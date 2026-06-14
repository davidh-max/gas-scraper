import React from "react";

/**
 * GAS Select — native select styled to match Input, with chevron.
 */
export function Select({
  label,
  hint,
  error,
  options = [],     // [{value, label}] or string[]
  placeholder,
  size = "md",
  id,
  style = {},
  containerStyle = {},
  ...rest
}) {
  const heights = { sm: "var(--control-sm)", md: "var(--control-md)", lg: "var(--control-lg)" };
  const reactId = React.useId();
  const selId = id || reactId;
  const norm = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...containerStyle }}>
      {label && (
        <label htmlFor={selId} style={{ font: "var(--weight-semibold) 13px/1.2 var(--font-sans)", color: "var(--text-primary)" }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          id={selId}
          className="gas-input"
          style={{
            width: "100%",
            height: heights[size],
            padding: "0 40px 0 14px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "15px",
            color: "var(--text-primary)",
            background: "var(--surface-card)",
            border: `1.5px solid ${error ? "var(--color-danger)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-input)",
            appearance: "none",
            cursor: "pointer",
            transition: "border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
            ...style,
          }}
          defaultValue={placeholder ? "" : undefined}
          {...rest}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {norm.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <i data-lucide="chevron-down" style={{
          position: "absolute", right: 14, width: 18, height: 18,
          color: "var(--text-muted)", pointerEvents: "none",
        }} />
      </div>
      {(hint || error) && (
        <span style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: error ? "var(--color-danger)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
