"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getDataSource } from "@/lib/data";
import { getMode, setModeCookie, type Mode } from "@/lib/data/mode";
import type { ParsedCompany } from "@/lib/parseCompanies";
import type { ClientSettings, ContactStatus } from "@/types/db";

// Crea un job (estado `queued`) e inserta sus empresas. El worker lo recoge.
// Delega en la capa de datos (Supabase o mock según el modo).
export async function createJob(formData: FormData): Promise<void> {
  const clientId = String(formData.get("client_id") ?? "");
  const areaId = String(formData.get("area_profile_id") ?? "");
  const backupRaw = String(formData.get("backup_area_profile_id") ?? "");
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

  const jobId = await getDataSource().createJob({
    clientId,
    areaId,
    backupAreaId: backupRaw || null,
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

  await getDataSource().createClientRecord(name);

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
  await getDataSource().updateClientSettings(id, settings);
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  revalidatePath("/");
}

// Aprobar/descartar un contacto desde la bandeja de revisión.
export async function updateContactStatus(
  contactId: string,
  status: ContactStatus,
): Promise<void> {
  await getDataSource().updateContactStatus(contactId, status);
  revalidatePath("/review");
}

// Cambia el modo de la interfaz (mock ↔ normal) escribiendo la cookie.
// El cliente fuerza una recarga dura a "/" para aplicarlo limpio.
export async function setMode(mode: Mode): Promise<void> {
  setModeCookie(mode);
}

export async function signOut(): Promise<void> {
  // En modo mock no hay sesión Supabase: volver a normal y pedir login.
  if (getMode() === "mock") {
    setModeCookie("normal");
    redirect("/login");
  }
  const { createClient } = await import("@/lib/supabaseServer");
  await createClient().auth.signOut();
  redirect("/login");
}
