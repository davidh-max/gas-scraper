"""Paso 3 — capa LLM del verify (`VerificationMethod.llm_web`).

El LLM lee un perfil de LinkedIn (output de HarvestAPI, ya reducido) y decide, para un
ÁREA y una EMPRESA OBJETIVO, si es `confirmed` (decisor) / `uncertain` (revisar) /
`rejected` (otra empresa o fuera de España). Filosofía: *ante la duda, revisar; no se
borra a nadie salvo descalificador duro*.

Este módulo es PURO + transporte LLM: reduce el perfil, construye el prompt por área y
llama a OpenRouter con structured output. La ORQUESTACIÓN (seleccionar dudosos, fetch
de HarvestAPI, re-check de companyId, caché, persistencia, mapeo a `Classification`)
vive en `verify.py`.

Ver el diseño completo en `prompts/verify_decisor_llm.md`.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel

from .llm.openrouter import OpenRouterClient, OpenRouterError
from .models import AreaProfile
from .resolver.base import canonical_company_id

FIXTURE_FILE = "verify_llm_sample.json"

# response_format de OpenRouter (apartado 2 del diseño). `strict` fuerza el formato.
VERDICT_JSON_SCHEMA: dict[str, Any] = {
    "name": "verificacion_decisor",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "verdict": {"type": "string", "enum": ["confirmed", "uncertain", "rejected"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "es_decisor_area": {"type": "boolean"},
            "cargo_actual_detectado": {"type": "string"},
            "empresa_coincide": {"type": "string", "enum": ["si", "no", "sin_dato"]},
            "ubicacion_ok": {"type": ["boolean", "null"]},
            "motivo": {"type": "string"},
        },
        "required": [
            "verdict", "confidence", "es_decisor_area", "cargo_actual_detectado",
            "empresa_coincide", "ubicacion_ok", "motivo",
        ],
        "additionalProperties": False,
    },
}


class LlmVerdict(BaseModel):
    """Veredicto del LLM (encaja con `Verification.signal_json` + verdict + confidence)."""

    verdict: Literal["confirmed", "uncertain", "rejected"] = "uncertain"
    confidence: float = 0.0
    es_decisor_area: bool = False
    cargo_actual_detectado: str = ""
    empresa_coincide: Literal["si", "no", "sin_dato"] = "sin_dato"
    ubicacion_ok: bool | None = None
    motivo: str = ""


# --------------------------------------------------------------------------- bloques por área
# Valor de `{{perfil_decisor_area}}` (apartado 4 del diseño), en lenguaje natural para el
# LLM. Derivados de las reglas `classify` de `area_profiles.py`. Clave = `area.key`.
# Se pueden sobreescribir por DATO en `area.params["verify_llm"]` (ver `area_verify_block`).
AREA_VERIFY_PROFILES: dict[str, dict[str, str]] = {
    "it": {
        "area_nombre": "Tecnología / IT",
        "perfil_decisor_area": """\
SÍ decisor: máximo o alto responsable de la tecnología/sistemas/IT INTERNOS de la
empresa: CIO, CTO, CISO, CDO, Director de Sistemas/IT/Tecnología, Head of
IT/Technology/Data/Infraestructura/Plataforma/Engineering, Director o Responsable de
Transformación Digital, IT Manager si lidera el área.
NO / revisar: roles que tocan tecnología pero no la deciden dentro de la empresa:
consultoría/preventa, ventas o comercial de IT, marketing, UX/diseño, research,
ingeniero o desarrollador individual sin mando, perfiles de IT en finanzas/RRHH.
Matiz: en pymes, "Responsable de Sistemas" puede ser el máximo de IT (decisor); un
técnico/administrador de sistemas sin equipo es revisar.""",
    },
    "rrhh": {
        "area_nombre": "Recursos Humanos",
        "perfil_decisor_area": """\
SÍ decisor: CHRO, Director de RRHH / Recursos Humanos, Head of HR / People, Director
de Personas / Talento, People & Culture Director, Chief People Officer.
NO / revisar: recruiter o técnico de selección sin mando, HR Business Partner
individual, nómina / administración de personal, prácticas/becario, o roles de otra área.
Matiz: en pymes, "Responsable de RRHH" que lidera el área es decisor.""",
    },
    "financiero": {
        "area_nombre": "Financiero",
        "perfil_decisor_area": """\
SÍ decisor: CFO, Director Financiero / de Finanzas, Director Administrativo-Financiero
o Económico-Financiero, Head of Finance, Financial Controller / Controller si lidera,
Director de Contabilidad / Tesorería / Control de Gestión.
NO / revisar: contable, auxiliar, becario, analista financiero individual, controller
júnior sin equipo, finanzas embebidas en otra área, o roles de ventas/compras.""",
    },
    "operaciones": {
        "area_nombre": "Operaciones",
        "perfil_decisor_area": """\
SÍ decisor: COO, Director de Operaciones / Industrial / de Planta / de Producción / de
Logística, Supply Chain Director, Head of Operations / Supply Chain.
NO / revisar: jefe de turno o de línea sin alcance de compañía, técnico de operaciones,
coordinador individual, o roles de otra área.""",
    },
    "ventas": {
        "area_nombre": "Ventas / Comercial",
        "perfil_decisor_area": """\
SÍ decisor: CRO, Chief Commercial Officer, Director Comercial / de Ventas / de
Desarrollo de Negocio, Head of Sales, VP Sales, Country Manager si lidera ventas,
Director de Grandes Cuentas. (Un "Director Comercial y de Marketing" SÍ vale.)
NO / revisar: Account Manager / Sales Manager individual sin equipo, KAM individual,
comercial / representante de ventas, preventa, SDR/BDR, gerente o director de TIENDA.""",
    },
    "marketing": {
        "area_nombre": "Marketing",
        "perfil_decisor_area": """\
SÍ decisor: CMO, Director de Marketing / Comunicación / Marca, Head of Marketing /
Growth, Director de Marketing Digital. (Un "Director de Marketing y Comunicación" o un
"Director Comercial y de Marketing" SÍ vale.)
NO / revisar: community / social media manager, content creator, copywriter, diseñador,
especialista SEO/SEM individual, o perfiles puramente operativos sin mando.""",
    },
    "compras": {
        "area_nombre": "Compras",
        "perfil_decisor_area": """\
SÍ decisor: CPO (Chief Procurement Officer), Director de Compras / Aprovisionamiento,
Head of Procurement / Purchasing, Strategic Sourcing Director, Director de Sourcing o
de Categoría.
NO / revisar: comprador / buyer individual, técnico de compras, administrativo de
compras, o roles de otra área.""",
    },
    "maximos": {
        "area_nombre": "Máximo responsable de la empresa",
        "perfil_decisor_area": """\
SÍ decisor: quien dirige la EMPRESA entera: CEO, Director General / Ejecutivo,
Consejero Delegado, Managing Director, Fundador / Owner / Propietario / Dueño,
Presidente Ejecutivo, Administrador Único.
NO / revisar: directores de área (CTO/CFO/CMO/COO, Director de X), VPs; gerentes o
directores de tienda/franquicia, franquiciados; consejeros no ejecutivos /
independientes, accionistas / socios sin rol ejecutivo, board members.
Matiz: una señal fuerte de cúpula (CEO/Fundador) manda sobre el ruido de "franquicia".""",
    },
}


def area_verify_block(area: AreaProfile) -> tuple[str, str]:
    """Devuelve `(area_nombre, perfil_decisor_area)` para el área.

    Precedencia (alineado con "el área es DATO"):
      1. `area.params["verify_llm"]` si trae `area_nombre` / `perfil_decisor_area` (DATO
         de la BD; permite añadir/afinar áreas sin tocar código).
      2. Bloque curado en `AREA_VERIFY_PROFILES[area.key]` (defaults, espejo para fixtures).
      3. Fallback genérico a partir de `area.name` (un área nueva sin bloque sigue funcionando).
    """
    override = (area.params or {}).get("verify_llm") or {}
    curated = AREA_VERIFY_PROFILES.get(area.key, {})
    area_nombre = override.get("area_nombre") or curated.get("area_nombre") or area.name
    perfil = (
        override.get("perfil_decisor_area")
        or curated.get("perfil_decisor_area")
        or (
            f"SÍ decisor: el máximo responsable del área «{area.name}» en la empresa "
            "(dirección o jefatura del área, con equipo a cargo).\n"
            "NO / revisar: roles individuales sin mando, de otra área, o de soporte."
        )
    )
    return area_nombre, perfil


def required_location(area: AreaProfile) -> str:
    """Ubicación requerida para el prompt (de `params.locations`). Por defecto, España."""
    locations = (area.params or {}).get("locations") or []
    if any(str(loc).strip().lower() in {"spain", "españa", "es"} for loc in locations):
        return "España"
    return ", ".join(str(loc) for loc in locations) if locations else "España"


# --------------------------------------------------------------------------- prompts

SYSTEM_PROMPT_TEMPLATE = """\
Eres un analista de prospección B2B. Verificas si un perfil de LinkedIn es un
DECISOR del área "{area_nombre}" en la empresa objetivo, con la PERSONA ubicada en
{ubicacion}. Decides de forma conservadora: si no está claro, "uncertain".
No inventas datos: si falta información relevante, es motivo de duda, no de afirmación.
Evalúas SIEMPRE el cargo ACTUAL, no los pasados.

EMPRESA OBJETIVO
- Nombre: {empresa_objetivo}
- Handle de LinkedIn: {empresa_handle}
- companyId canónico: {empresa_company_id}
- Match de empresa ya calculado (si se aporta): {company_match_previo}

QUÉ ES UN DECISOR DE "{area_nombre}"
{perfil_decisor_area}

REGLAS DE DECISIÓN (en este orden)
1. EMPRESA: el cargo ACTUAL debe ser en la empresa objetivo. Compara company_id /
   handle / nombre del puesto actual con los de arriba. Si el company_id actual es
   DISTINTO al canónico -> "rejected" (otra empresa, homónimo). Si coincide, o no hay
   company_id pero el nombre encaja claramente, continúa.
2. UBICACIÓN: la PERSONA debe estar en {ubicacion} (usa el país del perfil, NO el de la
   empresa, que puede ser global). Si está claramente fuera -> "rejected". Si no consta
   -> trátalo como duda.
3. ROL: evalúa el cargo ACTUAL contra la definición de arriba.
   - Encaja claramente como responsable del área -> "confirmed".
   - Encaja pero con dudas de nivel o alcance (mando intermedio en empresa grande,
     título ambiguo, datos escasos) -> "uncertain".
   - Es de otra área, perfil individual sin equipo, consultor / preventa / interino,
     o no decide en el área -> "uncertain" (no lo descartes: lo revisa una persona).
4. Solo el cargo ACTUAL cuenta. Un ex-responsable que hoy ocupa otro puesto no es
   decisor actual.
5. ANTE CUALQUIER DUDA -> "uncertain". Reserva "rejected" SOLO para descalificadores
   duros: empresa distinta confirmada, o persona fuera de {ubicacion}.

SALIDA
Responde EXCLUSIVAMENTE con el JSON del esquema (sin texto adicional, sin markdown).
confidence = tu seguridad en el veredicto (0-1). empresa_coincide: "si" si el cargo
actual es en la empresa objetivo, "no" si es otra, "sin_dato" si no puedes saberlo.
ubicacion_ok: true/false según {ubicacion}, o null si no consta."""


def build_system_prompt(
    *,
    area: AreaProfile,
    empresa_objetivo: str,
    empresa_handle: str,
    empresa_company_id: str,
    company_match_previo: str = "",
) -> str:
    area_nombre, perfil_decisor_area = area_verify_block(area)
    return SYSTEM_PROMPT_TEMPLATE.format(
        area_nombre=area_nombre,
        ubicacion=required_location(area),
        empresa_objetivo=empresa_objetivo or "(desconocida)",
        empresa_handle=empresa_handle or "(desconocido)",
        empresa_company_id=empresa_company_id or "(desconocido)",
        company_match_previo=company_match_previo or "(no aportado)",
        perfil_decisor_area=perfil_decisor_area,
    )


def build_user_prompt(reduced: dict[str, Any]) -> str:
    body = json.dumps(reduced, ensure_ascii=False, indent=2)
    return f"Perfil a evaluar (JSON reducido):\n{body}"


# --------------------------------------------------------------------------- input reducido


def reduce_profile(element: dict[str, Any]) -> dict[str, Any]:
    """Mapea el perfil completo de HarvestAPI al input reducido (apartado 1 del diseño).

    Solo lo que decide la cuestión (cargo actual + empresa + ubicación) + apoyo (about,
    skills, trayectoria). Defensivo: campos que faltan se omiten (ausente = duda, no
    invento). Mapea nombres alternativos (`currentPosition`/`currentPositions`,
    `companyLink`/`companyLinkedinUrl`, `position`/`title`).
    """
    reduced: dict[str, Any] = {}

    nombre = " ".join(
        p for p in (element.get("firstName"), element.get("lastName")) if p
    ).strip()
    if nombre:
        reduced["nombre"] = nombre
    _set(reduced, "headline", element.get("headline"))
    _set(reduced, "headline_es", _headline_es(element))
    _set(reduced, "ubicacion", _location(element))
    _set(reduced, "linkedin_url", element.get("linkedinUrl") or element.get("publicIdentifier"))

    cargos = [_position(p) for p in _current_positions(element)]
    cargos = [c for c in cargos if c]
    if cargos:
        reduced["cargos_actuales"] = cargos

    _set(reduced, "about", _trim(element.get("about"), 800))
    _set(reduced, "top_skills", _skills(element.get("topSkills")))

    exp = _recent_experience(element.get("experience"))
    if exp:
        reduced["experiencia_reciente"] = exp
    honores = _honors(element.get("honorsAndAwards"))
    if honores:
        reduced["honores"] = honores
    return reduced


def current_company_id(element: dict[str, Any]) -> str:
    """companyId del cargo ACTUAL (para el re-check barato de empresa antes del LLM).

    Toma el primer cargo actual y devuelve su id numérico (de `companyId` o de la URL de
    empresa con `canonical_company_id`). "" si no hay dato.
    """
    for pos in _current_positions(element):
        cid = str(pos.get("companyId") or "").strip()
        if cid:
            return cid
        url = pos.get("companyLinkedinUrl") or pos.get("companyLink") or pos.get("companyUrl")
        if url:
            return canonical_company_id(url)
    return ""


# --------------------------------------------------------------------------- transporte LLM


def call_llm_verdict(
    llm_client: OpenRouterClient,
    system: str,
    user: str,
    *,
    max_tokens: int = 400,
) -> tuple[LlmVerdict, float]:
    """Llama a OpenRouter (structured output). Fail-safe: ante error → `uncertain`, coste 0.

    Nunca rompe el lote: cualquier fallo de red/parseo/validación degrada a un veredicto
    `uncertain` (que el orquestador mapea a `revisar` → se conserva).
    """
    try:
        raw, cost = llm_client.chat_schema(
            system, user, json_schema=VERDICT_JSON_SCHEMA, web_search=False, max_tokens=max_tokens
        )
        return LlmVerdict.model_validate(raw), cost
    except (OpenRouterError, ValueError) as exc:  # noqa: BLE001 - degradar, no romper
        return LlmVerdict(motivo=f"Verificación LLM no disponible: {exc}"), 0.0


def load_verdict_fixture(fixtures_dir: Any, profile_url: str | None) -> LlmVerdict | None:
    """Lee un veredicto de ejemplo de `verify_llm_sample.json` (modo fixtures, gratis)."""
    from pathlib import Path

    from .harvest import profile_key

    if fixtures_dir is None or not profile_url:
        return None
    path = Path(fixtures_dir) / FIXTURE_FILE
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    entry = data.get(profile_key(profile_url))
    return LlmVerdict.model_validate(entry) if entry else None


# --------------------------------------------------------------------------- helpers privados


def _set(target: dict[str, Any], key: str, value: Any) -> None:
    if value:
        target[key] = value


def _trim(text: Any, limit: int) -> str | None:
    if not text:
        return None
    s = str(text).strip()
    return (s[:limit] + "…") if len(s) > limit else s


def _current_positions(element: dict[str, Any]) -> list[dict[str, Any]]:
    raw = element.get("currentPosition") or element.get("currentPositions") or []
    if isinstance(raw, dict):
        raw = [raw]
    return [p for p in raw if isinstance(p, dict)]


def _position(pos: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    _set(out, "cargo", pos.get("position") or pos.get("title"))
    _set(out, "empresa", pos.get("companyName"))
    url = pos.get("companyLinkedinUrl") or pos.get("companyLink") or pos.get("companyUrl")
    _set(out, "company_id", str(pos.get("companyId") or "").strip() or canonical_company_id(url))
    _set(out, "company_handle", pos.get("companyUniversalName"))
    _set(out, "desde", _date_text(pos.get("startDate")))
    _set(out, "duracion", pos.get("duration"))
    _set(out, "descripcion", _trim(pos.get("description"), 400))
    return out


def _recent_experience(experience: Any) -> list[dict[str, Any]]:
    if not isinstance(experience, list):
        return []
    out: list[dict[str, Any]] = []
    for exp in experience[:3]:
        if not isinstance(exp, dict):
            continue
        item: dict[str, Any] = {}
        _set(item, "cargo", exp.get("position") or exp.get("title"))
        _set(item, "empresa", exp.get("companyName"))
        _set(item, "desde", _date_text(exp.get("startDate")))
        _set(item, "hasta", _date_text(exp.get("endDate")))
        if item:
            out.append(item)
    return out


def _date_text(value: Any) -> str | None:
    if isinstance(value, dict):
        return value.get("text") or None
    return str(value) if value else None


def _location(element: dict[str, Any]) -> dict[str, Any] | None:
    loc = element.get("location")
    if not isinstance(loc, dict):
        return None
    parsed = loc.get("parsed") if isinstance(loc.get("parsed"), dict) else {}
    out: dict[str, Any] = {}
    _set(out, "pais_code", parsed.get("countryCode"))
    _set(out, "ciudad", parsed.get("city"))
    _set(out, "pais", parsed.get("country"))
    _set(out, "texto", loc.get("linkedinText") or loc.get("text"))
    return out or None


def _headline_es(element: dict[str, Any]) -> str | None:
    multi = element.get("multiLocaleHeadline")
    if isinstance(multi, dict):
        return multi.get("es_ES") or multi.get("es")
    if isinstance(multi, list):
        for entry in multi:
            if isinstance(entry, dict) and entry.get("locale") in ("es_ES", "es"):
                return entry.get("value") or entry.get("text")
    return None


def _skills(top_skills: Any) -> str | None:
    if isinstance(top_skills, str):
        return top_skills.strip() or None
    if isinstance(top_skills, list):
        names = [str(s.get("name") if isinstance(s, dict) else s).strip() for s in top_skills]
        names = [n for n in names if n]
        return " • ".join(names) or None
    return None


def _honors(honors: Any) -> list[str]:
    if not isinstance(honors, list):
        return []
    out: list[str] = []
    for h in honors:
        if isinstance(h, dict):
            title = (h.get("title") or "").strip()
            issuer = (h.get("issuedBy") or "").strip()
            if title:
                out.append(f"{title} — {issuer}" if issuer else title)
        elif isinstance(h, str) and h.strip():
            out.append(h.strip())
    return out
