import { clientInitials } from "@/lib/dashboard";

// Avatar cuadrado del cliente: muestra el logo (settings.logo_url) si existe,
// si no las iniciales sobre el color de marca (o ink por defecto).
export function ClientAvatar({
  name,
  logoUrl,
  color,
  size = 44,
  radius = 11,
}: {
  name: string;
  logoUrl?: string | null;
  color?: string | null;
  size?: number;
  radius?: number;
}) {
  if (logoUrl) {
    return (
      // Logo arbitrario de usuario: <img> directo (no next/image, evita configurar dominios).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flexShrink: 0,
          background: "var(--neutral-100)",
          border: "1px solid var(--border-subtle)",
        }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color || "var(--ink)",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        font: `var(--weight-bold) ${Math.round(size * 0.36)}px/1 var(--font-tech)`,
        flexShrink: 0,
      }}
    >
      {clientInitials(name)}
    </span>
  );
}
