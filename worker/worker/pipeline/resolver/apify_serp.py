"""Resolver basado en un Actor SERP de Apify (STUB).

Encadena: capa heurística gratuita (`resolve_heuristic`) → si sigue sin resolver y
NO estamos en modo fixtures, escalaría a una búsqueda SERP (Google/Bing vía Actor)
para encontrar la URL de LinkedIn. Esa llamada real está pendiente (`# TODO`).

En modo fixtures NO se llama a nada externo: lo que no resuelva la heurística
queda como `unresolved` (irá a "Sin resultado" con su nota).
"""

from __future__ import annotations

from ..models import Company, CompanyStatus, ResolutionMethod
from .base import UrlResolver, resolve_heuristic
from .confidence import name_handle_confidence


class ApifySerpResolver(UrlResolver):
    """Resolver de producción: heurística gratis + escalado a SERP de pago."""

    def __init__(self, *, use_fixtures: bool = False, serp_actor_id: str | None = None) -> None:
        self.use_fixtures = use_fixtures
        self.serp_actor_id = serp_actor_id

    def resolve(self, company: Company) -> Company:
        company = resolve_heuristic(company)
        if company.status != CompanyStatus.no_url:
            return company  # ya resuelta gratis

        if self.use_fixtures:
            # Modo gratis: no escalamos. Queda sin resolver.
            return company

        return self._resolve_via_serp(company)

    def _resolve_via_serp(self, company: Company) -> Company:
        """STUB del escalado a SERP de pago.

        # TODO(paso-1): llamar al Actor SERP (`self.serp_actor_id`) con una query
        #   tipo `"<razón social>" site:linkedin.com/company`, parsear el primer
        #   resultado /company/<handle>, puntuar con `name_handle_confidence`,
        #   cachear en `company_url_cache` y rellenar:
        #     resolution_method = ResolutionMethod.serp
        #     resolution_confidence = <score>
        #     status = CompanyStatus.resolved
        #   Validar antes el saldo Apify (ver apify.client.validate_account).
        """
        _ = name_handle_confidence  # referenciado para el TODO; evita import sin uso
        company.resolution_method = ResolutionMethod.unresolved
        company.status = CompanyStatus.no_url
        company.note = "SERP de resolución pendiente (stub). Aportar dominio o URL de LinkedIn."
        return company
