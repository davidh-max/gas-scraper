import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/SettingsForm";
import { getDataSource } from "@/lib/data";
import { createClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getDataSource();
  const [profiles, currentUser] = await Promise.all([
    data.getProfiles(),
    supabase.from("profiles").select("*").eq("id", user.id).single().then((r) => r.data),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 960 }}>
      <div>
        <h1 style={{ margin: 0, font: "var(--weight-bold) 30px/1 var(--font-display)", textTransform: "uppercase", color: "var(--ink)" }}>
          Ajustes
        </h1>
        <p style={{ margin: "6px 0 0", font: "var(--weight-medium) 14px/1.4 var(--font-sans)", color: "var(--text-secondary)" }}>
          Gestiona tu perfil, la marca del Scraper y los usuarios que tienen cuenta.
        </p>
      </div>

      <SettingsForm currentUser={currentUser} profiles={profiles ?? []} />
    </div>
  );
}
