"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getDataSource } from "@/lib/data";
import type { ParsedCompany } from "@/lib/parseCompanies";
import type { ClientSettings, ContactFeedback, ContactStatus, FeedbackReason } from "@/types/db";

// Crea un job (estado `queued`) e inserta sus empresas. El worker lo recoge.
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

  revalidatePath("/");
  redirect(`/jobs/${jobId}`);
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
