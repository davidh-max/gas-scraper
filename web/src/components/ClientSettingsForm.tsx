"use client";

import { useState } from "react";

import { Button, Input } from "@/ds";
import { ClientAvatar } from "./ClientAvatar";
import { updateClientSettings } from "@/lib/actions";
import type { ClientRow } from "@/types/db";

// Edición de la personalización del cliente (logo, color, web, sector).
// Persiste vía la server action updateClientSettings (Supabase o mock según modo).
export function ClientSettingsForm({ client }: { client: ClientRow }) {
  const s = client.settings ?? {};
  const [logoUrl, setLogoUrl] = useState(s.logo_url ?? "");
  const [brandColor, setBrandColor] = useState(s.brand_color ?? "");
  const [website, setWebsite] = useState(s.website ?? "");
  const [sector, setSector] = useState(s.sector ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
      action={async (fd) => {
        setPending(true);
        setSaved(false);
        setError(null);
        try {
          await updateClientSettings(fd);
          setSaved(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo guardar.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="client_id" value={client.id} />

      {/* preview en vivo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "var(--surface-page)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <ClientAvatar name={client.name} logoUrl={logoUrl || null} color={brandColor || null} size={52} radius={13} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "var(--weight-bold) 15px/1.2 var(--font-sans)", color: "var(--ink)" }}>{client.name}</div>
          <div style={{ font: "var(--weight-medium) 12px/1 var(--font-sans)", color: "var(--text-muted)", marginTop: 3 }}>
            {sector || "Sin sector"}
          </div>
        </div>
      </div>

      <Input
        name="logo_url"
        label="Logo (URL de imagen)"
        icon="image"
        placeholder="https://…/logo.png"
        value={logoUrl}
        onChange={(e) => setLogoUrl(e.target.value)}
      />

      <div>
        <label style={{ font: "var(--weight-semibold) 13px/1.2 var(--font-sans)", color: "var(--text-primary)", display: "block", marginBottom: 6 }}>
          Color de marca
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="color"
            aria-label="Selector de color de marca"
            value={brandColor || "#E30613"}
            onChange={(e) => setBrandColor(e.target.value)}
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              border: "1.5px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              background: "#fff",
              cursor: "pointer",
              padding: 2,
            }}
          />
          <Input
            name="brand_color"
            placeholder="#E30613"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            containerStyle={{ flex: 1 }}
          />
          {brandColor && (
            <button
              type="button"
              onClick={() => setBrandColor("")}
              aria-label="Quitar color"
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: "50%",
                border: "1.5px solid var(--border-default)",
                background: "#fff",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <i data-lucide="x" style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>
      </div>

      <Input
        name="website"
        label="Web"
        icon="globe"
        placeholder="ejemplo.com"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      <Input
        name="sector"
        label="Sector"
        icon="briefcase"
        placeholder="p. ej. Software"
        value={sector}
        onChange={(e) => setSector(e.target.value)}
      />

      {error && (
        <span style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: "var(--color-danger)" }}>{error}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="primary" icon="save" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        {saved && !pending && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--weight-semibold) 13px/1 var(--font-sans)", color: "var(--color-success)" }}>
            <i data-lucide="check-circle-2" style={{ width: 15, height: 15 }} /> Guardado
          </span>
        )}
      </div>
    </form>
  );
}
