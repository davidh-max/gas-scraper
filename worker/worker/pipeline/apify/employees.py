"""Pasos 2 y 2b — construye el input del Actor por pasada y devuelve los items.

`build_pass_input` arma el input respetando las reglas de oro. `EmployeesSearch`
ejecuta una pasada: en modo fixtures lee `tests/fixtures/apify_employees_sample.json`
y filtra por (empresa consultada, etiqueta de pasada); en modo live delega en
`ApifyClient.run_employees` (stub no verificado en esta tanda).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..models import Company
from ..resolver.base import handle_of
from .client import ApifyClient

DEFAULT_MAX_PER_COMPANY = 6

# etiqueta de pasada → clave de params en area_profile.
#   A / B            → área principal (pass_a = función+seniority, pass_b = jobTitles)
#   backup_a/backup_b → área de respaldo (mismas claves, otra área)
#   fallback         → alias histórico de backup_a (compatibilidad)
PASS_TO_PARAM_KEY = {
    "A": "pass_a",
    "B": "pass_b",
    "fallback": "pass_a",
    "backup_a": "pass_a",
    "backup_b": "pass_b",
}


def build_pass_input(
    company_urls: list[str],
    area_params: dict[str, Any],
    pass_label: str,
    *,
    max_per_company: int = DEFAULT_MAX_PER_COMPANY,
) -> dict[str, Any]:
    """Input del Actor para una pasada. UNA llamada, one_by_one (reglas de oro)."""
    param_key = PASS_TO_PARAM_KEY[pass_label]
    extra = dict(area_params.get(param_key, {}) or {})
    run_input: dict[str, Any] = {
        "companies": company_urls,
        "locations": area_params.get("locations", ["Spain"]),
        "profileScraperMode": "Short ($4 per 1k)",
        "companyBatchMode": "one_by_one",
        "maxItemsPerCompany": max_per_company,
        "maxItems": max(len(company_urls) * max_per_company, max_per_company),
    }
    run_input.update(extra)  # jobTitles XOR seniorityLevelIds (+ functionIds si aplica)
    if "jobTitles" in run_input and "seniorityLevelIds" in run_input:
        raise ValueError(
            "Regla de oro: no mezclar jobTitles y seniorityLevelIds en una pasada."
        )
    return run_input


def _load_fixture_items(fixtures_dir: Path) -> list[dict[str, Any]]:
    path = fixtures_dir / "apify_employees_sample.json"
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("items", []) if isinstance(data, dict) else (data or [])


def _fixture_pass_of(item: dict[str, Any]) -> str:
    return (item.get("_meta", {}) or {}).get("_fixture_pass", "A")


def _queried_handle(item: dict[str, Any]) -> str:
    q = (item.get("_meta", {}) or {}).get("query", {}) or {}
    companies = q.get("currentCompanies") or []
    return handle_of(companies[0]) if companies else ""


class EmployeesSearch:
    """Ejecuta una pasada del Actor (live o fixtures) y devuelve items crudos."""

    def __init__(
        self,
        *,
        use_fixtures: bool,
        fixtures_dir: Path | None = None,
        client: ApifyClient | None = None,
    ) -> None:
        self.use_fixtures = use_fixtures
        self.fixtures_dir = fixtures_dir
        self.client = client

    def run_pass(
        self,
        companies: list[Company],
        area_params: dict[str, Any],
        pass_label: str,
        *,
        max_per_company: int = DEFAULT_MAX_PER_COMPANY,
    ) -> list[dict[str, Any]]:
        """Devuelve los items del dataset para las `companies` dadas en esta pasada."""
        urls = [c.linkedin_url for c in companies if c.linkedin_url]
        if not urls:
            return []
        run_input = build_pass_input(
            urls, area_params, pass_label, max_per_company=max_per_company
        )

        if self.use_fixtures:
            return self._run_from_fixtures(urls, pass_label)

        if self.client is None:  # pragma: no cover - guardia de modo live
            raise RuntimeError("Modo live sin ApifyClient configurado.")
        return self.client.run_employees(run_input)

    def _run_from_fixtures(self, urls: list[str], pass_label: str) -> list[dict[str, Any]]:
        if self.fixtures_dir is None:
            raise RuntimeError("Modo fixtures sin fixtures_dir.")
        wanted = {handle_of(u) for u in urls}
        items = _load_fixture_items(self.fixtures_dir)
        return [
            it
            for it in items
            if _queried_handle(it) in wanted and _fixture_pass_of(it) == pass_label
        ]
