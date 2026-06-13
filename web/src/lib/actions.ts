"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabaseServer";
import { estimateCostUsd } from "@/lib/cost";
import { parseCompanies } from "@/lib/parseCompanies";
import type { CompanyInsert, ContactStatus } from "@/types/db";

// Crea un job (estado `queued`) e inserta sus empresas. El worker lo recoge.
export async function createJob(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clientId = String(formData.get("client_id") ?? "");
  const areaId = String(formData.get("area_profile_id") ?? "");
  const backupRaw = String(formData.get("backup_area_profile_id") ?? "");
  const useFixtures = formData.get("use_fixtures") === "on";
  const companiesText = String(formData.get("companies_text") ?? "");

  if (!clientId || !areaId) throw new Error("Faltan cliente o área.");
  const parsed = parseCompanies(companiesText);
  if (parsed.length === 0) throw new Error("No se reconoció ninguna empresa.");

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      client_id: clientId,
      area_profile_id: areaId,
      backup_area_profile_id: backupRaw || null,
      use_fixtures: useFixtures,
      status: "queued",
      total_companies: parsed.length,
      estimated_cost_usd: estimateCostUsd(parsed.length),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (jobError || !job) throw new Error(jobError?.message ?? "No se pudo crear el job.");

  const rows: CompanyInsert[] = parsed.map((c) => ({ ...c, job_id: job.id }));
  const { error: compError } = await supabase.from("companies").insert(rows);
  if (compError) throw new Error(compError.message);

  revalidatePath("/");
  redirect(`/jobs/${job.id}`);
}

// Aprobar/descartar un contacto desde la bandeja de revisión.
export async function updateContactStatus(
  contactId: string,
  status: ContactStatus,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("contacts").update({ status }).eq("id", contactId);
  if (error) throw new Error(error.message);
  revalidatePath("/review");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
