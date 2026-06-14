// Implementación de DataSource sobre Supabase. Envuelve exactamente las consultas
// y escrituras que ya existían en páginas y server actions, SIN cambiar el
// contrato de BD (tablas, columnas, nombres). El cliente supabase-js se usa sin
// el genérico <Database> a propósito; se castea a las Row de @/types/db.

import { createClient } from "@/lib/supabaseServer";
import { estimateCostUsd } from "@/lib/cost";
import { slugify } from "@/lib/slug";
import type {
  AreaProfileRow,
  ClientInsert,
  ClientRow,
  ClientSettings,
  CompanyInsert,
  CompanyRow,
  ContactRow,
  ContactStatus,
  JobRow,
} from "@/types/db";
import {
  reviewReason,
  type CreateJobInput,
  type DataSource,
  type JobContext,
  type ReviewContact,
} from "./source";

// `settings` puede faltar si la columna jsonb aún no se migró: normaliza a {}.
function normalizeClient(row: unknown): ClientRow {
  const c = row as ClientRow;
  return { ...c, settings: c.settings ?? {} };
}

export class SupabaseSource implements DataSource {
  async getClients(): Promise<ClientRow[]> {
    const { data } = await createClient().from("clients").select("*").order("name");
    return (data ?? []).map(normalizeClient);
  }

  async getActiveClients(): Promise<ClientRow[]> {
    const { data } = await createClient()
      .from("clients")
      .select("*")
      .eq("active", true)
      .order("name");
    return (data ?? []).map(normalizeClient);
  }

  async getClient(id: string): Promise<ClientRow | null> {
    const { data } = await createClient().from("clients").select("*").eq("id", id).single();
    return data ? normalizeClient(data) : null;
  }

  async getAreas(): Promise<AreaProfileRow[]> {
    const { data } = await createClient().from("area_profiles").select("*");
    return (data ?? []) as AreaProfileRow[];
  }

  async getActiveAreas(): Promise<AreaProfileRow[]> {
    const { data } = await createClient()
      .from("area_profiles")
      .select("*")
      .eq("active", true)
      .order("name");
    return (data ?? []) as AreaProfileRow[];
  }

  async getJobs(): Promise<JobRow[]> {
    const { data } = await createClient()
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as JobRow[];
  }

  async getJobsByClient(clientId: string): Promise<JobRow[]> {
    const { data } = await createClient()
      .from("jobs")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    return (data ?? []) as JobRow[];
  }

  async getJobContext(id: string): Promise<JobContext | null> {
    const supabase = createClient();
    const { data: jobData } = await supabase.from("jobs").select("*").eq("id", id).single();
    if (!jobData) return null;
    const job = jobData as JobRow;

    const [clientRes, areaRes, backupRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", job.client_id).single(),
      supabase.from("area_profiles").select("*").eq("id", job.area_profile_id).single(),
      job.backup_area_profile_id
        ? supabase.from("area_profiles").select("*").eq("id", job.backup_area_profile_id).single()
        : Promise.resolve({ data: null }),
    ]);

    return {
      job,
      client: clientRes.data ? normalizeClient(clientRes.data) : null,
      area: (areaRes.data as AreaProfileRow | null) ?? null,
      backupArea: (backupRes.data as AreaProfileRow | null) ?? null,
    };
  }

  async getReviewContacts(limit = 200): Promise<ReviewContact[]> {
    const supabase = createClient();
    const { data: contactsData } = await supabase
      .from("contacts")
      .select("*")
      .eq("status", "pending")
      .order("classification")
      .order("created_at")
      .limit(limit);
    const contacts = (contactsData ?? []) as ContactRow[];

    const companyIds = [...new Set(contacts.map((c) => c.company_id))];
    let companyName = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data: companiesData } = await supabase
        .from("companies")
        .select("*")
        .in("id", companyIds);
      const companies = (companiesData ?? []) as CompanyRow[];
      companyName = new Map(companies.map((c) => [c.id, c.razon_social ?? c.raw_input ?? c.id]));
    }

    return contacts.map((c) => ({
      ...c,
      companyName: companyName.get(c.company_id) ?? "—",
      reason: reviewReason(c),
    }));
  }

  async getReviewPendingCount(): Promise<number> {
    const { count } = await createClient()
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    return count ?? 0;
  }

  async createJob(input: CreateJobInput): Promise<string> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión requerida para crear un job.");

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        client_id: input.clientId,
        area_profile_id: input.areaId,
        backup_area_profile_id: input.backupAreaId,
        use_fixtures: input.useFixtures,
        reception_only: input.receptionOnly,
        status: "queued",
        total_companies: input.companies.length,
        estimated_cost_usd: estimateCostUsd(input.companies.length),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "No se pudo crear el job.");

    const rows: CompanyInsert[] = input.companies.map((c) => ({ ...c, job_id: job.id }));
    const { error: compError } = await supabase.from("companies").insert(rows);
    if (compError) throw new Error(compError.message);

    return job.id as string;
  }

  async createClientRecord(name: string): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión requerida para crear un cliente.");

    // Slug base + sufijo incremental si choca con uno ya existente.
    const base = slugify(name);
    const { data: existing } = await supabase
      .from("clients")
      .select("slug")
      .or(`slug.eq.${base},slug.like.${base}-%`);
    const taken = new Set(((existing as { slug: string }[] | null) ?? []).map((r) => r.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;

    const row: ClientInsert = { name, slug, active: true };
    const { error } = await supabase.from("clients").insert(row);
    if (error) {
      // Carrera: el slug se ocupó entre la consulta y el insert → reintento con sufijo aleatorio.
      if (error.code === "23505") {
        const suffix = globalThis.crypto.randomUUID().slice(0, 4);
        const fallback: ClientInsert = { name, slug: `${base}-${suffix}`, active: true };
        const retry = await supabase.from("clients").insert(fallback);
        if (retry.error) throw new Error("Ya existe un cliente con ese nombre. Prueba con otro.");
      } else {
        throw new Error(error.message);
      }
    }
  }

  async updateClientSettings(id: string, settings: ClientSettings): Promise<void> {
    const { error } = await createClient().from("clients").update({ settings }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateContactStatus(id: string, status: ContactStatus): Promise<void> {
    const { error } = await createClient().from("contacts").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  }
}
