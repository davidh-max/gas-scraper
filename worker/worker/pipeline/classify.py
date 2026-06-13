"""Paso 2 (post-búsqueda) — clasificación determinista del cargo: decisor | revisar.

NO hardcodea ningún área: toda la lógica se parametriza con
`area_profile.params["classify"]` (regla: "el área es DATO"). Esto reproduce, de
forma config-driven, la clasificación validada de las skills de IT y de máximos
decisores. Determinista y barata; "ante la duda, revisar".

Claves reconocidas en el dict `classify` (todas opcionales):
  clevel_acr        acrónimos C-level que SIEMPRE deciden (palabra)   -> cio, cto
  clevel_phrases    frases C-level que SIEMPRE deciden (subcadena)    -> "chief information"
  exclude_words     palabras que mandan a "revisar" (palabra)         -> ux
  exclude           subcadenas que mandan a "revisar"                 -> sales, marketing
  exec_phrases      frases de cúpula corporativa -> decisor           -> "director general"
  exec_acr          acrónimos de cúpula -> decisor (palabra)          -> ceo, founder
  unit_exclude      ruido tienda/franquicia -> revisar (salvo fuerte) -> franquicia
  passive_exclude   rango legal/consejo no ejecutivo -> revisar (subcadena)
  passive_acr       íd. por palabra                                   -> accionista
  not_top_acr       otros C-level no máximos / VP -> revisar (palabra)-> cfo, vp
  not_top_phrases   íd. por subcadena                                 -> "vice president"
  strong            señales fuertes por subcadena -> decisor          -> "director de sistemas"
  lead_words        liderazgo (para el fallback lead+dominio)         -> director, head
  domain_acr        dominio técnico por palabra (fallback)            -> it, sap
  domain_sub        dominio técnico por subcadena (fallback)                    p.ej. tecnolog
"""

from __future__ import annotations

import re

from .models import Classification

# score heurístico coarse-grained por etiqueta (el scoring fino es Paso 3 / verify)
_SCORE_DECISOR = 0.85
_SCORE_REVISAR = 0.40


def _word_set(text: str) -> set[str]:
    return set(re.findall(r"[a-zà-ÿ0-9'&-]+", text))


def classify(title: str | None, cfg: dict | None = None) -> Classification:
    """Etiqueta el cargo en `decisor` o `revisar` según la config del área."""
    cfg = cfg or {}
    t = (title or "").lower().strip()
    if not t:
        return Classification.revisar
    words = _word_set(t)

    clevel_acr = set(cfg.get("clevel_acr", []))
    clevel_phrases = tuple(cfg.get("clevel_phrases", []))
    exec_phrases = tuple(cfg.get("exec_phrases", []))
    exec_acr = set(cfg.get("exec_acr", []))

    # señal FUERTE de cúpula/decisor: manda sobre el ruido de unidad (franquicia/tienda)
    strong_signal = (
        bool(words & clevel_acr)
        or any(p in t for p in clevel_phrases)
        or bool(words & exec_acr)
        or any(p in t for p in exec_phrases)
    )

    # 1) ruido de tienda/franquicia/unidad → revisar (salvo señal fuerte de cúpula)
    unit_exclude = tuple(cfg.get("unit_exclude", []))
    if unit_exclude and not strong_signal and any(p in t for p in unit_exclude):
        return Classification.revisar

    # 2) C-level técnico (IT) → decisor. Gana incluso a 'sales'/'marketing' (como la skill IT).
    if (words & clevel_acr) or any(p in t for p in clevel_phrases):
        return Classification.decisor

    # 3) exclusiones por palabra ('ux') y por subcadena (sales, marketing, ...) → revisar
    if (words & set(cfg.get("exclude_words", []))) or any(
        p in t for p in cfg.get("exclude", [])
    ):
        return Classification.revisar

    # 4) cúpula corporativa (máximos) → decisor (gana aunque combine roles: "founder & cto")
    if any(p in t for p in exec_phrases) or (words & exec_acr):
        return Classification.decisor

    # 5) rango solo legal/accionarial o de consejo NO ejecutivo → revisar
    if any(p in t for p in cfg.get("passive_exclude", [])) or (
        words & set(cfg.get("passive_acr", []))
    ):
        return Classification.revisar

    # 6) otros C-level no máximos (CTO/CFO…), direcciones de área y VP → revisar
    if (words & set(cfg.get("not_top_acr", []))) or any(
        p in t for p in cfg.get("not_top_phrases", [])
    ):
        return Classification.revisar

    # 7) señales fuertes por subcadena (IT: "director de sistemas", "head of it"…) → decisor
    if any(p in t for p in cfg.get("strong", [])):
        return Classification.decisor

    # 8) presidente operativo corporativo (máximos; "del consejo" ya filtrado en 5) → decisor
    if exec_phrases and any(p in t for p in ("presidente", "presidenta", "president")):
        return Classification.decisor

    # 9) fallback (IT): liderazgo + dominio técnico → decisor
    lead_words = set(cfg.get("lead_words", []))
    if lead_words:
        lead = bool(words & lead_words) or "vice president" in t
        domain = bool(words & set(cfg.get("domain_acr", []))) or any(
            p in t for p in cfg.get("domain_sub", [])
        )
        if lead and domain:
            return Classification.decisor

    # 10) todo lo demás → revisar (ante la duda, revisar)
    return Classification.revisar


def heuristic_score(title: str | None, cfg: dict | None = None) -> float:
    """Score 0..1 coarse-grained por etiqueta. El scoring fino es Paso 3 (verify).

    # TODO(paso-3): sustituir por una puntuación con señales (match exacto vs
    #   fallback, longitud del título, idioma, etc.) calibrada en `verify`.
    """
    return _SCORE_DECISOR if classify(title, cfg) == Classification.decisor else _SCORE_REVISAR
