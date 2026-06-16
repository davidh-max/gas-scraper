// Datos de ejemplo del modo MockData. Reproducen el set del diseño
// (GAS Scraper.dc.html) para que la interfaz se vea como en los screenshots:
// 5 clientes, 9 jobs en estados distintos (incluido done y searching) y una
// bandeja de revisión con motivos variados.
//
// El estado mutable vive en `globalThis` (no en variables de módulo): en Next,
// los Server Components y los Server Actions corren en capas de bundle distintas
// y NO comparten el estado de módulo. Cachearlo en globalThis garantiza que las
// escrituras (crear cliente/job, aprobar/descartar, feedback) las vean las
// lecturas. Un reinicio del server resetea la demo.

import type {
  AreaProfileRow,
  Classification,
  ClientRow,
  CompanyRow,
  ContactFeedback,
  ContactRow,
  ContactStatus,
  FeedbackReason,
  JobRow,
  SourcePass,
} from "@/types/db";
import { reviewReason, type JobContact, type NoResultCompany, type ReviewContact } from "./source";

export interface MockStore {
  clients: ClientRow[];
  areas: AreaProfileRow[];
  jobs: JobRow[];
  contacts: JobContact[];
  noresults: NoResultCompany[];
}

interface MockJobInput {
  id: string;
  client_id: string;
  area_profile_id: string;
  backup_area_profile_id: string | null;
  status: JobRow["status"];
  total: number;
  resolved: number;
  ok: number;
  revisar: number;
  sin: number;
  hoursAgo: number;
}

const H = 3_600_000;
const FIRSTS = [
  "Alberto", "Rosa", "Ignacio", "Carmen", "Pablo", "Teresa", "Marta", "Óscar", "Lucía", "Javier",
  "Nuria", "Diego", "Elena", "Andrés", "Sonia", "Luis", "Cristina", "Fernando", "Ana", "Víctor",
];
const LASTS = [
  "Cifuentes", "Madariaga", "Solé", "Vidal", "Errazquin", "Goñi", "Beltrán", "Pidal", "Andrade",
  "Reus", "Sáez", "Carralero", "Quirós", "Delgado", "Molina", "Ibáñez", "Ferrer", "Ramos", "Vega", "Cano",
];
const COMPANY_NAMES = [
  "Naviera Costa Brava S.A.", "Astilleros del Atlántico SL", "Pesca y Congelados Morrazo",
  "Conservas Ría de Vigo", "Transportes Bahía Norte", "Frigoríficos Cantábrico", "Cerámicas Levantinas",
  "Distribuciones Norte", "Hoteles Marina Plaza", "Bodegas Ribera Alta", "Náutica Pereira",
  "Inmobiliaria Vallés", "TecnoBalear Software", "Grupo Hostelero Sol", "Naviera Cantábrica",
  "Transgrúas del Sur S.L.", "Aceites del Sur", "Lácteos del Pirineo", "Construcciones Mares",
  "Energía Solar del Mediterráneo",
];
const DECISOR_TITLES = [
  "Director General", "CEO", "Consejero Delegado", "Gerente", "Directora General",
  "Administrador Único", "CEO & Founder", "Director de Operaciones", "Country Manager",
  "Presidente Ejecutivo", "Socio Director",
];
const REVISAR_TITLES = [
  "Head of IT", "Responsable de Sistemas", "Director Financiero", "People & Talent Lead",
  "Responsable de Compras", "Directora de Marketing", "Head of Digital", "Gerente de Proyecto",
  "Director de RRHH", "Chief of Staff",
];
const REASONS: FeedbackReason[] = [
  "ya_no_en_empresa", "empresa_incorrecta", "url_incorrecta", "jubilado", "no_es_decisor", "otro",
];

let _contactCounter = 0;

function buildStore(): MockStore {
  const base = Date.now();
  const iso = (hoursAgo: number): string => new Date(base - hoursAgo * H).toISOString();

  const makeJob = (j: MockJobInput): JobRow => ({
    id: j.id,
    client_id: j.client_id,
    area_profile_id: j.area_profile_id,
    backup_area_profile_id: j.backup_area_profile_id,
    status: j.status,
    use_fixtures: false,
    reception_only: false,
    total_companies: j.total,
    resolved_companies: j.resolved,
    total_contacts: j.ok + j.revisar,
    decisor_count: j.ok,
    revisar_count: j.revisar,
    no_result_count: j.sin,
    result_path: j.status === "done" ? `mock/${j.id}.xlsx` : null,
    estimated_cost_usd: Math.round(j.total * 6 * 1.5 * 0.004 * 100) / 100,
    error_message: j.status === "error" ? "Fallo al resolver URLs (demo)" : null,
    created_by: "demo",
    created_at: iso(j.hoursAgo),
    updated_at: iso(Math.max(0, j.hoursAgo - 1)),
  });

  const jobs = [
    makeJob({ id: "j1", client_id: "naviera", area_profile_id: "max", backup_area_profile_id: "fin", status: "searching", total: 241, resolved: 187, ok: 184, revisar: 26, sin: 31, hoursAgo: 0 }),
    makeJob({ id: "j2", client_id: "naviera", area_profile_id: "it", backup_area_profile_id: null, status: "done", total: 96, resolved: 96, ok: 71, revisar: 9, sin: 16, hoursAgo: 66 }),
    makeJob({ id: "j6", client_id: "tecnobalear", area_profile_id: "it", backup_area_profile_id: "max", status: "searching", total: 80, resolved: 34, ok: 34, revisar: 5, sin: 6, hoursAgo: 1 }),
    makeJob({ id: "j3", client_id: "solhost", area_profile_id: "compras", backup_area_profile_id: "max", status: "queued", total: 150, resolved: 0, ok: 0, revisar: 0, sin: 0, hoursAgo: 2 }),
    makeJob({ id: "j5", client_id: "valles", area_profile_id: "max", backup_area_profile_id: "fin", status: "done", total: 120, resolved: 120, ok: 88, revisar: 14, sin: 18, hoursAgo: 17 }),
    makeJob({ id: "j4", client_id: "solhost", area_profile_id: "rrhh", backup_area_profile_id: null, status: "done", total: 64, resolved: 64, ok: 48, revisar: 7, sin: 9, hoursAgo: 50 }),
    makeJob({ id: "j7", client_id: "tecnobalear", area_profile_id: "fin", backup_area_profile_id: null, status: "error", total: 52, resolved: 12, ok: 0, revisar: 0, sin: 0, hoursAgo: 120 }),
    makeJob({ id: "j8", client_id: "ribera", area_profile_id: "rrhh", backup_area_profile_id: "compras", status: "done", total: 38, resolved: 38, ok: 29, revisar: 4, sin: 5, hoursAgo: 140 }),
    makeJob({ id: "j9", client_id: "valles", area_profile_id: "compras", backup_area_profile_id: null, status: "queued", total: 73, resolved: 0, ok: 0, revisar: 0, sin: 0, hoursAgo: 4 }),
  ];

  const contacts: JobContact[] = [];
  const noresults: NoResultCompany[] = [];

  const fmtSlug = (s: string): string =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 28);

  const sourceFor = (idx: number): SourcePass => {
    if (idx % 7 === 0) return "fallback";
    return idx % 3 === 0 ? "B" : "A";
  };

  const generateNoResults = (job: JobRow, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const companyId = `co-nr-${job.id}-${i}`;
      const companyName = COMPANY_NAMES[(i + job.total_companies) % COMPANY_NAMES.length];
      noresults.push({
        companyId,
        name: `${companyName} (sin contacto)`,
        note: i % 4 === 0 ? "Empresa demasiado pequeña o sin presencia en LinkedIn" : null,
      });
    }
  };

  const generateContacts = (job: JobRow, classification: Classification, count: number) => {
    const pickReason = (idx: number): FeedbackReason => REASONS[idx % REASONS.length] as FeedbackReason;
    const pickFirst = (idx: number): string => FIRSTS[idx % FIRSTS.length] ?? "Anónimo";
    const pickLast = (idx: number): string => LASTS[(idx * 3) % LASTS.length] ?? "Sin apellido";
    const pickTitle = (idx: number): string =>
      classification === "decisor"
        ? (DECISOR_TITLES[idx % DECISOR_TITLES.length] ?? "Directivo")
        : (REVISAR_TITLES[idx % REVISAR_TITLES.length] ?? "Responsable");
    const pickCompany = (idx: number): string =>
      COMPANY_NAMES[(idx + job.total_companies * 2) % COMPANY_NAMES.length] ?? "Empresa";

    for (let i = 0; i < count; i += 1) {
      const globalIdx = _contactCounter++;
      const first = pickFirst(globalIdx);
      const last = pickLast(globalIdx);
      const title = pickTitle(globalIdx);
      const companyName = pickCompany(globalIdx);
      const companyId = `co-${job.id}-${globalIdx}`;
      const linkedin = `https://www.linkedin.com/in/${fmtSlug(`${first}-${last}-${globalIdx}`)}`;
      const sourcePass = sourceFor(globalIdx);
      const hasFeedback = globalIdx % 3 === 0; // ~33% con feedback
      const isInvalid = hasFeedback && globalIdx % 11 === 0; // ~9% de erróneos dentro del feedback
      const feedback: ContactFeedback = hasFeedback ? (isInvalid ? "no_valido" : "valido") : "valido";
      const reason: FeedbackReason | null = feedback === "no_valido" ? pickReason(globalIdx) : null;
      const note: string | null = reason === "otro" ? "No encaja con el perfil solicitado" : null;
      const feedbackAt: string | null = hasFeedback
        ? new Date(base - ((globalIdx % 48) + 1) * 60_000).toISOString()
        : null;
      const status: ContactStatus =
        classification === "revisar" && globalIdx % 2 === 0 ? "pending" : "approved";
      const verifyFlag = classification === "revisar" && globalIdx % 5 === 0 ? "verificar_empresa" : null;

      contacts.push({
        id: `c-${job.id}-${globalIdx}`,
        job_id: job.id,
        company_id: companyId,
        source_pass: sourcePass,
        first_name: first,
        last_name: last,
        title,
        location: "España",
        linkedin_url: linkedin,
        company_linkedin_url: null,
        classification,
        heuristic_score: classification === "decisor" ? 0.85 : 0.55,
        verify_flag: verifyFlag,
        status,
        feedback,
        feedback_reason: reason,
        feedback_note: note,
        feedback_at: feedbackAt,
        feedback_by: hasFeedback ? "demo" : null,
        created_at: new Date(base - job.total_companies * 60_000 - globalIdx * 1_000).toISOString(),
        companyName,
      });
    }
  };

  for (const job of jobs) {
    if (job.decisor_count > 0) generateContacts(job, "decisor", job.decisor_count);
    if (job.revisar_count > 0) generateContacts(job, "revisar", job.revisar_count);
    if (job.no_result_count > 0) generateNoResults(job, job.no_result_count);
  }

  return {
    clients: [
      { id: "naviera", name: "Naviera Cantábrica", slug: "naviera-cantabrica", active: true, settings: { brand_color: "#0A4D8C", sector: "Transporte marítimo", website: "naviera-cantabrica.es" }, created_at: iso(720) },
      { id: "solhost", name: "Grupo Hostelero Sol", slug: "grupo-hostelero-sol", active: true, settings: { brand_color: "#E8550A", sector: "Hostelería" }, created_at: iso(700) },
      { id: "valles", name: "Inmobiliaria Vallés", slug: "inmobiliaria-valles", active: true, settings: { sector: "Inmobiliaria" }, created_at: iso(650) },
      { id: "tecnobalear", name: "TecnoBalear Software", slug: "tecnobalear-software", active: true, settings: { brand_color: "#00B8D9", sector: "Software", website: "tecnobalear.com" }, created_at: iso(600) },
      { id: "ribera", name: "Bodegas Ribera Alta", slug: "bodegas-ribera-alta", active: true, settings: { sector: "Alimentación y bebidas" }, created_at: iso(540) },
    ],
    areas: [
      { id: "max", key: "max", name: "Máximo ejecutivo", description: "CEO, director general, fundador, dueño", params: {}, active: true, created_at: iso(900) },
      { id: "it", key: "it", name: "IT / Sistemas", description: "CIO, CTO, Head of IT, Director de Sistemas", params: {}, active: true, created_at: iso(900) },
      { id: "fin", key: "fin", name: "Financiero", description: "CFO, Director Financiero", params: {}, active: true, created_at: iso(900) },
      { id: "rrhh", key: "rrhh", name: "RRHH", description: "Director de Personas / Talento", params: {}, active: true, created_at: iso(900) },
      { id: "compras", key: "compras", name: "Compras", description: "Director de Compras / Procurement", params: {}, active: true, created_at: iso(900) },
      { id: "mkt", key: "mkt", name: "Marketing", description: "CMO, Director de Marketing", params: {}, active: true, created_at: iso(900) },
      { id: "ops", key: "ops", name: "Operaciones", description: "COO, Director de Operaciones", params: {}, active: true, created_at: iso(900) },
      { id: "ventas", key: "ventas", name: "Ventas / Comercial", description: "CRO, Director Comercial / de Ventas", params: {}, active: true, created_at: iso(900) },
    ],
    jobs,
    contacts,
    noresults,
  };
}

// Singleton compartido entre capas (RSC y Server Actions) vía globalThis.
const globalRef = globalThis as typeof globalThis & { __gasMockStore__?: MockStore };

export function getMockStore(): MockStore {
  if (!globalRef.__gasMockStore__) globalRef.__gasMockStore__ = buildStore();
  return globalRef.__gasMockStore__;
}

export function asReviewContact(contact: JobContact): ReviewContact {
  return { ...contact, reason: reviewReason(contact) };
}

// Previsualización del Excel (estática) para la vista de descarga en modo demo.
export const mockExcelPreview: { nombre: string; cargo: string; empresa: string; linkedin: string }[] = [
  { nombre: "Alberto Cifuentes", cargo: "Director General", empresa: "Naviera Costa Brava S.A.", linkedin: "in/alberto-cifuentes" },
  { nombre: "Rosa Madariaga", cargo: "CEO", empresa: "Astilleros del Atlántico SL", linkedin: "in/rosa-madariaga" },
  { nombre: "Ignacio Solé", cargo: "Consejero Delegado", empresa: "Pesca y Congelados Morrazo", linkedin: "in/ignacio-sole" },
  { nombre: "Carmen Vidal", cargo: "Directora General", empresa: "Conservas Ría de Vigo", linkedin: "in/carmen-vidal" },
  { nombre: "Pablo Errazquin", cargo: "Gerente", empresa: "Transportes Bahía Norte", linkedin: "in/pablo-errazquin" },
  { nombre: "Teresa Goñi", cargo: "Administradora Única", empresa: "Frigoríficos Cantábrico", linkedin: "in/teresa-goni" },
];
