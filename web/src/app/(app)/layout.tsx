import { AppShell } from "@/components/AppShell";
import { getDataSource } from "@/lib/data";

// Shell de aplicación (sidebar + cabecera) para todas las rutas autenticadas.
// `login` queda fuera de este grupo, así que no lleva shell.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getDataSource();
  const [reviewPending, clients] = await Promise.all([
    data.getReviewPendingCount(),
    data.getActiveClients(),
  ]);

  let userName = "Equipo GAS";
  let userMeta = "Sesión activa";
  try {
    const { createClient } = await import("@/lib/supabaseServer");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      userName = user.email.split("@")[0] ?? user.email;
      userMeta = user.email;
    }
  } catch {
    // sin sesión legible: se quedan los valores por defecto
  }

  return (
    <AppShell
      userName={userName}
      userMeta={userMeta}
      reviewPending={reviewPending}
      flowstateValue={String(clients.length)}
      flowstateLabel="clientes activos"
    >
      {children}
    </AppShell>
  );
}
