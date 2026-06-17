import Link from "next/link";
import { notFound } from "next/navigation";

import { StatCard } from "@/ds";
import { ClientAvatar } from "@/components/ClientAvatar";
import { ClientSettingsForm } from "@/components/ClientSettingsForm";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { LinkButton } from "@/components/LinkButton";
import { StatusBadge } from "@/components/StatusBadge";
import { getDataSource } from "@/lib/data";
import { isProcessing, jobKpis, jobProgressPct } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const runtime = "edge";

const JOBS_GRID = "1fr 1.3fr 1fr 52px 52px 52px 28px";

function fmtDate(iso: string): string {
  return new Date(iso)
    .toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(",", " ·");
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const data = getDataSource();
  const [client, jobs, areas] = await Promise.all([
    data.getClient(params.id),
    data.getJobsByClient(params.id),
    data.getAreas(),
  ]);
  if (!client) notFound();

  const areaNames: Record<string, string> = {};
  for (const a of areas) areaNames[a.id] = a.name;
  const kpis = jobKpis(jobs);
  const running = jobs.some((j) => isProcessing(j.status));
  const color = client.settings.brand_color || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Link
        href="/clients"
        className="gas-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "var(--weight-semibold) 13px/1 var(--font-sans)",
          color: "var(--text-secondary)",
          width: "fit-content",
        }}
      >
        <i data-lucide="arrow-left" style={{ width: 16, height: 16 }} /> Clientes
      </Link>

      {/* cabecera de cliente */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderTop: `4px solid ${color ?? "var(--ink)"}`,
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          padding: "24px 26px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <ClientAvatar name={client.name} logoUrl={client.settings.logo_url} color={color} size={64} radius={16} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, font: "var(--weight-bold) 28px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            {client.name}
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 8,
              flexWrap: "wrap",
              font: "var(--weight-medium) 13px/1 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            {client.settings.sector && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <i data-lucide="briefcase" style={{ width: 14, height: 14 }} /> {client.settings.sector}
              </span>
            )}
            {client.settings.website && (
              <a
                className="gas-link"
                href={normalizeUrl(client.settings.website)}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--text-link)" }}
              >
                <i data-lucide="globe" style={{ width: 14, height: 14 }} /> {client.settings.website}
              </a>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i data-lucide="calendar" style={{ width: 14, height: 14 }} /> alta {fmtDate(client.created_at)}
            </span>
          </div>
        </div>
        {running && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              background: "var(--cyan-100)",
              color: "var(--cyan-500)",
              font: "var(--weight-bold) 11px/1 var(--font-tech)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cyan-500)" }} /> En curso
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <DeleteClientButton clientId={client.id} clientName={client.name} />
          <LinkButton href="/jobs/new" variant="dark" icon="plus">
            Nuevo job
          </LinkButton>
        </div>
      </div>

      {/* KPIs del cliente */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard label="Jobs" value={jobs.length} icon="layers" />
        <StatCard label="Decisores OK" value={kpis.decisores} icon="user-check" />
        <StatCard label="Pendientes revisar" value={kpis.revisar} icon="search-check" />
        <StatCard label="Sin resultado" value={kpis.sin} icon="circle-slash" />
      </div>

      {/* jobs + personalización */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18, alignItems: "start" }}>
        {/* jobs del cliente */}
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 style={{ margin: 0, font: "var(--weight-bold) 17px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
              Jobs del cliente
            </h2>
          </div>

          {jobs.length === 0 ? (
            <div style={{ padding: "28px 20px", color: "var(--text-muted)", font: "var(--weight-medium) 14px/1.5 var(--font-sans)" }}>
              Este cliente aún no tiene jobs.{" "}
              <Link href="/jobs/new" className="gas-link" style={{ color: "var(--text-link)", fontWeight: 600 }}>
                Lanza el primero
              </Link>
              .
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: JOBS_GRID,
                  gap: 10,
                  padding: "11px 20px",
                  background: "var(--neutral-50)",
                  borderBottom: "1px solid var(--border-subtle)",
                  font: "var(--weight-bold) 10px/1.2 var(--font-tech)",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                <div>Creado</div>
                <div>Área</div>
                <div>Estado</div>
                <div style={{ textAlign: "right", color: "var(--green-500)" }}>OK</div>
                <div style={{ textAlign: "right", color: "var(--amber-500)" }}>Rev.</div>
                <div style={{ textAlign: "right", color: "var(--neutral-500)" }}>Sin</div>
                <div />
              </div>
              {jobs.map((job) => {
                const showCounts = job.status === "done" || isProcessing(job.status);
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="gas-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: JOBS_GRID,
                      gap: 10,
                      padding: "13px 20px",
                      alignItems: "center",
                      borderBottom: "1px solid var(--neutral-100)",
                      color: "var(--ink)",
                    }}
                  >
                    <div style={{ font: "var(--weight-medium) 13px/1.2 var(--font-sans)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {fmtDate(job.created_at)}
                    </div>
                    <div style={{ font: "var(--weight-semibold) 13px/1.2 var(--font-sans)", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {areaNames[job.area_profile_id] ?? "—"}
                    </div>
                    <div>
                      <StatusBadge status={job.status} progress={isProcessing(job.status) ? jobProgressPct(job) : undefined} />
                    </div>
                    <div style={{ textAlign: "right", font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--green-500)" }}>
                      {showCounts ? job.decisor_count : "—"}
                    </div>
                    <div style={{ textAlign: "right", font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--amber-500)" }}>
                      {showCounts ? job.revisar_count : "—"}
                    </div>
                    <div style={{ textAlign: "right", font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--neutral-500)" }}>
                      {showCounts ? job.no_result_count : "—"}
                    </div>
                    <div style={{ textAlign: "right", color: "var(--neutral-400)" }}>
                      <i data-lucide="chevron-right" style={{ width: 16, height: 16 }} />
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </div>

        {/* personalización */}
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "22px 24px",
          }}
        >
          <h2 style={{ margin: 0, font: "var(--weight-bold) 17px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            Personalización
          </h2>
          <p style={{ margin: "6px 0 18px", font: "var(--weight-medium) 13px/1.5 var(--font-sans)", color: "var(--text-secondary)" }}>
            Logo, color de marca, web y sector. Se guardan en el cliente.
          </p>
          <ClientSettingsForm client={client} />
        </div>
      </div>
    </div>
  );
}
