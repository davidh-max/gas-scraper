import React from "react";

/**
 * GAS Avatar — initials or image, optional live status ring/dot.
 */
export function Avatar({
  name = "",
  src,
  size = "md",       // xs | sm | md | lg | xl
  status,            // "online" | "busy" | "away" | undefined
  ring = false,      // brand ring (e.g. active caller)
  style = {},
  ...rest
}) {
  const dims = { xs: 24, sm: 32, md: 40, lg: 52, xl: 72 };
  const d = dims[size];
  const initials = name
    .split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const statusColors = { online: "var(--color-success)", busy: "var(--color-brand)", away: "var(--color-warning)" };
  const dot = Math.max(8, Math.round(d * 0.28));

  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0, ...style }} {...rest}>
      <span
        style={{
          width: d, height: d, borderRadius: "50%", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: src ? "var(--neutral-200)" : "var(--neutral-800)",
          color: "#fff", fontFamily: "var(--font-tech)", fontWeight: 700,
          fontSize: Math.round(d * 0.38), letterSpacing: "0.02em",
          boxShadow: ring ? "0 0 0 2px var(--surface-card), 0 0 0 4px var(--color-brand)" : "none",
        }}
      >
        {src ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
      </span>
      {status && (
        <span
          style={{
            position: "absolute", right: -1, bottom: -1, width: dot, height: dot,
            borderRadius: "50%", background: statusColors[status],
            border: "2px solid var(--surface-card)",
          }}
        />
      )}
    </span>
  );
}
