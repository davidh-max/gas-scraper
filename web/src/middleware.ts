import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Protege las rutas: sin sesión → /login. Dos atajos antes de hablar con
// Supabase para que la interfaz funcione sin backend:
//   - cookie gas_mode=mock  → modo MockData: se salta el login por completo.
//   - sin variables de Supabase → no hay sesión posible: todo va a /login
//     (donde está el acceso al modo demo). Así nada peta por falta de config.
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname.startsWith("/login");
  const isAuthCallback = pathname.startsWith("/auth/callback");

  // Modo MockData: navegación libre sin sesión.
  if (request.cookies.get("gas_mode")?.value === "mock") {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    if (isLogin || isAuthCallback) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLogin && !isAuthCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // protege todo excepto assets estáticos (la descarga también exige sesión)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
