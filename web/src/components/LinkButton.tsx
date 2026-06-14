import Link from "next/link";

// Enlace con el aspecto de un Button del DS (para navegación desde Server
// Components, sin anidar <button> en <a>). Reusa las clases gas-btn / gas-btn--*
// del DS para heredar los estados hover/active de base.css.

type Variant = "primary" | "accent" | "dark" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const HEIGHTS: Record<Size, string> = { sm: "var(--control-sm)", md: "var(--control-md)", lg: "var(--control-lg)" };
const PADS: Record<Size, string> = { sm: "0 16px", md: "0 22px", lg: "0 28px" };
const FONTS: Record<Size, string> = { sm: "14px", md: "15px", lg: "17px" };
const ICON: Record<Size, number> = { sm: 15, md: 17, lg: 19 };

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--color-brand)", color: "var(--text-on-brand)", boxShadow: "var(--glow-red-sm)", border: "1.5px solid transparent" },
  accent: { background: "var(--color-accent)", color: "#fff", boxShadow: "var(--glow-flame)", border: "1.5px solid transparent" },
  dark: { background: "var(--ink)", color: "#fff", border: "1.5px solid transparent" },
  secondary: { background: "var(--surface-card)", color: "var(--text-primary)", border: "1.5px solid var(--border-default)" },
  ghost: { background: "transparent", color: "var(--text-primary)", border: "1.5px solid transparent" },
};

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth = false,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  const sz = ICON[size];
  return (
    <Link
      href={href}
      className={`gas-btn gas-btn--${variant}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: HEIGHTS[size],
        padding: PADS[size],
        width: fullWidth ? "100%" : "auto",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: FONTS[size],
        lineHeight: 1,
        letterSpacing: "0.01em",
        borderRadius: "var(--radius-button)",
        whiteSpace: "nowrap",
        ...VARIANTS[variant],
      }}
    >
      {icon && <i data-lucide={icon} style={{ width: sz, height: sz }} />}
      {children}
      {iconRight && <i data-lucide={iconRight} style={{ width: sz, height: sz }} />}
    </Link>
  );
}
