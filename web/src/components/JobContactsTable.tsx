"use client";

import { useMemo, useState } from "react";

import { Badge, Input, Tabs } from "@/ds";
import { ContactActions } from "./ContactActions";
import { computeErrorRateFromContacts } from "@/lib/data/source";
import { reviewReason } from "@/lib/data/source";
import type { JobContact, NoResultCompany } from "@/lib/data/source";
import type { JobRow, ContactStatus } from "@/types/db";

const REASON_LABELS: Record<string, string> = {
  ya_no_en_empresa: "Ya no está en la empresa",
  empresa_incorrecta: "Empresa equivocada",
  url_incorrecta: "URL de LinkedIn incorrecta",
  jubilado: "Se ha jubilado",
  no_es_decisor: "No era el decisor",
  otro: "Otro",
};

type TabKey = "todos" | "ok" | "revisar" | "sin_resultado";

interface RowItemContact {
  kind: "contact";
  data: JobContact;
}

interface RowItemNoResult {
  kind: "no_result";
  data: NoResultCompany;
}

type RowItem = RowItemContact | RowItemNoResult;

export function JobContactsTable({
  job,
  initialContacts,
  noResults,
}: {
  job: JobRow;
  initialContacts: JobContact[];
  noResults: NoResultCompany[];
}) {
  const [contacts, setContacts] = useState<JobContact[]>(initialContacts);
  const [activeTab, setActiveTab] = useState<TabKey>("todos");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const errorRate = useMemo(() => computeErrorRateFromContacts(contacts), [contacts]);

  const filtered = useMemo<RowItem[]>(() => {
    const q = query.trim().toLowerCase();
    const contactRows: RowItemContact[] = contacts
      .filter((c) => {
        if (activeTab === "ok") return c.classification === "decisor";
        if (activeTab === "revisar") return c.classification === "revisar";
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        const haystack = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.title ?? ""} ${c.companyName}`.toLowerCase();
        return haystack.includes(q);
      })
      .map((c) => ({ kind: "contact" as const, data: c }));

    const noResultRows: RowItemNoResult[] =
      activeTab === "sin_resultado" || activeTab === "todos"
        ? noResults
            .filter((n) => !q || n.name.toLowerCase().includes(q))
            .map((n) => ({ kind: "no_result" as const, data: n }))
        : [];

    if (activeTab === "sin_resultado") return noResultRows;
    return [...contactRows, ...noResultRows];
  }, [contacts, activeTab, query, noResults]);

  const handleFeedbackChange = (
    id: string,
    feedback: JobContact["feedback"],
    reason?: JobContact["feedback_reason"] | null,
    note?: string | null,
  ) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              feedback,
              feedback_reason: reason ?? null,
              feedback_note: note ?? null,
              feedback_at: new Date().toISOString(),
            }
          : c,
      ),
    );
  };

  const handleStatusChange = (id: string, status: ContactStatus) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const cols = "40px 1.4fr 1.5fr 1.4fr 90px 90px 100px 170px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tabs + búsqueda */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Tabs
          tabs={[
            { id: "todos", label: "Todos" },
            { id: "ok", label: "OK", count: contacts.filter((c) => c.classification === "decisor").length },
            { id: "revisar", label: "Revisar", count: contacts.filter((c) => c.classification === "revisar").length },
            { id: "sin_resultado", label: "Sin resultado", count: noResults.length },
          ]}
          value={activeTab}
          onChange={(id) => {
            setActiveTab(id as TabKey);
            setSelectedId(null);
          }}
        />
        <div style={{ width: 260, flexShrink: 0 }}>
          <Input
            icon="search"
            placeholder="Buscar nombre, cargo o empresa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="sm"
          />
        </div>
      </div>

      {/* Margen de error del job */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--red-50)",
            color: "var(--color-danger)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i data-lucide="percent" style={{ width: 18, height: 18 }} />
        </span>
        <div>
          <div style={{ font: "var(--weight-bold) 13px/1 var(--font-tech)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Margen de error del job
          </div>
          <div style={{ font: "var(--weight-medium) 14px/1.4 var(--font-sans)", color: "var(--text-secondary)", marginTop: 4 }}>
            Validados <strong style={{ color: "var(--green-600)" }}>{errorRate.total - errorRate.invalid}</strong>
            {" · "}
            Erróneos <strong style={{ color: "var(--color-danger)" }}>{errorRate.invalid}</strong>
            {" · "}
            <strong style={{ color: "var(--ink)" }}>{errorRate.rate}%</strong> margen de error
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              gap: 10,
              padding: "12px 16px",
              background: "var(--neutral-50)",
              borderBottom: "1px solid var(--border-subtle)",
              font: "var(--weight-bold) 10px/1.2 var(--font-tech)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              minWidth: 900,
            }}
          >
            <div>Nº</div>
            <div>Nombre</div>
            <div>Cargo</div>
            <div>Empresa</div>
            <div>LinkedIn</div>
            <div>Teléfono</div>
            <div>Estado</div>
            <div>Feedback</div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", font: "var(--weight-medium) 14px/1.5 var(--font-sans)" }}>
              No hay contactos para este filtro.
            </div>
          ) : (
            filtered.map((row, idx) => {
              if (row.kind === "no_result") {
                return (
                  <div
                    key={row.data.companyId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: cols,
                      gap: 10,
                      padding: "12px 16px",
                      alignItems: "center",
                      borderBottom: "1px solid var(--neutral-100)",
                      background: "var(--neutral-50)",
                      minWidth: 900,
                    }}
                  >
                    <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", color: "var(--neutral-300)" }}>{idx + 1}</div>
                    <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Sin contacto</div>
                    <div />
                    <div style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.data.name}
                    </div>
                    <div />
                    <div />
                    <div>
                      <Badge tone="neutral">Sin resultado</Badge>
                    </div>
                    <div />
                  </div>
                );
              }

              const c = row.data;
              const isSelected = selectedId === c.id;
              const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";

              return (
                <div key={c.id}>
                  <div
                    onClick={() => setSelectedId(isSelected ? null : c.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: cols,
                      gap: 10,
                      padding: "12px 16px",
                      alignItems: "center",
                      borderBottom: "1px solid var(--neutral-100)",
                      cursor: "pointer",
                      background: isSelected ? "var(--red-50)" : "#fff",
                      transition: "background var(--dur-base) var(--ease-standard)",
                      minWidth: 900,
                    }}
                  >
                    <div style={{ font: "var(--weight-bold) 11px/1 var(--font-tech)", color: "var(--neutral-300)" }}>{idx + 1}</div>
                    <div style={{ font: "var(--weight-semibold) 14px/1.2 var(--font-sans)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {name}
                    </div>
                    <div style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title ?? "—"}</div>
                    <div style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.companyName}</div>
                    <div>
                      {c.linkedin_url ? (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "var(--text-link)", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <i data-lucide="external-link" style={{ width: 14, height: 14 }} />
                          <span style={{ font: "var(--weight-semibold) 12px/1 var(--font-sans)" }}>Ver</span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                    <div style={{ color: "var(--neutral-300)", fontStyle: "italic" }}>—</div>
                    <div>
                      {c.classification === "decisor" ? (
                        <Badge tone="success" dot>OK</Badge>
                      ) : (
                        <Badge tone="warning" dot>Revisar</Badge>
                      )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ContactActions
                        contact={c}
                        onFeedbackChange={(feedback, reason, note) =>
                          handleFeedbackChange(c.id, feedback, reason, note ?? null)
                        }
                        onStatusChange={(status) => handleStatusChange(c.id, status)}
                      />
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        padding: "16px 20px",
                        background: "var(--surface-page)",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ font: "var(--weight-bold) 12px/1 var(--font-tech)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                        Detalle del contacto
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                        <DetailItem label="Ubicación" value={c.location ?? "—"} />
                        <DetailItem label="Pasada" value={c.source_pass} />
                        <DetailItem label="Motivo de revisión" value={c.classification === "revisar" ? reviewReason(c) : "—"} />
                        <DetailItem
                          label="Verificar empresa"
                          value={c.verify_flag === "verificar_empresa" ? "Sí — posible homónimo" : "No"}
                        />
                      </div>
                      {(c.feedback_reason ?? c.feedback_note) && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 12 }}>
                          <DetailItem label="Motivo del error" value={c.feedback_reason ? REASON_LABELS[c.feedback_reason] ?? c.feedback_reason : "—"} />
                          <DetailItem label="Nota" value={c.feedback_note ?? "—"} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ font: "var(--weight-bold) 10px/1 var(--font-tech)", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ font: "var(--weight-medium) 13px/1.4 var(--font-sans)", color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
