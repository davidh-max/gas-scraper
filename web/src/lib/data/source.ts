// Interfaz única de datos que consume la web. Dos implementaciones la cumplen:
//   - SupabaseSource (envuelve lo que ya existía, sin tocar el contrato de BD)
//   - MockSource     (datos en memoria para el modo MockData)
// Un selector central (./index) decide cuál usar según la cookie de modo.

import type {
  AreaProfileRow,
  ClientRow,
  ClientSettings,
  ContactRow,
  ContactStatus,
  JobRow,
} from "@/types/db";
import type { ParsedCompany } from "@/lib/parseCompanies";

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
}

export interface CreateJobInput {
  clientId: string;
  areaId: string;
  backupAreaId: string | null;
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
  getJobs(): Promise<JobRow[]>;
  getJobsByClient(clientId: string): Promise<JobRow[]>;
  getJobContext(id: string): Promise<JobContext | null>;
  getReviewContacts(limit?: number): Promise<ReviewContact[]>;
  getReviewPendingCount(): Promise<number>;

  // Escrituras (devuelven datos crudos; el redirect/revalidate vive en actions)
  createJob(input: CreateJobInput): Promise<string>;
  createClientRecord(name: string): Promise<void>;
  updateClientSettings(id: string, settings: ClientSettings): Promise<void>;
  updateContactStatus(id: string, status: ContactStatus): Promise<void>;
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
