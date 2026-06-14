// Parser CSV mínimo: separa por comas respetando comillas dobles.
// No soporta escapes complejos, pero es suficiente para importar listas
// de empresas desde Excel/Google Sheets.

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string, delimiter = ","): CsvTable {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: string[][] = [];

  for (const line of lines) {
    if (line.trim() === "") continue;
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      const next = line[i + 1];

      if (inQuotes) {
        if (ch === '"') {
          if (next === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const first: string[] = rows[0]!;
  // Heurística: si la primera fila parece cabecera (todo texto, sin URLs de
  // LinkedIn ni CIFs típicos), la usamos como cabecera.
  const looksLikeHeader = first.every((cell) => {
    const c = cell.toLowerCase();
    return (
      c.length > 0 &&
      !c.includes("linkedin.com") &&
      !/^[a-z]-?\d{8}$/i.test(cell) &&
      !/^\d{8}[a-z]$/i.test(cell)
    );
  });

  if (looksLikeHeader) {
    return { headers: first, rows: rows.slice(1) };
  }

  // Sin cabecera: generamos nombres genéricos Columna 1, Columna 2, ...
  const headers = first.map((_, i) => `Columna ${i + 1}`);
  return { headers, rows };
}
