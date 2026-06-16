import { StatCard } from "@/ds";
import { DashboardJobs } from "@/components/DashboardJobs";
import { ExpandableErrorRates } from "@/components/ExpandableErrorRates";
import { LinkButton } from "@/components/LinkButton";
import { getDataSource } from "@/lib/data";
import { jobKpis } from "@/lib/dashboard";
import type { ErrorRate } from "@/lib/data/source";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = getDataSource();
  const [jobs, clients, areas, globalErrorRate] = await Promise.all([
    data.getJobs(),
    data.getClients(),
    data.getAreas(),
    data.getGlobalErrorRate(),
  ]);

  const clientErrorRates = await Promise.all(
    clients.map(async (c): Promise<[string, ErrorRate]> => [c.id, await data.getClientErrorRate(c.id)]),
  );
  const errorRateByClient = Object.fromEntries(clientErrorRates);

  const areaNames: Record<string, string> = {};
  for (const a of areas) areaNames[a.id] = a.name;
  const kpis = jobKpis(jobs);
  const clientCount = new Set(jobs.map((j) => j.client_id)).size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, font: "var(--weight-bold) 30px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            Jobs
          </h1>
          <p style={{ margin: "6px 0 0", font: "var(--weight-medium) 14px/1 var(--font-sans)", color: "var(--text-secondary)" }}>
            {jobs.length} {jobs.length === 1 ? "lote" : "lotes"} · {clientCount} {clientCount === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <LinkButton href="/clients" variant="secondary" icon="building-2">
            Nuevo cliente
          </LinkButton>
          <LinkButton href="/jobs/new" variant="dark" icon="plus">
            Nuevo job
          </LinkButton>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard label="Jobs activos" value={kpis.active} icon="layers" />
        <StatCard label="Decisores OK" value={kpis.decisores} icon="user-check" />
        <StatCard label="Pendientes revisar" value={kpis.revisar} icon="search-check" />
        <StatCard label="Sin resultado" value={kpis.sin} icon="circle-slash" />
      </div>

      {clients.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: 28,
          }}
        >
          <h2 style={{ margin: 0, font: "var(--weight-bold) 20px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            Aún no hay clientes
          </h2>
          <p style={{ margin: "8px 0 16px", font: "var(--weight-medium) 14px/1.5 var(--font-sans)", color: "var(--text-secondary)" }}>
            Crea el primero para poder lanzarle jobs.
          </p>
          <LinkButton href="/clients" variant="primary" icon="plus">
            Nuevo cliente
          </LinkButton>
        </div>
      ) : (
        <ExpandableErrorRates
          globalErrorRate={globalErrorRate}
          clients={clients}
          jobs={jobs}
          errorRateByClient={errorRateByClient}
        >
          <DashboardJobs jobs={jobs} clients={clients} areaNames={areaNames} />
        </ExpandableErrorRates>
      )}
    </div>
  );
}
