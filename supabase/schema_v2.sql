-- ============================================================================
-- GAS — Supabase schema v2  (PostgreSQL)
-- ----------------------------------------------------------------------------
-- Copia de REFERENCIA del esquema ya aplicado al proyecto
--   ref: ftpgnimyjxlomjfdqfqy  (https://ftpgnimyjxlomjfdqfqy.supabase.co)
--
-- 11 tablas: clients, profiles, area_profiles, jobs, companies, contacts,
--            verifications, phones, job_events, company_url_cache,
--            verification_cache.
--
-- Espejo en TypeScript:  web/src/types/db.ts
-- Espejo en Pydantic:    worker/pipeline/models.py
-- Mantener los tres en sincronía. Este fichero es idempotente (re-ejecutable).
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ENUMs (máquina de estados y vocabularios controlados)
-- ----------------------------------------------------------------------------
do $$ begin
  create type job_status as enum
    ('queued','resolving','searching','verifying','enriching','done','error','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_status as enum
    ('pending','resolved','no_url','searching','done','no_result','error');
exception when duplicate_object then null; end $$;

do $$ begin
  -- pasada del Actor que produjo el contacto
  create type source_pass as enum ('A','B','fallback');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contact_classification as enum ('decisor','revisar');
exception when duplicate_object then null; end $$;

do $$ begin
  -- workflow de revisión humana
  create type contact_status as enum ('pending','approved','discarded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type resolution_method as enum
    ('provided','cache','domain_guess','serp','manual','llm_web','unresolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_method as enum ('heuristic','profile_rescrape','llm_web');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_verdict as enum ('confirmed','uncertain','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type robinson_status as enum ('unknown','clean','listed','error');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1.1) Feedback de validez post-llamada por contacto
-- ----------------------------------------------------------------------------
do $$ begin
  create type contact_feedback as enum ('valido','no_valido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type feedback_reason as enum
    ('ya_no_en_empresa','empresa_incorrecta','url_incorrecta','jubilado','no_es_decisor','otro');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1) clients  — los 7-8 clientes de delegación
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  active      boolean not null default true,
  settings    jsonb not null default '{}'::jsonb,   -- personalización: logo_url, brand_color, website, sector
  created_at  timestamptz not null default now()
);
-- Para BDs ya existentes (la tabla ya está creada), aplicar la columna con:
--   alter table public.clients add column if not exists settings jsonb not null default '{}'::jsonb;
-- (La policy "auth rw clients" (for all) ya permite el UPDATE de settings.)

-- ----------------------------------------------------------------------------
-- 2) profiles  — usuarios de la app (1:1 con auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'operator',   -- operator | admin
  client_id   uuid references public.clients(id) on delete set null,  -- null = ve todos
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3) area_profiles  — "el área es DATO". Parámetros Apify + reglas de clasif.
--    params (jsonb) p.ej:
--    {
--      "pass_a": { "jobTitles": [...] },
--      "pass_b": { "seniorityLevelIds": ["320","310"] },
--      "functionIds": ["13"],
--      "locations": ["Spain"],
--      "classify": { "include": [...], "exclude": [...], "strong": [...] }
--    }
-- ----------------------------------------------------------------------------
create table if not exists public.area_profiles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,        -- 'it', 'maximos', ...
  name        text not null,
  description text,
  params      jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4) jobs  — la unidad de trabajo / cola. Cuelga de clients y area_profiles.
-- ----------------------------------------------------------------------------
create table if not exists public.jobs (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references public.clients(id) on delete cascade,
  area_profile_id        uuid not null references public.area_profiles(id),
  backup_area_profile_id uuid references public.area_profiles(id),
  status                 job_status not null default 'queued',
  use_fixtures           boolean not null default false,
  reception_only         boolean not null default false,  -- true: worker solo recibe empresas y para
  -- contadores (se rellenan según avanza)
  total_companies        integer not null default 0,
  resolved_companies     integer not null default 0,
  total_contacts         integer not null default 0,
  decisor_count          integer not null default 0,
  revisar_count          integer not null default 0,
  no_result_count        integer not null default 0,
  -- salida
  result_path            text,            -- ruta del .xlsx en el bucket 'resultados'
  estimated_cost_usd     numeric(10,2),
  error_message          text,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_jobs_client  on public.jobs(client_id);
create index if not exists idx_jobs_status  on public.jobs(status);
-- el worker reclama el job 'queued' más antiguo:
create index if not exists idx_jobs_queue   on public.jobs(status, created_at);

-- ----------------------------------------------------------------------------
-- 5) companies  — input heterogéneo + resolución de URL + companyId canónico
-- ----------------------------------------------------------------------------
create table if not exists public.companies (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references public.jobs(id) on delete cascade,
  raw_input             text not null,        -- la línea original tal cual
  razon_social          text,
  cif                   text,
  domain                text,
  linkedin_url          text,
  resolution_method     resolution_method not null default 'unresolved',
  resolution_confidence numeric(4,3),         -- 0.000 .. 1.000
  linkedin_company_id   text,                 -- companyId canónico (anti-homónimos)
  status                company_status not null default 'pending',
  note                  text,                 -- nota accionable si 0 resultados
  created_at            timestamptz not null default now()
);
create index if not exists idx_companies_job on public.companies(job_id);

-- ----------------------------------------------------------------------------
-- 6) contacts  — los decisores/candidatos encontrados
-- ----------------------------------------------------------------------------
create table if not exists public.contacts (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs(id) on delete cascade,
  company_id          uuid not null references public.companies(id) on delete cascade,
  source_pass         source_pass not null,
  first_name          text,
  last_name           text,
  title               text,
  location            text,
  linkedin_url        text,
  company_linkedin_url text,
  classification      contact_classification not null default 'revisar',
  heuristic_score     numeric(4,3),
  verify_flag         text,                  -- p.ej. 'verificar_empresa'
  status              contact_status not null default 'pending',
  created_at          timestamptz not null default now(),
  -- feedback post-llamada (eje distinto de status de revisión)
  feedback            contact_feedback not null default 'valido',
  feedback_reason     feedback_reason,
  feedback_note       text,
  feedback_at         timestamptz,
  feedback_by         uuid references public.profiles(id)
);
create index if not exists idx_contacts_job     on public.contacts(job_id);
create index if not exists idx_contacts_company on public.contacts(company_id);
create index if not exists idx_contacts_status  on public.contacts(status);

-- ----------------------------------------------------------------------------
-- 7) verifications  — Paso 3 (STUB). 1 fila por método aplicado a un contacto.
-- ----------------------------------------------------------------------------
create table if not exists public.verifications (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  method      verification_method not null,
  verdict     verification_verdict not null,
  confidence  numeric(4,3),
  signal_json jsonb not null default '{}'::jsonb,
  cost        numeric(10,4) not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_verifications_contact on public.verifications(contact_id);

-- ----------------------------------------------------------------------------
-- 8) phones  — Paso 4 (STUB). Teléfono + cumplimiento RGPD.
-- ----------------------------------------------------------------------------
create table if not exists public.phones (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  number          text,
  type            text,                       -- mobile | landline | switchboard
  source          text,                       -- de dónde salió el número
  robinson_status robinson_status not null default 'unknown',
  legal_basis     text,                       -- base legal RGPD (interés legítimo, ...)
  created_at      timestamptz not null default now()
);
create index if not exists idx_phones_contact on public.phones(contact_id);

-- ----------------------------------------------------------------------------
-- 9) job_events  — bitácora de la máquina de estados
-- ----------------------------------------------------------------------------
create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs(id) on delete cascade,
  from_status job_status,
  to_status   job_status,
  message     text,
  payload     jsonb not null default '{}'::jsonb,  -- contadores, detalle
  created_at  timestamptz not null default now()
);
create index if not exists idx_job_events_job on public.job_events(job_id, created_at);

-- ----------------------------------------------------------------------------
-- 10) company_url_cache  — cachea la resolución input→URL para no repetir SERP
-- ----------------------------------------------------------------------------
create table if not exists public.company_url_cache (
  id                    uuid primary key default gen_random_uuid(),
  cache_key             text not null unique,   -- normalización del raw_input
  linkedin_url          text,
  linkedin_company_id   text,
  resolution_method     resolution_method not null default 'unresolved',
  resolution_confidence numeric(4,3),
  created_at            timestamptz not null default now(),
  expires_at            timestamptz
);

-- ----------------------------------------------------------------------------
-- 11) verification_cache  — cachea verificaciones caras por perfil
-- ----------------------------------------------------------------------------
create table if not exists public.verification_cache (
  id           uuid primary key default gen_random_uuid(),
  cache_key    text not null unique,   -- p.ej. linkedin_url del perfil + método
  method       verification_method not null,
  verdict      verification_verdict not null,
  confidence   numeric(4,3),
  signal_json  jsonb not null default '{}'::jsonb,
  cost         numeric(10,4) not null default 0,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);

-- ----------------------------------------------------------------------------
-- updated_at trigger para jobs
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-provisión de `profiles` al crear un usuario en auth.users.
-- Sin esto, `jobs.created_by → profiles(id)` viola la FK (la web pone created_by
-- = auth.uid() al crear un job, y debe existir la fila en profiles).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Storage bucket para los Excel de resultados
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resultados', 'resultados', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- RLS  (el worker usa service_role y la salta; la web usa anon/auth)
-- NOTA: políticas mínimas de ejemplo. Endurecer por client_id en producción.
-- ----------------------------------------------------------------------------
alter table public.clients        enable row level security;
alter table public.area_profiles  enable row level security;
alter table public.jobs           enable row level security;
alter table public.companies      enable row level security;
alter table public.contacts       enable row level security;
alter table public.job_events     enable row level security;
alter table public.verifications  enable row level security;
alter table public.phones         enable row level security;
alter table public.profiles       enable row level security;

-- Usuarios autenticados pueden leer catálogos y su trabajo.
do $$ begin
  create policy "auth read clients"       on public.clients       for select to authenticated using (true);
  create policy "auth rw clients"          on public.clients       for all    to authenticated using (true) with check (true);
  create policy "auth read area_profiles" on public.area_profiles for select to authenticated using (true);
  create policy "auth rw jobs"            on public.jobs          for all    to authenticated using (true) with check (true);
  create policy "auth rw companies"       on public.companies     for all    to authenticated using (true) with check (true);
  create policy "auth rw contacts"        on public.contacts      for all    to authenticated using (true) with check (true);
  create policy "auth read job_events"    on public.job_events    for select to authenticated using (true);
  create policy "self profile"            on public.profiles      for all    to authenticated using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- Storage: usuarios autenticados pueden descargar del bucket privado `resultados`.
do $$ begin
  create policy "auth read resultados" on storage.objects
    for select to authenticated using (bucket_id = 'resultados');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- SEED mínimo de catálogo (idempotente) — clientes y áreas de ejemplo.
-- Las claves de área ('it','maximos') las usa el worker y la CLI (--area it).
-- ============================================================================
insert into public.clients (name, slug) values
  ('Cliente Demo', 'demo')
on conflict (slug) do nothing;

insert into public.area_profiles (key, name, description, params) values
(
  'it',
  'Decisores IT (España)',
  'CIO/CTO/Head of IT/Director de Sistemas y equivalentes, ubicados en España.',
  $json$
  {
    "locations": ["Spain"],
    "pass_a": {
      "functionIds": ["13"],
      "seniorityLevelIds": ["310","300","220","210"]
    },
    "pass_b": {
      "jobTitles": ["CIO","CTO","Director de Sistemas","Director de IT",
        "Head of IT","IT Director","Director de Tecnología",
        "Responsable de Sistemas","Head of Digital Transformation",
        "Director de Transformación Digital","IT Manager"]
    },
    "classify": {
      "clevel_acr": ["cio","cto","ciso","cdo"],
      "clevel_phrases": ["chief information","chief technology","chief digital",
        "chief data","chief technical"],
      "exclude_words": ["ux"],
      "strong": ["director de sistemas","director de it","it director",
        "director it","head of it","director de tecnolog","responsable de sistemas",
        "responsable de it","responsable de tecnolog","it manager",
        "head of technology","head of engineering","head of data",
        "head of digital","head of infrastructure","head of platform",
        "director de transformaci","digital transformation","transformation",
        "information officer","technology officer","data officer",
        "sistemas de informaci","cybersecurity","seguridad de la informaci"],
      "exclude": ["consult","preventa","pre-sale","presale","sales","ventas",
        "comercial","account exec","account manager","marketing",
        "user experience","research","talent","human resources",
        "recursos humanos","recruit","business development","partnership",
        "alliance","procurement","compras","legal","finance","financ","contab"],
      "lead_words": ["director","manager","head","lead","responsable","jefe",
        "chief","vp"],
      "domain_acr": ["it","ti","sap","erp"],
      "domain_sub": ["information","tecnolog","technology","sistemas","data",
        "datos","digital","software","infraestructura","infrastructure",
        "cyber","seguridad","platform","engineering","ingenier"]
    }
  }
  $json$::jsonb
),
(
  'maximos',
  'Máximos decisores (España)',
  'CEO/Director General/Fundador/Dueño/Consejero Delegado — la cúpula de la empresa.',
  $json$
  {
    "locations": ["Spain"],
    "pass_a": {
      "jobTitles": ["CEO","Chief Executive Officer","Director Ejecutivo",
        "Director General","Managing Director","Director Gerente",
        "Consejero Delegado","Founder","Co-Founder","Cofounder","Fundador",
        "Owner","Propietario","Dueño","President","Presidente",
        "Presidente Ejecutivo","Administrador Único"]
    },
    "pass_b": {
      "seniorityLevelIds": ["320","310"]
    },
    "classify": {
      "exec_phrases": ["chief executive","director ejecutivo","director general",
        "direccion general","dirección general","director gerente",
        "managing director","consejero delegado","consejera delegada","founder",
        "co-founder","cofounder","fundador","owner","propietari","dueñ",
        "presidente ejecutivo","executive chairman","executive president",
        "administrador unico","administrador único"],
      "exec_acr": ["ceo","founder","cofounder","owner"],
      "unit_exclude": ["franquicia","franchise","franquiciad","de tienda",
        " tienda","store manager","shop manager","store director","encargad",
        "punto de venta"],
      "passive_exclude": ["consejero independiente","consejero externo",
        "consejero no ejecutivo","miembro del consejo","vocal","board member",
        "non-executive","no ejecutivo","presidente del consejo",
        "chairman of the board","accionista","socio capitalista",
        "business angel","venture partner"],
      "passive_acr": ["accionista","shareholder","inversor","investor",
        "consejero","consejera"],
      "not_top_acr": ["cto","cfo","cmo","coo","cio","ciso","cdo","vp"],
      "not_top_phrases": ["chief technology","chief financial","chief marketing",
        "chief operating","head of","responsable de","deputy","adjunto",
        "vice president","vice-president","vicepresiden"]
    }
  }
  $json$::jsonb
),
(
  'rrhh',
  'Decisores RRHH (España)',
  'CHRO/Director de RRHH/Head of People/Director de Talento y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "12"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CHRO",
        "Chief People Officer",
        "Director de Recursos Humanos",
        "Director de RRHH",
        "HR Director",
        "Head of HR",
        "Head of People",
        "Director de Personas",
        "Director de Talento",
        "People & Culture Director",
        "Responsable de Recursos Humanos",
        "HR Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "chro"
      ],
      "clevel_phrases": [
        "chief people",
        "chief human resources",
        "chief hr",
        "chief talent"
      ],
      "strong": [
        "director de recursos humanos",
        "director de rrhh",
        "directora de recursos humanos",
        "directora de rrhh",
        "hr director",
        "director of hr",
        "head of hr",
        "head of people",
        "people director",
        "director de personas",
        "responsable de recursos humanos",
        "responsable de rrhh",
        "director de talento",
        "head of talent",
        "people & culture",
        "people and culture",
        "director de gestión de personas",
        "director de gestion de personas",
        "human resources director",
        "director de desarrollo de personas"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "finance",
        "financ",
        "contab",
        "legal",
        "jurídic",
        "juridic",
        "compras",
        "procurement",
        "purchasing",
        "operaciones",
        "operations",
        "logístic",
        "logistic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "rrhh",
        "rh",
        "hr",
        "hrbp"
      ],
      "domain_sub": [
        "recursos humanos",
        "personas",
        "talento",
        "talent",
        "people",
        "selección",
        "seleccion",
        "formación",
        "formacion",
        "relaciones laborales",
        "nómina",
        "nomina",
        "cultura",
        "people & culture"
      ]
    }
  }
  $json$::jsonb
),
(
  'financiero',
  'Decisores Financiero (España)',
  'CFO/Director Financiero/Director de Finanzas/Controller y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "10"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CFO",
        "Chief Financial Officer",
        "Director Financiero",
        "Director de Finanzas",
        "Finance Director",
        "Head of Finance",
        "Director Administrativo Financiero",
        "Director Económico Financiero",
        "Financial Controller",
        "Controller",
        "Responsable Financiero"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cfo"
      ],
      "clevel_phrases": [
        "chief financial",
        "chief finance"
      ],
      "strong": [
        "director financiero",
        "director de finanzas",
        "finance director",
        "head of finance",
        "director administrativo financiero",
        "director económico financiero",
        "director economico financiero",
        "director de administración y finanzas",
        "director de administracion y finanzas",
        "financial controller",
        "controller",
        "director de control de gestión",
        "director de control de gestion",
        "responsable financiero",
        "vp finance",
        "director de contabilidad",
        "director de tesorería",
        "director de tesoreria",
        "finance officer"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "recursos humanos",
        "rrhh",
        "recruit",
        "talent",
        "legal",
        "jurídic",
        "juridic",
        "compras",
        "procurement",
        "purchasing",
        "operaciones",
        "operations",
        "logístic",
        "logistic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "fp&a",
        "fpa"
      ],
      "domain_sub": [
        "financ",
        "finanzas",
        "contab",
        "tesorer",
        "fiscal",
        "control de gestión",
        "control de gestion",
        "auditor",
        "administración y finanzas",
        "administracion y finanzas",
        "económico financiero",
        "economico financiero",
        "accounting"
      ]
    }
  }
  $json$::jsonb
),
(
  'operaciones',
  'Decisores Operaciones (España)',
  'COO/Director de Operaciones/Director Industrial/Supply Chain y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "18"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "COO",
        "Chief Operating Officer",
        "Director de Operaciones",
        "Operations Director",
        "Head of Operations",
        "Director Industrial",
        "Director de Planta",
        "Director de Producción",
        "Director de Logística",
        "Supply Chain Director",
        "Responsable de Operaciones",
        "Operations Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "coo"
      ],
      "clevel_phrases": [
        "chief operating",
        "chief operations"
      ],
      "strong": [
        "director de operaciones",
        "operations director",
        "head of operations",
        "director industrial",
        "director de planta",
        "plant director",
        "director de producción",
        "director de produccion",
        "director de fábrica",
        "director de fabrica",
        "director de logística",
        "director de logistica",
        "supply chain director",
        "head of supply chain",
        "director de cadena de suministro",
        "responsable de operaciones",
        "vp operations",
        "operations manager",
        "director de supply chain",
        "operations officer"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "recruit",
        "talent",
        "legal",
        "jurídic",
        "juridic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "scm",
        "s&op"
      ],
      "domain_sub": [
        "operacion",
        "operations",
        "producción",
        "produccion",
        "planta",
        "fábrica",
        "fabrica",
        "industrial",
        "logístic",
        "logistic",
        "supply chain",
        "cadena de suministro",
        "manufactura",
        "manufacturing",
        "almacén",
        "almacen",
        "aprovisionamiento",
        "distribución",
        "distribucion"
      ]
    }
  }
  $json$::jsonb
),
(
  'ventas',
  'Decisores Ventas (España)',
  'CRO/Director Comercial/Director de Ventas/Business Development y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "25"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CRO",
        "Chief Revenue Officer",
        "Director Comercial",
        "Director de Ventas",
        "Sales Director",
        "Head of Sales",
        "VP Sales",
        "Director de Desarrollo de Negocio",
        "Business Development Director",
        "Country Manager",
        "Responsable Comercial",
        "Sales Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cro",
        "cco"
      ],
      "clevel_phrases": [
        "chief revenue",
        "chief sales",
        "chief commercial"
      ],
      "strong": [
        "director comercial",
        "director de ventas",
        "sales director",
        "head of sales",
        "vp sales",
        "vp of sales",
        "director de desarrollo de negocio",
        "business development director",
        "director de negocio",
        "responsable comercial",
        "country manager",
        "director comercial y marketing",
        "key account director",
        "regional sales director",
        "national sales manager",
        "director de expansión",
        "director de expansion",
        "sales manager",
        "director de grandes cuentas",
        "revenue officer"
      ],
      "exclude": [
        "account manager",
        "account exec",
        "account executive",
        "ejecutivo de cuentas",
        "sales representative",
        "sales rep",
        "representante",
        "preventa",
        "presale",
        "pre-sale",
        "store manager",
        "tienda",
        "dependient",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "legal",
        "compras",
        "procurement",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "b2b",
        "b2c"
      ],
      "domain_sub": [
        "ventas",
        "comercial",
        "sales",
        "desarrollo de negocio",
        "business development",
        "grandes cuentas",
        "key account",
        "revenue",
        "go-to-market",
        "expansión",
        "expansion",
        "canal"
      ]
    }
  }
  $json$::jsonb
),
(
  'marketing',
  'Decisores Marketing (España)',
  'CMO/Director de Marketing/Director de Comunicación/Head of Growth y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "15"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CMO",
        "Chief Marketing Officer",
        "Director de Marketing",
        "Marketing Director",
        "Head of Marketing",
        "Director de Comunicación",
        "Head of Communications",
        "Director de Marca",
        "Director de Marketing Digital",
        "Head of Growth",
        "Responsable de Marketing",
        "Marketing Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cmo"
      ],
      "clevel_phrases": [
        "chief marketing",
        "chief brand",
        "chief growth"
      ],
      "strong": [
        "director de marketing",
        "marketing director",
        "head of marketing",
        "director de comunicación",
        "director de comunicacion",
        "head of communications",
        "director de marca",
        "brand director",
        "director de marketing digital",
        "head of growth",
        "growth director",
        "responsable de marketing",
        "director de marketing y comunicación",
        "director de marketing y comunicacion",
        "vp marketing",
        "director de publicidad",
        "director de contenidos",
        "demand generation",
        "marketing officer"
      ],
      "exclude": [
        "community manager",
        "social media specialist",
        "content creator",
        "copywriter",
        "diseñador",
        "disenador",
        "designer",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "legal",
        "compras",
        "procurement",
        "operaciones",
        "operations",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "seo",
        "sem",
        "ppc",
        "crm"
      ],
      "domain_sub": [
        "marketing",
        "comunicación",
        "comunicacion",
        "marca",
        "brand",
        "publicidad",
        "growth",
        "contenidos",
        "content",
        "demanda",
        "demand",
        "redes sociales",
        "social media",
        "captación",
        "captacion",
        "adquisición",
        "adquisicion"
      ]
    }
  }
  $json$::jsonb
),
(
  'compras',
  'Decisores Compras (España)',
  'CPO/Director de Compras/Head of Procurement/Director de Sourcing y equivalentes, en España.',
  $json$
  {
    "locations": [
      "Spain"
    ],
    "pass_a": {
      "functionIds": [
        "21"
      ],
      "seniorityLevelIds": [
        "310",
        "300",
        "220",
        "210"
      ]
    },
    "pass_b": {
      "jobTitles": [
        "CPO",
        "Chief Procurement Officer",
        "Director de Compras",
        "Purchasing Director",
        "Head of Procurement",
        "Director de Aprovisionamiento",
        "Strategic Sourcing Director",
        "Director de Sourcing",
        "Responsable de Compras",
        "Procurement Manager",
        "Purchasing Manager"
      ]
    },
    "classify": {
      "clevel_acr": [
        "cpo"
      ],
      "clevel_phrases": [
        "chief procurement",
        "chief purchasing"
      ],
      "strong": [
        "director de compras",
        "purchasing director",
        "head of procurement",
        "director de aprovisionamiento",
        "strategic sourcing director",
        "director de sourcing",
        "responsable de compras",
        "procurement manager",
        "purchasing manager",
        "head of purchasing",
        "director de procurement",
        "vp procurement",
        "category director",
        "director de categoría",
        "director de categoria",
        "procurement officer",
        "director de compras y logística"
      ],
      "exclude": [
        "sales",
        "ventas",
        "comercial",
        "marketing",
        "finance",
        "financ",
        "contab",
        "recursos humanos",
        "rrhh",
        "recruit",
        "talent",
        "legal",
        "jurídic",
        "juridic",
        "sistemas",
        "tecnolog"
      ],
      "lead_words": [
        "director",
        "directora",
        "manager",
        "head",
        "lead",
        "responsable",
        "jefe",
        "jefa",
        "chief",
        "vp"
      ],
      "domain_acr": [
        "mro"
      ],
      "domain_sub": [
        "compras",
        "aprovisionamiento",
        "procurement",
        "purchasing",
        "sourcing",
        "abastecimiento",
        "category",
        "categoría",
        "categoria",
        "proveedores",
        "supply"
      ]
    }
  }
  $json$::jsonb
)
on conflict (key) do update set params = excluded.params, name = excluded.name,
  description = excluded.description;
