"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Checkbox, Input } from "@/ds";
import { setMode } from "@/lib/actions";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoPending, startDemo] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con Supabase. Configura las claves o usa el modo demo.");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo() {
    startDemo(async () => {
      await setMode("mock");
      window.location.href = "/";
    });
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-card)", flexWrap: "wrap" }}>
      {/* Panel de marca */}
      <div
        style={{
          flex: 1,
          minWidth: 360,
          background: "var(--ink)",
          color: "#fff",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(620px 320px at 82% 6%, rgba(25,224,255,0.14), transparent), radial-gradient(520px 300px at 6% 96%, rgba(227,6,19,0.22), transparent)",
          }}
        />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/gas-mark.png" alt="GAS" width={54} height={36} priority style={{ height: 34, width: "auto" }} />
          <span style={{ font: "var(--weight-extra) 27px/1 var(--font-display)", letterSpacing: ".05em", textTransform: "uppercase" }}>
            Scraper
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              font: "var(--weight-bold) 12px/1 var(--font-tech)",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "var(--neon-cyan)",
              marginBottom: 16,
            }}
          >
            The Cool Calling Accelerator
          </div>
          <div
            style={{
              font: "var(--weight-extra) 64px/0.96 var(--font-display)",
              textTransform: "uppercase",
              textShadow: "0 0 22px rgba(25,224,255,0.28)",
            }}
          >
            No music,
            <br />
            <span style={{ color: "var(--red-400)", textShadow: "0 0 26px rgba(227,6,19,0.55)" }}>no sales</span>
          </div>
          <div style={{ font: "var(--weight-regular) 16px/1.6 var(--font-sans)", color: "var(--neutral-400)", marginTop: 20, maxWidth: 400 }}>
            Entra en flowstate ⚡ y convierte una lista de empresas en decisores listos para llamar. Ganamos juntos.
          </div>
        </div>
        <div style={{ position: "relative", font: "var(--weight-medium) 13px/1 var(--font-sans)", color: "var(--neutral-500)" }}>
          © GAS · Cool Calling Accelerator
        </div>
      </div>

      {/* Formulario */}
      <div style={{ width: 480, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ width: "100%", maxWidth: 348 }}>
          <h1 style={{ margin: "0 0 6px", font: "var(--weight-bold) 36px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            Inicia sesión
          </h1>
          <p style={{ margin: "0 0 28px", font: "var(--weight-regular) 15px/1.5 var(--font-sans)", color: "var(--text-secondary)" }}>
            Tu equipo te está esperando.
          </p>
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="tu@empresa.com"
              icon="mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              icon="lock"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Checkbox label="Recordarme" defaultChecked />
              <span style={{ font: "var(--weight-semibold) 13px/1 var(--font-sans)", color: "var(--text-link)", cursor: "pointer" }}>
                ¿Olvidaste?
              </span>
            </div>
            {error && (
              <p style={{ margin: 0, font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--color-danger)" }}>{error}</p>
            )}
            <Button variant="primary" size="lg" icon="flame" fullWidth type="submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar en flowstate"}
            </Button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
            <span style={{ font: "var(--weight-bold) 10px/1 var(--font-tech)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              o
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
          </div>

          <Button variant="secondary" size="lg" icon="flask-conical" fullWidth type="button" onClick={enterDemo} disabled={demoPending}>
            {demoPending ? "Abriendo demo…" : "Explorar en modo MockData"}
          </Button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              marginTop: 18,
              font: "var(--weight-medium) 12px/1 var(--font-sans)",
              color: "var(--text-muted)",
            }}
          >
            <i data-lucide="shield-check" style={{ width: 14, height: 14 }} /> Acceso restringido al equipo GAS
          </div>
        </div>
      </div>
    </div>
  );
}
