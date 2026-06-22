"use client";

import { useMemo, useRef, useState } from "react";

import { Button, Input, Select, Switch } from "@/ds";
import { createJob } from "@/lib/actions";
import { estimateCostUsd } from "@/lib/cost";
import { parseCompanies } from "@/lib/parseCompanies";
import { parseCsv, type CsvTable } from "@/lib/parseCsv";
import type { ParsedCompany } from "@/lib/parseCompanies";
import type { AreaProfileRow, ClientRow } from "@/types/db";
import { CsvColumnMapper } from "./CsvColumnMapper";

const PLACEHOLDER = [
  "Naviera Costa Brava S.A.",
  "B-12345678",
  "linkedin.com/company/transgruas-del-sur",
  "Astilleros del Atlántico SL",
  "Pesca y Congelados Morrazo",
].join("\n");

const eurStyle: React.CSSProperties = {
  font: "var(--weight-extra) 52px/0.9 var(--font-tech)",
  color: "var(--ink)",
};

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px" }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--ink)",
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          font: "var(--weight-bold) 12px/1 var(--font-tech)",
        }}
      >
        {n}
      </span>
      <span
        style={{
          font: "var(--weight-bold) 13px/1 var(--font-tech)",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--ink)",
        }}
      >
        {title}
      </span>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 36,
        padding: "0 16px",
        borderRadius: 999,
        cursor: "pointer",
        border: "none",
        font: "var(--weight-semibold) 13px/1 var(--font-sans)",
        background: active ? "#fff" : "transparent",
        color: active ? "var(--ink)" : "var(--text-muted)",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        transition: "all var(--dur-base) var(--ease-standard)",
      }}
    >
      <i data-lucide={icon} style={{ width: 15, height: 15 }} />
      {label}
    </button>
  );
}

export function NewJobForm({ clients, areas }: { clients: ClientRow[]; areas: AreaProfileRow[] }) {
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [backup, setBackup] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para el flujo de subida + mapeo de columnas
  const [fileMode, setFileMode] = useState<"idle" | "mapper" | "confirmed">("idle");
  const [mapperTable, setMapperTable] = useState<CsvTable | null>(null);
  const [mappedCompanies, setMappedCompanies] = useState<ParsedCompany[] | null>(null);
  const [mapperError, setMapperError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const parsedFromText = useMemo(() => parseCompanies(text), [text]);
  const companiesToSend = useMemo<ParsedCompany[]>(() => {
    if (tab === "paste") return parsedFromText;
    if (tab === "upload" && mappedCompanies) return mappedCompanies;
    return [];
  }, [tab, parsedFromText, mappedCompanies]);

  const count = companiesToSend.length;
  const withUrl = companiesToSend.filter((c) => c.linkedin_url).length;
  const cost = useMemo(() => estimateCostUsd(count), [count]);
  const costLabel = cost.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const areaOptions = areas.map((a) => ({ value: a.id, label: a.name }));
  const backupOptions = [{ value: "", label: "— Sin respaldo —" }, ...areaOptions];

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMapperError(null);
    file.text().then((t) => {
      const table = parseCsv(t);
      if (table.headers.length === 0 || table.rows.length === 0) {
        setMapperError("El archivo parece vacío. Revisa que tenga al menos una fila de datos.");
        setFileMode("idle");
        return;
      }

      // Una sola columna: mapeo automático directo.
      if (table.headers.length === 1) {
        const companies: ParsedCompany[] = table.rows
          .map((row) => {
            const raw = row[0]?.trim() ?? "";
            if (!raw) return null;
            const item: ParsedCompany = {
              raw_input: raw,
              razon_social: null,
              cif: null,
              domain: null,
              linkedin_url: null,
            };
            return item;
          })
          .filter((c): c is ParsedCompany => c !== null);
        setMappedCompanies(companies);
        setFileMode("confirmed");
        return;
      }

      setMapperTable(table);
      setFileMode("mapper");
    });
  }

  function handleMapperConfirm(companies: ParsedCompany[]) {
    setMappedCompanies(companies);
    setFileMode("confirmed");
  }

  function handleMapperCancel() {
    setFileMode("idle");
    setMapperTable(null);
    setMappedCompanies(null);
    setMapperError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form
      action={async (fd) => {
        if (pending) return;
        setPending(true);
        setError(null);
        try {
          await createJob(fd);
        } catch (e) {
          // redirect() lanza NEXT_REDIRECT como control de flujo: re-lánzalo.
          if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) {
            throw e;
          }
          setError(e instanceof Error ? e.message : "No se pudo crear el job.");
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="companies_json" value={JSON.stringify(companiesToSend)} />
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        {/* ===== Columna de formulario ===== */}
        <div style={{ flex: 1, minWidth: 0, padding: "28px 30px" }}>
          <StepHeader n={1} title="Cliente & área" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <Select name="client_id" label="Cliente" options={clientOptions} required />
            <Select name="area_profile_id" label="Área del decisor" options={areaOptions} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <Select
              name="backup_area_profile_id"
              label="Área de respaldo (opcional)"
              options={backupOptions}
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
            />
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 9,
                background: "var(--cyan-100)",
                border: "1px solid var(--cyan-100)",
                borderRadius: "var(--radius-md)",
                padding: "12px 14px",
                marginTop: 24,
              }}
            >
              <i data-lucide="info" style={{ width: 16, height: 16, color: "var(--cyan-500)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ font: "var(--weight-medium) 12px/1.45 var(--font-sans)", color: "var(--text-secondary)" }}>
                Si no encuentra el área principal, busca el área de respaldo antes de marcar <b>Sin resultado</b>.
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Input
              name="name"
              label="Nombre del lote (opcional)"
              placeholder="p. ej. Vodafone IT · junio 2026"
              icon="tag"
            />
          </div>

          <div style={{ marginTop: 28 }}>
            <StepHeader n={2} title="Lista de empresas" />
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              background: "var(--surface-sunken)",
              padding: 4,
              borderRadius: 999,
              width: "fit-content",
              marginBottom: 14,
            }}
          >
            <TabButton active={tab === "paste"} icon="clipboard" label="Pegar texto" onClick={() => setTab("paste")} />
            <TabButton active={tab === "upload"} icon="upload" label="Subir archivo" onClick={() => setTab("upload")} />
          </div>

          {tab === "paste" ? (
            <div
              style={{
                border: "1.5px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 14px",
                  background: "var(--neutral-50)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <span style={{ font: "var(--weight-semibold) 12px/1 var(--font-sans)", color: "var(--text-secondary)" }}>
                  Una empresa por línea — nombre, CIF o URL de LinkedIn
                </span>
                <span style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", color: "var(--color-brand)" }}>
                  {count} {count === 1 ? "EMPRESA" : "EMPRESAS"}
                </span>
              </div>
              <textarea
                name="companies_text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PLACEHOLDER}
                style={{
                  width: "100%",
                  minHeight: 200,
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  padding: "12px 14px",
                  font: "var(--weight-regular) 13px/1.8 var(--font-mono, ui-monospace, monospace)",
                  color: "var(--text-primary)",
                  background: "#fff",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                border: "1.5px solid var(--border-default)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "#fff",
                padding: "20px",
              }}
            >
              {fileMode === "idle" && (
                <div
                  style={{
                    border: "2px dashed var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    background: "#fff",
                    padding: 30,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "var(--red-50)",
                      color: "var(--color-brand)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                    }}
                  >
                    <i data-lucide="file-spreadsheet" style={{ width: 24, height: 24 }} />
                  </div>
                  <div style={{ font: "var(--weight-bold) 15px/1.2 var(--font-sans)", color: "var(--ink)" }}>
                    Sube un .csv o .txt con las empresas
                  </div>
                  <div style={{ font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-muted)", margin: "6px 0 14px" }}>
                    Cada fila será una empresa. Podrás mapear las columnas a continuación.
                  </div>
                  {mapperError && (
                    <div style={{ color: "var(--color-danger)", font: "var(--weight-medium) 13px/1.4 var(--font-sans)", marginBottom: 12 }}>
                      {mapperError}
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} style={{ display: "none" }} />
                  <Button variant="secondary" icon="folder-open" type="button" onClick={() => fileRef.current?.click()}>
                    Elegir archivo
                  </Button>
                </div>
              )}

              {fileMode === "mapper" && mapperTable && (
                <CsvColumnMapper
                  table={mapperTable}
                  onConfirm={handleMapperConfirm}
                  onCancel={handleMapperCancel}
                />
              )}

              {fileMode === "confirmed" && mappedCompanies && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div style={{ font: "var(--weight-bold) 15px/1.2 var(--font-sans)", color: "var(--ink)" }}>
                        Archivo listo
                      </div>
                      <div style={{ font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-muted)" }}>
                        {mappedCompanies.length}{" "}
                        {mappedCompanies.length === 1 ? "empresa mapeada" : "empresas mapeadas"}
                        {withUrl > 0 && ` · ${withUrl} con LinkedIn URL`}
                      </div>
                    </div>
                    <Button variant="secondary" type="button" onClick={handleMapperCancel}>
                      Cambiar archivo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== Sidebar de coste / lanzamiento ===== */}
        <aside
          style={{
            width: 340,
            flexShrink: 0,
            background: "var(--surface-page)",
            borderLeft: "1px solid var(--border-subtle)",
            padding: "28px 26px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              font: "var(--weight-bold) 11px/1 var(--font-tech)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Estimación de coste
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 12 }}>
            <span style={eurStyle}>≈ {costLabel}</span>
            <span style={{ font: "var(--weight-bold) 20px/1 var(--font-tech)", color: "var(--text-secondary)", marginBottom: 6 }}>
              USD
            </span>
          </div>
          <div style={{ font: "var(--weight-medium) 12px/1.3 var(--font-sans)", color: "var(--text-muted)", marginTop: 4 }}>
            estimación aproximada para procesar este lote
          </div>

          <div style={{ height: 1, background: "var(--border-subtle)", margin: "20px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <Row label="Empresas en la lista" value={String(count)} />
            <Row label="URLs de LinkedIn ya en la lista" value={String(withUrl)} />
            <Row label="Con respaldo activado" value={backup ? "Sí" : "No"} />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 9,
              background: "var(--flame-50)",
              border: "1px solid var(--flame-100)",
              borderRadius: "var(--radius-md)",
              padding: "11px 13px",
              marginTop: 18,
            }}
          >
            <i data-lucide="zap" style={{ width: 15, height: 15, color: "var(--flame-600)", flexShrink: 0, marginTop: 1 }} />
            <span style={{ font: "var(--weight-medium) 12px/1.45 var(--font-sans)", color: "#7c5306" }}>
              Procesar cuesta dinero (servicios externos). Revisa el coste antes de lanzar.
            </span>
          </div>

          <div style={{ marginTop: 18 }}>
            <Switch name="use_fixtures" label="Usar fixtures (no gasta Apify)" />
          </div>

          {error && (
            <span
              style={{
                font: "var(--weight-medium) 12px/1.4 var(--font-sans)",
                color: "var(--color-danger)",
                marginTop: 14,
              }}
            >
              {error}
            </span>
          )}

          <div style={{ marginTop: "auto", paddingTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <Button variant="primary" size="lg" icon="flame" fullWidth type="submit" disabled={pending || count === 0}>
              {pending ? "Lanzando…" : "Lanzar lote"}
            </Button>
            <span style={{ textAlign: "center", font: "var(--weight-medium) 12px/1.4 var(--font-sans)", color: "var(--text-muted)" }}>
              Se procesa automáticamente al crearlo.
            </span>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ font: "var(--weight-medium) 13px/1 var(--font-sans)", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ font: "var(--weight-bold) 14px/1 var(--font-tech)", color: "var(--ink)" }}>{value}</span>
    </div>
  );
}
