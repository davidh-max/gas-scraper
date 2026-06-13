// Estimador de coste Apify (APROXIMADO). Firma estable; calibración fina = TODO.
//
// Modelo "Short ($4 per 1k)": ~0.004 $/perfil. Con companyBatchMode one_by_one se
// cobra además una pequeña tarifa de arranque por empresa. Se asumen hasta
// `maxPerCompany` perfiles por empresa y por pasada, y ~1.5 pasadas medias.

const PRICE_PER_PROFILE_USD = 0.004;
const STARTUP_FEE_PER_COMPANY_USD = 0.002; // TODO(coste): confirmar tarifa real one_by_one
const AVG_PASSES = 1.5; // A casi siempre; B/fallback solo en vacías

export function estimateCostUsd(nCompanies: number, maxPerCompany = 6): number {
  if (nCompanies <= 0) return 0;
  const profiles = nCompanies * maxPerCompany * AVG_PASSES;
  const cost = profiles * PRICE_PER_PROFILE_USD + nCompanies * STARTUP_FEE_PER_COMPANY_USD;
  return Math.round(cost * 100) / 100;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value);
}
