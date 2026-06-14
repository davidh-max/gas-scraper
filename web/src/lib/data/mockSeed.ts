// Datos de ejemplo del modo MockData. Reproducen el set del diseño
// (GAS Scraper.dc.html) para que la interfaz se vea como en los screenshots:
// 5 clientes, 9 jobs en estados distintos (incluido done y searching) y una
// bandeja de revisión con motivos variados.
//
// El estado mutable vive en `globalThis` (no en variables de módulo): en Next,
// los Server Components y los Server Actions corren en capas de bundle distintas
// y NO comparten el estado de módulo. Cachearlo en globalThis garantiza que las
// escrituras (crear cliente/job, aprobar/descartar) las vean las lecturas. Un
// reinicio del server resetea la demo.

import type { AreaProfileRow, ClientRow, JobRow } from "@/types/db";
import type { ReviewContact } from "./source";

export interface MockStore {
  clients: ClientRow[];
  areas: AreaProfileRow[];
  jobs: JobRow[];
  review: ReviewContact[];
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

interface MockReviewInput {
  id: string;
  first: string;
  last: string;
  title: string;
  company: string;
  linkedin: string;
  reason: string;
}

function buildStore(): MockStore {
  const H = 3_600_000;
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

  const makeReview = (r: MockReviewInput): ReviewContact => ({
    id: r.id,
    job_id: "j1",
    company_id: `co-${r.id}`,
    source_pass: "A",
    first_name: r.first,
    last_name: r.last,
    title: r.title,
    location: "España",
    linkedin_url: `https://www.linkedin.com/${r.linkedin}`,
    company_linkedin_url: null,
    classification: "revisar",
    heuristic_score: 0.5,
    verify_flag: null,
    status: "pending",
    created_at: iso(2),
    companyName: r.company,
    reason: r.reason,
  });

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
    ],
    jobs: [
      makeJob({ id: "j1", client_id: "naviera", area_profile_id: "max", backup_area_profile_id: "fin", status: "searching", total: 241, resolved: 187, ok: 184, revisar: 26, sin: 31, hoursAgo: 0 }),
      makeJob({ id: "j2", client_id: "naviera", area_profile_id: "it", backup_area_profile_id: null, status: "done", total: 96, resolved: 96, ok: 71, revisar: 9, sin: 16, hoursAgo: 66 }),
      makeJob({ id: "j6", client_id: "tecnobalear", area_profile_id: "it", backup_area_profile_id: "max", status: "searching", total: 80, resolved: 34, ok: 34, revisar: 5, sin: 6, hoursAgo: 1 }),
      makeJob({ id: "j3", client_id: "solhost", area_profile_id: "compras", backup_area_profile_id: "max", status: "queued", total: 150, resolved: 0, ok: 0, revisar: 0, sin: 0, hoursAgo: 2 }),
      makeJob({ id: "j5", client_id: "valles", area_profile_id: "max", backup_area_profile_id: "fin", status: "done", total: 120, resolved: 120, ok: 88, revisar: 14, sin: 18, hoursAgo: 17 }),
      makeJob({ id: "j4", client_id: "solhost", area_profile_id: "rrhh", backup_area_profile_id: null, status: "done", total: 64, resolved: 64, ok: 48, revisar: 7, sin: 9, hoursAgo: 50 }),
      makeJob({ id: "j7", client_id: "tecnobalear", area_profile_id: "fin", backup_area_profile_id: null, status: "error", total: 52, resolved: 12, ok: 0, revisar: 0, sin: 0, hoursAgo: 120 }),
      makeJob({ id: "j8", client_id: "ribera", area_profile_id: "rrhh", backup_area_profile_id: "compras", status: "done", total: 38, resolved: 38, ok: 29, revisar: 4, sin: 5, hoursAgo: 140 }),
      makeJob({ id: "j9", client_id: "valles", area_profile_id: "compras", backup_area_profile_id: null, status: "queued", total: 73, resolved: 0, ok: 0, revisar: 0, sin: 0, hoursAgo: 4 }),
    ],
    review: [
      makeReview({ id: "r1", first: "Marta", last: "Beltrán", title: "Directora de Operaciones", company: "Transgrúas del Sur S.L.", linkedin: "in/marta-beltran", reason: "Cargo ambiguo para el área" }),
      makeReview({ id: "r2", first: "Óscar", last: "Pidal", title: "Head of IT", company: "Cerámicas Levantinas", linkedin: "in/oscar-pidal", reason: "Posible homónimo (2 perfiles)" }),
      makeReview({ id: "r3", first: "Lucía", last: "Andrade", title: "Responsable de Compras", company: "Distribuciones Norte", linkedin: "in/lucia-andrade", reason: "Empresa con varias sedes" }),
      makeReview({ id: "r4", first: "Javier", last: "Reus", title: "CFO", company: "Hoteles Marina Plaza", linkedin: "in/javier-reus", reason: "Antigüedad < 3 meses" }),
      makeReview({ id: "r5", first: "Nuria", last: "Sáez", title: "People & Talent Lead", company: "Bodegas Ribera Alta", linkedin: "in/nuria-saez", reason: "Perfil sin actividad reciente" }),
      makeReview({ id: "r6", first: "Diego", last: "Carralero", title: "Gerente", company: "Náutica Pereira", linkedin: "in/diego-carralero", reason: "LinkedIn no verificado por la fuente" }),
      makeReview({ id: "r7", first: "Elena", last: "Quirós", title: "Directora Financiera", company: "Inmobiliaria Vallés", linkedin: "in/elena-quiros", reason: "Cargo ambiguo para el área" }),
    ],
  };
}

// Singleton compartido entre capas (RSC y Server Actions) vía globalThis.
const globalRef = globalThis as typeof globalThis & { __gasMockStore__?: MockStore };

export function getMockStore(): MockStore {
  if (!globalRef.__gasMockStore__) globalRef.__gasMockStore__ = buildStore();
  return globalRef.__gasMockStore__;
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
