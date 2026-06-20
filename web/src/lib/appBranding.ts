// Configuración de marca de la app, guardada en localStorage del navegador.
// No toca la base de datos; se aplica en AppShell y se edita en /settings.

export interface AppBranding {
  appName: string;
  logoUrl: string | null;
}

export const BRANDING_KEY = "gas_app_branding";

export const DEFAULT_BRANDING: AppBranding = {
  appName: "Scraper",
  logoUrl: "/gas-mark.png",
};

function isBranding(value: unknown): value is AppBranding {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Partial<AppBranding>;
  return typeof b.appName === "string" && (b.logoUrl === null || typeof b.logoUrl === "string");
}

export function loadBranding(): AppBranding {
  if (typeof window === "undefined") return DEFAULT_BRANDING;
  try {
    const raw = window.localStorage.getItem(BRANDING_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const parsed = JSON.parse(raw) as unknown;
    if (!isBranding(parsed)) return DEFAULT_BRANDING;
    return {
      appName: parsed.appName.trim() || DEFAULT_BRANDING.appName,
      logoUrl: parsed.logoUrl?.trim() || DEFAULT_BRANDING.logoUrl,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBranding(branding: AppBranding): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      BRANDING_KEY,
      JSON.stringify({
        appName: branding.appName.trim() || DEFAULT_BRANDING.appName,
        logoUrl: branding.logoUrl?.trim() || DEFAULT_BRANDING.logoUrl,
      }),
    );
  } catch {
    // localStorage puede estar bloqueado en modo privado.
  }
}
