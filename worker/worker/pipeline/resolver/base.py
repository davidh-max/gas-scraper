"""Interfaz `UrlResolver` y la resolución heurística gratuita (sin red).

El Paso 1 toma una `Company` con input heterogéneo y rellena:
`linkedin_url`, `resolution_method`, `resolution_confidence`, `status`.
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod

from ..models import Company, CompanyStatus, ResolutionMethod
from .confidence import name_handle_confidence, normalize_handle

_LINKEDIN_COMPANY_RE = re.compile(r"linkedin\.com/company/([^/?#\s]+)", re.I)


def extract_linkedin_company_url(text: str | None) -> str | None:
    """Si el texto contiene una URL de /company/<handle>, devuelve la URL canónica."""
    if not text:
        return None
    m = _LINKEDIN_COMPANY_RE.search(text)
    if not m:
        return None
    handle = m.group(1).strip().rstrip("/")
    return f"https://www.linkedin.com/company/{handle}"


def handle_from_domain(domain: str | None) -> str | None:
    """Adivina un handle a partir del dominio: 'bnext.es' → 'bnext'."""
    if not domain:
        return None
    d = domain.strip().lower()
    d = re.sub(r"^https?://", "", d).split("/")[0]
    d = re.sub(r"^www\.", "", d)
    label = d.split(".")[0] if "." in d else d
    return label or None


class UrlResolver(ABC):
    """Resuelve la URL de LinkedIn de una empresa a partir de su input heterogéneo."""

    @abstractmethod
    def resolve(self, company: Company) -> Company:
        """Devuelve la `company` con los campos de resolución rellenos (muta y retorna)."""
        raise NotImplementedError


def resolve_heuristic(company: Company) -> Company:
    """Capa gratuita y determinista del Paso 1 (sin llamadas externas).

    Orden de preferencia:
      1. `linkedin_url` ya provisto o detectado en `raw_input` → `provided` (conf 1.0).
      2. `domain` → adivina handle, confianza por fuzzy nombre↔handle → `domain_guess`.
      3. Nada → `unresolved` (status `no_url`); candidata a SERP / fallback.
    """
    # 1) URL provista (campo explícito o embebida en el texto crudo)
    provided = company.linkedin_url or extract_linkedin_company_url(company.raw_input)
    if provided:
        company.linkedin_url = extract_linkedin_company_url(provided) or provided
        company.resolution_method = ResolutionMethod.provided
        company.resolution_confidence = 1.0
        company.status = CompanyStatus.resolved
        return company

    # 2) Dominio → handle adivinado, puntuado por similitud con la razón social
    handle = handle_from_domain(company.domain)
    if handle:
        url = f"https://www.linkedin.com/company/{handle}"
        conf = name_handle_confidence(company.razon_social or company.raw_input, handle)
        # un domain_guess sin nombre con el que contrastar aún vale como pista media
        company.linkedin_url = url
        company.resolution_method = ResolutionMethod.domain_guess
        company.resolution_confidence = max(conf, 0.4)
        company.status = CompanyStatus.resolved
        return company

    # 3) Sin señales suficientes
    company.resolution_method = ResolutionMethod.unresolved
    company.resolution_confidence = 0.0
    company.status = CompanyStatus.no_url
    company.note = (
        "No se pudo resolver la URL de LinkedIn (sin dominio ni URL). "
        "Aportar el dominio o la URL de empresa, o resolver vía SERP."
    )
    return company


def handle_of(linkedin_url: str | None) -> str:
    """Handle crudo de /company/<handle> (en minúsculas, guiones preservados).

    Sirve para AGRUPAR items por empresa consultada (regla de oro nº4) y comparar
    URLs que difieren en `es.`/`www.`/esquema/barra final.
    """
    if not linkedin_url:
        return ""
    u = str(linkedin_url).strip().lower().split("?")[0].split("#")[0].rstrip("/")
    m = re.search(r"/company/([^/]+)", u)
    return m.group(1) if m else u


def canonical_company_id(linkedin_url: str | None) -> str:
    """companyId canónico: el id numérico de /company/<id>; si no, el handle."""
    if not linkedin_url:
        return ""
    m = re.search(r"/company/(\d+)", str(linkedin_url))
    return m.group(1) if m else normalize_handle(linkedin_url).replace(" ", "-")
