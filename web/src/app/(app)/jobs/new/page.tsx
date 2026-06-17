import { NewJobForm } from "@/components/NewJobForm";
import { LinkButton } from "@/components/LinkButton";
import { getDataSource } from "@/lib/data";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function NewJobPage() {
  const data = getDataSource();
  const [clients, areas] = await Promise.all([data.getActiveClients(), data.getActiveAreas()]);
  const ready = clients.length > 0 && areas.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, font: "var(--weight-bold) 30px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
          Nuevo job
        </h1>
        <p style={{ margin: "6px 0 0", font: "var(--weight-medium) 14px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
          Cliente, área del decisor, lista de empresas y coste estimado antes de lanzar.
        </p>
      </div>

      {ready ? (
        <NewJobForm clients={clients} areas={areas} />
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: 28,
          }}
        >
          <h2 style={{ margin: 0, font: "var(--weight-bold) 18px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
            Falta configuración
          </h2>
          <p style={{ margin: "8px 0 16px", font: "var(--weight-medium) 14px/1.5 var(--font-sans)", color: "var(--text-secondary)" }}>
            Necesitas al menos un cliente y un área activa. Crea un cliente o revisa el seed de{" "}
            <code>area_profiles</code>.
          </p>
          <LinkButton href="/clients" variant="primary" icon="plus">
            Nuevo cliente
          </LinkButton>
        </div>
      )}
    </div>
  );
}
