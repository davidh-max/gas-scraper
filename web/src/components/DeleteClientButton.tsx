"use client";

import { useState } from "react";

import { Button } from "@/ds";
import { deleteClientRecord } from "@/lib/actions";

// Botón de borrado de cliente con confirmación modal inline.
// No añade dependencias: el overlay se pinta con estilos en línea.
export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon="trash-2"
        onClick={() => setOpen(true)}
        style={{ color: "var(--color-danger)" }}
      >
        Borrar cliente
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-client-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,10,12,0.55)",
            backdropFilter: "blur(2px)",
            padding: 24,
          }}
        >
          <form
            action={async (fd) => {
              if (pending) return;
              setPending(true);
              setError(null);
              try {
                await deleteClientRecord(fd);
              } catch (e) {
                setPending(false);
                setError(e instanceof Error ? e.message : "No se pudo borrar el cliente.");
              }
            }}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              padding: "26px 28px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input type="hidden" name="client_id" value={clientId} />
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--color-danger-bg, rgba(239,68,68,0.10))",
                color: "var(--color-danger)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <i data-lucide="alert-triangle" style={{ width: 22, height: 22 }} />
            </div>
            <h2
              id="delete-client-title"
              style={{
                margin: 0,
                font: "var(--weight-bold) 18px/1.2 var(--font-display)",
                color: "var(--ink)",
                textTransform: "uppercase",
              }}
            >
              Borrar cliente
            </h2>
            <p
              style={{
                margin: "10px 0 22px",
                font: "var(--weight-medium) 14px/1.5 var(--font-sans)",
                color: "var(--text-secondary)",
              }}
            >
              ¿Seguro que quieres borrar a <strong style={{ color: "var(--text-primary)" }}>{clientName}</strong>? Se
              eliminarán también todos sus jobs y resultados. Esta acción no se puede deshacer.
            </p>

            {error && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-danger-bg, rgba(239,68,68,0.08))",
                  color: "var(--color-danger)",
                  font: "var(--weight-medium) 13px/1.4 var(--font-sans)",
                  marginBottom: 18,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={pending} style={{ background: "var(--color-danger)", borderColor: "var(--color-danger)" }}>
                {pending ? "Borrando…" : "Sí, borrar"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
