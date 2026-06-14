import React from "react";

/**
 * GAS Tag — removable/selectable chip (filters, categories).
 */
export function Tag({
  children,
  selected = false,
  onRemove,
  icon,
  style = {},
  ...rest
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        height: "30px",
        padding: onRemove ? "0 8px 0 12px" : "0 13px",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: "13px",
        lineHeight: 1,
        borderRadius: "var(--radius-pill)",
        cursor: rest.onClick ? "pointer" : "default",
        background: selected ? "var(--ink)" : "var(--neutral-100)",
        color: selected ? "#fff" : "var(--text-secondary)",
        border: selected ? "1.5px solid var(--ink)" : "1.5px solid transparent",
        transition: "all var(--dur-base) var(--ease-standard)",
        ...style,
      }}
      {...rest}
    >
      {icon && <i data-lucide={icon} style={{ width: 14, height: 14 }} />}
      {children}
      {onRemove && (
        <button
          aria-label="Quitar"
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, marginLeft: 2, border: "none", borderRadius: "50%",
            background: selected ? "rgba(255,255,255,0.18)" : "var(--neutral-200)",
            color: "inherit", cursor: "pointer", padding: 0,
          }}
        >
          <i data-lucide="x" style={{ width: 12, height: 12 }} />
        </button>
      )}
    </span>
  );
}
