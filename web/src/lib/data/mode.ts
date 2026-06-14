import { cookies } from "next/headers";

// Modo de la INTERFAZ (no confundir con `use_fixtures` por job del worker):
//   - "normal": todo va contra Supabase, login incluido.
//   - "mock":   datos falsos en memoria, sin backend ni sesión.
// El modo vive en una cookie para que los Server Components lo lean al render.
export type Mode = "mock" | "normal";

export const MODE_COOKIE = "gas_mode";

export function getMode(): Mode {
  return cookies().get(MODE_COOKIE)?.value === "mock" ? "mock" : "normal";
}

// Solo válido dentro de Server Actions / Route Handlers (escriben cookies).
export function setModeCookie(mode: Mode): void {
  cookies().set(MODE_COOKIE, mode, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
