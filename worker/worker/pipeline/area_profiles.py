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
    "rrhh": {
        "name": "Decisores RRHH (España)",
        "description": (  # noqa: E501
            "CHRO/Director de RRHH/Head of People/Director de Talento y equivalentes, en España."
        ),
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["12"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "CHRO", "Chief People Officer", "Director de Recursos Humanos",
                    "Director de RRHH", "HR Director", "Head of HR", "Head of People",
                    "Director de Personas", "Director de Talento", "People & Culture Director",
                    "Responsable de Recursos Humanos", "HR Manager",
                ]
            },
            "classify": {
                "clevel_acr": ["chro"],
                "clevel_phrases": [
                    "chief people", "chief human resources", "chief hr", "chief talent",
                ],
                "strong": [
                    "director de recursos humanos", "director de rrhh",
                    "directora de recursos humanos", "directora de rrhh", "hr director",
                    "director of hr", "head of hr", "head of people", "people director",
                    "director de personas", "responsable de recursos humanos",
                    "responsable de rrhh", "director de talento", "head of talent",
                    "people & culture", "people and culture", "director de gestión de personas",
                    "director de gestion de personas", "human resources director",
                    "director de desarrollo de personas",
                ],
                "exclude": [
                    "sales", "ventas", "comercial", "marketing", "finance", "financ", "contab",
                    "legal", "jurídic", "juridic", "compras", "procurement", "purchasing",
                    "operaciones", "operations", "logístic", "logistic", "sistemas", "tecnolog",
                ],
                "lead_words": [
                    "director", "directora", "manager", "head", "lead", "responsable", "jefe",
                    "jefa", "chief", "vp",
                ],
                "domain_acr": ["rrhh", "rh", "hr", "hrbp"],
                "domain_sub": [
                    "recursos humanos", "personas", "talento", "talent", "people", "selección",
                    "seleccion", "formación", "formacion", "relaciones laborales", "nómina",
                    "nomina", "cultura", "people & culture",
                ],
            },
        },
    },
    "financiero": {
        "name": "Decisores Financiero (España)",
        "description": (  # noqa: E501
            "CFO/Director Financiero/Director de Finanzas/Controller y equivalentes, en España."
        ),
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["10"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "CFO", "Chief Financial Officer", "Director Financiero", "Director de Finanzas",
                    "Finance Director", "Head of Finance", "Director Administrativo Financiero",
                    "Director Económico Financiero", "Financial Controller", "Controller",
                    "Responsable Financiero",
                ]
            },
            "classify": {
                "clevel_acr": ["cfo"],
                "clevel_phrases": ["chief financial", "chief finance"],
                "strong": [
                "director financiero", "director de finanzas", "finance director",
                "head of finance",
                "director administrativo financiero",
                "director económico financiero", "director economico financiero",
                "director de administración y finanzas",  # noqa: E501
                "director de administracion y finanzas",
                    "financial controller", "controller", "director de control de gestión",
                    "director de control de gestion", "responsable financiero", "vp finance",
                    "director de contabilidad", "director de tesorería", "director de tesoreria",
                    "finance officer",
                ],
                "exclude": [
                    "sales", "ventas", "comercial", "marketing", "recursos humanos", "rrhh",
                    "recruit", "talent", "legal", "jurídic", "juridic", "compras", "procurement",
                    "purchasing", "operaciones", "operations", "logístic", "logistic", "sistemas",
                    "tecnolog",
                ],
                "lead_words": [
                    "director", "directora", "manager", "head", "lead", "responsable", "jefe",
                    "jefa", "chief", "vp",
                ],
                "domain_acr": ["fp&a", "fpa"],
                "domain_sub": [
                    "financ", "finanzas", "contab", "tesorer", "fiscal", "control de gestión",
                    "control de gestion", "auditor", "administración y finanzas",
                    "administracion y finanzas", "económico financiero", "economico financiero",
                    "accounting",
                ],
            },
        },
    },
    "operaciones": {
        "name": "Decisores Operaciones (España)",
        "description": (  # noqa: E501
            "COO/Director de Operaciones/Director Industrial/"
            "Supply Chain y equivalentes, en España."
        ),
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["18"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "COO", "Chief Operating Officer", "Director de Operaciones",
                    "Operations Director", "Head of Operations", "Director Industrial",
                    "Director de Planta", "Director de Producción", "Director de Logística",
                    "Supply Chain Director", "Responsable de Operaciones", "Operations Manager",
                ]
            },
            "classify": {
                "clevel_acr": ["coo"],
                "clevel_phrases": ["chief operating", "chief operations"],
                "strong": [
                    "director de operaciones", "operations director", "head of operations",
                    "director industrial", "director de planta", "plant director",
                    "director de producción", "director de produccion", "director de fábrica",
                    "director de fabrica", "director de logística", "director de logistica",
                    "supply chain director", "head of supply chain",
                    "director de cadena de suministro", "responsable de operaciones",
                    "vp operations", "operations manager", "director de supply chain",
                    "operations officer",
                ],
                "exclude": [
                    "sales", "ventas", "comercial", "marketing", "finance", "financ", "contab",
                    "recursos humanos", "rrhh", "recruit", "talent", "legal", "jurídic", "juridic",
                    "sistemas", "tecnolog",
                ],
                "lead_words": [
                    "director", "directora", "manager", "head", "lead", "responsable", "jefe",
                    "jefa", "chief", "vp",
                ],
                "domain_acr": ["scm", "s&op"],
                "domain_sub": [
                    "operacion", "operations", "producción", "produccion", "planta", "fábrica",
                    "fabrica", "industrial", "logístic", "logistic", "supply chain",
                    "cadena de suministro", "manufactura", "manufacturing", "almacén", "almacen",
                    "aprovisionamiento", "distribución", "distribucion",
                ],
            },
        },
    },
    "ventas": {
        "name": "Decisores Ventas (España)",
        "description": (  # noqa: E501
            "CRO/Director Comercial/Director de Ventas/"
            "Business Development y equivalentes, en España."
        ),
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["25"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "CRO", "Chief Revenue Officer", "Director Comercial", "Director de Ventas",
                    "Sales Director", "Head of Sales", "VP Sales",
                    "Director de Desarrollo de Negocio", "Business Development Director",
                    "Country Manager", "Responsable Comercial", "Sales Manager",
                ]
            },
            "classify": {
                "clevel_acr": ["cro", "cco"],
                "clevel_phrases": ["chief revenue", "chief sales", "chief commercial"],
                "strong": [
                    "director comercial", "director de ventas", "sales director", "head of sales",
                    "vp sales", "vp of sales", "director de desarrollo de negocio",
                    "business development director", "director de negocio", "responsable comercial",
                    "country manager", "director comercial y marketing", "key account director",
                    "regional sales director", "national sales manager", "director de expansión",
                    "director de expansion", "sales manager", "director de grandes cuentas",
                    "revenue officer",
                ],
                "exclude": [
                    "account manager", "account exec", "account executive", "ejecutivo de cuentas",
                    "sales representative", "sales rep", "representante", "preventa", "presale",
                    "pre-sale", "store manager", "tienda", "dependient", "finance", "financ",
                    "contab", "recursos humanos", "rrhh", "legal", "compras", "procurement",
                    "sistemas", "tecnolog",
                ],
                "lead_words": [
                    "director", "directora", "manager", "head", "lead", "responsable", "jefe",
                    "jefa", "chief", "vp",
                ],
                "domain_acr": ["b2b", "b2c"],
                "domain_sub": [
                    "ventas", "comercial", "sales", "desarrollo de negocio", "business development",
                    "grandes cuentas", "key account", "revenue", "go-to-market", "expansión",
                    "expansion", "canal",
                ],
            },
        },
    },
    "marketing": {
        "name": "Decisores Marketing (España)",
        "description": (  # noqa: E501
            "CMO/Director de Marketing/Director de Comunicación/"
            "Head of Growth y equivalentes, en España."
        ),
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["15"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "CMO", "Chief Marketing Officer", "Director de Marketing", "Marketing Director",
                    "Head of Marketing", "Director de Comunicación", "Head of Communications",
                    "Director de Marca", "Director de Marketing Digital", "Head of Growth",
                    "Responsable de Marketing", "Marketing Manager",
                ]
            },
            "classify": {
                "clevel_acr": ["cmo"],
                "clevel_phrases": ["chief marketing", "chief brand", "chief growth"],
                "strong": [
                "director de marketing", "marketing director", "head of marketing",
                "director de comunicación", "director de comunicacion",  # noqa: E501
                "head of communications",
                    "director de marca", "brand director", "director de marketing digital",
                    "head of growth", "growth director", "responsable de marketing",
                    "director de marketing y comunicación", "director de marketing y comunicacion",
                    "vp marketing", "director de publicidad", "director de contenidos",
                    "demand generation", "marketing officer",
                ],
                "exclude": [
                    "community manager", "social media specialist", "content creator", "copywriter",
                    "diseñador", "disenador", "designer", "finance", "financ", "contab",
                    "recursos humanos", "rrhh", "legal", "compras", "procurement", "operaciones",
                    "operations", "sistemas", "tecnolog",
                ],
                "lead_words": [
                    "director", "directora", "manager", "head", "lead", "responsable", "jefe",
                    "jefa", "chief", "vp",
                ],
                "domain_acr": ["seo", "sem", "ppc", "crm"],
                "domain_sub": [
                    "marketing", "comunicación", "comunicacion", "marca", "brand", "publicidad",
                    "growth", "contenidos", "content", "demanda", "demand", "redes sociales",
                    "social media", "captación", "captacion", "adquisición", "adquisicion",
                ],
            },
        },
    },
    "compras": {
        "name": "Decisores Compras (España)",
        "description": (  # noqa: E501
            "CPO/Director de Compras/Head of Procurement/"
            "Director de Sourcing y equivalentes, en España."
        ),
        "params": {
            "locations": ["Spain"],
            "pass_a": {"functionIds": ["21"], "seniorityLevelIds": ["310", "300", "220", "210"]},
            "pass_b": {
                "jobTitles": [
                    "CPO", "Chief Procurement Officer", "Director de Compras",  # noqa: E501
                    "Purchasing Director",
                    "Head of Procurement", "Director de Aprovisionamiento",
                    "Strategic Sourcing Director", "Director de Sourcing", "Responsable de Compras",
                    "Procurement Manager", "Purchasing Manager",
                ]
            },
            "classify": {
                "clevel_acr": ["cpo"],
                "clevel_phrases": ["chief procurement", "chief purchasing"],
                "strong": [
                    "director de compras", "purchasing director", "head of procurement",
                    "director de aprovisionamiento", "strategic sourcing director",
                    "director de sourcing", "responsable de compras", "procurement manager",
                    "purchasing manager", "head of purchasing", "director de procurement",
                    "vp procurement", "category director", "director de categoría",
                    "director de categoria", "procurement officer",
                    "director de compras y logística",
                ],
                "exclude": [
                    "sales", "ventas", "comercial", "marketing", "finance", "financ", "contab",
                    "recursos humanos", "rrhh", "recruit", "talent", "legal", "jurídic", "juridic",
                    "sistemas", "tecnolog",
                ],
                "lead_words": [
                    "director", "directora", "manager", "head", "lead", "responsable", "jefe",
                    "jefa", "chief", "vp",
                ],
                "domain_acr": ["mro"],
                "domain_sub": [
                    "compras", "aprovisionamiento", "procurement", "purchasing", "sourcing",
                    "abastecimiento", "category", "categoría", "categoria", "proveedores", "supply",
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
