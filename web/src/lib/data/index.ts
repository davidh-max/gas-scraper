// Selector central de la capa de datos. Siempre usa Supabase (modo MockData eliminado).
// Las páginas y server actions llaman SIEMPRE aquí, nunca a Supabase directamente.

import { SupabaseSource } from "./supabaseSource";
import type { DataSource } from "./source";

export async function getDataSource(): Promise<DataSource> {
  return new SupabaseSource();
}

export type { DataSource, ReviewContact, JobContext, CreateJobInput, JobListItem } from "./source";
