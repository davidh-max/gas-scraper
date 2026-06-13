"""Cliente fino del Actor de Apify (REST). Live path detrás de flag — STUB en esta tanda.

Reglas de oro que este cliente DEBE respetar (ver CLAUDE.md):
  - UNA sola llamada por pasada: todas las URLs en `companies`, `companyBatchMode="one_by_one"`.
  - `profileScraperMode="Short ($4 per 1k)"`.
  - Al LEER el dataset, usar `omit`, NUNCA `fields` (la proyección rompe arrays).
"""

from __future__ import annotations

from typing import Any

import httpx

APIFY_BASE = "https://api.apify.com/v2"

# Campos de ruido que descartamos al leer el dataset (regla de oro: omit, no fields).
DATASET_OMIT = "summary,pictureUrl,openProfile,premium,id"

# Llamada mínima de validación de cuenta (regla de oro nº8).
AMADEUS_VALIDATION_INPUT: dict[str, Any] = {
    "companies": ["https://www.linkedin.com/company/amadeus/"],
    "locations": ["Spain"],
    "functionIds": ["13"],
    "profileScraperMode": "Short ($4 per 1k)",
    "companyBatchMode": "one_by_one",
    "maxItemsPerCompany": 3,
    "maxItems": 3,
}


class ApifyError(RuntimeError):
    pass


class ApifyClient:
    """Wrapper REST mínimo. Solo se usa en modo NO-fixtures (live)."""

    def __init__(self, token: str, employees_actor_id: str, *, timeout: float = 600.0) -> None:
        if not token:
            raise ApifyError("APIFY_TOKEN vacío: el modo live requiere token.")
        self.token = token
        self.employees_actor_id = employees_actor_id
        self.timeout = timeout

    # --- llamada al Actor + lectura del dataset (one_by_one + omit) ---------

    def run_employees(self, run_input: dict[str, Any]) -> list[dict[str, Any]]:
        """Lanza UNA pasada del Actor y devuelve los items del dataset (leídos con `omit`).

        # TODO(paso-2, live): verificar el flujo real contra Apify:
        #   1) POST /acts/{actor}/run-sync-get-dataset-items?token=...&omit=DATASET_OMIT
        #      con `run_input` (debe traer companyBatchMode="one_by_one").
        #   2) o bien run asíncrono + polling de get-actor-run + get-dataset-items.
        #   Manejar `free user run limit exceeded` y runs de 0 items (problema de cuenta).
        """
        self._assert_golden_rules(run_input)
        url = (
            f"{APIFY_BASE}/acts/{self.employees_actor_id}"
            f"/run-sync-get-dataset-items?token={self.token}&omit={DATASET_OMIT}"
        )
        # La llamada está implementada pero NO verificada en esta tanda.
        raise NotImplementedError(
            "Live Apify path no verificado en esta tanda. Usar --use-fixtures. "
            f"(POST listo a {url.split('?')[0]})"
        )

    def validate_account(self) -> bool:
        """Valida saldo/permisos con la llamada mínima a Amadeus (regla de oro nº8).

        # TODO(paso-0): ejecutar AMADEUS_VALIDATION_INPUT; devolver True si vienen
        #   perfiles, False si 0 items en ~3-5 s (problema de cuenta).
        """
        raise NotImplementedError("validate_account: pendiente de verificación live.")

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

    def _http(self) -> httpx.Client:  # pragma: no cover - solo live
        return httpx.Client(timeout=self.timeout)
