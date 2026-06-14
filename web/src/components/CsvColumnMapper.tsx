"use client";

import { useMemo, useState } from "react";

import { Button, Select } from "@/ds";
import type { ParsedCompany } from "@/lib/parseCompanies";
import type { CsvTable } from "@/lib/parseCsv";

interface CsvColumnMapperProps {
  table: CsvTable;
  onConfirm: (companies: ParsedCompany[]) => void;
  onCancel: () => void;
}

export function CsvColumnMapper({ table, onConfirm, onCancel }: CsvColumnMapperProps) {
  const [rawInputColumn, setRawInputColumn] = useState<string>("");
  const [linkedinColumn, setLinkedinColumn] = useState<string>("");

  const columnOptions = useMemo(
    () => table.headers.map((h) => ({ value: h, label: h })),
    [table.headers],
  );

  const preview = useMemo(() => {
    const rawIndex = table.headers.indexOf(rawInputColumn);
    const linkedinIndex = linkedinColumn ? table.headers.indexOf(linkedinColumn) : -1;
    if (rawIndex === -1) return [];

    return table.rows.slice(0, 5).map((row) => {
      const raw = row[rawIndex]?.trim() ?? "";
      const linkedin = linkedinIndex >= 0 ? (row[linkedinIndex]?.trim() ?? "") : "";
      return { raw, linkedin };
    });
  }, [table, rawInputColumn, linkedinColumn]);

  const canConfirm = rawInputColumn !== "";

  function handleConfirm() {
    if (!canConfirm) return;
    const rawIndex = table.headers.indexOf(rawInputColumn);
    const linkedinIndex = linkedinColumn ? table.headers.indexOf(linkedinColumn) : -1;

    const companies: ParsedCompany[] = table.rows
      .map((row) => {
        const raw = row[rawIndex]?.trim() ?? "";
        const linkedin = linkedinIndex >= 0 ? (row[linkedinIndex]?.trim() ?? "") : "";
        if (!raw && !linkedin) return null;
        const item: ParsedCompany = {
          raw_input: raw || linkedin,
          razon_social: null,
          cif: null,
          domain: null,
          linkedin_url: linkedin || null,
        };
        return item;
      })
      .filter((c): c is ParsedCompany => c !== null);

    onConfirm(companies);
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ font: "var(--weight-bold) 15px/1.2 var(--font-sans)", color: "var(--ink)", marginBottom: 4 }}>
          Mapea las columnas del archivo
        </div>
        <div style={{ font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-muted)" }}>
          Elige qué columna contiene el nombre de búsqueda y, si la hay, la URL de LinkedIn.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Select
          label="Columna de búsqueda *"
          placeholder="— Selecciona columna —"
          options={columnOptions}
          value={rawInputColumn}
          onChange={(e) => setRawInputColumn(e.target.value)}
        />
        <Select
          label="Columna de LinkedIn URL"
          placeholder="— Ninguna —"
          options={[{ value: "", label: "— Ninguna —" }, ...columnOptions]}
          value={linkedinColumn}
          onChange={(e) => setLinkedinColumn(e.target.value)}
        />
      </div>

      {preview.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: "var(--neutral-50)",
              borderBottom: "1px solid var(--border-subtle)",
              font: "var(--weight-semibold) 12px/1 var(--font-sans)",
              color: "var(--text-secondary)",
            }}
          >
            Vista previa ({preview.length} de {table.rows.length} filas)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 14px",
                    font: "var(--weight-semibold) 12px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Búsqueda
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 14px",
                    font: "var(--weight-semibold) 12px/1 var(--font-sans)",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  LinkedIn URL
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  <td
                    style={{
                      padding: "8px 14px",
                      font: "var(--weight-regular) 13px/1.4 var(--font-sans)",
                      color: "var(--text-primary)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    {row.raw || "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 14px",
                      font: "var(--weight-regular) 13px/1.4 var(--font-sans)",
                      color: "var(--text-primary)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    {row.linkedin || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" type="button" onClick={handleConfirm} disabled={!canConfirm}>
          Confirmar mapeo
        </Button>
      </div>
    </div>
  );
}
