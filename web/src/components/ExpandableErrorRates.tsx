"use client";

import { useMemo, useState } from "react";

import { StatCard } from "@/ds";
import { ClientAvatar } from "@/components/ClientAvatar";
import { clientStats } from "@/lib/dashboard";
import type { ClientRow, JobRow } from "@/types/db";
import type { ErrorRate } from "@/lib/data/source";

interface ExpandableErrorRatesProps {
  globalErrorRate: ErrorRate;
  clients: ClientRow[];
  jobs: JobRow[];
  errorRateByClient: Record<string, ErrorRate>;
  children: React.ReactNode;
}

export function ExpandableErrorRates({
  globalErrorRate,
  clients,
  jobs,
  errorRateByClient,
  children,
}: ExpandableErrorRatesProps) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => clientStats(clients, jobs), [clients, jobs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          width: "fit-content",
          padding: "10px 14px",
          borderRadius: "var(--radius-lg)",
          border: "1.5px solid var(--border-default)",
          background: "#fff",
          color: "var(--text-secondary)",
          font: "var(--weight-semibold) 13px/1 var(--font-sans)",
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <i data-lucide="percent" style={{ width: 16, height: 16 }} />
        {open ? "Ocultar márgenes de error" : "Ver márgenes de error"}
        <i
          data-lucide={open ? "chevron-up" : "chevron-down"}
          style={{ width: 16, height: 16, marginLeft: "auto" }}
        />
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
            <StatCard
              label="Margen de error global"
              value={`${globalErrorRate.rate}%`}
              icon="percent"
              tone="dark"
              style={{ background: "var(--ink)", color: "#fff" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {stats.map((s) => {
              const er = errorRateByClient[s.client.id] ?? { total: 0, invalid: 0, rate: 0 };
              const color = s.client.settings.brand_color || "var(--ink)";
              return (
                <div
                  key={s.client.id}
                  style={{
                    textAlign: "left",
                    background: "#fff",
                    border: "2px solid var(--border-subtle)",
                    borderTop: `4px solid ${color}`,
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-sm)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ClientAvatar
                      name={s.client.name}
                      logoUrl={s.client.settings.logo_url}
                      color={color}
                      size={34}
                      radius={9}
                    />
                    <span
                      style={{
                        font: "var(--weight-semibold) 14px/1.2 var(--font-sans)",
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.client.name}
                    </span>
                  </div>
                  <div style={{ font: "var(--weight-medium) 12px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
                    {s.nJobs} jobs · {s.ok + s.revisar + s.sin} empresas
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span
                      style={{
                        font: "var(--weight-extra) 22px/1 var(--font-tech)",
                        color: er.rate > 10 ? "var(--color-danger)" : "var(--green-600)",
                      }}
                    >
                      {er.rate}%
                    </span>
                    <span style={{ font: "var(--weight-medium) 11px/1.3 var(--font-sans)", color: "var(--text-muted)" }}>
                      {er.total - er.invalid} val. · {er.invalid} err.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
