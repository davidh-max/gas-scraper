// Implementación en memoria de DataSource para el modo MockData.
// Las lecturas devuelven los datos sembrados; las escrituras mutan el store
// compartido (optimistas, sin backend). Permite navegar toda la web sin Supabase
// ni sesión.

import type { AreaProfileRow, ClientRow, ContactStatus, JobRow } from "@/types/db";
import { estimateCostUsd } from "@/lib/cost";
import { slugify } from "@/lib/slug";
import { getMockStore } from "./mockSeed";
import type { CreateJobInput, DataSource, JobContext, ReviewContact } from "./source";

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, "es");
const byCreatedDesc = (a: JobRow, b: JobRow): number => b.created_at.localeCompare(a.created_at);

export class MockSource implements DataSource {
  async getClients(): Promise<ClientRow[]> {
    return [...getMockStore().clients].sort(byName);
  }

  async getActiveClients(): Promise<ClientRow[]> {
    return getMockStore().clients.filter((c) => c.active).sort(byName);
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
    return getMockStore().review.filter((c) => c.status === "pending").slice(0, limit);
  }

  async getReviewPendingCount(): Promise<number> {
    return getMockStore().review.filter((c) => c.status === "pending").length;
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
      created_at: new Date().toISOString(),
    });
  }

  async updateContactStatus(id: string, status: ContactStatus): Promise<void> {
    const contact = getMockStore().review.find((c) => c.id === id);
    if (contact) contact.status = status;
  }
}
