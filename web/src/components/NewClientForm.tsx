"use client";

import { useRef, useState } from "react";

import { Button, Input } from "@/ds";
import { createClientRecord } from "@/lib/actions";

// Alta de cliente (Input nombre + botón). Vive en la pantalla de Clientes.
export function NewClientForm() {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      action={async (fd) => {
        if (pending) return;
        setPending(true);
        setError(null);
        try {
          await createClientRecord(fd);
          setName("");
          formRef.current?.reset();
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo crear el cliente.");
        } finally {
          setPending(false);
        }
      }}
    >
      <Input
        name="name"
        label="Nombre del cliente"
        placeholder="p. ej. Naviera Cantábrica"
        icon="building-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Button variant="primary" icon="plus" type="submit" fullWidth disabled={pending || name.trim() === ""}>
        {pending ? "Creando…" : "Crear cliente"}
      </Button>
      {error && (
        <span style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: "var(--color-danger)" }}>
          {error}
        </span>
      )}
    </form>
  );
}
