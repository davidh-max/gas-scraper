// Interfaz única de datos que consume la web. Usa SupabaseSource como única
// implementación.

import type {
  AreaProfileRow,
  ClientRow,
  ClientSettings,
  ContactFeedback,
  ContactRow,
  ContactStatus,
  FeedbackReason,
  JobRow,
  ProfileRow,
} from "@/types/db";
import type { ParsedCompany } from "@/lib/parseCompanies";

// Contacto enriquecido para la tabla de job: incluye el nombre de la empresa.
export interface JobContact extends ContactRow {
  companyName: string;
}

// Contacto de la bandeja de revisión enriquecido para la vista (nombre de la
// empresa + motivo legible). Espejo de ContactRow, sin cambiar la tabla.
export interface ReviewContact extends ContactRow {
  companyName: string;
  reason: string;
}

// Contexto completo de un job para la pantalla de progreso/descarga.
export interface JobContext {
  job: JobRow;
  client: ClientRow | null;
  area: AreaProfileRow | null;
  backupArea: AreaProfileRow | null;
  creatorName: string | null;
}

export interface JobListItem extends JobRow {
  creator_name: string | null;
  creator_email: string | null;
}

export interface ErrorRate {
  total: number;   // contactos entregados (universo); por defecto TODOS válidos
  invalid: number; // contactos marcados como erróneos (feedback = 'no_valido')
  rate: number;    // % redondeado a 1 decimal (invalid / total)
}

export interface NoResultCompany {
  companyId: string;
  name: string;
  note: string | null;
}

export interface CreateJobInput {
  clientId: string;
  areaId: string;
  backupAreaId: string | null;
  name: string | null;
  useFixtures: boolean;
  receptionOnly: boolean;
  companies: ParsedCompany[];
}

export interface DataSource {
  // Lecturas
  getClients(): Promise<ClientRow[]>;
  getActiveClients(): Promise<ClientRow[]>;
  getClient(id: string): Promise<ClientRow | null>;
  getAreas(): Promise<AreaProfileRow[]>;
  getActiveAreas(): Promise<AreaProfileRow[]>;
  getJobs(): Promise<JobListItem[]>;
  getJobsByClient(clientId: string): Promise<JobListItem[]>;
  getJobContext(id: string): Promise<JobContext | null>;
  getReviewContacts(limit?: number): Promise<ReviewContact[]>;
  getReviewPendingCount(): Promise<number>;
  getJobContacts(jobId: string): Promise<JobContact[]>;
  getJobNoResultCompanies(jobId: string): Promise<NoResultCompany[]>;
  getGlobalErrorRate(): Promise<ErrorRate>;
  getClientErrorRate(clientId: string): Promise<ErrorRate>;
  getProfiles(): Promise<ProfileRow[]>;

  // Escrituras (devuelven datos crudos; el redirect/revalidate vive en actions)
  createJob(input: CreateJobInput): Promise<string>;
  createClientRecord(name: string): Promise<void>;
  updateClientSettings(id: string, settings: ClientSettings): Promise<void>;
  deleteClient(id: string): Promise<void>;
  updateContactStatus(id: string, status: ContactStatus): Promise<void>;
  updateContactFeedback(
    id: string,
    feedback: ContactFeedback,
    reason?: FeedbackReason | null,
    note?: string | null,
  ): Promise<void>;
  updateProfileName(id: string, fullName: string): Promise<void>;
}

// Motivo legible de revisión a partir de las señales reales del contacto.
export function reviewReason(contact: Pick<ContactRow, "verify_flag" | "classification">): string {
  if (contact.verify_flag === "verificar_empresa") {
    return "Empresa sin confirmar — posible homónimo";
  }
  if (contact.verify_flag) return contact.verify_flag;
  if (contact.classification === "revisar") return "Cargo dudoso para el área — validar";
  return "Pendiente de validación";
}

// Margen de error desde un array de contactos. El universo es TODO el conjunto
// entregado: por defecto cuentan como válidos, y solo los marcados explícitamente como
// 'no_valido' restan. (Antes el denominador eran solo los contactos ya puntuados, así
// que marcar uno como erróneo daba 100%.)
export function computeErrorRateFromContacts(contacts: Pick<ContactRow, "feedback">[]): ErrorRate {
  const total = contacts.length;
  const invalid = contacts.filter((c) => c.feedback === "no_valido").length;
  return {
    total,
    invalid,
    rate: total > 0 ? Math.round((invalid / total) * 1000) / 10 : 0,
  };
}
