"use client";

import { useState } from "react";

import { createClientRecord } from "@/lib/actions";

// Alta rápida de cliente (input de nombre + botón). Se usa en el header del
// dashboard y como estado vacío cuando aún no hay clientes.
export function NewClientForm() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="row"
      style={{ gap: 8 }}
      action={async (fd) => {
        setPending(true);
        setError(null);
        try {
          await createClientRecord(fd);
          setName("");
        } catch (e) {
          // `redirect()` lanza NEXT_REDIRECT como control de flujo: re-lánzalo.
          if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) {
            throw e;
          }
          setError(e instanceof Error ? e.message : "No se pudo crear el cliente.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input
        name="name"
        aria-label="Nombre del cliente"
        placeholder="Nombre del cliente"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        style={{ width: 240 }}
      />
      <button
        className="btn secondary"
        type="submit"
        disabled={pending || name.trim() === ""}
      >
        {pending ? "Creando…" : "+ Nuevo cliente"}
      </button>
      {error && (
        <span className="small" style={{ color: "var(--red)" }}>
          {error}
        </span>
      )}
    </form>
  );
}
