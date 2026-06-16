"""Parte 2 — validación de la URL de empresa con Gemini (OpenRouter + web search).

Solo para empresas en las que la búsqueda (Pasadas A y B) no devolvió a nadie. Se le
pasa al modelo el texto crudo con que se buscó la empresa y la URL de LinkedIn que
tenemos; con búsqueda web decide si esa URL pertenece realmente a esa empresa y, si
está mal, intenta dar la correcta.

Diseño a prueba de fallos: cualquier error de red/parseo o falta de cliente degrada a
`url_status="unknown"` (la empresa acabará en `no_result`), nunca rompe el lote.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from .llm.openrouter import OpenRouterClient, OpenRouterError
from .models import Company
from .resolver.apify_company_url import normalize_company_url
from .resolver.base import handle_of

FIXTURE_FILE = "openrouter_url_check_sample.json"

SYSTEM_PROMPT = """\
Eres un verificador de URLs de empresa en LinkedIn. Recibes el nombre de una empresa y \
una URL de LinkedIn candidata. Usando búsqueda web, determina si esa URL de LinkedIn \
corresponde REALMENTE a esa empresa (misma razón social / marca; no un homónimo, ni una \
filial distinta, ni una página personal).

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con \
exactamente estos campos:
{
  "url_status": "correct" | "incorrect" | "unknown",
  "correct_url": string | null,
  "confidence": number,
  "reasoning": string
}

Reglas:
- "correct": la URL pertenece a la empresa indicada.
- "incorrect": la URL pertenece a otra empresa o no a esta. Si localizas la correcta por \
búsqueda web, ponla en "correct_url" como https://www.linkedin.com/company/<handle>; si no \
la encuentras, "correct_url" = null.
- "unknown": no hay evidencia suficiente. Ante la duda, usa "unknown".
- No inventes URLs: "correct_url" solo si la has verificado por búsqueda web.
- "confidence" entre 0.0 y 1.0. "reasoning": 1-2 frases en español justificando la decisión.\
"""


class UrlCheck(BaseModel):
    """Veredicto de Gemini sobre la URL de empresa."""

    url_status: Literal["correct", "incorrect", "unknown"] = "unknown"
    correct_url: str | None = None
    confidence: float = 0.0
    reasoning: str = ""


def build_user_prompt(company: Company) -> str:
    name = (company.razon_social or company.raw_input or "").strip()
    return (
        f'Empresa: "{name}"\n'
        f"URL de LinkedIn candidata: {company.linkedin_url}\n"
        "¿Esta URL corresponde a esta empresa? Responde en JSON."
    )


def validate_company_url(
    company: Company,
    *,
    llm_client: OpenRouterClient | None,
    use_fixtures: bool,
    fixtures_dir: Path | None = None,
) -> UrlCheck:
    """Valida la URL de `company`. Devuelve un `UrlCheck` (fail-safe → unknown)."""
    if use_fixtures:
        return _from_fixtures(company, fixtures_dir)

    if llm_client is None:
        return UrlCheck()  # sin cliente y sin fixtures → degradación elegante

    try:
        raw = llm_client.chat_json(SYSTEM_PROMPT, build_user_prompt(company))
        check = UrlCheck.model_validate(raw)
    except (OpenRouterError, ValueError) as exc:  # noqa: BLE001 - degradar, no romper
        return UrlCheck(reasoning=f"Validación no disponible: {exc}")

    if check.correct_url:
        check.correct_url = normalize_company_url(check.correct_url)
        if check.correct_url is None:
            # el modelo dio algo que no es una URL de /company → no fiable
            check.url_status = "unknown"
    return check


def _from_fixtures(company: Company, fixtures_dir: Path | None) -> UrlCheck:
    if fixtures_dir is None:
        return UrlCheck()
    path = fixtures_dir / FIXTURE_FILE
    if not path.exists():
        return UrlCheck()
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    entry = data.get(handle_of(company.linkedin_url))
    if not entry:
        return UrlCheck()
    check = UrlCheck.model_validate(entry)
    if check.correct_url:
        check.correct_url = normalize_company_url(check.correct_url)
    return check
