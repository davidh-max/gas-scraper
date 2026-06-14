import Link from "next/link";
import { notFound } from "next/navigation";

import { JobProgress } from "@/components/JobProgress";
import { ResultsView } from "@/components/ResultsView";
import { getDataSource } from "@/lib/data";
import { getMode } from "@/lib/data/mode";
import { mockExcelPreview } from "@/lib/data/mockSeed";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: { id: string } }) {
  const mode = getMode();
  const ctx = await getDataSource().getJobContext(params.id);
  if (!ctx) notFound();

  const { job, client, area, backupArea } = ctx;
  const clientName = client?.name ?? "—";
  const areaName = area?.name ?? "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Link
        href="/"
        className="gas-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "var(--weight-semibold) 13px/1 var(--font-sans)",
          color: "var(--text-secondary)",
          width: "fit-content",
        }}
      >
        <i data-lucide="arrow-left" style={{ width: 16, height: 16 }} /> Panel
      </Link>

      {job.status === "done" ? (
        <ResultsView
          job={job}
          clientName={clientName}
          areaName={areaName}
          preview={mode === "mock" ? mockExcelPreview : []}
        />
      ) : (
        <JobProgress
          initialJob={job}
          clientName={clientName}
          areaName={areaName}
          backupName={backupArea?.name ?? null}
          mode={mode}
        />
      )}
    </div>
  );
}
