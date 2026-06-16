"""Paso 3 — verificación por capas con escalado por coste.

Dos capas, de barata a cara:
  1. **companyId-match** determinista (anti-homónimos, regla de oro nº6):
     `verify_company_match` / `apply_company_match`. Sin coste.
  2. **LLM (OpenRouter)** solo para los DUDOSOS que sobreviven a la capa 1:
     `run_layered_verification` enriquece el perfil (HarvestAPI REST), re-chequea la
     empresa con los datos nuevos (rechazo de homónimo SIN gastar LLM) y, si sigue en
     duda, somete el perfil reducido al LLM. Ver `prompts/verify_decisor_llm.md`.

Filosofía intacta: ante la duda → `revisar`; `rejected` (se descarta) solo para
descalificador duro (otra empresa confirmada o persona fuera de España).
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from .harvest import HarvestClient, HarvestError, load_profile_fixture, profile_key
from .llm.openrouter import OpenRouterClient
from .models import (
    AreaProfile,
    Classification,
    Company,
    Contact,
    Verification,
    VerificationMethod,
    VerificationVerdict,
)
from .resolver.base import canonical_company_id
from .verify_llm import (
    build_system_prompt,
    build_user_prompt,
    call_llm_verdict,
    current_company_id,
    load_verdict_fixture,
    reduce_profile,
)

VERIFY_FLAG_COMPANY = "verificar_empresa"

# Un `decisor` con score < este umbral también pasa por el LLM (apoyo). Los `decisor`
# del clasificador determinista valen 0.85 (no entran); el umbral deja margen para un
# scoring fino futuro. Los `revisar` y los `verify_flag` SIEMPRE entran (son dudosos).
MIN_DECISOR_SCORE = 0.85

# motivos (en signal_json.reason) — los usa apply_company_match para decidir
REASON_NO_CANONICAL = "empresa sin companyId canónico"
REASON_PROFILE_NO_ID = "perfil sin companyId"
REASON_MATCH = "companyId coincide"
REASON_MISMATCH = "companyId distinto (homónimo)"


def verify_company_match(contact: Contact, canonical_id: str | None) -> Verification:
    """Compara el companyId del perfil con el canónico de la empresa buscada.

    El `canonical_id` lo decide quien llama (`pipeline._canonical_ids_by_company`): es el
    companyId NUMÉRICO real de la empresa buscada cuando la resolución lo dio, y si no,
    la moda de los `company_linkedin_url` de los propios perfiles (heurística de respaldo).

    Veredictos (regla de oro nº6):
      - `confirmed`: el perfil declara una empresa con el mismo companyId canónico.
      - `rejected`:  declara un companyId DISTINTO → es otra empresa (homónimo).
      - `uncertain` (motivo `perfil sin companyId`): la empresa tiene canónico pero
                     este perfil no trae companyId → se conserva pero se degrada.
      - `uncertain` (motivo `empresa sin companyId canónico`): no se puede verificar
                     (ningún perfil traía companyId) → se conserva sin cambios.
    """
    profile_id = canonical_company_id(contact.company_linkedin_url)
    canonical = (canonical_id or "").strip()

    if not canonical:
        verdict, conf, reason = VerificationVerdict.uncertain, 0.5, REASON_NO_CANONICAL
    elif not profile_id:
        verdict, conf, reason = VerificationVerdict.uncertain, 0.5, REASON_PROFILE_NO_ID
    elif profile_id == canonical:
        verdict, conf, reason = VerificationVerdict.confirmed, 1.0, REASON_MATCH
    else:
        verdict, conf, reason = VerificationVerdict.rejected, 0.0, REASON_MISMATCH

    return Verification(
        contact_id=contact.id,
        method=VerificationMethod.heuristic,
        verdict=verdict,
        confidence=conf,
        signal_json={
            "profile_company_id": profile_id,
            "canonical_company_id": canonical,
            "reason": reason,
            "profile_url": contact.linkedin_url,  # correlación contacto↔verification al persistir
        },
        cost=0.0,
    )


def apply_company_match(contact: Contact, canonical_id: str | None) -> tuple[bool, Verification]:
    """Aplica el veredicto al contacto. Devuelve (conservar?, verification).

    - `rejected`                         → conservar=False (se descarta: es otra empresa).
    - `uncertain` (perfil sin companyId) → conservar=True, degradado a `revisar` + flag.
    - `uncertain` (empresa sin canónico) → conservar=True, sin cambios (no verificable).
    - `confirmed`                        → conservar=True, sin cambios.

    "Nunca se borra a nadie" salvo evidencia de homónimo (companyId distinto).
    """
    v = verify_company_match(contact, canonical_id)
    if v.verdict == VerificationVerdict.rejected:
        return False, v
    degrade = v.signal_json.get("reason") == REASON_PROFILE_NO_ID
    if v.verdict == VerificationVerdict.uncertain and degrade:
        contact.verify_flag = VERIFY_FLAG_COMPANY
        contact.classification = Classification.revisar
    return True, v


class VerificationCacheStore(Protocol):
    """Caché de veredictos por `cache_key` (persona + área), para no pagar dos veces.

    La implementación persistente (tabla `verification_cache`) vive en el worker; el
    pipeline solo depende de esta interfaz (frontera limpia: sin acceso a BD). En CLI /
    fixtures se usa `InMemoryVerificationCache` (dedup dentro del lote).
    """

    def get(self, cache_key: str) -> Verification | None: ...
    def put(self, cache_key: str, verification: Verification) -> None: ...


class InMemoryVerificationCache:
    """Caché de proceso (no cruza ejecuciones). Suficiente para CLI / fixtures / tests."""

    def __init__(self) -> None:
        self._data: dict[str, Verification] = {}

    def get(self, cache_key: str) -> Verification | None:
        return self._data.get(cache_key)

    def put(self, cache_key: str, verification: Verification) -> None:
        self._data[cache_key] = verification


def needs_llm_review(contact: Contact, *, min_decisor_score: float = MIN_DECISOR_SCORE) -> bool:
    """¿Es un DUDOSO que merece la capa LLM? Solo estos entran (la capa cara).

    Dudoso si: está en `revisar`, o trae `verify_flag` (p. ej. `verificar_empresa`), o es
    `decisor` con score bajo. Un `decisor` con score alto se salta esta capa (ahorro).
    """
    if contact.classification == Classification.revisar:
        return True
    if contact.verify_flag:
        return True
    if contact.classification == Classification.decisor:
        return (contact.heuristic_score or 1.0) < min_decisor_score
    return False


def verification_cache_key(contact: Contact, area: AreaProfile) -> str:
    """Clave de caché: persona (handle del perfil) + área + método LLM."""
    return f"{profile_key(contact.linkedin_url)}|{area.key}|llm_web"


def run_layered_verification(
    contact: Contact,
    *,
    area: AreaProfile,
    company: Company | None,
    canonical_id: str,
    harvest_client: HarvestClient | None = None,
    llm_client: OpenRouterClient | None = None,
    use_fixtures: bool = False,
    fixtures_dir: Path | None = None,
    cache: VerificationCacheStore | None = None,
    max_tokens: int = 400,
) -> tuple[bool, list[Verification]]:
    """Verifica UN contacto dudoso por capas. Devuelve `(conservar?, verifications)`.

    Muta `contact.classification` según el veredicto (`confirmed→decisor`,
    `uncertain→revisar`, `rejected→se descarta`). Pasos (escalado por coste):
      1. Caché: si ya hay veredicto para (persona, área) → aplícalo sin gastar.
      2. Enriquecer el perfil (HarvestAPI REST `main=true`, o fixture). Si falla/no hay →
         `uncertain` (no verificable), se conserva.
      3. Re-check de empresa con los datos nuevos: companyId actual vs canónico. Homónimo
         claro → `rejected` SIN gastar LLM.
      4. LLM (OpenRouter) con el prompt del área + perfil reducido → veredicto.
    """
    key = verification_cache_key(contact, area)
    if cache is not None:
        hit = cache.get(key)
        if hit is not None:
            keep = _apply_verdict(contact, hit.verdict)
            return keep, [_clone_for_contact(hit, contact, cached=True)]

    # --- capa 2: enriquecer el perfil --------------------------------------------------
    element = _fetch_profile(
        contact, harvest_client=harvest_client, use_fixtures=use_fixtures, fixtures_dir=fixtures_dir
    )
    if element is None:
        v = _verification(
            contact, VerificationMethod.llm_web, VerificationVerdict.uncertain,
            confidence=0.0,
            signal={"reason": "perfil no verificable (HarvestAPI sin datos)"},
        )
        _apply_verdict(contact, v.verdict)  # uncertain → revisar
        return True, [v]

    # --- capa 3: re-check barato de empresa (homónimo → rejected sin LLM) ---------------
    profile_cid = current_company_id(element)
    company_match = _company_match_summary(profile_cid, canonical_id)
    if canonical_id and profile_cid and profile_cid != canonical_id:
        v = _verification(
            contact, VerificationMethod.profile_rescrape, VerificationVerdict.rejected,
            confidence=0.0,
            signal={
                "reason": "companyId distinto tras re-scrape (homónimo)",
                "profile_company_id": profile_cid,
                "canonical_company_id": canonical_id,
            },
        )
        if cache is not None:
            cache.put(key, v)
        return False, [v]  # se descarta

    # --- capa 4: LLM -------------------------------------------------------------------
    verdict, cost = _llm_verdict(
        element, contact, area, company, canonical_id, company_match,
        llm_client=llm_client, use_fixtures=use_fixtures, fixtures_dir=fixtures_dir,
        max_tokens=max_tokens,
    )
    v = _verification(
        contact, VerificationMethod.llm_web,
        VerificationVerdict(verdict.verdict), confidence=verdict.confidence,
        signal={**verdict.model_dump(), "company_match_previo": company_match},
        cost=cost,
    )
    keep = _apply_verdict(contact, v.verdict)
    if cache is not None:
        cache.put(key, v)
    return keep, [v]


# --------------------------------------------------------------------------- helpers LLM


def _fetch_profile(
    contact: Contact,
    *,
    harvest_client: HarvestClient | None,
    use_fixtures: bool,
    fixtures_dir: Path | None,
) -> dict | None:
    """Trae el perfil completo (fixture o HarvestAPI live). Fail-safe → None."""
    if use_fixtures:
        return load_profile_fixture(fixtures_dir, contact.linkedin_url)
    if harvest_client is None or not contact.linkedin_url:
        return None
    try:
        return harvest_client.fetch_profile(contact.linkedin_url)
    except HarvestError:
        return None


def _llm_verdict(
    element: dict,
    contact: Contact,
    area: AreaProfile,
    company: Company | None,
    canonical_id: str,
    company_match: str,
    *,
    llm_client: OpenRouterClient | None,
    use_fixtures: bool,
    fixtures_dir: Path | None,
    max_tokens: int,
):
    """Devuelve `(LlmVerdict, coste)`. En fixtures lee el veredicto de ejemplo."""
    from .resolver.base import handle_of
    from .verify_llm import LlmVerdict

    if use_fixtures:
        fixture = load_verdict_fixture(fixtures_dir, contact.linkedin_url)
        return (fixture or LlmVerdict(motivo="sin fixture de veredicto → uncertain")), 0.0
    if llm_client is None:
        return LlmVerdict(motivo="sin cliente LLM → uncertain"), 0.0

    empresa = (company.razon_social or company.raw_input) if company else ""
    empresa_handle = handle_of(company.linkedin_url) if company else ""
    system = build_system_prompt(
        area=area,
        empresa_objetivo=empresa,
        empresa_handle=empresa_handle,
        empresa_company_id=canonical_id,
        company_match_previo=company_match,
    )
    user = build_user_prompt(reduce_profile(element))
    return call_llm_verdict(llm_client, system, user, max_tokens=max_tokens)


def _company_match_summary(profile_cid: str, canonical_id: str) -> str:
    if not canonical_id:
        return "sin canónico (no comparable)"
    if not profile_cid:
        return f"perfil sin companyId (canónico {canonical_id})"
    if profile_cid == canonical_id:
        return f"coincide (companyId {canonical_id})"
    return f"distinto (perfil {profile_cid} ≠ canónico {canonical_id})"


def _apply_verdict(contact: Contact, verdict: VerificationVerdict) -> bool:
    """Mapea el veredicto a `Classification` y dice si se conserva el contacto."""
    if verdict == VerificationVerdict.confirmed:
        contact.classification = Classification.decisor
        return True
    if verdict == VerificationVerdict.rejected:
        return False
    contact.classification = Classification.revisar  # uncertain → revisar
    return True


def _verification(
    contact: Contact,
    method: VerificationMethod,
    verdict: VerificationVerdict,
    *,
    confidence: float | None,
    signal: dict,
    cost: float = 0.0,
) -> Verification:
    return Verification(
        contact_id=contact.id,
        method=method,
        verdict=verdict,
        confidence=confidence,
        signal_json={**signal, "profile_url": contact.linkedin_url},
        cost=cost,
    )


def _clone_for_contact(src: Verification, contact: Contact, *, cached: bool) -> Verification:
    """Copia un veredicto cacheado para ESTE contacto (coste 0: no se vuelve a pagar)."""
    return Verification(
        contact_id=contact.id,
        method=src.method,
        verdict=src.verdict,
        confidence=src.confidence,
        signal_json={**src.signal_json, "profile_url": contact.linkedin_url, "cached": cached},
        cost=0.0,
    )
