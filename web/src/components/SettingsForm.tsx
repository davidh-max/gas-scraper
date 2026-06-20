"use client";

import { useState } from "react";

import { Button, Input } from "@/ds";
import { updateProfileName } from "@/lib/actions";
import { BRANDING_KEY, DEFAULT_BRANDING, type AppBranding } from "@/lib/appBranding";
import type { ProfileRow } from "@/types/db";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function roleLabel(role: string): string {
  if (role === "admin") return "Administrador";
  if (role === "operator") return "Operador";
  return role;
}

export function SettingsForm({
  currentUser,
  profiles,
}: {
  currentUser: ProfileRow | null;
  profiles: ProfileRow[];
}) {
  const [fullName, setFullName] = useState(currentUser?.full_name ?? "");
  const [branding, setBranding] = useState<AppBranding>(() => {
    if (typeof window === "undefined") return DEFAULT_BRANDING;
    try {
      const raw = window.localStorage.getItem(BRANDING_KEY);
      if (!raw) return DEFAULT_BRANDING;
      const parsed = JSON.parse(raw) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "appName" in parsed &&
        "logoUrl" in parsed
      ) {
        return {
          appName: String((parsed as { appName: unknown }).appName || DEFAULT_BRANDING.appName),
          logoUrl: String((parsed as { logoUrl: unknown }).logoUrl || DEFAULT_BRANDING.logoUrl),
        };
      }
    } catch {
      // fallthrough
    }
    return DEFAULT_BRANDING;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateProfileName(currentUser.id, fullName);
      setMessage("Perfil actualizado.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  function saveBranding(next: AppBranding) {
    setBranding(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(BRANDING_KEY, JSON.stringify(next));
    } catch {
      // localStorage bloqueado.
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Perfil actual */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "22px 26px",
        }}
      >
        <h2
          style={{
            margin: "0 0 4px",
            font: "var(--weight-bold) 20px/1 var(--font-display)",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          Tu perfil
        </h2>
        <p style={{ margin: 0, font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
          Actualiza cómo te ven el resto de compañeros.
        </p>

        {currentUser ? (
          <form onSubmit={saveProfile} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Input
                label="Nombre completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre"
                icon="user"
              />
              <Input label="Email" value={currentUser.email ?? "—"} disabled icon="mail" />
            </div>
            {message && (
              <p style={{ margin: 0, font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: message.startsWith("No") ? "var(--color-danger)" : "var(--green-600)" }}>
                {message}
              </p>
            )}
            <div>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar perfil"}
              </Button>
            </div>
          </form>
        ) : (
          <p style={{ marginTop: 14, color: "var(--text-muted)", font: "var(--weight-medium) 13px/1.4 var(--font-sans)" }}>
            No se ha podido leer tu sesión.
          </p>
        )}
      </div>

      {/* Marca de la app */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "22px 26px",
        }}
      >
        <h2
          style={{
            margin: "0 0 4px",
            font: "var(--weight-bold) 20px/1 var(--font-display)",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          Marca
        </h2>
        <p style={{ margin: 0, font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
          Personaliza el nombre y el logo que aparecen en la barra lateral.
        </p>
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Input
            label="Nombre de la app"
            value={branding.appName}
            onChange={(e) => saveBranding({ ...branding, appName: e.target.value })}
            placeholder="Scraper"
            icon="type"
          />
          <Input
            label="URL del logo"
            value={branding.logoUrl ?? ""}
            onChange={(e) => saveBranding({ ...branding, logoUrl: e.target.value || null })}
            placeholder="/gas-mark.png"
            icon="image"
          />
        </div>
        <div style={{ marginTop: 12, font: "var(--weight-medium) 12px/1.4 var(--font-sans)", color: "var(--text-muted)" }}>
          Se guarda en este navegador; no afecta a otros usuarios.
        </div>
      </div>

      {/* Lista de usuarios */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <header style={{ padding: "22px 26px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2
            style={{
              margin: 0,
              font: "var(--weight-bold) 20px/1 var(--font-display)",
              textTransform: "uppercase",
              color: "var(--ink)",
            }}
          >
            Usuarios
          </h2>
          <p style={{ margin: "4px 0 0", font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
            {profiles.length} {profiles.length === 1 ? "cuenta" : "cuentas"} registradas.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1.2fr 0.9fr 1fr",
            gap: 12,
            padding: "12px 26px",
            background: "var(--neutral-50)",
            borderBottom: "1px solid var(--border-subtle)",
            font: "var(--weight-bold) 10px/1.2 var(--font-tech)",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          <div>Email</div>
          <div>Nombre</div>
          <div>Rol</div>
          <div>Registrado</div>
        </div>

        {profiles.map((p) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1.2fr 0.9fr 1fr",
              gap: 12,
              padding: "13px 26px",
              alignItems: "center",
              borderBottom: "1px solid var(--neutral-100)",
            }}
          >
            <div
              style={{
                font: "var(--weight-medium) 13px/1.3 var(--font-sans)",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={p.email ?? undefined}
            >
              {p.email ?? "—"}
            </div>
            <div style={{ font: "var(--weight-medium) 13px/1.3 var(--font-sans)", color: "var(--ink)" }}>
              {p.full_name ?? <span style={{ color: "var(--text-muted)" }}>Sin nombre</span>}
            </div>
            <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              {roleLabel(p.role)}
            </div>
            <div style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: "var(--text-muted)" }}>
              {fmtDate(p.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
