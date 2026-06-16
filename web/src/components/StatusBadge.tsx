import type { JobStatus } from "@/types/db";

// Pastilla de estado del job con el lenguaje visual del diseño (font tech,
// uppercase, color por estado). El estado "en proceso" lleva punto latiendo.

const PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  font: "var(--weight-bold) 11px/1 var(--font-tech)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

function PulseDot() {
  return (
    <span style={{ position: "relative", width: 7, height: 7, display: "inline-block" }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--cyan-500)" }} />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "var(--cyan-500)",
          animation: "gasPulse 1.6s var(--ease-out) infinite",
        }}
      />
    </span>
  );
}

export function StatusBadge({ status, progress }: { status: JobStatus; progress?: number }) {
  if (status === "done") {
    return (
      <span style={{ ...PILL, background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <i data-lucide="check" style={{ width: 13, height: 13 }} /> Hecho
      </span>
    );
  }
  if (status === "error") {
    return (
      <span style={{ ...PILL, background: "var(--red-50)", color: "var(--red-600)" }}>
        <i data-lucide="alert-triangle" style={{ width: 12, height: 12 }} /> Error
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span style={{ ...PILL, background: "var(--neutral-100)", color: "var(--text-secondary)" }}>
        <i data-lucide="ban" style={{ width: 12, height: 12 }} /> Cancelado
      </span>
    );
  }
  if (status === "queued") {
    return (
      <span style={{ ...PILL, background: "var(--neutral-100)", color: "var(--text-secondary)" }}>
        <i data-lucide="clock" style={{ width: 12, height: 12 }} /> En cola
      </span>
    );
  }
  // resolving | searching | verifying (+ enriching legado) → "en proceso"
  return (
    <span style={{ ...PILL, gap: 7, background: "var(--cyan-100)", color: "var(--cyan-500)" }}>
      <PulseDot />
      {progress != null ? `${progress}%` : "Procesando"}
    </span>
  );
}
