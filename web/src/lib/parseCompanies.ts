// Parser del textarea de empresas. Cada línea es una empresa. Acepta:
//   - una URL de LinkedIn suelta
//   - una razón social suelta (las comas se conservan: "Navantia, S.A., S.M.E")
//   - varios campos por línea separados por ';' o TAB (no por coma):
//       raw_input ; razon_social ; cif ; domain ; linkedin_url
// Devuelve filas listas para insertar en `companies` (sin job_id).
//
// La coma NO se usa como separador a propósito: las formas jurídicas españolas
// (S.A., S.L., S.M.E, S.L.U.) llevan comas internas y partirían el nombre. Para
// pegar varias columnas usa TAB (copiar de Excel/Sheets ya lo hace) o ';'.

export interface ParsedCompany {
  raw_input: string;
  razon_social: string | null;
  cif: string | null;
  domain: string | null;
  linkedin_url: string | null;
}

const LINKEDIN_RE = /linkedin\.com\/company\/[^\s,]+/i;

export function parseCompanies(text: string): ParsedCompany[] {
  const out: ParsedCompany[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cols = line.split(/[;\t]/).map((c) => c.trim());
    const [c0 = "", c1 = "", c2 = "", c3 = "", c4 = ""] = cols;

    if (cols.length === 1) {
      const isUrl = LINKEDIN_RE.test(c0);
      out.push({
        raw_input: c0,
        razon_social: isUrl ? null : c0,
        cif: null,
        domain: null,
        linkedin_url: isUrl ? c0 : null,
      });
      continue;
    }

    // CSV por línea
    const linkedin = c4 || (LINKEDIN_RE.test(line) ? (line.match(LINKEDIN_RE)?.[0] ?? null) : null);
    out.push({
      raw_input: c0 || c1 || linkedin || line,
      razon_social: c1 || null,
      cif: c2 || null,
      domain: c3 || null,
      linkedin_url: linkedin,
    });
  }
  return out;
}
