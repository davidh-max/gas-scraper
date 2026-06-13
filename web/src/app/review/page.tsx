import { createClient } from "@/lib/supabaseServer";
import { ReviewRow } from "@/components/ReviewRow";
import type { CompanyRow, ContactRow } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = createClient();
  const { data: contactsData } = await supabase
    .from("contacts")
    .select("*")
    .eq("status", "pending")
    .order("classification")
    .order("created_at")
    .limit(200);
  const contacts: ContactRow[] = contactsData ?? [];

  const companyIds = [...new Set(contacts.map((c) => c.company_id))];
  let companyName = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companiesData } = await supabase
      .from("companies")
      .select("*")
      .in("id", companyIds);
    const companies: CompanyRow[] = companiesData ?? [];
    companyName = new Map(
      companies.map((c) => [c.id, c.razon_social ?? c.raw_input ?? c.id]),
    );
  }

  return (
    <div>
      <h1>Bandeja de revisión</h1>
      <p className="muted small">
        Contactos pendientes. Aprobar o descartar actualiza <code>contacts.status</code>. Nunca se
        borra a nadie; descartar solo cambia el estado.
      </p>
      <div className="panel">
        {contacts.length === 0 ? (
          <p className="muted">No hay contactos pendientes.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Clasificación</th>
                <th>LinkedIn</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <ReviewRow
                  key={contact.id}
                  contact={contact}
                  companyName={companyName.get(contact.company_id) ?? "—"}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
