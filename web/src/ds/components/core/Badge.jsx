import React from "react";

/**
 * GAS Badge — small status/label pill. Tech-font, uppercase.
 */
export function Badge({
  children,
  tone = "neutral",   // neutral | brand | flame | success | warning | info | dark
  dot = false,
  icon,               // optional lucide name
  style = {},
  ...rest
}) {
  const tones = {
    neutral: { background: "var(--neutral-100)", color: "var(--text-secondary)" },
    brand:   { background: "var(--red-50)",  color: "var(--red-700)" },
    flame:   { background: "var(--flame-100)", color: "var(--flame-600)" },
    success: { background: "var(--color-success-bg)", color: "var(--color-success)" },
    warning: { background: "var(--color-warning-bg)", color: "#9A6A00" },
    info:    { background: "var(--color-info-bg)", color: "var(--cyan-500)" },
    dark:    { background: "var(--ink)", color: "#fff" },
  };
  const dotColor = {
    neutral: "var(--neutral-400)", brand: "var(--red-500)", flame: "var(--flame-500)",
    success: "var(--color-success)", warning: "var(--color-warning)", info: "var(--cyan-500)", dark: "var(--neon-cyan)",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 10px",
        fontFamily: "var(--font-tech)",
        fontWeight: 700,
        fontSize: "11px",
        lineHeight: 1,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        borderRadius: "var(--radius-pill)",
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor[tone] }} />}
      {icon && <i data-lucide={icon} style={{ width: 13, height: 13 }} />}
      {children}
    </span>
  );
}
