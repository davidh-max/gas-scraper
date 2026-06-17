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
  ContactFeedback,
  ContactRow,
  ContactStatus,
  FeedbackReason,
  JobRow,
} from "@/types/db";
import {
  reviewReason,
  type CreateJobInput,
  type DataSource,
  type ErrorRate,
  type JobContact,
  type JobContext,
  type NoResultCompany,
  type ReviewContact,
} from "./source";

// `settings` puede faltar si la columna jsonb aún no se migró: normaliza a {}.
function normalizeClient(row: unknown): ClientRow {
  const c = row as ClientRow;
  return { ...c, settings: c.settings ?? {} };
}

function computeErrorRate(rows: Pick<ContactRow, "feedback">[]): ErrorRate {
  const total = rows.length;
  const invalid = rows.filter((r) => r.feedback === "no_valido").length;
  return {
    total,
    invalid,
    rate: total > 0 ? Math.round((invalid / total) * 1000) / 10 : 0,
  };
}

export class SupabaseSource implements DataSource {
  async getClients(): Promise<ClientRow[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("clients").select("*").order("name");
    return (data ?? []).map(normalizeClient);
  }

  async getActiveClients(): Promise<ClientRow[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("active", true)
      .order("name");
    return (data ?? []).map(normalizeClient);
  }

  async getClient(id: string): Promise<ClientRow | null> {
    const supabase = await createClient();
    const { data } = await supabase.from("clients").select("*").eq("id", id).single();
    return data ? normalizeClient(data) : null;
  }

  async getAreas(): Promise<AreaProfileRow[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("area_profiles").select("*");
    return (data ?? []) as AreaProfileRow[];
  }

  async getActiveAreas(): Promise<AreaProfileRow[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("area_profiles")
      .select("*")
      .eq("active", true)
      .order("name");
    return (data ?? []) as AreaProfileRow[];
  }

  async getJobs(): Promise<JobRow[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    return (data ?? []) as JobRow[];
  }

  async getJobsByClient(clientId: string): Promise<JobRow[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    return (data ?? []) as JobRow[];
  }

  async getJobContext(id: string): Promise<JobContext | null> {
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
    const { count } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    return count ?? 0;
  }

  async createJob(input: CreateJobInput): Promise<string> {
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();
    const { error } = await supabase.from("clients").update({ settings }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async deleteClient(id: string): Promise<void> {
    const supabase = await createClient();
    const { error: jobsError } = await supabase.from("jobs").delete().eq("client_id", id);
    if (jobsError) throw new Error(jobsError.message);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async getJobContacts(jobId: string): Promise<JobContact[]> {
    const supabase = await createClient();
    const [{ data: contactsData }, { data: companiesData }] = await Promise.all([
      supabase.from("contacts").select("*").eq("job_id", jobId).order("created_at"),
      supabase.from("companies").select("id, razon_social, raw_input").eq("job_id", jobId),
    ]);
    const contacts = (contactsData ?? []) as ContactRow[];
    const companyName = new Map(
      ((companiesData ?? []) as CompanyRow[]).map((c) => [
        c.id,
        c.razon_social ?? c.raw_input ?? c.id,
      ]),
    );
    return contacts.map((c) => ({ ...c, companyName: companyName.get(c.company_id) ?? "—" }));
  }

  async getJobNoResultCompanies(jobId: string): Promise<NoResultCompany[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("companies")
      .select("id, razon_social, raw_input, note")
      .eq("job_id", jobId)
      .eq("status", "no_result")
      .order("created_at");
    return ((data ?? []) as CompanyRow[]).map((c) => ({
      companyId: c.id,
      name: c.razon_social ?? c.raw_input ?? c.id,
      note: c.note ?? null,
    }));
  }

  async getGlobalErrorRate(): Promise<ErrorRate> {
    // Universo = TODOS los contactos entregados (por defecto válidos); solo restan los
    // marcados 'no_valido'. No filtramos por feedback_at: si lo hiciéramos, el primer
    // contacto marcado como erróneo daría 100%.
    const supabase = await createClient();
    const { data } = await supabase.from("contacts").select("feedback");
    return computeErrorRate((data ?? []) as Pick<ContactRow, "feedback">[]);
  }

  async getClientErrorRate(clientId: string): Promise<ErrorRate> {
    const supabase = await createClient();
    const { data: jobsData } = await supabase.from("jobs").select("id").eq("client_id", clientId);
    const jobIds = ((jobsData ?? []) as { id: string }[]).map((j) => j.id);
    if (jobIds.length === 0) return { total: 0, invalid: 0, rate: 0 };
    const { data } = await supabase
      .from("contacts")
      .select("feedback")
      .in("job_id", jobIds);
    return computeErrorRate((data ?? []) as Pick<ContactRow, "feedback">[]);
  }

  async updateContactFeedback(
    id: string,
    feedback: ContactFeedback,
    reason?: FeedbackReason | null,
    note?: string | null,
  ): Promise<void> {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesión requerida para guardar feedback.");
    const updates: Record<string, unknown> = {
      feedback,
      feedback_at: new Date().toISOString(),
      feedback_by: user.id,
    };
    if (feedback === "no_valido") {
      updates.feedback_reason = reason ?? null;
      updates.feedback_note = note?.trim() || null;
    } else {
      updates.feedback_reason = null;
      updates.feedback_note = null;
    }
    const { error } = await supabase.from("contacts").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateContactStatus(id: string, status: ContactStatus): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("contacts").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  }
}
