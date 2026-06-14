import React from "react";

/**
 * GAS Switch — toggle. On = energy red. Controlled or uncontrolled.
 */
export function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled = false,
  size = "md",   // sm | md
  id,
  style = {},
  ...rest
}) {
  const reactId = React.useId();
  const swId = id || reactId;
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;

  const W = size === "sm" ? 38 : 46;
  const H = size === "sm" ? 22 : 26;
  const K = H - 6;

  const toggle = (e) => {
    if (disabled) return;
    if (!isControlled) setInternal(e.target.checked);
    onChange && onChange(e);
  };

  return (
    <label
      htmlFor={swId}
      style={{
        display: "inline-flex", alignItems: "center", gap: "10px",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        font: "var(--weight-medium) 15px/1.3 var(--font-sans)", color: "var(--text-primary)",
        ...style,
      }}
    >
      <input id={swId} type="checkbox" checked={on} onChange={toggle} disabled={disabled}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} {...rest} />
      <span className="gas-switch" style={{
        position: "relative", width: W, height: H, flexShrink: 0,
        borderRadius: "var(--radius-pill)",
        background: on ? "var(--color-brand)" : "var(--neutral-300)",
        boxShadow: on ? "var(--glow-red-sm)" : "none",
      }}>
        <span className="gas-switch__knob" style={{
          position: "absolute", top: 3, left: 3, width: K, height: K,
          borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-sm)",
          transform: on ? `translateX(${W - K - 6}px)` : "translateX(0)",
        }} />
      </span>
      {label}
    </label>
  );
}
