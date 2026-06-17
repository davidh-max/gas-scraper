import { cookies } from "next/headers";

// Modo de la INTERFAZ (no confundir con `use_fixtures` por job del worker):
//   - "normal": todo va contra Supabase, login incluido.
//   - "mock":   datos falsos en memoria, sin backend ni sesión.
// El modo vive en una cookie para que los Server Components lo lean al render.
// Nota: cookies() es asíncrono a partir de Next.js 15.
export type Mode = "mock" | "normal";

export const MODE_COOKIE = "gas_mode";

export async function getMode(): Promise<Mode> {
  const cookieStore = await cookies();
  return cookieStore.get(MODE_COOKIE)?.value === "mock" ? "mock" : "normal";
}

// Solo válido dentro de Server Actions / Route Handlers (escriben cookies).
export async function setModeCookie(mode: Mode): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MODE_COOKIE, mode, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
