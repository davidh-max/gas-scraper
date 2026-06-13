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
from .models import (
    Classification,
    Company,
    CompanyStatus,
    Contact,
    JobStatus,
    SourcePass,
    Verification,
)
from .resolver.apify_serp import ApifySerpResolver
from .resolver.base import canonical_company_id, handle_of
from .verify import apply_company_match

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
    serp_actor_id: str | None = None,
    on_event: EventCallback | None = None,
) -> PipelineResult:
    """Ejecuta el pipeline completo sobre `companies` y devuelve el resultado."""

    def emit(status: JobStatus, message: str, payload: dict[str, Any] | None = None) -> None:
        if on_event is not None:
            on_event(status, message, payload or {})

    classify_cfg = (area.params or {}).get("classify", {})
    resolver = ApifySerpResolver(use_fixtures=use_fixtures, serp_actor_id=serp_actor_id)
    search = EmployeesSearch(
        use_fixtures=use_fixtures, fixtures_dir=fixtures_dir, client=apify_client
    )

    # ---------------------------------------------------------------- Paso 0: validar cuenta
    # Regla de oro nº8: antes de gastar en el lote (live), validar la cuenta Apify con
    # una llamada mínima a Amadeus. En fixtures no se gasta nada, así que se omite.
    if not use_fixtures and apify_client is not None:
        if not apify_client.validate_account():
            raise RuntimeError(
                "Cuenta Apify no validada (Amadeus): saldo/plan/permisos. Lote abortado."
            )

    # ---------------------------------------------------------------- Paso 1: resolver
    emit(JobStatus.resolving, "Resolviendo URLs de LinkedIn", {"total": len(companies)})
    for company in companies:
        resolver.resolve(company)
        if not company.id:
            company.id = company_key(company)
        if company.linkedin_url:
            company.linkedin_company_id = canonical_company_id(company.linkedin_url)
    resolved = [c for c in companies if c.status == CompanyStatus.resolved]
    by_handle: dict[str, Company] = {handle_of(c.linkedin_url): c for c in resolved}
    emit(
        JobStatus.resolving,
        "Resolución completada",
        {"resolved": len(resolved), "unresolved": len(companies) - len(resolved)},
    )

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

    # Pasada A (principal)
    ingest(search.run_pass(resolved, area.params, "A"), SourcePass.A)

    # Pasada B (refuerzo): empresas resueltas que siguen sin contactos
    empty_a = _companies_without_contacts(resolved, contacts)
    if empty_a:
        emit(JobStatus.searching, "Pasada B (seniority/títulos)", {"companies": len(empty_a)})
        ingest(search.run_pass(empty_a, area.params, "B"), SourcePass.B)

    # Fallback: área de respaldo sobre las que aún quedan vacías
    empty_b = _companies_without_contacts(resolved, contacts)
    if empty_b and backup_area is not None:
        emit(JobStatus.searching, "Fallback (área de respaldo)", {"companies": len(empty_b)})
        ingest(search.run_pass(empty_b, backup_area.params, "fallback"), SourcePass.fallback)

    # ---------------------------------------------------------------- Paso 3: verificar
    emit(JobStatus.verifying, "Verificando (companyId match)", {"contacts": len(contacts)})
    verifications, kept = _verify_company_ids(contacts, companies)
    contacts = kept

    # marca status de cada empresa según resultados
    with_contacts = {c.company_id for c in contacts}
    for company in companies:
        if company.status == CompanyStatus.resolved:
            company.status = (
                CompanyStatus.done if company.id in with_contacts else CompanyStatus.no_result
            )

    # ---------------------------------------------------------------- Paso 4: teléfono (STUB)
    emit(JobStatus.enriching, "Enriquecimiento de teléfono (stub)", {"contacts": len(contacts)})
    # TODO(paso-4): aquí iría enrich_phone() por contacto. Por ahora no-op.

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


def _verify_company_ids(
    contacts: list[Contact], companies: list[Company]
) -> tuple[list[Verification], list[Contact]]:
    """Anti-homónimos (regla de oro nº6). Determina el companyId canónico por empresa.

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

    verifications: list[Verification] = []
    kept: list[Contact] = []
    for c in contacts:
        canonical = canonical_by_company.get(c.company_id or "", "")
        keep, verification = apply_company_match(c, canonical)
        verifications.append(verification)
        if keep:
            kept.append(c)
    return verifications, kept
