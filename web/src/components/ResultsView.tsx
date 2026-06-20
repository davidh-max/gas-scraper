import { slugify } from "@/lib/slug";
import type { JobRow } from "@/types/db";
import { JobContactsTable } from "./JobContactsTable";
import type { JobContact, NoResultCompany } from "@/lib/data/source";

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function Block({
  label,
  value,
  description,
  percent,
  accent,
  labelColor,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  percent: number;
  accent: string;
  labelColor: string;
  icon: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-subtle)",
        borderTop: `4px solid ${accent}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 22,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            font: "var(--weight-bold) 12px/1 var(--font-tech)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: labelColor,
          }}
        >
          <span style={{ width: 11, height: 11, borderRadius: 4, background: accent }} />
          {label}
        </span>
        <i data-lucide={icon} style={{ width: 18, height: 18, color: accent }} />
      </div>
      <div style={{ font: "var(--weight-extra) 52px/0.9 var(--font-tech)", color: "var(--ink)", marginTop: 14 }}>{value}</div>
      <div style={{ font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-secondary)", marginTop: 6 }}>
        {description}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--neutral-100)", marginTop: 16, overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: accent, borderRadius: 999 }} />
      </div>
      <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", color: "var(--text-muted)", marginTop: 7 }}>
        {percent}% DE LA LISTA
      </div>
    </div>
  );
}

function jobDisplayName(job: JobRow): string {
  if (job.name?.trim()) return job.name.trim();
  const date = new Date(job.created_at).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
  });
  return `Lote ${date}`;
}

export function ResultsView({
  job,
  clientName,
  areaName,
  creatorName,
  contacts,
  noResults,
}: {
  job: JobRow;
  clientName: string;
  areaName: string;
  creatorName: string | null;
  contacts: JobContact[];
  noResults: NoResultCompany[];
}) {
  const total = job.total_companies;
  const filename = `${slugify(clientName)}_${slugify(areaName)}_${job.id.slice(0, 6)}.xlsx`;

  return (
    <div
      style={{
        background: "var(--surface-page)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        padding: "30px 32px",
      }}
    >
      {/* resumen */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--color-success-bg)",
            color: "var(--color-success)",
            font: "var(--weight-bold) 11px/1 var(--font-tech)",
            letterSpacing: ".06em",
            textTransform: "uppercase",
          }}
        >
          <i data-lucide="check" style={{ width: 14, height: 14 }} /> Hecho
        </span>
        <div>
          <h2 style={{ margin: 0, font: "var(--weight-bold) 26px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            {jobDisplayName(job)}
          </h2>
          <div style={{ font: "var(--weight-medium) 13px/1 var(--font-sans)", color: "var(--text-secondary)", marginTop: 5 }}>
            {clientName} · {areaName} · Lote #{job.id.slice(0, 8)}
            {creatorName ? ` · creado por ${creatorName}` : ""} · {total} empresas · {job.decisor_count} decisores listos
          </div>
        </div>
      </div>

      {/* tres bloques */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "26px 0" }}>
        <Block
          label="Decisores · OK"
          value={job.decisor_count}
          description="Verificados y listos para llamar. Nombre, cargo, empresa y LinkedIn."
          percent={pct(job.decisor_count, total)}
          accent="var(--green-500)"
          labelColor="var(--green-600)"
          icon="user-check"
        />
        <Block
          label="Revisar"
          value={job.revisar_count}
          description="Dudosos que aún esperan validación humana en la bandeja."
          percent={pct(job.revisar_count, total)}
          accent="var(--amber-500)"
          labelColor="#9A6A00"
          icon="search-check"
        />
        <Block
          label="Sin resultado"
          value={job.no_result_count}
          description="No se halló decisor del área ni del respaldo en estas empresas."
          percent={pct(job.no_result_count, total)}
          accent="var(--neutral-400)"
          labelColor="var(--text-secondary)"
          icon="circle-slash"
        />
      </div>

      {/* CTA de descarga horizontal */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          background: "var(--ink)",
          color: "#fff",
          borderRadius: "var(--radius-lg)",
          padding: "16px 22px",
          position: "relative",
          overflow: "hidden",
          margin: "26px 0 20px",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(280px 150px at 98% 0%, rgba(227,6,19,0.22), transparent)",
          }}
        />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i data-lucide="download" style={{ width: 20, height: 20 }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: "var(--weight-bold) 10px/1 var(--font-tech)",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--neon-cyan)",
              }}
            >
              Lista lista para llamar
            </div>
            <div
              style={{
                font: "var(--weight-extra) 26px/0.95 var(--font-display)",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Bájalo y a por <span style={{ color: "var(--red-400)" }}>ello ⚡</span>
            </div>
          </div>
        </div>
        <a
          href={`/jobs/${job.id}/download`}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 46,
            padding: "0 22px",
            borderRadius: 999,
            background: "var(--color-brand)",
            color: "#fff",
            font: "var(--weight-bold) 15px/1 var(--font-sans)",
            boxShadow: "var(--glow-red-sm)",
            flexShrink: 0,
          }}
        >
          <i data-lucide="download" style={{ width: 18, height: 18 }} /> Descargar Excel
        </a>
      </div>

      {/* Tabla de contactos */}
      <div style={{ minWidth: 0 }}>
        <JobContactsTable job={job} initialContacts={contacts} noResults={noResults} />
      </div>
    </div>
  );
}
