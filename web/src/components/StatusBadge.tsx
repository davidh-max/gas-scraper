import type { JobStatus } from "@/types/db";

export function statusClass(status: JobStatus): string {
  if (status === "done") return "done";
  if (status === "error" || status === "cancelled") return "error";
  if (status === "queued") return "";
  return "running";
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge ${statusClass(status)}`}>{status}</span>;
}
