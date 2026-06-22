"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getDataSource } from "@/lib/data";
import type { ParsedCompany } from "@/lib/parseCompanies";
import type { ClientSettings, ContactFeedback, ContactStatus, FeedbackReason } from "@/types/db";
import { createClient } from "@/lib/supabaseServer";

async function logJobEvent(
  jobId: string,
  toStatus: string,
  message: string,
  payload: Record<string, unknown> = {},
) {
  const supabase = await createClient();
  await supabase.from("job_events").insert({
    job_id: jobId,
    to_status: toStatus,
    message,
    payload,
  });
}

/**
 * Intenta ejecutar el worker Python para un job concreto en background.
 * En local/Node (next dev / next start) esto arranca el procesamiento
 * inmediatamente. En entornos edge/sin `child_process` (p. ej. Cloudflare
 * Pages) falla silenciosamente y el job permanece `queued` para el polling
 * worker.
 */
async function spawnWorkerForJob(jobId: string, useFixtures: boolean): Promise<void> {
  // `path` y `child_process` se importan dinámicamente para que no entren en el
  // bundle (este módulo "use server" lo importan componentes de cliente). En
  // entornos edge/sin estos módulos (p. ej. Cloudflare Pages) el import falla y
  // el job queda `queued` para el polling worker.
  const path = (await import(/* webpackIgnore: true */ "node:path")).default;
  // `web/` y `worker/` son hermanos en la raíz del repo (monorepo).
  const workerDir = path.resolve(process.cwd(), "..", "worker");
  const pythonCmds = [
    // Primero el virtualenv del worker, si existe (despliegue local/monorepo).
    path.join(workerDir, ".venv", "bin", "python3"),
    path.join(workerDir, ".venv", "bin", "python"),
    // Fallbacks del sistema.
    "python3",
    "python",
  ];
  const args = ["-m", "worker.main", "--job-id", jobId];
  if (useFixtures) args.push("--use-fixtures");

  let spawned = false;
  let lastError: Error | null = null;

  for (const cmd of pythonCmds) {
    try {
      const { spawn } = await import(/* webpackIgnore: true */ "node:child_process");
      const proc = spawn(cmd, args, {
        cwd: workerDir,
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      });
      proc.on("error", (err) => {
        // eslint-disable-next-line no-console
        console.error(`Worker spawn error (${cmd}):`, err);
      });
      proc.unref();
      spawned = true;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (spawned) {
    await logJobEvent(jobId, "queued", "Worker auto-lanzado", {
      worker_dir: workerDir,
      use_fixtures: useFixtures,
    });
    return;
  }

  await logJobEvent(jobId, "queued", "No se pudo auto-lanzar el worker; esperando polling", {
    worker_dir: workerDir,
    use_fixtures: useFixtures,
    error: lastError?.message ?? "unknown",
  });
}

// Crea un job e inserta sus empresas. Luego intenta ejecutarlo automáticamente.
export async function createJob(formData: FormData): Promise<void> {
  const clientId = String(formData.get("client_id") ?? "");
  const areaId = String(formData.get("area_profile_id") ?? "");
  const backupRaw = String(formData.get("backup_area_profile_id") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const useFixtures = formData.get("use_fixtures") === "on";
  const receptionOnly = false; // ya resuelve URLs de LinkedIn en el worker
  const companiesJson = String(formData.get("companies_json") ?? "[]");
  let companies: ParsedCompany[];
  try {
    companies = JSON.parse(companiesJson) as ParsedCompany[];
  } catch {
    throw new Error("No se pudieron leer las empresas.");
  }

  if (!clientId || !areaId) throw new Error("Faltan cliente o área.");
  if (!Array.isArray(companies) || companies.length === 0) {
    throw new Error("No se reconoció ninguna empresa.");
  }

  const jobId = await (await getDataSource()).createJob({
    clientId,
    areaId,
    backupAreaId: backupRaw || null,
    name,
    useFixtures,
    receptionOnly,
    companies,
  });

  // Intenta arrancar el procesamiento en background. No bloquea el redirect.
  await spawnWorkerForJob(jobId, useFixtures);

  revalidatePath("/");
  redirect(`/jobs/${jobId}`);
}

// Reencola un job parado (queued/error) y lo intenta ejecutar de nuevo.
export async function retryJob(jobId: string): Promise<void> {
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", jobId).single();
  if (!job) throw new Error("Job no encontrado.");
  if (job.status !== "queued" && job.status !== "error") {
    throw new Error(`No se puede reintentar un job en estado '${job.status}'.`);
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status: "queued", error_message: null })
    .eq("id", jobId);
  if (error) throw new Error(error.message);

  await logJobEvent(jobId, "queued", "Reintentado manualmente", { previous_status: job.status });

  await spawnWorkerForJob(jobId, Boolean(job.use_fixtures));

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/");
}

// Alta de cliente. Genera un slug único a partir del nombre.
export async function createClientRecord(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El nombre del cliente es obligatorio.");

  await (await getDataSource()).createClientRecord(name);

  revalidatePath("/");
  revalidatePath("/jobs/new");
  revalidatePath("/clients");
}

// Guarda la personalización de un cliente (logo, color, web, sector) en
// `clients.settings`. Campos vacíos → null.
export async function updateClientSettings(formData: FormData): Promise<void> {
  const id = String(formData.get("client_id") ?? "");
  if (!id) throw new Error("Falta el cliente.");
  const field = (key: string): string | null => {
    const value = String(formData.get(key) ?? "").trim();
    return value || null;
  };
  const settings: ClientSettings = {
    logo_url: field("logo_url"),
    brand_color: field("brand_color"),
    website: field("website"),
    sector: field("sector"),
  };
  await (await getDataSource()).updateClientSettings(id, settings);
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  revalidatePath("/");
}

export async function deleteClientRecord(formData: FormData): Promise<void> {
  const id = String(formData.get("client_id") ?? "");
  if (!id) throw new Error("Falta el cliente.");
  await (await getDataSource()).deleteClient(id);
  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}

// Guarda la validez post-llamada de un contacto (eje distinto de la bandeja Revisar).
export async function updateContactFeedback(
  contactId: string,
  feedback: ContactFeedback,
  reason?: FeedbackReason | null,
  note?: string | null,
): Promise<void> {
  await (await getDataSource()).updateContactFeedback(contactId, feedback, reason, note);
}

// Aprobar/descartar un contacto desde la bandeja de revisión.
export async function updateContactStatus(
  contactId: string,
  status: ContactStatus,
): Promise<void> {
  await (await getDataSource()).updateContactStatus(contactId, status);
  revalidatePath("/review");
}

export async function updateProfileName(id: string, fullName: string): Promise<void> {
  await (await getDataSource()).updateProfileName(id, fullName.trim());
  revalidatePath("/settings");
}

export async function signOut(): Promise<void> {
  const { createClient } = await import("@/lib/supabaseServer");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
