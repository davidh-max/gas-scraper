"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/StatusBadge";
import { clientInitials } from "@/lib/dashboard";
import { isProcessing, jobProgressPct } from "@/lib/dashboard";
import type { ClientRow, JobRow } from "@/types/db";

const GRID = "1.5fr 0.95fr 1.35fr 1.2fr 64px 52px 60px 64px 34px";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(",", " ·");
}

export function DashboardJobs({
  jobs,
  clients,
  areaNames,
}: {
  jobs: JobRow[];
  clients: ClientRow[];
  areaNames: Record<string, string>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");

  const clientName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) m[c.id] = c.name;
    return m;
  }, [clients]);

  const visible = filter === "all" ? jobs : jobs.filter((j) => j.client_id === filter);
  const chips = [{ id: "all", name: "Todos" }, ...clients.map((c) => ({ id: c.id, name: c.name }))];

  return (
    <div>
      {/* chips de filtro por cliente */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
        <span
          style={{
            font: "var(--weight-bold) 11px/1 var(--font-tech)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginRight: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <i data-lucide="filter" style={{ width: 13, height: 13 }} /> Cliente
        </span>
        {chips.map((chip) => {
          const active = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className="gas-chip"
              onClick={() => setFilter(chip.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                height: 34,
                padding: "0 15px",
                borderRadius: 999,
                cursor: "pointer",
                font: "var(--weight-semibold) 13px/1 var(--font-sans)",
                border: active ? "1.5px solid var(--ink)" : "1.5px solid var(--border-default)",
                background: active ? "var(--ink)" : "#fff",
                color: active ? "#fff" : "var(--text-secondary)",
                whiteSpace: "nowrap",
                transition: "all var(--dur-base) var(--ease-standard)",
              }}
            >
              {chip.name}
            </button>
          );
        })}
      </div>

      {/* tabla de jobs */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID,
            gap: 10,
            padding: "13px 18px",
            background: "var(--neutral-50)",
            borderBottom: "1px solid var(--border-subtle)",
            font: "var(--weight-bold) 10px/1.2 var(--font-tech)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          <div>Cliente</div>
          <div>Creado</div>
          <div>Área buscada</div>
          <div>Estado</div>
          <div style={{ textAlign: "right" }}>Empr.</div>
          <div style={{ textAlign: "right", color: "var(--green-500)" }}>OK</div>
          <div style={{ textAlign: "right", color: "var(--amber-500)" }}>Rev.</div>
          <div style={{ textAlign: "right", color: "var(--neutral-500)" }}>Sin</div>
          <div />
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: "28px 18px", color: "var(--text-muted)", font: "var(--weight-medium) 14px/1.4 var(--font-sans)" }}>
            No hay jobs para este filtro.
          </div>
        ) : (
          visible.map((job) => {
            const showCounts = job.status === "done" || isProcessing(job.status);
            const backupName = job.backup_area_profile_id ? areaNames[job.backup_area_profile_id] : null;
            return (
              <div
                key={job.id}
                className="gas-row"
                onClick={() => router.push(`/jobs/${job.id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 10,
                  padding: "14px 18px",
                  alignItems: "center",
                  borderBottom: "1px solid var(--neutral-100)",
                  cursor: "pointer",
                }}
              >
                <div style={{ font: "var(--weight-semibold) 14px/1.2 var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {clientName[job.client_id] ?? "—"}
                </div>
                <div style={{ font: "var(--weight-medium) 13px/1.2 var(--font-sans)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {fmtDate(job.created_at)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: "var(--weight-medium) 13px/1.2 var(--font-sans)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {areaNames[job.area_profile_id] ?? "—"}
                  </div>
                  {backupName && (
                    <div style={{ font: "var(--weight-medium) 11px/1.3 var(--font-sans)", color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                      ↳ respaldo: {backupName}
                    </div>
                  )}
                </div>
                <div>
                  <StatusBadge status={job.status} progress={isProcessing(job.status) ? jobProgressPct(job) : undefined} />
                </div>
                <div style={{ textAlign: "right", font: "var(--weight-semibold) 14px/1 var(--font-tech)", color: "var(--text-primary)" }}>
                  {job.total_companies}
                </div>
                <div style={{ textAlign: "right", font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--green-500)" }}>
                  {showCounts ? job.decisor_count : "—"}
                </div>
                <div style={{ textAlign: "right", font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--amber-500)" }}>
                  {showCounts ? job.revisar_count : "—"}
                </div>
                <div style={{ textAlign: "right", font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--neutral-500)" }}>
                  {showCounts ? job.no_result_count : "—"}
                </div>
                <div style={{ textAlign: "right", color: "var(--neutral-400)" }}>
                  <i data-lucide="chevron-right" style={{ width: 17, height: 17 }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
