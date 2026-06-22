import { describe, expect, it } from "vitest";

import { parseCompanies } from "./parseCompanies";

describe("parseCompanies", () => {
  it("conserva las comas internas de la forma jurídica (regresión Navantia)", () => {
    const rows = parseCompanies("Navantia, S.A., S.M.E");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      raw_input: "Navantia, S.A., S.M.E",
      razon_social: "Navantia, S.A., S.M.E",
      cif: null,
      domain: null,
      linkedin_url: null,
    });
  });

  it("trata cada caso de coma como una sola empresa, no como varias columnas", () => {
    for (const name of ["Acme, S.L.", "Foo, S.L.U.", "Bar, Sociedad Anónima"]) {
      const rows = parseCompanies(name);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ razon_social: name, cif: null });
    }
  });

  it("una razón social suelta", () => {
    const [row] = parseCompanies("Galenicum");
    expect(row).toMatchObject({ raw_input: "Galenicum", razon_social: "Galenicum", linkedin_url: null });
  });

  it("una URL de LinkedIn suelta", () => {
    const url = "https://www.linkedin.com/company/amadeus/";
    const [row] = parseCompanies(url);
    expect(row).toMatchObject({ raw_input: url, razon_social: null, linkedin_url: url });
  });

  it("varios campos por línea separados por ';' (raw_input ; razon_social ; cif)", () => {
    const [row] = parseCompanies("Acme; Acme, S.A.; B12345678");
    expect(row).toMatchObject({
      raw_input: "Acme",
      razon_social: "Acme, S.A.",
      cif: "B12345678",
    });
  });

  it("varios campos por línea separados por TAB (pegado desde Excel)", () => {
    const [row] = parseCompanies("Acme\tAcme, S.A.\tB12345678");
    expect(row).toMatchObject({
      raw_input: "Acme",
      razon_social: "Acme, S.A.",
      cif: "B12345678",
    });
  });

  it("ignora líneas en blanco y procesa varias líneas", () => {
    const rows = parseCompanies("Navantia, S.A., S.M.E\n\n  \nGalenicum\n");
    expect(rows.map((r) => r.razon_social)).toEqual(["Navantia, S.A., S.M.E", "Galenicum"]);
  });
});
