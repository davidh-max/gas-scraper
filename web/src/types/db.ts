// Tipos espejo de `supabase/schema_v2.sql`.
// Mantener en sincronía con el esquema SQL y con worker/pipeline/models.py.

// --------------------------------------------------------------------- enums
export type ContactFeedback = "valido" | "no_valido";
export type FeedbackReason =
  | "ya_no_en_empresa"
  | "empresa_incorrecta"
  | "url_incorrecta"
  | "jubilado"
  | "no_es_decisor"
  | "otro";

export type JobStatus =
  | "queued"
  | "resolving"
  | "searching"
  | "verifying"
  | "enriching" // legado (Paso 4 descartado): no se transita ni se muestra; ver JOB_STATUS_FLOW
  | "done"
  | "error"
  | "cancelled";

export type CompanyStatus =
  | "pending"
  | "resolved"
  | "no_url"
  | "searching"
  | "done"
  | "no_result"
  | "error";

export type SourcePass = "A" | "B" | "fallback";
export type Classification = "decisor" | "revisar";
export type ContactStatus = "pending" | "approved" | "discarded";
export type ResolutionMethod =
  | "provided"
  | "cache"
  | "domain_guess"
  | "serp"
  | "manual"
  | "llm_web"
  | "unresolved";
export type VerificationMethod = "heuristic" | "profile_rescrape" | "llm_web";
export type VerificationVerdict = "confirmed" | "uncertain" | "rejected";
export type RobinsonStatus = "unknown" | "clean" | "listed" | "error";

// La máquina de estados visible al usuario (orden de progreso).
// `enriching` (Paso 4, teléfono) está descartado: el flujo va verifying → done. El
// valor sigue en el enum `JobStatus` (y en el enum SQL) como legado, pero no se muestra.
export const JOB_STATUS_FLOW: JobStatus[] = [
  "queued",
  "resolving",
  "searching",
  "verifying",
  "done",
];

// --------------------------------------------------------------------- rows
// Personalización por cliente — se guarda en la columna jsonb `clients.settings`.
// Todo opcional; un cliente recién creado tiene `{}`.
export interface ClientSettings {
  logo_url?: string | null;
  brand_color?: string | null;
  website?: string | null;
  sector?: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  settings: ClientSettings;
  created_at: string;
}

export interface AreaProfileRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  params: Record<string, unknown>;
  active: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  client_id: string | null;
  created_at: string;
}

export interface JobRow {
  id: string;
  client_id: string;
  area_profile_id: string;
  backup_area_profile_id: string | null;
  status: JobStatus;
  use_fixtures: boolean;
  reception_only: boolean;
  total_companies: number;
  resolved_companies: number;
  total_contacts: number;
  decisor_count: number;
  revisar_count: number;
  no_result_count: number;
  result_path: string | null;
  estimated_cost_usd: number | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyRow {
  id: string;
  job_id: string;
  raw_input: string;
  razon_social: string | null;
  cif: string | null;
  domain: string | null;
  linkedin_url: string | null;
  resolution_method: ResolutionMethod;
  resolution_confidence: number | null;
  linkedin_company_id: string | null;
  status: CompanyStatus;
  note: string | null;
  created_at: string;
}

export interface ContactRow {
  id: string;
  job_id: string;
  company_id: string;
  source_pass: SourcePass;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  location: string | null;
  linkedin_url: string | null;
  company_linkedin_url: string | null;
  classification: Classification;
  heuristic_score: number | null;
  verify_flag: string | null;
  status: ContactStatus;
  feedback: ContactFeedback;
  feedback_reason: FeedbackReason | null;
  feedback_note: string | null;
  feedback_at: string | null;
  feedback_by: string | null;
  created_at: string;
}

export interface JobEventRow {
  id: string;
  job_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus | null;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

// Paso 3/4 (stubs): tablas creadas, sin uso en la web todavía. Aquí por completitud
// del espejo del esquema.
export interface VerificationRow {
  id: string;
  contact_id: string;
  method: VerificationMethod;
  verdict: VerificationVerdict;
  confidence: number | null;
  signal_json: Record<string, unknown>;
  cost: number;
  created_at: string;
}

export interface PhoneRow {
  id: string;
  contact_id: string;
  number: string | null;
  type: string | null;
  source: string | null;
  robinson_status: RobinsonStatus;
  legal_basis: string | null;
  created_at: string;
}

export interface CompanyUrlCacheRow {
  id: string;
  cache_key: string;
  linkedin_url: string | null;
  linkedin_company_id: string | null;
  resolution_method: ResolutionMethod;
  resolution_confidence: number | null;
  created_at: string;
  expires_at: string | null;
}

export interface VerificationCacheRow {
  id: string;
  cache_key: string;
  method: VerificationMethod;
  verdict: VerificationVerdict;
  confidence: number | null;
  signal_json: Record<string, unknown>;
  cost: number;
  created_at: string;
  expires_at: string | null;
}

// --------------------------------------------------------------------- inserts
export type JobInsert = {
  client_id: string;
  area_profile_id: string;
  backup_area_profile_id?: string | null;
  status?: JobStatus;
  use_fixtures?: boolean;
  reception_only?: boolean;
  total_companies?: number;
  estimated_cost_usd?: number | null;
  created_by?: string | null;
};

export type ClientInsert = {
  name: string;
  slug: string;
  active?: boolean;
};

export type CompanyInsert = {
  job_id: string;
  raw_input: string;
  razon_social?: string | null;
  cif?: string | null;
  domain?: string | null;
  linkedin_url?: string | null;
};

// --------------------------------------------------------------------- Database
// Forma que consume `createBrowserClient<Database>` / `createServerClient<Database>`.
type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      clients: Table<ClientRow, Partial<ClientRow>>;
      area_profiles: Table<AreaProfileRow, Partial<AreaProfileRow>>;
      profiles: Table<ProfileRow, Partial<ProfileRow>>;
      jobs: Table<JobRow, JobInsert>;
      companies: Table<CompanyRow, CompanyInsert>;
      contacts: Table<ContactRow, Partial<ContactRow>>;
      job_events: Table<JobEventRow, Partial<JobEventRow>>;
      verifications: Table<VerificationRow, Partial<VerificationRow>>;
      phones: Table<PhoneRow, Partial<PhoneRow>>;
      company_url_cache: Table<CompanyUrlCacheRow, Partial<CompanyUrlCacheRow>>;
      verification_cache: Table<VerificationCacheRow, Partial<VerificationCacheRow>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Enums: {
      job_status: JobStatus;
      company_status: CompanyStatus;
      source_pass: SourcePass;
      contact_classification: Classification;
      contact_status: ContactStatus;
      contact_feedback: ContactFeedback;
      feedback_reason: FeedbackReason;
      resolution_method: ResolutionMethod;
      verification_method: VerificationMethod;
      verification_verdict: VerificationVerdict;
      robinson_status: RobinsonStatus;
    };
  };
}
