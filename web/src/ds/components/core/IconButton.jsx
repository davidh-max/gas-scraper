import React from "react";

/**
 * GAS IconButton — square/circular icon-only control.
 * Default = subtle neutral; brand = solid red.
 */
export function IconButton({
  icon,
  variant = "default",   // default | brand | ghost
  size = "md",           // sm | md | lg
  shape = "circle",      // circle | square
  ariaLabel,
  disabled = false,
  style = {},
  ...rest
}) {
  const dims = { sm: 36, md: 44, lg: 52 };
  const iconSz = { sm: 17, md: 19, lg: 22 };
  const d = dims[size];

  const variants = {
    default: { background: "var(--surface-card)", color: "var(--text-secondary)", border: "1.5px solid var(--border-subtle)" },
    brand:   { background: "var(--color-brand)", color: "#fff", border: "1.5px solid transparent", boxShadow: "var(--glow-red-sm)" },
    ghost:   { background: "transparent", color: "var(--text-secondary)", border: "1.5px solid transparent" },
  };

  return (
    <button
      aria-label={ariaLabel}
      disabled={disabled}
      className={`gas-iconbtn gas-iconbtn--${variant}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: d,
        height: d,
        borderRadius: shape === "circle" ? "var(--radius-pill)" : "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      <i data-lucide={icon} style={{ width: iconSz[size], height: iconSz[size] }} />
    </button>
  );
}
