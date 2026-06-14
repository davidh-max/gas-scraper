import React from "react";

/**
 * GAS StatCard — KPI tile with big tech-font number, label, optional
 * delta and icon. Used across the SCRAPER dashboard.
 */
export function StatCard({
  label,
  value,
  unit,
  delta,            // e.g. "+12%" or "-4%"
  trend,            // "up" | "down" — colors the delta
  icon,             // lucide name
  tone = "light",   // light | dark
  style = {},
  ...rest
}) {
  const dark = tone === "dark";
  const deltaUp = trend === "up" || (delta && delta.trim().startsWith("+"));
  const deltaColor = deltaUp ? "var(--color-success)" : "var(--color-brand)";

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: "12px",
        padding: "var(--space-5)",
        borderRadius: "var(--radius-card)",
        background: dark ? "var(--ink)" : "var(--surface-card)",
        border: dark ? "1px solid var(--border-inverse)" : "1px solid var(--border-subtle)",
        boxShadow: dark ? "var(--shadow-md)" : "var(--shadow-sm)",
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          font: "var(--weight-bold) 11px/1 var(--font-tech)", letterSpacing: "0.1em",
          textTransform: "uppercase", color: dark ? "var(--neutral-400)" : "var(--text-muted)",
        }}>{label}</span>
        {icon && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: "var(--radius-sm)",
            background: dark ? "rgba(255,255,255,0.08)" : "var(--red-50)",
            color: dark ? "var(--neon-cyan)" : "var(--color-brand)",
          }}>
            <i data-lucide={icon} style={{ width: 17, height: 17 }} />
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <span style={{
          font: "var(--weight-extra) 38px/0.9 var(--font-tech)",
          color: dark ? "#fff" : "var(--ink)", letterSpacing: "-0.01em",
        }}>{value}</span>
        {unit && <span style={{ font: "var(--weight-semibold) 14px/1 var(--font-tech)", color: dark ? "var(--neutral-400)" : "var(--text-muted)", textTransform: "uppercase" }}>{unit}</span>}
      </div>
      {delta && (
        <div style={{ display: "flex", alignItems: "center", gap: "5px", color: deltaColor, font: "var(--weight-bold) 13px/1 var(--font-sans)" }}>
          <i data-lucide={deltaUp ? "trending-up" : "trending-down"} style={{ width: 15, height: 15 }} />
          {delta}
        </div>
      )}
    </div>
  );
}
