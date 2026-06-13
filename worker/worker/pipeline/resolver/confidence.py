"""Similitud difusa nombre de empresa ↔ handle de LinkedIn (con rapidfuzz).

Devuelve una confianza 0.0..1.0 que alimenta `companies.resolution_confidence`.
Determinista y barato. Se usa para puntuar resoluciones por `domain_guess`/`serp`.
"""

from __future__ import annotations

import re

from rapidfuzz import fuzz

# Sufijos societarios y ruido que no aporta a la comparación nombre↔handle.
_LEGAL_SUFFIXES = (
    "sociedad limitada", "sociedad anonima", "sociedad anónima",
    "s l u", "s a u", "s l", "s a", "slu", "sau", "sl", "sa",
    "sociedad cooperativa", "scoop", "s coop", "sccl",
    "inc", "llc", "ltd", "ltda", "gmbh", "bv", "nv", "plc", "co", "corp",
    "group", "grupo", "holding", "españa", "espana", "iberia", "spain",
)


def _strip_legal(text: str) -> str:
    """Quita sufijos societarios y normaliza separadores a espacios."""
    t = re.sub(r"[^a-z0-9ñáéíóúü]+", " ", (text or "").lower()).strip()
    # quita sufijos al final, de forma iterativa (p.ej. "... s l u")
    changed = True
    while changed:
        changed = False
        for suf in _LEGAL_SUFFIXES:
            if t == suf:
                continue
            if t.endswith(" " + suf):
                t = t[: -(len(suf) + 1)].strip()
                changed = True
    return t


def normalize_handle(handle_or_url: str) -> str:
    """Extrae y normaliza el handle de /company/<handle> (o un handle suelto)."""
    if not handle_or_url:
        return ""
    u = str(handle_or_url).strip().lower().split("?")[0].split("#")[0].rstrip("/")
    m = re.search(r"/company/([^/]+)", u)
    handle = m.group(1) if m else u
    # los handles usan guiones; los pasamos a espacios para comparar como texto
    return re.sub(r"[-_]+", " ", handle).strip()


def name_handle_confidence(name: str | None, handle_or_url: str | None) -> float:
    """Confianza 0.0..1.0 de que `handle` corresponde a la empresa `name`.

    Estrategia: normaliza ambos (quita sufijos societarios), y combina
    `token_set_ratio` (robusto a orden/palabras extra) con `partial_ratio`
    (capta cuando el handle es un prefijo del nombre, p.ej. "glovo" ⊂ "glovoapp").
    """
    n = _strip_legal(name or "")
    h = _strip_legal(normalize_handle(handle_or_url or ""))
    if not n or not h:
        return 0.0
    token = fuzz.token_set_ratio(n, h) / 100.0
    partial = fuzz.partial_ratio(n, h) / 100.0
    # el máximo premia coincidencias parciales fuertes sin penalizar el orden
    return round(max(token, partial * 0.95), 3)
