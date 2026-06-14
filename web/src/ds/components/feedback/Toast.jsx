import React from "react";

/**
 * GAS Toast — transient notification. Renders inline (static); pair with
 * your own queue/portal for live use.
 */
export function Toast({
  title,
  message,
  tone = "neutral",   // neutral | success | warning | danger | brand
  icon,               // lucide name (defaults per tone)
  onClose,
  style = {},
  ...rest
}) {
  const tones = {
    neutral: { accent: "var(--neutral-500)", defIcon: "bell" },
    success: { accent: "var(--color-success)", defIcon: "check-circle" },
    warning: { accent: "var(--color-warning)", defIcon: "alert-triangle" },
    danger:  { accent: "var(--color-danger)", defIcon: "alert-circle" },
    brand:   { accent: "var(--color-brand)", defIcon: "zap" },
  };
  const t = tones[tone];

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: "12px",
        width: "360px", maxWidth: "100%",
        padding: "14px 16px",
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        ...style,
      }}
      {...rest}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, flexShrink: 0, borderRadius: "var(--radius-sm)",
        background: "color-mix(in srgb, " + "currentColor" + " 0%, transparent)",
        backgroundColor: "var(--neutral-100)", color: t.accent,
      }}>
        <i data-lucide={icon || t.defIcon} style={{ width: 18, height: 18 }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ font: "var(--weight-bold) 14px/1.3 var(--font-sans)", color: "var(--text-primary)", marginBottom: message ? 2 : 0 }}>{title}</div>}
        {message && <div style={{ font: "var(--weight-regular) 13px/1.45 var(--font-sans)", color: "var(--text-secondary)" }}>{message}</div>}
      </div>
      {onClose && (
        <button aria-label="Cerrar" onClick={onClose} style={{
          border: "none", background: "transparent", color: "var(--text-muted)",
          cursor: "pointer", padding: 2, display: "inline-flex", flexShrink: 0,
        }}>
          <i data-lucide="x" style={{ width: 16, height: 16 }} />
        </button>
      )}
    </div>
  );
}
