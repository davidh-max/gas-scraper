// Convierte un nombre en slug url-safe: minúsculas, sin acentos,
// no-alfanuméricos → guiones, solo [a-z0-9-]. Nunca vacío.
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita diacríticos (acentos, ñ→n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // todo lo demás → guion
    .replace(/^-+|-+$/g, ""); // sin guiones sobrantes en los extremos
  return base || "cliente";
}
