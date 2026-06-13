"""Carga de `area_profiles` ("el área es DATO"): de Supabase, con defaults locales.

Los defaults locales son espejo del SEED de `supabase/schema_v2.sql`. Permiten que
la CLI con `--use-fixtures` corra end-to-end sin tocar la BD. En el worker real, los
parámetros se leen de la tabla `area_profiles`.
"""

from __future__ import annotations

from typing import Any

from .models import AreaProfile

# --------------------------------------------------------------------------- defaults
# Espejo del seed SQL. Si cambias uno, cambia el otro.
DEFAULT_AREA_PROFILES: dict[str, dict[str, Any]] = {
    "it": {
        "name": "Decisores IT (España)",
        "description": "CIO/CTO/Head of IT/Director de Sistemas y equivalentes, en España.",
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["13"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "CIO", "CTO", "Director de Sistemas", "Director de IT", "Head of IT",
                    "IT Director", "Director de Tecnología", "Responsable de Sistemas",
                    "Head of Digital Transformation", "Director de Transformación Digital",
                    "IT Manager",
                ]
            },
            "classify": {
                "clevel_acr": ["cio", "cto", "ciso", "cdo"],
                "clevel_phrases": [
                    "chief information", "chief technology", "chief digital",
                    "chief data", "chief technical",
                ],
                "exclude_words": ["ux"],
                "strong": [
                    "director de sistemas", "director de it", "it director", "director it",
                    "head of it", "director de tecnolog", "responsable de sistemas",
                    "responsable de it", "responsable de tecnolog", "it manager",
                    "head of technology", "head of engineering", "head of data",
                    "head of digital", "head of infrastructure", "head of platform",
                    "director de transformaci", "digital transformation", "transformation",
                    "information officer", "technology officer", "data officer",
                    "sistemas de informaci", "cybersecurity", "seguridad de la informaci",
                ],
                "exclude": [
                    "consult", "preventa", "pre-sale", "presale", "sales", "ventas",
                    "comercial", "account exec", "account manager", "marketing",
                    "user experience", "research", "talent", "human resources",
                    "recursos humanos", "recruit", "business development", "partnership",
                    "alliance", "procurement", "compras", "legal", "finance", "financ",
                    "contab",
                ],
                "lead_words": [
                    "director", "manager", "head", "lead", "responsable", "jefe",
                    "chief", "vp",
                ],
                "domain_acr": ["it", "ti", "sap", "erp"],
                "domain_sub": [
                    "information", "tecnolog", "technology", "sistemas", "data", "datos",
                    "digital", "software", "infraestructura", "infrastructure", "cyber",
                    "seguridad", "platform", "engineering", "ingenier",
                ],
            },
        },
    },
    "maximos": {
        "name": "Máximos decisores (España)",
        "description": "CEO/Director General/Fundador/Dueño/Consejero Delegado — la cúpula.",
        "params": {
            "locations": ["Spain"],
            "pass_a": {
                "jobTitles": [
                    "CEO", "Chief Executive Officer", "Director Ejecutivo", "Director General",
                    "Managing Director", "Director Gerente", "Consejero Delegado", "Founder",
                    "Co-Founder", "Cofounder", "Fundador", "Owner", "Propietario", "Dueño",
                    "President", "Presidente", "Presidente Ejecutivo", "Administrador Único",
                ]
            },
            "pass_b": {"seniorityLevelIds": ["320", "310"]},
            "classify": {
                "exec_phrases": [
                    "chief executive", "director ejecutivo", "director general",
                    "direccion general", "dirección general", "director gerente",
                    "managing director", "consejero delegado", "consejera delegada", "founder",
                    "co-founder", "cofounder", "fundador", "owner", "propietari", "dueñ",
                    "presidente ejecutivo", "executive chairman", "executive president",
                    "administrador unico", "administrador único",
                ],
                "exec_acr": ["ceo", "founder", "cofounder", "owner"],
                "unit_exclude": [
                    "franquicia", "franchise", "franquiciad", "de tienda", " tienda",
                    "store manager", "shop manager", "store director", "encargad",
                    "punto de venta",
                ],
                "passive_exclude": [
                    "consejero independiente", "consejero externo", "consejero no ejecutivo",
                    "miembro del consejo", "vocal", "board member", "non-executive",
                    "no ejecutivo", "presidente del consejo", "chairman of the board",
                    "accionista", "socio capitalista", "business angel", "venture partner",
                ],
                "passive_acr": [
                    "accionista", "shareholder", "inversor", "investor", "consejero",
                    "consejera",
                ],
                "not_top_acr": ["cto", "cfo", "cmo", "coo", "cio", "ciso", "cdo", "vp"],
                "not_top_phrases": [
                    "chief technology", "chief financial", "chief marketing",
                    "chief operating", "head of", "responsable de", "deputy", "adjunto",
                    "vice president", "vice-president", "vicepresiden",
                ],
            },
        },
    },
}


def default_area_profile(key: str) -> AreaProfile:
    """AreaProfile a partir de los defaults locales (espejo del seed)."""
    if key not in DEFAULT_AREA_PROFILES:
        raise KeyError(f"Área desconocida: {key!r}. Conocidas: {sorted(DEFAULT_AREA_PROFILES)}")
    d = DEFAULT_AREA_PROFILES[key]
    return AreaProfile(key=key, name=d["name"], description=d["description"], params=d["params"])


def load_area_profile(
    key: str, *, supabase: Any | None = None, use_fixtures: bool = False
) -> AreaProfile:
    """Carga un área por su `key`. Con fixtures o sin cliente → defaults locales."""
    if use_fixtures or supabase is None:
        return default_area_profile(key)
    return load_area_profile_from_supabase(supabase, key)


def load_area_profile_from_supabase(supabase: Any, key: str) -> AreaProfile:
    """Lee una fila de `area_profiles` por `key` y la mapea a `AreaProfile`."""
    res = supabase.table("area_profiles").select("*").eq("key", key).single().execute()
    return AreaProfile(**res.data)


def load_area_profile_by_id(supabase: Any, area_profile_id: str) -> AreaProfile:
    """Lee una fila de `area_profiles` por id (usado por el worker desde un job)."""
    res = supabase.table("area_profiles").select("*").eq("id", area_profile_id).single().execute()
    return AreaProfile(**res.data)
