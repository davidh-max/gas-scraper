"""Orquestación de los Pasos 1..6 por lote. Sin acceso a la cola ni a Storage.

`run_pipeline` toma una lista de `Company` (input heterogéneo) y un `AreaProfile`,
y devuelve un `PipelineResult` (companies resueltas, contacts clasificados,
verifications y un resumen). El modo `use_fixtures` evita cualquier llamada externa.

La persistencia (escribir en Supabase, subir el Excel) y la máquina de estados de
`jobs` viven en `worker.main`; aquí solo se EMITEN eventos vía `on_event`.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .apify.client import ApifyClient
from .apify.employees import EmployeesSearch
from .area_profiles import AreaProfile
from .classify import classify, heuristic_score
from .export_excel import company_key
from .harvest import HarvestClient
from .llm.openrouter import OpenRouterClient
from .models import (
    Classification,
    Company,
    CompanyStatus,
    Contact,
    JobStatus,
    ResolutionMethod,
    SourcePass,
    Verification,
)
from .resolve_llm import UrlCheck, validate_company_url
from .resolver.apify_company_url import resolve_linkedin_urls
from .resolver.base import canonical_company_id, handle_of
from .verify import (
    InMemoryVerificationCache,
    VerificationCacheStore,
    apply_company_match,
    needs_llm_review,
    run_layered_verification,
)

EventCallback = Callable[[JobStatus, str, dict[str, Any]], None]


@dataclass
class PipelineResult:
    companies: list[Company]
    contacts: list[Contact]
    verifications: list[Verification] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


def run_pipeline(
    companies: list[Company],
    area: AreaProfile,
    *,
    backup_area: AreaProfile | None = None,
    use_fixtures: bool = False,
    fixtures_dir: Path | None = None,
    apify_client: ApifyClient | None = None,
    llm_client: OpenRouterClient | None = None,
    harvest_client: HarvestClient | None = None,
    verification_cache: VerificationCacheStore | None = None,
    verify_llm_max_tokens: int = 400,
    max_per_company: int = 3,
    resolve_only: bool = False,
    on_event: EventCallback | None = None,
) -> PipelineResult:
    """Ejecuta el pipeline completo sobre `companies` y devuelve el resultado."""

    def emit(status: JobStatus, message: str, payload: dict[str, Any] | None = None) -> None:
        if on_event is not None:
            on_event(status, message, payload or {})

    classify_cfg = (area.params or {}).get("classify", {})
    search = EmployeesSearch(
        use_fixtures=use_fixtures, fixtures_dir=fixtures_dir, client=apify_client
    )

    # ---------------------------------------------------------------- Paso 0: validar cuenta
    if not use_fixtures and apify_client is not None:
        if not apify_client.validate_company_url_finder():
            raise RuntimeError(
                "Cuenta Apify no validada (company-url-finder): saldo/plan/permisos. "
                "Lote abortado."
            )

    # ---------------------------------------------------------------- Paso 1: resolver
    emit(JobStatus.resolving, "Resolviendo URLs de LinkedIn", {"total": len(companies)})
    resolve_linkedin_urls(companies, apify_client if not use_fixtures else None)
    for company in companies:
        if not company.id:
            company.id = company_key(company)
    resolved = [c for c in companies if c.status == CompanyStatus.resolved]
    by_handle: dict[str, Company] = {handle_of(c.linkedin_url): c for c in resolved}
    emit(
        JobStatus.resolving,
        "Resolución completada",
        {"resolved": len(resolved), "unresolved": len(companies) - len(resolved)},
    )

    if resolve_only:
        # Modo fase 2: solo resolución de URLs de empresa, no buscamos empleados.
        summary = {
            "companies_total": len(companies),
            "companies_resolved": len(resolved),
            "companies_unresolved": len(companies) - len(resolved),
            "contacts_total": 0,
            "decisor": 0,
            "revisar": 0,
            "companies_with_results": 0,
            "companies_no_result": 0,
            "resolve_only": True,
        }
        return PipelineResult(companies=companies, contacts=[], verifications=[], summary=summary)

    # ---------------------------------------------------------------- Paso 2/2b: buscar
    emit(JobStatus.searching, "Buscando decisores (Pasada A)", {"companies": len(resolved)})
    contacts: list[Contact] = []
    seen: set[tuple[str, str]] = set()

    def ingest(items: list[dict[str, Any]], source: SourcePass) -> None:
        for it in items:
            handle = _queried_handle(it)
            company = by_handle.get(handle)
            if company is None:
                continue
            contact = _item_to_contact(it, company, source, classify_cfg)
            key = ((contact.linkedin_url or "").lower(), handle)
            if contact.linkedin_url and key in seen:
                continue
            seen.add(key)
            contacts.append(contact)

    def run_and_ingest(
        subset: list[Company], params: dict[str, Any], label: str, source: SourcePass
    ) -> None:
        ingest(search.run_pass(subset, params, label, max_per_company=max_per_company), source)

    # --- Parte 1: área principal (función+seniority → jobTitles) ---------------
    run_and_ingest(resolved, area.params, "A", SourcePass.A)  # Pasada A: functionIds+seniority

    # Pasada B (refuerzo): jobTitles sobre las empresas que siguen sin contactos.
    empty_a = _companies_without_contacts(resolved, contacts)
    if empty_a:
        emit(JobStatus.searching, "Pasada B (jobTitles)", {"companies": len(empty_a)})
        run_and_ingest(empty_a, area.params, "B", SourcePass.B)

    # --- Parte 2: validar la URL con Gemini y, según el veredicto, respaldo -----
    # Solo para las empresas que SIGUEN sin nadie tras A+B.
    still_empty = _companies_without_contacts(resolved, contacts)
    if still_empty:
        emit(
            JobStatus.searching,
            "Validando URLs sin resultados (Gemini)",
            {"companies": len(still_empty)},
        )
        corrected: list[Company] = []
        backup_eligible: list[Company] = []
        for company in still_empty:
            check = validate_company_url(
                company, llm_client=llm_client, use_fixtures=use_fixtures, fixtures_dir=fixtures_dir
            )
            emit(
                JobStatus.searching,
                "Validación de URL",
                {
                    "handle": handle_of(company.linkedin_url),
                    "url_status": check.url_status,
                    "confidence": check.confidence,
                    "correct_url": check.correct_url,
                    "reasoning": check.reasoning,
                },
            )
            if check.url_status == "incorrect" and check.correct_url:
                _apply_corrected_url(company, check)
                by_handle[handle_of(company.linkedin_url)] = company  # re-indexa con la URL nueva
                corrected.append(company)
            elif check.url_status == "correct":
                backup_eligible.append(company)
            # "unknown" o "incorrect" sin correct_url → no se toca (acabará en no_result)

        # Re-ejecutar Parte 1 (A→B) sobre las URLs corregidas. Acotado: una sola vez.
        if corrected:
            emit(JobStatus.searching, "Re-búsqueda (URL corregida)", {"companies": len(corrected)})
            run_and_ingest(corrected, area.params, "A", SourcePass.A)
            empty_corr = _companies_without_contacts(corrected, contacts)
            if empty_corr:
                run_and_ingest(empty_corr, area.params, "B", SourcePass.B)
            # Las corregidas que sigan vacías van al respaldo (su URL ya es correcta).
            backup_eligible.extend(_companies_without_contacts(corrected, contacts))

        # Área de respaldo: backup_a (seniority+function) → backup_b (jobTitles).
        backup_eligible = _companies_without_contacts(backup_eligible, contacts)
        if backup_eligible and backup_area is not None:
            emit(
                JobStatus.searching,
                "Respaldo (seniority+function)",
                {"companies": len(backup_eligible)},
            )
            run_and_ingest(backup_eligible, backup_area.params, "backup_a", SourcePass.fallback)
            empty_bk = _companies_without_contacts(backup_eligible, contacts)
            if empty_bk:
                emit(JobStatus.searching, "Respaldo (jobTitles)", {"companies": len(empty_bk)})
                run_and_ingest(empty_bk, backup_area.params, "backup_b", SourcePass.fallback)

    # ---------------------------------------------------------------- Paso 3: verificar
    # Capa 1 (gratis): companyId-match determinista (anti-homónimos).
    emit(JobStatus.verifying, "Verificando (companyId match)", {"contacts": len(contacts)})
    canonical_by_company = _canonical_ids_by_company(contacts, companies)
    verifications, kept = _verify_company_ids(contacts, canonical_by_company)
    contacts = kept

    # Capa 2 (cara, solo dudosos): enriquecer perfil (HarvestAPI) + LLM (OpenRouter).
    dudosos = [c for c in contacts if needs_llm_review(c)]
    if dudosos:
        emit(JobStatus.verifying, "Verificación LLM (dudosos)", {"dudosos": len(dudosos)})
        cache = verification_cache or InMemoryVerificationCache()
        company_by_id = {c.id: c for c in companies if c.id}
        llm_verifications, rejected = _verify_dudosos_with_llm(
            dudosos,
            area,
            company_by_id=company_by_id,
            canonical_by_company=canonical_by_company,
            harvest_client=harvest_client,
            llm_client=llm_client,
            use_fixtures=use_fixtures,
            fixtures_dir=fixtures_dir,
            cache=cache,
            max_tokens=verify_llm_max_tokens,
        )
        verifications.extend(llm_verifications)
        if rejected:
            rejected_ids = {id(c) for c in rejected}
            contacts = [c for c in contacts if id(c) not in rejected_ids]
            emit(JobStatus.verifying, "Descartados por LLM (homónimo/fuera)", {"n": len(rejected)})

    # marca status de cada empresa según resultados
    with_contacts = {c.company_id for c in contacts}
    for company in companies:
        if company.status == CompanyStatus.resolved:
            company.status = (
                CompanyStatus.done if company.id in with_contacts else CompanyStatus.no_result
            )

    # Paso 4 (teléfono + Lista Robinson + RGPD) está DESCARTADO: no se enriquece ni se
    # transita por `enriching`. El flujo termina en verify → el worker marca `done`.

    # ---------------------------------------------------------------- resumen
    n_dec = sum(1 for c in contacts if c.classification == Classification.decisor)
    n_rev = len(contacts) - n_dec
    n_no = sum(1 for c in companies if c.status in (CompanyStatus.no_result, CompanyStatus.no_url))
    summary = {
        "companies_total": len(companies),
        "companies_resolved": len(resolved),
        "companies_with_results": len(resolved) - sum(
            1 for c in resolved if c.status == CompanyStatus.no_result
        ),
        "companies_no_result": n_no,
        "contacts_total": len(contacts),
        "decisor": n_dec,
        "revisar": n_rev,
        "verify_flagged": sum(1 for c in contacts if c.verify_flag),
    }
    return PipelineResult(
        companies=companies, contacts=contacts, verifications=verifications, summary=summary
    )


# --------------------------------------------------------------------------- helpers


def _queried_handle(item: dict[str, Any]) -> str:
    q = (item.get("_meta", {}) or {}).get("query", {}) or {}
    companies = q.get("currentCompanies") or []
    return handle_of(companies[0]) if companies else ""


def _item_to_contact(
    item: dict[str, Any], company: Company, source: SourcePass, classify_cfg: dict
) -> Contact:
    positions = item.get("currentPositions") or []
    pos = positions[0] if positions else {}
    title = (pos.get("title") or "").strip()
    return Contact(
        job_id=company.job_id,
        company_id=company.id,
        source_pass=source,
        first_name=(item.get("firstName") or "").strip() or None,
        last_name=(item.get("lastName") or "").strip() or None,
        title=title or None,
        location=((item.get("location") or {}).get("linkedinText") or "").strip() or None,
        linkedin_url=(item.get("linkedinUrl") or "").strip() or None,
        company_linkedin_url=(pos.get("companyLinkedinUrl") or "").strip() or None,
        classification=classify(title, classify_cfg),
        heuristic_score=heuristic_score(title, classify_cfg),
    )


def _companies_without_contacts(
    companies: list[Company], contacts: list[Contact]
) -> list[Company]:
    have = {c.company_id for c in contacts}
    return [c for c in companies if c.id not in have]


def _apply_corrected_url(company: Company, check: UrlCheck) -> None:
    """Sustituye la URL de empresa por la corregida por Gemini (Parte 2, rama 2b)."""
    company.linkedin_url = check.correct_url
    company.linkedin_company_id = canonical_company_id(check.correct_url)
    company.resolution_method = ResolutionMethod.llm_web
    company.resolution_confidence = check.confidence
    prefix = f"{company.note} | " if company.note else ""
    company.note = f"{prefix}URL corregida por Gemini: {check.reasoning[:200]}"


def _canonical_ids_by_company(
    contacts: list[Contact], companies: list[Company]
) -> dict[str, str]:
    """companyId canónico por empresa (regla de oro nº6). Reutilizado por ambas capas.

    Preferimos el companyId **numérico real de la empresa buscada** (`linkedin_company_id`,
    resuelto en el Paso 1) cuando la resolución lo proporcionó. Si la resolución solo dio
    un handle de vanidad (no numérico, no comparable con los `companyLinkedinUrl` numéricos
    de los perfiles), caemos a la heurística validada: la **moda** de los companyId que
    traen los propios perfiles de esa empresa.
    """
    company_by_id: dict[str, Company] = {c.id: c for c in companies if c.id}
    by_company: dict[str, list[Contact]] = defaultdict(list)
    for c in contacts:
        by_company[c.company_id or ""].append(c)

    canonical_by_company: dict[str, str] = {}
    for company_id, group in by_company.items():
        company = company_by_id.get(company_id)
        resolved = (company.linkedin_company_id or "") if company else ""
        if resolved.isdigit():
            canonical_by_company[company_id] = resolved  # id real de la empresa buscada
            continue
        ids = Counter(
            canonical_company_id(c.company_linkedin_url)
            for c in group
            if c.company_linkedin_url
        )
        canonical_by_company[company_id] = ids.most_common(1)[0][0] if ids else ""
    return canonical_by_company


def _verify_company_ids(
    contacts: list[Contact], canonical_by_company: dict[str, str]
) -> tuple[list[Verification], list[Contact]]:
    """Capa 1: aplica el companyId-match (anti-homónimos) a cada contacto."""
    verifications: list[Verification] = []
    kept: list[Contact] = []
    for c in contacts:
        canonical = canonical_by_company.get(c.company_id or "", "")
        keep, verification = apply_company_match(c, canonical)
        verifications.append(verification)
        if keep:
            kept.append(c)
    return verifications, kept


def _verify_dudosos_with_llm(
    dudosos: list[Contact],
    area: AreaProfile,
    *,
    company_by_id: dict[str, Company],
    canonical_by_company: dict[str, str],
    harvest_client: HarvestClient | None,
    llm_client: OpenRouterClient | None,
    use_fixtures: bool,
    fixtures_dir: Path | None,
    cache: VerificationCacheStore,
    max_tokens: int,
) -> tuple[list[Verification], list[Contact]]:
    """Capa 2: cada dudoso por `run_layered_verification`. Devuelve (verifications, rechazados)."""
    verifications: list[Verification] = []
    rejected: list[Contact] = []
    for c in dudosos:
        keep, vs = run_layered_verification(
            c,
            area=area,
            company=company_by_id.get(c.company_id or ""),
            canonical_id=canonical_by_company.get(c.company_id or "", ""),
            harvest_client=harvest_client,
            llm_client=llm_client,
            use_fixtures=use_fixtures,
            fixtures_dir=fixtures_dir,
            cache=cache,
            max_tokens=max_tokens,
        )
        verifications.extend(vs)
        if not keep:
            rejected.append(c)
    return verifications, rejected
