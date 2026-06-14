import React from "react";

/**
 * GAS ProgressBar — goal / quota progress. Brand red fill, optional glow.
 */
export function ProgressBar({
  value = 0,           // 0-100
  tone = "brand",      // brand | flame | success | dark
  size = "md",         // sm | md | lg
  label,
  showValue = false,
  glow = false,
  style = {},
  ...rest
}) {
  const heights = { sm: 6, md: 10, lg: 14 };
  const h = heights[size];
  const pct = Math.max(0, Math.min(100, value));
  const fills = {
    brand: "var(--color-brand)",
    flame: "var(--color-accent)",
    success: "var(--color-success)",
    dark: "var(--ink)",
  };
  const glows = { brand: "var(--glow-red-sm)", flame: "var(--glow-flame)", success: "none", dark: "none" };

  return (
    <div style={{ width: "100%", ...style }} {...rest}>
      {(label || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          {label && <span style={{ font: "var(--weight-semibold) 13px/1 var(--font-sans)", color: "var(--text-secondary)" }}>{label}</span>}
          {showValue && <span style={{ font: "var(--weight-bold) 13px/1 var(--font-tech)", color: "var(--text-primary)" }}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div style={{ width: "100%", height: h, borderRadius: "var(--radius-pill)", background: "var(--neutral-200)", overflow: "hidden" }}>
        <div style={{
          width: pct + "%", height: "100%", borderRadius: "var(--radius-pill)",
          background: fills[tone], boxShadow: glow ? glows[tone] : "none",
          transition: "width var(--dur-slow) var(--ease-out)",
        }} />
      </div>
    </div>
  );
}
