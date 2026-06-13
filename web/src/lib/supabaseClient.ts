"use client";

import { createBrowserClient } from "@supabase/ssr";

// Cliente de navegador (clave anon). Usar en componentes "use client".
// Las consultas se tipan en el sitio de uso casteando a los tipos de `@/types/db`.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
