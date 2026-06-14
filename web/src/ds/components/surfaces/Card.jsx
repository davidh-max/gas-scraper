import React from "react";

/**
 * GAS Card — surface container. White by default; `tone="dark"` for the
 * graphite feature card; `interactive` adds hover lift.
 */
export function Card({
  children,
  tone = "light",      // light | dark | brand
  padding = "lg",      // sm | md | lg | none
  interactive = false,
  style = {},
  ...rest
}) {
  const pads = { none: 0, sm: "var(--space-4)", md: "var(--space-5)", lg: "var(--space-6)" };
  const tones = {
    light: { background: "var(--surface-card)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" },
    dark:  { background: "var(--ink)", border: "1px solid var(--border-inverse)", color: "#fff", boxShadow: "var(--shadow-md)" },
    brand: { background: "var(--color-brand)", border: "1px solid transparent", color: "#fff", boxShadow: "var(--glow-red-sm)" },
  };

  return (
    <div
      className={interactive ? "gas-card--interactive" : undefined}
      style={{
        borderRadius: "var(--radius-card)",
        padding: pads[padding],
        ...tones[tone],
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
