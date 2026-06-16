"use client";

import { useState, useTransition } from "react";

import { ContactFeedbackControl } from "./ContactFeedbackControl";
import { updateContactStatus } from "@/lib/actions";
import type { ContactFeedback, ContactStatus, FeedbackReason } from "@/types/db";
import type { JobContact } from "@/lib/data/source";

interface ContactActionsProps {
  contact: JobContact;
  onFeedbackChange?: (feedback: ContactFeedback, reason?: FeedbackReason | null, note?: string | null) => void;
  onStatusChange?: (status: ContactStatus) => void;
}

export function ContactActions({ contact, onFeedbackChange, onStatusChange }: ContactActionsProps) {
  const isReview = contact.classification === "revisar";
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [pending, startTransition] = useTransition();

  function act(next: ContactStatus) {
    startTransition(async () => {
      await updateContactStatus(contact.id, next);
      setStatus(next);
      onStatusChange?.(next);
    });
  }

  if (isReview) {
    const resolved = status !== "pending";
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        {!resolved && (
          <>
            <button
              type="button"
              className="gas-action-x"
              onClick={() => act("discarded")}
              disabled={pending}
              title="Descartar"
              style={{
                width: 34,
                height: 34,
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
              className="gas-action-ok"
              onClick={() => act("approved")}
              disabled={pending}
              title="Aprobar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 34,
                padding: "0 14px",
                borderRadius: 999,
                border: "none",
                background: "var(--green-500)",
                color: "#fff",
                font: "var(--weight-bold) 13px/1 var(--font-sans)",
                cursor: pending ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
              }}
            >
              <i data-lucide="check" style={{ width: 15, height: 15 }} /> OK
            </button>
          </>
        )}
        {resolved && (
          <>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                height: 28,
                padding: "0 10px",
                borderRadius: 999,
                background: status === "approved" ? "var(--color-success-bg)" : "var(--neutral-100)",
                color: status === "approved" ? "var(--color-success)" : "var(--text-muted)",
                font: "var(--weight-bold) 11px/1 var(--font-tech)",
                letterSpacing: ".04em",
                textTransform: "uppercase",
              }}
            >
              <i data-lucide={status === "approved" ? "check-circle-2" : "x-circle"} style={{ width: 13, height: 13 }} />
              {status === "approved" ? "OK" : "Descartado"}
            </span>
            <button
              type="button"
              onClick={() => act("pending")}
              disabled={pending}
              title="Deshacer"
              style={{
                width: 28,
                height: 28,
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
              <i data-lucide="rotate-ccw" style={{ width: 13, height: 13 }} />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <ContactFeedbackControl
      contactId={contact.id}
      initialFeedback={contact.feedback}
      initialReason={contact.feedback_reason}
      initialNote={contact.feedback_note}
      onChange={onFeedbackChange}
    />
  );
}
