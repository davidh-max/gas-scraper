"""Cliente fino de OpenRouter (REST). Mismo estilo que `apify/client.py`.

Se usa para una única tarea en esta tanda: validar con Gemini (+ web search) si la
URL de LinkedIn de una empresa le pertenece de verdad. La lógica de negocio (prompt,
ramificación) vive en `resolve_llm.py`; aquí solo está el transporte HTTP.

Web search en OpenRouter: se habilita con el plugin `web` (equivalente al sufijo
`:online` del modelo, pero permite acotar `max_results` para controlar coste). Ver
https://openrouter.ai/docs/features/web-search
"""

from __future__ import annotations

import json
from typing import Any

import httpx

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterError(RuntimeError):
    pass


class OpenRouterClient:
    """Wrapper REST mínimo para `chat/completions` con salida JSON."""

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        app_title: str | None = None,
        referer: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise OpenRouterError("OPENROUTER_API_KEY vacío: el modo live requiere clave.")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.app_title = app_title
        self.referer = referer
        self.timeout = timeout
        self._http_cache: httpx.Client | None = None

    def chat_json(
        self,
        system: str,
        user: str,
        *,
        web_search: bool = True,
        max_results: int = 3,
    ) -> dict[str, Any]:
        """Una completion en modo JSON. Devuelve el objeto JSON del mensaje.

        Lanza `OpenRouterError` ante error HTTP, respuesta vacía o JSON no parseable.
        """
        body: dict[str, Any] = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if web_search:
            body["plugins"] = [{"id": "web", "max_results": max_results}]

        resp = self._http().post(
            f"{self.base_url}/chat/completions", json=body, headers=self._headers()
        )
        if resp.status_code not in (200, 201):
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise OpenRouterError(f"OpenRouter error {resp.status_code}: {detail}")

        try:
            content = resp.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise OpenRouterError(f"Respuesta de OpenRouter sin contenido: {exc}") from exc

        return _parse_json_content(content)

    def chat_schema(
        self,
        system: str,
        user: str,
        *,
        json_schema: dict[str, Any],
        web_search: bool = False,
        max_tokens: int | None = None,
    ) -> tuple[dict[str, Any], float]:
        """Completion con `response_format: json_schema` (structured output, estricto).

        Devuelve `(objeto_json, coste_usd)`. Pensado para clasificación con salida
        pequeña y determinista (Paso 3 verify): `temperature=0`, sin web search por
        defecto. El coste sale de `usage.cost` (se pide con `usage.include=true`); si
        el proveedor no lo informa, devuelve 0.0.

        Lanza `OpenRouterError` ante error HTTP, respuesta vacía o JSON no parseable.
        """
        body: dict[str, Any] = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_schema", "json_schema": json_schema},
            "usage": {"include": True},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if web_search:
            body["plugins"] = [{"id": "web", "max_results": 3}]

        resp = self._http().post(
            f"{self.base_url}/chat/completions", json=body, headers=self._headers()
        )
        if resp.status_code not in (200, 201):
            try:
                detail = resp.json()
            except Exception:
                detail = resp.text
            raise OpenRouterError(f"OpenRouter error {resp.status_code}: {detail}")

        payload = resp.json()
        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise OpenRouterError(f"Respuesta de OpenRouter sin contenido: {exc}") from exc

        cost = _extract_cost(payload)
        return _parse_json_content(content), cost

    def _headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.referer:
            headers["HTTP-Referer"] = self.referer
        if self.app_title:
            headers["X-Title"] = self.app_title
        return headers

    def _http(self) -> httpx.Client:
        if self._http_cache is None:
            self._http_cache = httpx.Client(timeout=self.timeout)
        return self._http_cache


def _extract_cost(payload: dict[str, Any]) -> float:
    """Coste en USD del run (de `usage.cost`). 0.0 si el proveedor no lo informa."""
    usage = payload.get("usage") or {}
    try:
        return float(usage.get("cost") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _parse_json_content(content: str | None) -> dict[str, Any]:
    """Parsea el contenido del mensaje a dict, tolerando fences ```json ... ```."""
    text = (content or "").strip()
    if not text:
        raise OpenRouterError("Contenido vacío en la respuesta de OpenRouter.")
    if text.startswith("```"):
        # quita la primera línea (```json) y el cierre ```
        text = text.split("\n", 1)[-1] if "\n" in text else text
        text = text.rsplit("```", 1)[0].strip()
        if text.startswith("json"):
            text = text[4:].lstrip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise OpenRouterError(f"JSON no parseable de OpenRouter: {exc}") from exc
    if not isinstance(data, dict):
        raise OpenRouterError("Se esperaba un objeto JSON de OpenRouter.")
    return data
