"""Paso 1: resolver URL de LinkedIn de cada empresa.

Usa el Actor de Apify `anchor/LinkedIn-company-url-finder` con UNA llamada en batch.
Si la empresa ya trae URL de LinkedIn (o la detectamos en raw_input), se conserva.
Las URLs devueltas se normalizan a `https://www.linkedin.com/company/{handle}/`.

Validación: por ahora confiamos en el Actor. LinkedIn devuelve 200 incluso para
handles inventados, así que la verificación HTTP no es fiable. Más adelante se
puede añadir validación con IA/web search.
"""

from __future__ import annotations

import re

from ..apify.client import ApifyClient
from ..models import Company, CompanyStatus, ResolutionMethod
from .base import resolve_heuristic
from .confidence import name_handle_confidence

# Cualquier URL de LinkedIn /company/<handle> posiblemente con path extra (/jobs,...)
_LINKEDIN_COMPANY_RE = re.compile(r"linkedin\.com/company/([^/?#\s]+)", re.I)


def normalize_company_url(url: str | None) -> str | None:
    """Extrae y normaliza la URL canónica de /company/<handle>.

    Ignora subdominios (es.linkedin.com), barra final, paths extra (/jobs, /about).
    """
    if not url:
        return None
    m = _LINKEDIN_COMPANY_RE.search(url)
    if not m:
        return None
    handle = m.group(1).strip().rstrip("/")
    return f"https://www.linkedin.com/company/{handle}/"


class ApifyCompanyUrlResolver:
    """Resuelve URLs de LinkedIn en batch vía Apify company-url-finder."""

    def __init__(self, client: ApifyClient | None = None) -> None:
        self.client = client

    def resolve_batch(self, companies: list[Company]) -> None:
        """Resuelve todas las empresas que aún no tengan URL con una sola llamada."""
        if not companies:
            return

        # 1) Primero la capa heurística gratuita
        to_resolve: list[Company] = []
        for company in companies:
            resolve_heuristic(company)
            if not company.linkedin_url:
                to_resolve.append(company)

        if not to_resolve:
            return

        if self.client is None:
            # Modo fixtures/stub: no se puede resolver, se marcan unresolved
            for company in to_resolve:
                company.resolution_method = ResolutionMethod.unresolved
                company.status = CompanyStatus.no_url
                company.note = (
                    "No se pudo resolver la URL de LinkedIn (sin soporte Apify)."
                )
            return

        queries = []
        for company in to_resolve:
            # Preferimos usar razon_social; si no, el raw_input (nombre original)
            queries.append(company.razon_social or company.raw_input)

        results = self.client.run_company_url_finder(queries)

        # Indexar resultados por mySearch (el nombre enviado)
        by_query = {r.get("mySearch", ""): r for r in results}

        for company in to_resolve:
            query = company.razon_social or company.raw_input
            result = by_query.get(query, {})
            linkedin_url = normalize_company_url(result.get("linkedinUrl"))

            if linkedin_url:
                company.linkedin_url = linkedin_url
                company.resolution_method = ResolutionMethod.serp
                match = _LINKEDIN_COMPANY_RE.search(linkedin_url)
                handle = match.group(1) if match else ""
                company.resolution_confidence = name_handle_confidence(
                    company.razon_social or company.raw_input, handle
                )
                company.status = CompanyStatus.resolved
                company.note = None
            else:
                company.resolution_method = ResolutionMethod.unresolved
                company.status = CompanyStatus.no_url
                company.note = "No se encontró URL de LinkedIn para esta empresa."

    def resolve(self, company: Company) -> Company:
        """API compatible con un resolver individual."""
        self.resolve_batch([company])
        return company


def resolve_linkedin_urls(
    companies: list[Company],
    client: ApifyClient | None,
) -> list[Company]:
    """Helper de alto nivel usado por el pipeline."""
    resolver = ApifyCompanyUrlResolver(client=client)
    resolver.resolve_batch(companies)

    # companyId canónico anti-homónimos (handle, numérico si lo tuviera)
    from .base import canonical_company_id

    for company in companies:
        if company.linkedin_url:
            company.linkedin_company_id = canonical_company_id(company.linkedin_url)

    return companies
