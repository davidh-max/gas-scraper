"use client";

import { useMemo, useState } from "react";

import { createJob } from "@/lib/actions";
import { estimateCostUsd, formatUsd } from "@/lib/cost";
import { parseCompanies } from "@/lib/parseCompanies";
import type { AreaProfileRow, ClientRow } from "@/types/db";

export function NewJobForm({
  clients,
  areas,
}: {
  clients: ClientRow[];
  areas: AreaProfileRow[];
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = useMemo(() => parseCompanies(text).length, [text]);
  const cost = useMemo(() => estimateCostUsd(count), [count]);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        setError(null);
        try {
          await createJob(fd);
        } catch (e) {
          // `redirect()` lanza NEXT_REDIRECT como control de flujo: re-lánzalo.
          if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) {
            throw e;
          }
          setError(e instanceof Error ? e.message : "No se pudo crear el job.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid">
        <div>
          <label htmlFor="client_id">Cliente</label>
          <select id="client_id" name="client_id" required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="area_profile_id">Área</label>
          <select id="area_profile_id" name="area_profile_id" required>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor="backup_area_profile_id">Área de respaldo (fallback, opcional)</label>
      <select id="backup_area_profile_id" name="backup_area_profile_id">
        <option value="">— ninguna —</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <label htmlFor="companies_text">
        Empresas (una por línea: URL de LinkedIn, o razón social, o
        <code> raw, razón social, CIF, dominio, URL</code>)
      </label>
      <textarea
        id="companies_text"
        name="companies_text"
        placeholder={"Amadeus IT Group, Amadeus IT Group SA, A11111111, , https://www.linkedin.com/company/amadeus/\nBnext, Bnext SL, B22222222, bnext.es,"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
      />

      <div className="row" style={{ marginTop: 12 }}>
        <label
          htmlFor="use_fixtures"
          style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}
        >
          <input
            id="use_fixtures"
            name="use_fixtures"
            type="checkbox"
            style={{ width: "auto" }}
          />
          Usar fixtures (no gasta Apify)
        </label>
        <div className="spacer" />
        <span className="muted small">
          {count} empresa{count === 1 ? "" : "s"} · coste estimado ~{formatUsd(cost)}{" "}
          <span title="Estimación aproximada (TODO calibrar)">ⓘ</span>
        </span>
      </div>

      {error && (
        <p className="small" style={{ color: "var(--red)", marginTop: 12 }}>
          {error}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending || count === 0} style={{ marginTop: 14 }}>
        {pending ? "Creando…" : "Crear job"}
      </button>
    </form>
  );
}
