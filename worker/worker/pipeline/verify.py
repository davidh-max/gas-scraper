"""Paso 3 — verificación por capas (STUB en esta tanda).

En esta tanda solo está implementado el **companyId-match básico** (anti-homónimos,
regla de oro nº6), que SÍ es determinista y testeable. La verificación por capas
(heurística → re-scrape barato → LLM/web para dudosos), su coste y su lógica fina
quedan como firmas con `# TODO` para una sesión posterior.
"""

from __future__ import annotations

from .models import (
    Classification,
    Contact,
    Verification,
    VerificationMethod,
    VerificationVerdict,
)
from .resolver.base import canonical_company_id

VERIFY_FLAG_COMPANY = "verificar_empresa"

# motivos (en signal_json.reason) — los usa apply_company_match para decidir
REASON_NO_CANONICAL = "empresa sin companyId canónico"
REASON_PROFILE_NO_ID = "perfil sin companyId"
REASON_MATCH = "companyId coincide"
REASON_MISMATCH = "companyId distinto (homónimo)"


def verify_company_match(contact: Contact, canonical_id: str | None) -> Verification:
    """Compara el companyId del perfil con el canónico de la empresa buscada.

    El `canonical_id` se deduce de los PROPIOS perfiles de la empresa (el companyId
    más común entre los que sí traen `company_linkedin_url`), no de la URL resuelta.

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


def run_layered_verification(contact: Contact, *, area_params: dict) -> list[Verification]:
    """Paso 3 completo (STUB). Verificación por capas con escalado por coste.

    # TODO(paso-3): implementar las capas en orden de coste creciente:
    #   1) heurística gratis (firma del cargo, ubicación, idioma) → verdict + conf.
    #   2) si dudoso, re-scrape barato del perfil (Apify Short) para más señales.
    #   3) si sigue dudoso, escalado a LLM/web (caro) SOLO para los dudosos.
    #   Cachear en `verification_cache`, registrar 1 fila por método en `verifications`
    #   con (verdict, confidence, signal_json, cost). Reduce 40-50 candidatos a 20-30.
    """
    raise NotImplementedError("Paso 3 (verificación por capas) pendiente de diseño.")
