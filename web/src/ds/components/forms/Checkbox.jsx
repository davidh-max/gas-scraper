import React from "react";

/**
 * GAS Checkbox — controlled or uncontrolled, with label.
 */
export function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const reactId = React.useId();
  const cbId = id || reactId;
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;

  const toggle = (e) => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };

  return (
    <label
      htmlFor={cbId}
      style={{
        display: "inline-flex", alignItems: "center", gap: "10px",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        font: "var(--weight-medium) 15px/1.3 var(--font-sans)", color: "var(--text-primary)",
        ...style,
      }}
    >
      <input id={cbId} type="checkbox" checked={on} onChange={toggle} disabled={disabled}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, flexShrink: 0, borderRadius: "var(--radius-xs)",
        background: on ? "var(--color-brand)" : "var(--surface-card)",
        border: `1.5px solid ${on ? "var(--color-brand)" : "var(--border-strong)"}`,
        transition: "all var(--dur-base) var(--ease-standard)",
      }}>
        {on && <i data-lucide="check" style={{ width: 14, height: 14, color: "#fff", strokeWidth: 3 }} />}
      </span>
      {label}
    </label>
  );
}
