import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabaseServer";
import { JobProgress } from "@/components/JobProgress";
import type { AreaProfileRow, ClientRow, JobRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: job } = await supabase.from("jobs").select("*").eq("id", params.id).single();
  if (!job) notFound();
  const typedJob = job as JobRow;

  const [clientRes, areaRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", typedJob.client_id).single(),
    supabase.from("area_profiles").select("*").eq("id", typedJob.area_profile_id).single(),
  ]);
  const client = clientRes.data as ClientRow | null;
  const area = areaRes.data as AreaProfileRow | null;

  return (
    <div>
      <p className="small">
        <a href="/">← Dashboard</a>
      </p>
      <h1>Job {typedJob.id.slice(0, 8)}</h1>
      <p className="muted small">
        Cliente: <strong>{client?.name ?? "—"}</strong> · Área:{" "}
        <strong>{area?.name ?? "—"}</strong>
        {typedJob.use_fixtures && " · (fixtures)"}
      </p>
      <div className="panel">
        <JobProgress initialJob={typedJob} />
      </div>
    </div>
  );
}
