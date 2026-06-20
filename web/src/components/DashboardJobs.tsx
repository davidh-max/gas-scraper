"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/StatusBadge";
import { isProcessing, jobProgressPct } from "@/lib/dashboard";
import type { ClientRow } from "@/types/db";
import type { JobListItem } from "@/lib/data";
import { ClientAvatar } from "./ClientAvatar";

const GRID = "2fr 0.65fr 0.9fr 1.25fr 0.95fr 0.85fr 64px 52px 60px 64px 34px";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(",", " ·");
}

function jobDisplayName(job: JobListItem): string {
  if (job.name?.trim()) return job.name.trim();
  const date = new Date(job.created_at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
  });
  return `Lote ${date}`;
}

function creatorInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts[1]?.charAt(0) ?? "";
  return (a + b).toUpperCase() || name.charAt(0).toUpperCase();
}

export function DashboardJobs({
  jobs,
  clients,
  areaNames,
}: {
  jobs: JobListItem[];
  clients: ClientRow[];
  areaNames: Record<string, string>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");

  const clientById = useMemo(() => {
    const m: Record<string, ClientRow> = {};
    for (const c of clients) m[c.id] = c;
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
          <div>Lote</div>
          <div>Cliente</div>
          <div>Creado</div>
          <div>Área buscada</div>
          <div>Estado</div>
          <div>Creador</div>
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
            const client = clientById[job.client_id];
            const clientName = client?.name ?? "—";
            const displayName = jobDisplayName(job);

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
                {/* Lote (nombre + cliente logo) */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "var(--weight-semibold) 14px/1.2 var(--font-sans)",
                      color: "var(--ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {displayName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                    <ClientAvatar
                      name={clientName}
                      logoUrl={client?.settings?.logo_url}
                      color={client?.settings?.brand_color}
                      size={18}
                      radius={4}
                    />
                    <span
                      style={{
                        font: "var(--weight-medium) 11px/1 var(--font-sans)",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {clientName}
                    </span>
                  </div>
                </div>

                {/* Cliente logo */}
                <div>
                  <ClientAvatar
                    name={clientName}
                    logoUrl={client?.settings?.logo_url}
                    color={client?.settings?.brand_color}
                    size={32}
                    radius={8}
                  />
                </div>

                {/* Creado */}
                <div style={{ font: "var(--weight-medium) 13px/1.2 var(--font-sans)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {fmtDate(job.created_at)}
                </div>

                {/* Área */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "var(--weight-medium) 13px/1.2 var(--font-sans)",
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {areaNames[job.area_profile_id] ?? "—"}
                  </div>
                  {backupName && (
                    <div style={{ font: "var(--weight-medium) 11px/1.3 var(--font-sans)", color: "var(--text-muted)", marginTop: 2, whiteSpace: "nowrap" }}>
                      ↳ respaldo: {backupName}
                    </div>
                  )}
                </div>

                {/* Estado */}
                <div>
                  <StatusBadge status={job.status} progress={isProcessing(job.status) ? jobProgressPct(job) : undefined} />
                </div>

                {/* Creador */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "var(--neutral-100)",
                      color: "var(--text-secondary)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      font: "var(--weight-bold) 10px/1 var(--font-tech)",
                      flexShrink: 0,
                    }}
                    title={job.creator_email ?? undefined}
                  >
                    {creatorInitials(job.creator_name ?? job.creator_email)}
                  </span>
                  <span
                    style={{
                      font: "var(--weight-medium) 12px/1.2 var(--font-sans)",
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={job.creator_email ?? undefined}
                  >
                    {job.creator_name ?? job.creator_email?.split("@")[0] ?? "—"}
                  </span>
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
