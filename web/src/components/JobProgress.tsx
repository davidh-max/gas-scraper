"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabaseClient";
import { JOB_STATUS_FLOW, type JobRow } from "@/types/db";

const TERMINAL = new Set(["done", "error", "cancelled"]);

export function JobProgress({ initialJob }: { initialJob: JobRow }) {
  const [job, setJob] = useState<JobRow>(initialJob);

  useEffect(() => {
    if (TERMINAL.has(job.status)) return;
    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", job.id).single();
      if (data) setJob(data);
    }, 3000);
    return () => clearInterval(timer);
  }, [job.id, job.status]);

  const currentIdx = JOB_STATUS_FLOW.indexOf(job.status);

  return (
    <div>
      <div className="stepper">
        {JOB_STATUS_FLOW.map((s, i) => {
          const cls =
            job.status === "done" || i < currentIdx
              ? "passed"
              : i === currentIdx
                ? "active"
                : "";
          return (
            <span key={s} className={`step ${cls}`}>
              {s}
            </span>
          );
        })}
      </div>

      {job.status === "error" && (
        <p style={{ color: "var(--red)" }}>Error: {job.error_message ?? "desconocido"}</p>
      )}

      <div className="stats">
        <div className="stat">
          <div className="n">{job.total_companies}</div>
          <div className="l">Empresas</div>
        </div>
        <div className="stat">
          <div className="n">{job.resolved_companies}</div>
          <div className="l">Resueltas</div>
        </div>
        <div className="stat">
          <div className="n">{job.decisor_count}</div>
          <div className="l">Decisores</div>
        </div>
        <div className="stat">
          <div className="n">{job.revisar_count}</div>
          <div className="l">Revisar</div>
        </div>
        <div className="stat">
          <div className="n">{job.no_result_count}</div>
          <div className="l">Sin resultado</div>
        </div>
      </div>

      {job.status === "done" && job.result_path && (
        <p style={{ marginTop: 16 }}>
          <a className="btn" href={`/jobs/${job.id}/download`}>
            Descargar Excel
          </a>
        </p>
      )}
      {!TERMINAL.has(job.status) && (
        <p className="muted small" style={{ marginTop: 12 }}>
          Actualizando cada 3 s…
        </p>
      )}
    </div>
  );
}
