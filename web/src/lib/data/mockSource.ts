// Implementación en memoria de DataSource para el modo MockData.
// Las lecturas devuelven los datos sembrados; las escrituras mutan el store
// compartido (optimistas, sin backend). Permite navegar toda la web sin Supabase
// ni sesión.

import type { AreaProfileRow, ClientRow, ClientSettings, ContactFeedback, ContactStatus, FeedbackReason, JobRow } from "@/types/db";
import { estimateCostUsd } from "@/lib/cost";
import { slugify } from "@/lib/slug";
import { asReviewContact, getMockStore } from "./mockSeed";
import { computeErrorRateFromContacts, type CreateJobInput, type DataSource, type ErrorRate, type JobContact, type JobContext, type NoResultCompany, type ReviewContact } from "./source";

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, "es");
const byCreatedDesc = (a: JobRow, b: JobRow): number => b.created_at.localeCompare(a.created_at);

export class MockSource implements DataSource {
  async getClients(): Promise<ClientRow[]> {
    return [...getMockStore().clients].sort(byName);
  }

  async getActiveClients(): Promise<ClientRow[]> {
    return getMockStore().clients.filter((c) => c.active).sort(byName);
  }

  async getClient(id: string): Promise<ClientRow | null> {
    return getMockStore().clients.find((c) => c.id === id) ?? null;
  }

  async getAreas(): Promise<AreaProfileRow[]> {
    return [...getMockStore().areas];
  }

  async getActiveAreas(): Promise<AreaProfileRow[]> {
    return getMockStore().areas.filter((a) => a.active).sort(byName);
  }

  async getJobs(): Promise<JobRow[]> {
    return [...getMockStore().jobs].sort(byCreatedDesc);
  }

  async getJobsByClient(clientId: string): Promise<JobRow[]> {
    return getMockStore().jobs.filter((j) => j.client_id === clientId).sort(byCreatedDesc);
  }

  async getJobContext(id: string): Promise<JobContext | null> {
    const store = getMockStore();
    const job = store.jobs.find((j) => j.id === id);
    if (!job) return null;
    return {
      job,
      client: store.clients.find((c) => c.id === job.client_id) ?? null,
      area: store.areas.find((a) => a.id === job.area_profile_id) ?? null,
      backupArea: job.backup_area_profile_id
        ? store.areas.find((a) => a.id === job.backup_area_profile_id) ?? null
        : null,
    };
  }

  async getReviewContacts(limit = 200): Promise<ReviewContact[]> {
    return getMockStore()
      .contacts.filter((c) => c.status === "pending")
      .map(asReviewContact)
      .sort((a, b) => a.classification.localeCompare(b.classification) || a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }

  async getReviewPendingCount(): Promise<number> {
    return getMockStore().contacts.filter((c) => c.status === "pending").length;
  }

  async getJobContacts(jobId: string): Promise<JobContact[]> {
    return getMockStore().contacts.filter((c) => c.job_id === jobId);
  }

  async getJobNoResultCompanies(jobId: string): Promise<NoResultCompany[]> {
    return getMockStore().noresults.filter((c) => c.companyId.startsWith(`co-nr-${jobId}-`));
  }

  async getGlobalErrorRate(): Promise<ErrorRate> {
    return computeErrorRateFromContacts(getMockStore().contacts);
  }

  async getClientErrorRate(clientId: string): Promise<ErrorRate> {
    const store = getMockStore();
    const jobIds = new Set(store.jobs.filter((j) => j.client_id === clientId).map((j) => j.id));
    return computeErrorRateFromContacts(store.contacts.filter((c) => jobIds.has(c.job_id)));
  }

  async createJob(input: CreateJobInput): Promise<string> {
    const id = globalThis.crypto.randomUUID();
    const now = new Date().toISOString();
    getMockStore().jobs.unshift({
      id,
      client_id: input.clientId,
      area_profile_id: input.areaId,
      backup_area_profile_id: input.backupAreaId,
      status: "queued",
      use_fixtures: input.useFixtures,
      reception_only: input.receptionOnly,
      total_companies: input.companies.length,
      resolved_companies: 0,
      total_contacts: 0,
      decisor_count: 0,
      revisar_count: 0,
      no_result_count: 0,
      result_path: null,
      estimated_cost_usd: estimateCostUsd(input.companies.length),
      error_message: null,
      created_by: "demo",
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  async createClientRecord(name: string): Promise<void> {
    const store = getMockStore();
    const clean = name.trim();
    const baseSlug = slugify(clean);
    const taken = new Set(store.clients.map((c) => c.slug));
    let slug = baseSlug;
    for (let n = 2; taken.has(slug); n += 1) slug = `${baseSlug}-${n}`;
    store.clients.push({
      id: globalThis.crypto.randomUUID(),
      name: clean,
      slug,
      active: true,
      settings: {},
      created_at: new Date().toISOString(),
    });
  }

  async updateClientSettings(id: string, settings: ClientSettings): Promise<void> {
    const client = getMockStore().clients.find((c) => c.id === id);
    if (client) client.settings = settings;
  }

  async deleteClient(id: string): Promise<void> {
    const store = getMockStore();
    store.jobs = store.jobs.filter((j) => j.client_id !== id);
    store.contacts = store.contacts.filter((c) => !store.jobs.some((j) => j.id === c.job_id));
    store.noresults = store.noresults.filter((n) => !store.jobs.some((j) => n.companyId.startsWith(`co-nr-${j.id}-`)));
    store.clients = store.clients.filter((c) => c.id !== id);
  }

  async updateContactFeedback(
    id: string,
    feedback: ContactFeedback,
    reason?: FeedbackReason | null,
    note?: string | null,
  ): Promise<void> {
    const store = getMockStore();
    const contact = store.contacts.find((c) => c.id === id);
    if (!contact) return;
    contact.feedback = feedback;
    contact.feedback_at = new Date().toISOString();
    contact.feedback_by = "demo";
    if (feedback === "no_valido") {
      contact.feedback_reason = reason ?? null;
      contact.feedback_note = note?.trim() || null;
    } else {
      contact.feedback_reason = null;
      contact.feedback_note = null;
    }
  }

  async updateContactStatus(id: string, status: ContactStatus): Promise<void> {
    const contact = getMockStore().contacts.find((c) => c.id === id);
    if (contact) contact.status = status;
  }
}
