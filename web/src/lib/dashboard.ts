// Helpers de presentación del dashboard / clientes. Derivan KPIs y rollups por
// cliente a partir de las filas crudas (no consultan nada).

import type { ClientRow, JobRow, JobStatus } from "@/types/db";

const TERMINAL = new Set<JobStatus>(["done", "error", "cancelled"]);
const PROCESSING = new Set<JobStatus>(["resolving", "searching", "verifying", "enriching"]);

export interface JobKpis {
  active: number;
  decisores: number;
  revisar: number;
  sin: number;
}

export function jobKpis(jobs: JobRow[]): JobKpis {
  return {
    active: jobs.filter((j) => !TERMINAL.has(j.status)).length,
    decisores: jobs.reduce((a, j) => a + j.decisor_count, 0),
    revisar: jobs.reduce((a, j) => a + j.revisar_count, 0),
    sin: jobs.reduce((a, j) => a + j.no_result_count, 0),
  };
}

export interface ClientStat {
  client: ClientRow;
  nJobs: number;
  empresas: number;
  ok: number;
  revisar: number;
  sin: number;
  running: boolean;
}

export function clientStats(clients: ClientRow[], jobs: JobRow[]): ClientStat[] {
  return clients.map((client) => {
    const cj = jobs.filter((j) => j.client_id === client.id);
    return {
      client,
      nJobs: cj.length,
      empresas: cj.reduce((a, j) => a + j.total_companies, 0),
      ok: cj.reduce((a, j) => a + j.decisor_count, 0),
      revisar: cj.reduce((a, j) => a + j.revisar_count, 0),
      sin: cj.reduce((a, j) => a + j.no_result_count, 0),
      running: cj.some((j) => PROCESSING.has(j.status)),
    };
  });
}

// Iniciales para el chip cuadrado del cliente (p. ej. "Naviera Cantábrica" → "NC").
export function clientInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const second = words[1] ?? "";
  const a = first.charAt(0);
  const b = second.charAt(0) || first.charAt(1);
  return (a + b).toUpperCase() || "?";
}

export function isProcessing(status: JobStatus): boolean {
  return PROCESSING.has(status);
}

// % de avance aproximado de la barra, POR FASE. El worker actualiza `jobs.status` en
// cada fase (resolving→searching→verifying→done) en tiempo real, así que la barra
// avanza conforme el job cambia de fase. NO usamos resolved/total: el worker solo
// escribe los contadores al terminar (por eso antes se quedaba clavado en 0%).
const PHASE_PCT: Partial<Record<JobStatus, number>> = {
  queued: 4,
  resolving: 25,
  searching: 60,
  verifying: 85,
  enriching: 92, // legado: el flujo ya no pasa por aquí
  done: 100,
};

export function jobProgressPct(job: JobRow): number {
  if (job.status === "done") return 100;
  if (job.status === "error" || job.status === "cancelled") return 0;
  return PHASE_PCT[job.status] ?? 0;
}
