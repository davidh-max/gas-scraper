import { slugify } from "@/lib/slug";
import type { JobRow } from "@/types/db";

export interface ExcelPreviewRow {
  nombre: string;
  cargo: string;
  empresa: string;
  linkedin: string;
}

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

export function ResultsView({
  job,
  clientName,
  areaName,
  preview,
}: {
  job: JobRow;
  clientName: string;
  areaName: string;
  preview: ExcelPreviewRow[];
}) {
  const total = job.total_companies;
  const filename = `${slugify(clientName)}_${slugify(areaName)}_${job.id.slice(0, 6)}.xlsx`;
  const cols = "28px 1.3fr 1.4fr 1.4fr 1fr 0.8fr";

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
            {clientName} · {areaName}
          </h2>
          <div style={{ font: "var(--weight-medium) 13px/1 var(--font-sans)", color: "var(--text-secondary)", marginTop: 5 }}>
            Lote #{job.id.slice(0, 8)} · {total} empresas · {job.decisor_count} decisores listos
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

      {/* preview + descarga */}
      <div style={{ display: "flex", gap: 20, alignItems: "stretch", flexWrap: "wrap" }}>
        <div
          style={{
            flex: 1,
            minWidth: 380,
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--neutral-50)", borderBottom: "1px solid var(--border-subtle)" }}>
            <i data-lucide="file-spreadsheet" style={{ width: 18, height: 18, color: "var(--green-600)" }} />
            <span style={{ font: "var(--weight-semibold) 13px/1 var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {filename}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
              <span style={{ font: "var(--weight-bold) 10px/1 var(--font-tech)", padding: "4px 8px", borderRadius: 6, background: "var(--green-100)", color: "var(--green-600)" }}>DECISORES</span>
              <span style={{ font: "var(--weight-bold) 10px/1 var(--font-tech)", padding: "4px 8px", borderRadius: 6, background: "var(--amber-100)", color: "#9A6A00" }}>REVISAR</span>
              <span style={{ font: "var(--weight-bold) 10px/1 var(--font-tech)", padding: "4px 8px", borderRadius: 6, background: "var(--neutral-100)", color: "var(--text-secondary)" }}>SIN RESULTADO</span>
            </span>
          </div>
          {preview.length > 0 ? (
            <div style={{ overflow: "hidden", font: "var(--weight-medium) 12px/1 var(--font-sans)" }}>
              <div style={{ display: "grid", gridTemplateColumns: cols, background: "var(--neutral-100)", color: "var(--text-muted)", font: "var(--weight-bold) 10px/1 var(--font-tech)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                <div style={{ padding: "9px 8px", borderRight: "1px solid var(--border-subtle)" }} />
                <div style={{ padding: "9px 10px", borderRight: "1px solid var(--border-subtle)" }}>Nombre</div>
                <div style={{ padding: "9px 10px", borderRight: "1px solid var(--border-subtle)" }}>Cargo</div>
                <div style={{ padding: "9px 10px", borderRight: "1px solid var(--border-subtle)" }}>Empresa</div>
                <div style={{ padding: "9px 10px", borderRight: "1px solid var(--border-subtle)" }}>LinkedIn</div>
                <div style={{ padding: "9px 10px" }}>Teléfono</div>
              </div>
              {preview.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--neutral-100)" }}>
                  <div style={{ padding: "9px 8px", textAlign: "center", color: "var(--neutral-300)", borderRight: "1px solid var(--neutral-100)", font: "var(--weight-bold) 10px/1.3 var(--font-tech)" }}>{i + 1}</div>
                  <div style={{ padding: "9px 10px", borderRight: "1px solid var(--neutral-100)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nombre}</div>
                  <div style={{ padding: "9px 10px", borderRight: "1px solid var(--neutral-100)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.cargo}</div>
                  <div style={{ padding: "9px 10px", borderRight: "1px solid var(--neutral-100)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.empresa}</div>
                  <div style={{ padding: "9px 10px", borderRight: "1px solid var(--neutral-100)", color: "var(--text-link)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.linkedin}</div>
                  <div style={{ padding: "9px 10px", color: "var(--neutral-300)", fontStyle: "italic" }}>—</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "28px 16px", color: "var(--text-muted)", font: "var(--weight-medium) 13px/1.5 var(--font-sans)" }}>
              La lista completa está dentro del Excel — tres hojas (Decisores, Revisar y Sin resultado), con la
              columna teléfono lista para rellenar a mano.
            </div>
          )}
        </div>

        {/* panel de descarga */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            background: "var(--ink)",
            color: "#fff",
            borderRadius: "var(--radius-lg)",
            padding: 26,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(360px 200px at 90% 0%, rgba(227,6,19,0.22), transparent)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--neon-cyan)" }}>
              Lista lista para llamar
            </div>
            <div style={{ font: "var(--weight-extra) 40px/0.95 var(--font-display)", textTransform: "uppercase", marginTop: 12 }}>
              Bájalo
              <br />y a por <span style={{ color: "var(--red-400)" }}>ello ⚡</span>
            </div>
            <div style={{ font: "var(--weight-medium) 13px/1.5 var(--font-sans)", color: "var(--neutral-400)", marginTop: 12 }}>
              Un archivo, tres hojas. La columna teléfono va lista para rellenar a mano.
            </div>
            <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href={`/jobs/${job.id}/download`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 56,
                  borderRadius: 999,
                  background: "var(--color-brand)",
                  color: "#fff",
                  font: "var(--weight-bold) 17px/1 var(--font-sans)",
                  boxShadow: "var(--glow-red-sm)",
                }}
              >
                <i data-lucide="download" style={{ width: 19, height: 19 }} /> Descargar Excel
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
