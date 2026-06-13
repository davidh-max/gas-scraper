import { createClient } from "@/lib/supabaseServer";
import { NewJobForm } from "@/components/NewJobForm";
import type { AreaProfileRow, ClientRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const supabase = createClient();
  const [clientsRes, areasRes] = await Promise.all([
    supabase.from("clients").select("*").eq("active", true).order("name"),
    supabase.from("area_profiles").select("*").eq("active", true).order("name"),
  ]);
  const clients: ClientRow[] = clientsRes.data ?? [];
  const areas: AreaProfileRow[] = areasRes.data ?? [];

  return (
    <div>
      <h1>Nuevo job</h1>
      <p className="muted small">
        Pega las empresas, elige cliente y área. Se crea un job en cola que el worker recogerá.
      </p>
      <div className="panel">
        {clients.length === 0 || areas.length === 0 ? (
          <p>
            Necesitas al menos un cliente y un área. Revisa las tablas{" "}
            <code>clients</code> y <code>area_profiles</code> (el esquema trae un seed).
          </p>
        ) : (
          <NewJobForm clients={clients} areas={areas} />
        )}
      </div>
    </div>
  );
}
