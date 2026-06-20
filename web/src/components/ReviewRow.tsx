"use client";

import { useState, useTransition } from "react";

import { updateContactStatus } from "@/lib/actions";
import type { ContactStatus } from "@/types/db";
import type { ReviewContact } from "@/lib/data/source";

export const REVIEW_COLUMNS = "1.6fr 1.4fr 1.4fr 1.6fr 168px";

function initials(contact: ReviewContact): string {
  const a = (contact.first_name ?? "").charAt(0);
  const b = (contact.last_name ?? "").charAt(0);
  return (a + b).toUpperCase() || "?";
}

function linkedinLabel(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^https?:\/\/(www\.)?linkedin\.com\//i, "").replace(/\/+$/, "");
}

export function ReviewRow({ contact }: { contact: ReviewContact }) {
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [pending, startTransition] = useTransition();

  function act(next: ContactStatus) {
    startTransition(async () => {
      await updateContactStatus(contact.id, next);
      setStatus(next);
    });
  }

  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "—";
  const li = linkedinLabel(contact.linkedin_url);
  const resolved = status !== "pending";

  return (
    <div
      className="gas-row"
      style={{
        display: "grid",
        gridTemplateColumns: REVIEW_COLUMNS,
        gap: 14,
        padding: "14px 26px",
        alignItems: "center",
        borderBottom: "1px solid var(--neutral-100)",
        background: status === "approved" ? "rgba(34,197,94,0.04)" : status === "discarded" ? "var(--neutral-50)" : "#fff",
        opacity: status === "discarded" ? 0.62 : 1,
        transition: "background var(--dur-base) var(--ease-standard), opacity var(--dur-base) var(--ease-standard)",
      }}
    >
      {/* contacto */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--neutral-100)",
            color: "var(--text-secondary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "var(--weight-bold) 13px/1 var(--font-tech)",
            flexShrink: 0,
          }}
        >
          {initials(contact)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              font: "var(--weight-semibold) 14px/1.2 var(--font-sans)",
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          {li && contact.linkedin_url && (
            <a
              className="gas-link"
              href={contact.linkedin_url}
              target="_blank"
              rel="noreferrer"
              title={contact.linkedin_url}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                maxWidth: "100%",
                marginTop: 2,
              }}
            >
              <i data-lucide="external-link" style={{ width: 12, height: 12, flexShrink: 0, color: "var(--text-link)" }} />
              <span
                style={{
                  font: "var(--weight-semibold) 12px/1.3 var(--font-sans)",
                  color: "var(--text-link)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {li}
              </span>
            </a>
          )}
        </div>
      </div>

      {/* cargo */}
      <div style={{ font: "var(--weight-medium) 13px/1.3 var(--font-sans)", color: "var(--text-primary)", minWidth: 0 }}>
        {contact.title ?? "—"}
      </div>

      {/* empresa */}
      <div style={{ font: "var(--weight-medium) 13px/1.3 var(--font-sans)", color: "var(--text-secondary)", minWidth: 0 }}>
        {contact.companyName}
      </div>

      {/* motivo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amber-500)", flexShrink: 0 }} />
        <span style={{ font: "var(--weight-medium) 12px/1.35 var(--font-sans)", color: "var(--text-secondary)" }}>
          {contact.reason}
        </span>
      </div>

      {/* acción */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {!resolved && (
          <>
            <button
              type="button"
              onClick={() => act("discarded")}
              disabled={pending}
              title="Descartar"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "1.5px solid var(--border-default)",
                background: "#fff",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: pending ? "not-allowed" : "pointer",
              }}
            >
              <i data-lucide="x" style={{ width: 17, height: 17 }} />
            </button>
            <button
              type="button"
              onClick={() => act("approved")}
              disabled={pending}
              title="Aprobar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 38,
                padding: "0 16px",
                borderRadius: 999,
                border: "none",
                background: "var(--green-500)",
                color: "#fff",
                font: "var(--weight-bold) 13px/1 var(--font-sans)",
                cursor: pending ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
              }}
            >
              <i data-lucide="check" style={{ width: 16, height: 16 }} /> OK
            </button>
          </>
        )}
        {resolved && (
          <>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 38,
                padding: "0 14px",
                borderRadius: 999,
                background: status === "approved" ? "var(--color-success-bg)" : "var(--neutral-100)",
                color: status === "approved" ? "var(--color-success)" : "var(--text-muted)",
                font: "var(--weight-bold) 12px/1 var(--font-tech)",
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              <i data-lucide={status === "approved" ? "check-circle-2" : "x-circle"} style={{ width: 15, height: 15 }} />
              {status === "approved" ? "Aprobado" : "Descartado"}
            </span>
            <button
              type="button"
              onClick={() => act("pending")}
              disabled={pending}
              title="Deshacer"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: "var(--neutral-400)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: pending ? "not-allowed" : "pointer",
              }}
            >
              <i data-lucide="rotate-ccw" style={{ width: 14, height: 14 }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
