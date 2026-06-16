"""Cliente fino del Actor de Apify (REST). Soporta modo live real.

Reglas de oro que este cliente DEBE respetar (ver CLAUDE.md):
  - UNA sola llamada por pasada: todas las URLs en `companies`, companyBatchMode="one_by_one".
  - profileScraperMode="Short ($4 per 1k)".
  - Al LEER el dataset, usar `omit`, NUNCA `fields` (la proyección rompe arrays).
"""

from __future__ import annotations

from typing import Any

import httpx

APIFY_BASE = "https://api.apify.com/v2"

# Campos de ruido que descartamos al leer el dataset (regla de oro: omit, no fields).
DATASET_OMIT = "summary,pictureUrl,openProfile,premium,id"


class ApifyError(RuntimeError):
    pass


class ApifyClient:
    """Wrapper REST mínimo. Solo se usa en modo NO-fixtures (live)."""

    def __init__(
        self,
        token: str,
        employees_actor_id: str,
        company_url_finder_actor_id: str,
        *,
        timeout: float = 600.0,
    ) -> None:
        if not token:
            raise ApifyError("APIFY_TOKEN vacío: el modo live requiere token.")
        self.token = token
        self.employees_actor_id = employees_actor_id
        self.company_url_finder_actor_id = company_url_finder_actor_id
        self.timeout = timeout
        self._http_cache: httpx.Client | None = None

    # --- llamada genérica a un Actor + lectura del dataset ------------------

    def run_actor_sync(
        self,
        actor_id: str,
        run_input: dict[str, Any],
        *,
        omit: str = DATASET_OMIT,
    ) -> list[dict[str, Any]]:
        """POST run-sync-get-dataset-items y devuelve los items del dataset."""
        url = (
            f"{APIFY_BASE}/acts/{actor_id}/"
            f"run-sync-get-dataset-items?token={self.token}&omit={omit}"
        )
        client = self._http()
        resp = client.post(url, json=run_input)
        if resp.status_code not in (200, 201):
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise ApifyError(f"Apify actor {actor_id} error {resp.status_code}: {detail}")
        data = resp.json()
        return data if isinstance(data, list) else data.get("items", [])

    def run_company_url_finder(
        self,
        queries: list[str],
        max_concurrency: int = 10,
    ) -> list[dict[str, Any]]:
        """Resuelve URLs de LinkedIn para una lista de nombres de empresa en UNA llamada."""
        if not queries:
            return []
        run_input: dict[str, Any] = {
            "queries": "\n".join(queries),
            "maxConcurrency": max_concurrency,
        }
        return self.run_actor_sync(self.company_url_finder_actor_id, run_input, omit="")

    def validate_company_url_finder(self) -> bool:
        """Valida saldo/permisos con una llamada mínima al actor de resolución."""
        try:
            items = self.run_company_url_finder(["Amadeus IT Group"])
        except ApifyError:
            return False
        return len(items) > 0

    def run_employees(self, run_input: dict[str, Any]) -> list[dict[str, Any]]:
        """Lanza UNA pasada del Actor de empleados y devuelve los items del dataset.

        UNA sola llamada por pasada (todas las URLs en `companies`, one_by_one). Se
        leen los items con `omit` (regla de oro: la proyección con `fields` rompe
        arrays anidados como `currentPositions`).
        """
        self._assert_golden_rules(run_input)
        return self.run_actor_sync(self.employees_actor_id, run_input, omit=DATASET_OMIT)

    def _http(self) -> httpx.Client:
        if self._http_cache is None:
            self._http_cache = httpx.Client(timeout=self.timeout)
        return self._http_cache

    @staticmethod
    def _assert_golden_rules(run_input: dict[str, Any]) -> None:
        if run_input.get("companyBatchMode") != "one_by_one":
            raise ApifyError("Regla de oro: companyBatchMode debe ser 'one_by_one'.")
        if run_input.get("profileScraperMode") != "Short ($4 per 1k)":
            raise ApifyError("Regla de oro: profileScraperMode debe ser 'Short ($4 per 1k)'.")
        if "jobTitles" in run_input and "seniorityLevelIds" in run_input:
            raise ApifyError(
                "Regla de oro: no mezclar jobTitles con seniorityLevelIds (van en pasadas A/B)."
            )
