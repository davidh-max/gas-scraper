"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { Input, Select } from "@/ds";
import { updateContactFeedback } from "@/lib/actions";
import type { ContactFeedback, FeedbackReason } from "@/types/db";

const FEEDBACK_REASON_LABELS: Record<FeedbackReason, string> = {
  ya_no_en_empresa: "Ya no está en la empresa",
  empresa_incorrecta: "Empresa equivocada",
  url_incorrecta: "URL de LinkedIn incorrecta",
  jubilado: "Se ha jubilado",
  no_es_decisor: "No era el decisor",
  otro: "Otro",
};

const REASON_OPTIONS: { value: FeedbackReason; label: string }[] = Object.entries(FEEDBACK_REASON_LABELS).map(
  ([value, label]) => ({ value: value as FeedbackReason, label }),
);

const MENU_WIDTH = 220;

interface ContactFeedbackControlProps {
  contactId: string;
  initialFeedback: ContactFeedback;
  initialReason?: FeedbackReason | null;
  initialNote?: string | null;
  onChange?: (feedback: ContactFeedback, reason?: FeedbackReason | null, note?: string | null) => void;
}

export function ContactFeedbackControl({
  contactId,
  initialFeedback,
  initialReason = null,
  initialNote = null,
  onChange,
}: ContactFeedbackControlProps) {
  const [feedback, setFeedback] = useState<ContactFeedback>(initialFeedback);
  const [reason, setReason] = useState<FeedbackReason | null>(initialReason ?? null);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function computePosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setMenuPos({ top: rect.bottom + 6, left });
  }

  function toggle() {
    if (!open) {
      computePosition();
    }
    setOpen((v) => !v);
  }

  const save = (nextFeedback: ContactFeedback, nextReason?: FeedbackReason | null, nextNote?: string) => {
    startTransition(async () => {
      setError(null);
      try {
        await updateContactFeedback(contactId, nextFeedback, nextReason, nextNote);
        onChange?.(nextFeedback, nextReason, nextNote);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
        setFeedback(initialFeedback);
        setReason(initialReason ?? null);
        setNote(initialNote ?? "");
      }
    });
  };

  const handleFeedbackChange = (next: ContactFeedback) => {
    setFeedback(next);
    if (next === "valido") {
      setReason(null);
      setNote("");
      save(next, null, "");
    } else {
      const nextReason = reason ?? "ya_no_en_empresa";
      setReason(nextReason);
      save(next, nextReason, note);
    }
  };

  const handleReasonChange = (value: string) => {
    const nextReason = value as FeedbackReason;
    setReason(nextReason);
    save(feedback, nextReason, note);
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    if (reason === "otro") {
      save(feedback, reason, value);
    }
  };

  const triggerIcon = feedback === "no_valido" ? "x" : "more-vertical";
  const triggerColor = feedback === "no_valido" ? "var(--color-danger)" : "var(--text-muted)";
  const triggerBorder = feedback === "no_valido" ? "1.5px solid var(--red-200)" : "1.5px solid var(--border-default)";

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        className="gas-feedback-btn"
        data-feedback={feedback}
        disabled={pending}
        title={feedback === "no_valido" ? "Erróneo — abrir opciones" : "Opciones de validación"}
        onClick={toggle}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: triggerBorder,
          background: feedback === "no_valido" ? "var(--red-50)" : undefined,
          color: triggerColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: pending ? "not-allowed" : "pointer",
        }}
      >
        <i data-lucide={triggerIcon} style={{ width: 18, height: 18 }} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos?.top ?? 0,
              left: menuPos?.left ?? 0,
              width: MENU_WIDTH,
              background: "#fff",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              zIndex: 200,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                font: "var(--weight-bold) 10px/1 var(--font-tech)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "4px 6px",
              }}
            >
              Validación
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={() => handleFeedbackChange("valido")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: feedback === "valido" ? "var(--green-50)" : "transparent",
                color: feedback === "valido" ? "var(--green-600)" : "var(--text-primary)",
                font: "var(--weight-semibold) 13px/1 var(--font-sans)",
                cursor: pending ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              <i data-lucide="check" style={{ width: 15, height: 15 }} />
              Válido
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => handleFeedbackChange("no_valido")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: feedback === "no_valido" ? "var(--red-50)" : "transparent",
                color: feedback === "no_valido" ? "var(--color-danger)" : "var(--text-primary)",
                font: "var(--weight-semibold) 13px/1 var(--font-sans)",
                cursor: pending ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              <i data-lucide="x" style={{ width: 15, height: 15 }} />
              Erróneo
            </button>

            {feedback === "no_valido" && (
              <div style={{ padding: "4px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <Select
                  size="sm"
                  placeholder="Motivo"
                  options={REASON_OPTIONS}
                  value={reason ?? ""}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  disabled={pending}
                />
                {reason === "otro" && (
                  <Input
                    size="sm"
                    placeholder="Nota corta..."
                    value={note}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    disabled={pending}
                  />
                )}
              </div>
            )}

            {error && (
              <span style={{ font: "var(--weight-medium) 11px/1.3 var(--font-sans)", color: "var(--color-danger)", padding: "0 6px" }}>
                {error}
              </span>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
