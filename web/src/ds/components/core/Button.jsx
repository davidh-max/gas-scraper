import React from "react";

/**
 * GAS Button — pill-shaped, energetic. The dark "botón redondeado oscuro"
 * is the signature; primary red and flame-amber carry CTAs.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,            // lucide icon name (string), rendered left of label
  iconRight,       // lucide icon name (string), rendered right of label
  fullWidth = false,
  disabled = false,
  type = "button",
  style = {},
  ...rest
}) {
  const heights = { sm: "var(--control-sm)", md: "var(--control-md)", lg: "var(--control-lg)" };
  const pads = { sm: "0 16px", md: "0 22px", lg: "0 28px" };
  const fonts = { sm: "14px", md: "15px", lg: "17px" };

  const variants = {
    primary: {
      background: "var(--color-brand)",
      color: "var(--text-on-brand)",
      boxShadow: "var(--glow-red-sm)",
      border: "1.5px solid transparent",
    },
    accent: {
      background: "var(--color-accent)",
      color: "#fff",
      boxShadow: "var(--glow-flame)",
      border: "1.5px solid transparent",
    },
    dark: {
      background: "var(--ink)",
      color: "#fff",
      border: "1.5px solid transparent",
    },
    secondary: {
      background: "var(--surface-card)",
      color: "var(--text-primary)",
      border: "1.5px solid var(--border-default)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-primary)",
      border: "1.5px solid transparent",
    },
  };

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    height: heights[size],
    padding: pads[size],
    width: fullWidth ? "100%" : "auto",
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: fonts[size],
    lineHeight: 1,
    letterSpacing: "0.01em",
    borderRadius: "var(--radius-button)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "background var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
    whiteSpace: "nowrap",
    ...variants[variant],
    ...style,
  };

  const sz = size === "lg" ? 19 : size === "sm" ? 15 : 17;

  return (
    <button
      type={type}
      disabled={disabled}
      className={`gas-btn gas-btn--${variant}`}
      style={base}
      {...rest}
    >
      {icon && <i data-lucide={icon} style={{ width: sz, height: sz }} />}
      {children}
      {iconRight && <i data-lucide={iconRight} style={{ width: sz, height: sz }} />}
    </button>
  );
}
