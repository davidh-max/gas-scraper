import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const ALLOWED_DOMAINS = new Set([
  "gascoolcalling.com",
  "aszendit.com",
  "aszendit",
]);

export const runtime = "edge";

function isAllowedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return ALLOWED_DOMAINS.has(domain);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // En middleware/edge se aplicará la cookie en la respuesta.
          }
        },
      },
    },
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "oauth");
      return NextResponse.redirect(url);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Si llegó con email, lo pasamos para mostrarlo; si no, genérico.
    if (user?.email) {
      url.searchParams.set("email", user.email);
    }
    url.searchParams.set("error", "domain");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
