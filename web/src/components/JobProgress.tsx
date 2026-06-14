"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabaseClient";
import { jobProgressPct } from "@/lib/dashboard";
import { StatusBadge } from "@/components/StatusBadge";
import { JOB_STATUS_FLOW, type JobRow } from "@/types/db";
import type { Mode } from "@/lib/data/mode";

const TERMINAL = new Set(["done", "error", "cancelled"]);

const PHASES: { status: (typeof JOB_STATUS_FLOW)[number]; title: string; icon: string }[] = [
  { status: "queued", title: "En cola", icon: "clock" },
  { status: "resolving", title: "Resolviendo URLs", icon: "link" },
  { status: "searching", title: "Buscando decisores", icon: "search" },
  { status: "verifying", title: "Verificando", icon: "badge-check" },
  { status: "enriching", title: "Enriqueciendo", icon: "sparkles" },
  { status: "done", title: "Hecho", icon: "flag" },
];

const N = PHASES.length;
const LEFT_PCT = 100 / (2 * N); // centro del primer/último nodo
const INNER_SPAN = 100 - 2 * LEFT_PCT;

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "amber" | "muted";
}) {
  const palette = {
    neutral: { bg: "#fff", border: "var(--border-subtle)", fg: "var(--ink)", labelFg: "var(--text-muted)" },
    green: { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.22)", fg: "var(--green-600)", labelFg: "var(--green-600)" },
    amber: { bg: "var(--amber-50, rgba(245,166,35,0.08))", border: "rgba(245,158,11,0.25)", fg: "#9A6A00", labelFg: "#9A6A00" },
    muted: { bg: "var(--neutral-50)", border: "var(--border-subtle)", fg: "var(--text-secondary)", labelFg: "var(--text-secondary)" },
  }[tone];
  const dot = { neutral: "var(--neutral-400)", green: "var(--green-500)", amber: "var(--amber-500)", muted: "var(--neutral-400)" }[tone];
  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: "var(--radius-lg)",
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: "var(--weight-bold) 10px/1 var(--font-tech)",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: palette.labelFg,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 3, background: dot }} />
        {label}
      </div>
      <div style={{ font: "var(--weight-extra) 36px/1 var(--font-tech)", color: palette.fg, marginTop: 12 }}>{value}</div>
    </div>
  );
}

export function JobProgress({
  initialJob,
  clientName,
  areaName,
  backupName,
  mode,
}: {
  initialJob: JobRow;
  clientName: string;
  areaName: string;
  backupName: string | null;
  mode: Mode;
}) {
  const [job, setJob] = useState<JobRow>(initialJob);
  const router = useRouter();

  useEffect(() => {
    if (mode !== "normal") return; // en mock no se hace polling
    if (TERMINAL.has(job.status)) return;
    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", job.id).single();
      if (data) {
        const next = data as JobRow;
        setJob(next);
        if (next.status === "done") router.refresh(); // cambia a la vista de resultados
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [job.id, job.status, mode, router]);

  const idx = Math.max(0, JOB_STATUS_FLOW.indexOf(job.status));
  const isError = job.status === "error";
  const pct = jobProgressPct(job);
  const fillFraction = job.status === "done" ? 1 : idx / (N - 1);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* header */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "22px 32px", borderBottom: "1px solid var(--border-subtle)" }}>
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: isError ? "var(--red-50)" : "var(--cyan-50, rgba(25,224,255,0.12))",
            color: isError ? "var(--red-600)" : "var(--cyan-600, #00B8D9)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i data-lucide={isError ? "alert-triangle" : "loader"} style={{ width: 23, height: 23 }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {clientName}
            </span>
            <StatusBadge status={job.status} progress={pct} />
          </div>
          <h2 style={{ margin: "6px 0 0", font: "var(--weight-bold) 24px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            {areaName}
            {backupName && (
              <span style={{ color: "var(--text-muted)", fontSize: 15, fontWeight: 600 }}> · respaldo {backupName}</span>
            )}
          </h2>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
          <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Lote #{job.id.slice(0, 8)}
          </div>
          <div style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: "var(--text-secondary)", marginTop: 5 }}>
            {job.total_companies} empresas
          </div>
        </div>
      </header>

      <div style={{ padding: "28px 32px" }}>
        {isError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "var(--red-50)",
              border: "1px solid var(--red-100)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: 20,
              font: "var(--weight-medium) 13px/1.4 var(--font-sans)",
              color: "var(--red-700)",
            }}
          >
            <i data-lucide="alert-triangle" style={{ width: 16, height: 16 }} />
            {job.error_message ?? "El lote terminó con error."}
          </div>
        )}

        {/* headline + barra */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Progreso del lote
            </div>
            <div style={{ font: "var(--weight-semibold) 15px/1 var(--font-sans)", color: "var(--text-secondary)", marginTop: 8 }}>
              {job.resolved_companies} de {job.total_companies} empresas procesadas
            </div>
          </div>
          <span style={{ font: "var(--weight-extra) 56px/0.85 var(--font-tech)", color: "var(--ink)" }}>
            {pct}
            <span style={{ fontSize: 28, color: isError ? "var(--red-500)" : "var(--cyan-600, #00B8D9)" }}>%</span>
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--neutral-100)", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 999,
              background: isError
                ? "var(--red-500)"
                : "linear-gradient(90deg, var(--cyan-500), var(--neon-cyan))",
              transition: "width var(--dur-slow) var(--ease-out)",
            }}
          />
        </div>

        {/* stepper de fases */}
        <div style={{ position: "relative", margin: "40px 0 8px", padding: "0 8px" }}>
          <div style={{ position: "absolute", top: 24, left: `${LEFT_PCT}%`, width: `${INNER_SPAN}%`, height: 3, background: "var(--neutral-200)", borderRadius: 999 }} />
          <div
            style={{
              position: "absolute",
              top: 24,
              left: `${LEFT_PCT}%`,
              width: `${INNER_SPAN * fillFraction}%`,
              height: 3,
              background: "linear-gradient(90deg, var(--green-500), var(--cyan-500))",
              borderRadius: 999,
            }}
          />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 6 }}>
            {PHASES.map((ph, i) => {
              const done = job.status === "done" ? true : i < idx;
              const active = job.status !== "done" && i === idx && !isError;
              const accentFg = active ? "var(--cyan-600, #00B8D9)" : done ? "var(--green-600)" : "var(--text-muted)";
              return (
                <div key={ph.status} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 4px" }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      zIndex: 1,
                      background: active ? "var(--cyan-500)" : done ? "var(--green-500)" : "#fff",
                      color: active ? "#06222b" : done ? "#fff" : "var(--neutral-400)",
                      border: active || done ? "none" : "2px solid var(--border-default)",
                      boxShadow: active
                        ? "0 0 0 5px rgba(25,224,255,0.18)"
                        : done
                          ? "0 4px 12px rgba(34,197,94,0.28)"
                          : "none",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          inset: -5,
                          borderRadius: "50%",
                          border: "2px solid var(--cyan-500)",
                          animation: "gasPulse 1.8s var(--ease-out) infinite",
                        }}
                      />
                    )}
                    <i data-lucide={done ? "check" : ph.icon} style={{ width: 20, height: 20 }} />
                  </div>
                  <div style={{ font: "var(--weight-bold) 10px/1 var(--font-tech)", letterSpacing: ".08em", color: accentFg, marginTop: 12 }}>
                    0{i + 1}
                  </div>
                  <div
                    style={{
                      font: "var(--weight-bold) 13px/1.2 var(--font-sans)",
                      color: active || done ? "var(--ink)" : "var(--text-muted)",
                      marginTop: 8,
                      minHeight: 31,
                    }}
                  >
                    {ph.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* contadores en vivo */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 32 }}>
          <Counter label="Empresas" value={job.total_companies} tone="neutral" />
          <Counter label="Decisores OK" value={job.decisor_count} tone="green" />
          <Counter label="Pend. revisar" value={job.revisar_count} tone="amber" />
          <Counter label="Sin resultado" value={job.no_result_count} tone="muted" />
        </div>
      </div>

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "18px 32px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--surface-page)",
          font: "var(--weight-medium) 13px/1.4 var(--font-sans)",
          color: "var(--text-secondary)",
        }}
      >
        <i data-lucide="info" style={{ width: 16, height: 16, color: "var(--cyan-500)" }} />
        {TERMINAL.has(job.status)
          ? "Lote finalizado."
          : mode === "normal"
            ? "Puedes cerrar esta ventana — el lote sigue en segundo plano. Se actualiza cada 3 s."
            : "Vista de demostración — el progreso es estático en modo MockData."}
      </div>
    </div>
  );
}
