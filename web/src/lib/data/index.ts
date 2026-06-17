// Selector central de la capa de datos. Lee la cookie de modo y devuelve la
// implementación adecuada. Las páginas y server actions llaman SIEMPRE aquí,
// nunca a Supabase directamente.

import { getMode } from "./mode";
import { MockSource } from "./mockSource";
import { SupabaseSource } from "./supabaseSource";
import type { DataSource } from "./source";

export async function getDataSource(): Promise<DataSource> {
  return (await getMode()) === "mock" ? new MockSource() : new SupabaseSource();
}

export type { DataSource, ReviewContact, JobContext, CreateJobInput } from "./source";
