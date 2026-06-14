import React from "react";

/**
 * GAS Input — text field with optional label, leading icon and hint/error.
 */
export function Input({
  label,
  hint,
  error,
  icon,            // lucide name, leading
  size = "md",     // sm | md | lg
  id,
  style = {},
  containerStyle = {},
  ...rest
}) {
  const heights = { sm: "var(--control-sm)", md: "var(--control-md)", lg: "var(--control-lg)" };
  const reactId = React.useId();
  const inputId = id || reactId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", ...containerStyle }}>
      {label && (
        <label htmlFor={inputId} style={{ font: "var(--weight-semibold) 13px/1.2 var(--font-sans)", color: "var(--text-primary)" }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <i data-lucide={icon} style={{
            position: "absolute", left: 14, width: 18, height: 18,
            color: "var(--text-muted)", pointerEvents: "none",
          }} />
        )}
        <input
          id={inputId}
          className="gas-input"
          style={{
            width: "100%",
            height: heights[size],
            padding: icon ? "0 14px 0 42px" : "0 14px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "15px",
            color: "var(--text-primary)",
            background: "var(--surface-card)",
            border: `1.5px solid ${error ? "var(--color-danger)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-input)",
            transition: "border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
            ...style,
          }}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: error ? "var(--color-danger)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
