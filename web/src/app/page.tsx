import { createClient } from "@/lib/supabaseServer";
import { StatusBadge } from "@/components/StatusBadge";
import { NewClientForm } from "@/components/NewClientForm";
import type { AreaProfileRow, ClientRow, JobRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createClient();
  const [jobsRes, clientsRes, areasRes] = await Promise.all([
    supabase.from("jobs").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("name"),
    supabase.from("area_profiles").select("*"),
  ]);

  const jobs: JobRow[] = jobsRes.data ?? [];
  const clients: ClientRow[] = clientsRes.data ?? [];
  const areas: AreaProfileRow[] = areasRes.data ?? [];
  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  const jobsByClient = new Map<string, JobRow[]>();
  for (const job of jobs) {
    const list = jobsByClient.get(job.client_id) ?? [];
    list.push(job);
    jobsByClient.set(job.client_id, list);
  }

  return (
    <div>
      <div className="row">
        <h1>Dashboard</h1>
        <div className="spacer" />
        <NewClientForm />
        <a className="btn" href="/jobs/new">
          + Nuevo job
        </a>
      </div>
      <p className="muted small">Jobs por cliente. El worker procesa los que están en cola.</p>

      {clients.length === 0 && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Aún no hay clientes</h2>
          <p className="muted small">
            Crea el primero para poder lanzarle jobs.
          </p>
          <NewClientForm />
        </div>
      )}

      {clients.map((client) => {
        const clientJobs = jobsByClient.get(client.id) ?? [];
        return (
          <div className="panel" key={client.id}>
            <h2 style={{ marginTop: 0 }}>{client.name}</h2>
            {clientJobs.length === 0 ? (
              <p className="muted small">Sin jobs todavía.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Creado</th>
                    <th>Área</th>
                    <th>Estado</th>
                    <th>Empresas</th>
                    <th>Decisores</th>
                    <th>Revisar</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="small">
                        {new Date(job.created_at).toLocaleString("es-ES")}
                      </td>
                      <td>{areaName.get(job.area_profile_id) ?? "—"}</td>
                      <td>
                        <StatusBadge status={job.status} />
                      </td>
                      <td>{job.total_companies}</td>
                      <td>{job.decisor_count}</td>
                      <td>{job.revisar_count}</td>
                      <td>
                        <a href={`/jobs/${job.id}`}>ver</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
