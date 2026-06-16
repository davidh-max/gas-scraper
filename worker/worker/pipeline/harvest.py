"""Cliente fino de HarvestAPI REST (`api.harvest-api.com`) — Paso 3 (verify).

⚠️ NO confundir con el Actor de Apify del Paso 2:
  - Paso 2 (búsqueda de empleados) → Actor de **Apify** `harvestapi/linkedin-company-employees`
    (cliente `apify/client.py`). Devuelve perfiles "Short" de una empresa.
  - Paso 3 (verify de UN perfil)   → **REST directa** de HarvestAPI (este módulo).
    Devuelve el perfil completo (about, experiencia, ubicación) de UNA persona.

Son superficies y CLAVES distintas (`HARVEST_API_KEY` ≠ `APIFY_TOKEN`). Mismo estilo
fino que `apify/client.py` / `llm/openrouter.py`: solo transporte HTTP; la lógica de
negocio (selección de dudosos, mapeo reducido, LLM) vive en `verify.py`/`verify_llm.py`.

Endpoint:
    GET {base}/linkedin/profile?url=<perfil>&main=true
    Header: X-API-Key: <HARVEST_API_KEY>
Respuesta: { "element": {perfil}, "status": "...", "error": "...", "query": {...} }
`main=true` cobra menos créditos y trae lo justo para verificar (cargo actual +
ubicación + about + experiencia reciente). NO activamos `findEmail` (eso es Paso 4).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx

DEFAULT_BASE_URL = "https://api.harvest-api.com"
FIXTURE_FILE = "harvest_profile_sample.json"


class HarvestError(RuntimeError):
    pass


class HarvestClient:
    """Wrapper REST mínimo de HarvestAPI. Solo se usa en modo NO-fixtures (live)."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise HarvestError("HARVEST_API_KEY vacío: el modo live requiere clave.")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._http_cache: httpx.Client | None = None

    def fetch_profile(self, linkedin_url: str) -> dict[str, Any] | None:
        """Devuelve el `element` (perfil) de una URL de LinkedIn, o None si no hay.

        Lanza `HarvestError` ante fallo de red/HTTP. Un 200 con `element` nulo o con
        `error` poblado devuelve None (el caller lo trata como "no verificable").
        """
        resp = self._http().get(
            f"{self.base_url}/linkedin/profile",
            params={"url": linkedin_url, "main": "true"},
            headers={"X-API-Key": self.api_key},
        )
        if resp.status_code not in (200, 201):
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise HarvestError(f"HarvestAPI error {resp.status_code}: {detail}")
        try:
            data = resp.json()
        except Exception as exc:  # noqa: BLE001 - respuesta no-JSON
            raise HarvestError(f"HarvestAPI respuesta no-JSON: {exc}") from exc
        return _element_of(data)

    def _http(self) -> httpx.Client:
        if self._http_cache is None:
            self._http_cache = httpx.Client(timeout=self.timeout)
        return self._http_cache


def load_profile_fixture(
    fixtures_dir: Path | None, linkedin_url: str | None
) -> dict[str, Any] | None:
    """Lee un perfil de ejemplo de `harvest_profile_sample.json` por handle de perfil.

    Mismo patrón que `resolve_llm._from_fixtures`: con fixtures se prueba gratis. Si no
    hay fixture para ese perfil, devuelve None (→ el verify lo trata como no verificable).
    """
    if fixtures_dir is None or not linkedin_url:
        return None
    path = fixtures_dir / FIXTURE_FILE
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    entry = data.get(profile_key(linkedin_url))
    return _element_of(entry) if isinstance(entry, dict) else entry


def profile_key(linkedin_url: str | None) -> str:
    """Slug de un perfil `/in/<handle>` (minúsculas), para indexar caché y fixtures.

    Análogo a `resolver.base.handle_of` pero para perfiles de persona, no de empresa.
    """
    if not linkedin_url:
        return ""
    u = str(linkedin_url).strip().lower().split("?")[0].split("#")[0].rstrip("/")
    m = re.search(r"/in/([^/]+)", u)
    return m.group(1) if m else u


def _element_of(data: Any) -> dict[str, Any] | None:
    """Saca el perfil de la envoltura `{element, status, error, query}` de HarvestAPI.

    Defensivo: si la respuesta YA es el perfil (sin envoltura), la devuelve tal cual;
    si trae `error` o `element` nulo, devuelve None.
    """
    if not isinstance(data, dict):
        return None
    if "element" in data or "status" in data or "error" in data:
        if data.get("error"):
            return None
        element = data.get("element")
        return element if isinstance(element, dict) else None
    return data  # ya es el perfil (p. ej. un fixture plano)
