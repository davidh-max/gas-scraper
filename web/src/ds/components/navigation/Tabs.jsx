import React from "react";

/**
 * GAS Tabs — underline tab bar. Controlled or uncontrolled.
 * tabs: [{ id, label, icon?, count? }]
 */
export function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange,
  style = {},
  ...rest
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? (tabs[0] && tabs[0].id));
  const active = isControlled ? value : internal;

  const select = (id) => {
    if (!isControlled) setInternal(id);
    onChange && onChange(id);
  };

  return (
    <div
      role="tablist"
      style={{
        display: "flex", gap: "4px", alignItems: "stretch",
        borderBottom: "1.5px solid var(--border-subtle)",
        ...style,
      }}
      {...rest}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            className="gas-tab"
            onClick={() => select(t.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "12px 14px", marginBottom: "-1.5px",
              border: "none", background: "transparent", cursor: "pointer",
              font: "var(--weight-semibold) 14px/1 var(--font-sans)",
              color: on ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: `2.5px solid ${on ? "var(--color-brand)" : "transparent"}`,
            }}
          >
            {t.icon && <i data-lucide={t.icon} style={{ width: 16, height: 16 }} />}
            {t.label}
            {t.count != null && (
              <span style={{
                font: "var(--weight-bold) 11px/1 var(--font-tech)",
                padding: "3px 7px", borderRadius: "var(--radius-pill)",
                background: on ? "var(--red-50)" : "var(--neutral-100)",
                color: on ? "var(--color-brand)" : "var(--text-muted)",
              }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
