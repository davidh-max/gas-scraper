"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

import { Avatar, Button, Switch } from "@/ds";
import { setMode, signOut } from "@/lib/actions";
import type { Mode } from "@/lib/data/mode";

interface NavEntry {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  match: (path: string) => boolean;
}

function sectionLabel(path: string): string {
  if (path === "/jobs/new") return "Nuevo job";
  if (path.startsWith("/jobs/")) return "Job";
  if (path.startsWith("/review")) return "Revisar";
  if (path.startsWith("/clients")) return "Clientes";
  return "Panel";
}

function SidebarLink({ entry, active }: { entry: NavEntry; active: boolean }) {
  return (
    <Link
      href={entry.href}
      className="gas-navitem"
      data-active={active ? "" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 14px",
        borderRadius: "var(--radius-md)",
        background: active ? "var(--color-brand)" : "transparent",
        color: active ? "#fff" : "var(--neutral-400)",
        boxShadow: active ? "var(--glow-red-sm)" : "none",
        font: "var(--weight-semibold) 14px/1 var(--font-sans)",
        transition: "all var(--dur-base) var(--ease-standard)",
      }}
    >
      <i data-lucide={entry.icon} style={{ width: 18, height: 18 }} />
      {entry.label}
      {entry.badge != null && entry.badge > 0 && (
        <span
          style={{
            marginLeft: "auto",
            font: "var(--weight-bold) 11px/1 var(--font-tech)",
            background: "var(--amber-500)",
            color: "#1a1a1a",
            padding: "3px 7px",
            borderRadius: 999,
          }}
        >
          {entry.badge}
        </span>
      )}
    </Link>
  );
}

export interface AppShellProps {
  mode: Mode;
  userName: string;
  userMeta: string;
  reviewPending: number;
  flowstateValue: string;
  flowstateLabel: string;
  children: React.ReactNode;
}

export function AppShell({
  mode,
  userName,
  userMeta,
  reviewPending,
  flowstateValue,
  flowstateLabel,
  children,
}: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isMock = mode === "mock";

  const nav: NavEntry[] = [
    { href: "/", icon: "layout-dashboard", label: "Panel", match: (p) => p === "/" || p.startsWith("/jobs") },
    { href: "/review", icon: "inbox", label: "Revisar", badge: reviewPending, match: (p) => p.startsWith("/review") },
    { href: "/clients", icon: "building-2", label: "Clientes", match: (p) => p.startsWith("/clients") },
  ];

  function onToggleMode(e: React.ChangeEvent<HTMLInputElement>) {
    const next: Mode = e.target.checked ? "mock" : "normal";
    startTransition(async () => {
      await setMode(next);
      // Recarga dura: aplica la cookie en todas partes y resetea estado cliente.
      window.location.href = "/";
    });
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-page)" }}>
      {/* ===== Sidebar ===== */}
      <aside
        style={{
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          width: 232,
          flexShrink: 0,
          background: "var(--ink)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          padding: "20px 16px",
          overflowY: "auto",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 22px", color: "#fff" }}
        >
          <Image
            src="/gas-mark.png"
            alt="GAS"
            width={42}
            height={28}
            priority
            style={{ height: 26, width: "auto" }}
          />
          <span
            style={{
              font: "var(--weight-extra) 21px/1 var(--font-display)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            Scraper
          </span>
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {nav.map((entry) => (
            <SidebarLink key={entry.href} entry={entry} active={entry.match(pathname)} />
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Toggle de modo MockData */}
          <div
            style={{
              background: isMock ? "rgba(227,6,19,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isMock ? "rgba(227,6,19,0.45)" : "var(--border-inverse)"}`,
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    font: "var(--weight-bold) 10px/1 var(--font-tech)",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: isMock ? "var(--red-400)" : "var(--neon-cyan)",
                  }}
                >
                  {isMock ? "Modo MockData" : "Modo normal"}
                </div>
                <div
                  style={{
                    font: "var(--weight-medium) 11px/1.3 var(--font-sans)",
                    color: "var(--neutral-400)",
                    marginTop: 4,
                  }}
                >
                  {isMock ? "datos de demostración" : "datos reales (Supabase)"}
                </div>
              </div>
              <Switch checked={isMock} onChange={onToggleMode} disabled={pending} aria-label="Activar modo MockData" />
            </div>
          </div>

          {/* Widget flowstate */}
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--border-inverse)",
              borderRadius: "var(--radius-md)",
              padding: "14px",
            }}
          >
            <div
              style={{
                font: "var(--weight-bold) 10px/1 var(--font-tech)",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--neon-cyan)",
              }}
            >
              Flowstate ⚡
            </div>
            <div style={{ font: "var(--weight-extra) 24px/1 var(--font-tech)", marginTop: 8 }}>{flowstateValue}</div>
            <div
              style={{
                font: "var(--weight-medium) 12px/1.3 var(--font-sans)",
                color: "var(--neutral-400)",
                marginTop: 4,
              }}
            >
              {flowstateLabel}
            </div>
          </div>

          {/* Usuario + salir */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
            <Avatar name={userName} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  font: "var(--weight-semibold) 13px/1.2 var(--font-sans)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {userName}
              </div>
              <div style={{ font: "var(--weight-medium) 11px/1.2 var(--font-sans)", color: "var(--neutral-500)" }}>
                {userMeta}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                aria-label={isMock ? "Salir del modo demo" : "Cerrar sesión"}
                title={isMock ? "Salir del modo demo" : "Cerrar sesión"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  color: "var(--neutral-400)",
                  cursor: "pointer",
                }}
              >
                <i data-lucide="log-out" style={{ width: 16, height: 16 }} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            height: 66,
            flexShrink: 0,
            background: "#fff",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 26px",
          }}
        >
          <div
            style={{
              font: "var(--weight-bold) 13px/1 var(--font-tech)",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            {sectionLabel(pathname)}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: 320,
              maxWidth: "32vw",
              height: 40,
              padding: "0 14px",
              background: "var(--surface-sunken)",
              borderRadius: 999,
              color: "var(--text-muted)",
              marginLeft: 12,
            }}
          >
            <i data-lucide="search" style={{ width: 16, height: 16 }} />
            <span style={{ font: "var(--weight-medium) 14px/1 var(--font-sans)" }}>Buscar cliente, job o empresa…</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <button
              aria-label="Notificaciones"
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: "1px solid var(--border-subtle)",
                background: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <i data-lucide="bell" style={{ width: 18, height: 18 }} />
            </button>
            <Button variant="primary" icon="plus" onClick={() => router.push("/jobs/new")}>
              Nuevo job
            </Button>
          </div>
        </header>

        {isMock && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 26px",
              background: "var(--red-50)",
              borderBottom: "1px solid var(--red-100)",
              color: "var(--red-700)",
              font: "var(--weight-semibold) 13px/1.3 var(--font-sans)",
            }}
          >
            <i data-lucide="flask-conical" style={{ width: 16, height: 16, flexShrink: 0 }} />
            Modo MockData activo — datos de demostración. Las acciones no tocan Supabase y se reinician al recargar.
          </div>
        )}

        <main style={{ flex: 1, minWidth: 0, padding: "26px 28px" }}>{children}</main>
      </div>
    </div>
  );
}
