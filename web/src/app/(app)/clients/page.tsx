import Link from "next/link";

import { ClientAvatar } from "@/components/ClientAvatar";
import { NewClientForm } from "@/components/NewClientForm";
import { getDataSource } from "@/lib/data";
import { clientStats } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function ClientsPage() {
  const data = getDataSource();
  const [clients, jobs] = await Promise.all([data.getClients(), data.getJobs()]);
  const stats = clientStats(clients, jobs);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, font: "var(--weight-bold) 30px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
          Gestión de clientes
        </h1>
        <p style={{ margin: "6px 0 0", font: "var(--weight-medium) 14px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
          Alta de clientes y listado. Todo el trabajo se organiza por cliente.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "var(--surface-page)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {/* alta */}
        <div style={{ width: 340, flexShrink: 0, background: "#fff", borderRight: "1px solid var(--border-subtle)", padding: "28px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--red-50)",
                color: "var(--color-brand)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i data-lucide="building-2" style={{ width: 19, height: 19 }} />
            </span>
            <h2 style={{ margin: 0, font: "var(--weight-bold) 19px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
              Nuevo cliente
            </h2>
          </div>
          <p style={{ font: "var(--weight-medium) 13px/1.5 var(--font-sans)", color: "var(--text-secondary)", margin: "14px 0 18px" }}>
            Da de alta un cliente para empezar a lanzarle jobs. Solo necesitas el nombre.
          </p>
          <NewClientForm />
        </div>

        {/* listado */}
        <div style={{ flex: 1, minWidth: 0, padding: "28px 30px" }}>
          <h2 style={{ margin: "0 0 16px", font: "var(--weight-bold) 20px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
          </h2>

          {clients.length === 0 ? (
            <p style={{ font: "var(--weight-medium) 14px/1.5 var(--font-sans)", color: "var(--text-muted)" }}>
              Aún no hay clientes. Crea el primero con el formulario de la izquierda.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {stats.map((s) => (
                <Link
                  key={s.client.id}
                  href={`/clients/${s.client.id}`}
                  className="gas-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    background: "#fff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-xs)",
                    padding: "16px 18px",
                    color: "var(--ink)",
                  }}
                >
                  <ClientAvatar
                    name={s.client.name}
                    logoUrl={s.client.settings.logo_url}
                    color={s.client.settings.brand_color}
                    size={44}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "var(--weight-bold) 15px/1.15 var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.client.name}
                    </div>
                    <div style={{ font: "var(--weight-medium) 12px/1 var(--font-sans)", color: "var(--text-muted)", marginTop: 3 }}>
                      {s.nJobs} jobs · {s.empresas} empresas · {s.ok} OK
                    </div>
                  </div>
                  {s.running && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        font: "var(--weight-bold) 10px/1 var(--font-tech)",
                        color: "var(--cyan-500)",
                        textTransform: "uppercase",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cyan-500)" }} /> En curso
                    </span>
                  )}
                  <i data-lucide="chevron-right" style={{ width: 18, height: 18, color: "var(--neutral-400)" }} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
