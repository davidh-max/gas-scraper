"""Worker loop — toma jobs `queued` de Supabase y los procesa con el pipeline.

    python -m worker.main --use-fixtures        # procesa con fixtures (sin gastar Apify)
    python -m worker.main --once                # procesa un solo job y sale
    python -m worker.main                        # loop continuo (modo live)

Frontera limpia: este módulo SOLO orquesta y persiste. La lógica vive en
`worker.pipeline`. Avanza la máquina de estados de `jobs` y registra cada cambio en
`job_events`.
"""

from __future__ import annotations

import argparse
import tempfile
import time
from pathlib import Path
from typing import Any

from .config import get_settings
from .pipeline.apify.client import ApifyClient
from .pipeline.area_profiles import load_area_profile_by_id
from .pipeline.export_excel import export_excel
from .pipeline.harvest import HarvestClient
from .pipeline.llm.openrouter import OpenRouterClient
from .pipeline.models import Company, Contact, Job, JobStatus, Verification
from .pipeline.pipeline import PipelineResult, run_pipeline

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# --------------------------------------------------------------------------- claim


def claim_next_job(sb: Any) -> Job | None:
    """Reclama el job `queued` más antiguo pasándolo a `resolving` (best-effort atómico)."""
    res = (
        sb.table("jobs")
        .select("*")
        .eq("status", "queued")
        .order("created_at")
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    job = Job(**rows[0])
    # toma el job: solo gana si sigue 'queued'
    upd = (
        sb.table("jobs")
        .update({"status": JobStatus.resolving.value})
        .eq("id", job.id)
        .eq("status", "queued")
        .execute()
    )
    if not (upd.data or []):
        return None  # otro worker lo reclamó
    job.status = JobStatus.resolving
    return job


# --------------------------------------------------------------------------- persist


def load_companies(sb: Any, job_id: str) -> list[Company]:
    res = sb.table("companies").select("*").eq("job_id", job_id).execute()
    return [Company(**row) for row in (res.data or [])]


def persist_company(sb: Any, company: Company) -> None:
    payload = company.model_dump(
        mode="json",
        include={
            "linkedin_url", "resolution_method", "resolution_confidence",
            "linkedin_company_id", "status", "note", "razon_social", "cif", "domain",
        },
    )
    sb.table("companies").update(payload).eq("id", company.id).execute()


def insert_contacts(sb: Any, contacts: list[Contact]) -> dict[str, str]:
    """Inserta los contactos y devuelve `{linkedin_url: id}` para correlacionar verifications."""
    if not contacts:
        return {}
    # guarda anti-huérfanos: las FKs son NOT NULL en el esquema (ver models.py)
    orphans = [c for c in contacts if not c.company_id or not c.job_id]
    if orphans:
        raise RuntimeError(
            f"{len(orphans)} contactos sin company_id/job_id; no se insertan (evita huérfanos)."
        )
    rows = [
        c.model_dump(mode="json", exclude={"id", "created_at"}, exclude_none=True)
        for c in contacts
    ]
    res = sb.table("contacts").insert(rows).execute()
    return {
        row["linkedin_url"]: row["id"]
        for row in (res.data or [])
        if row.get("linkedin_url") and row.get("id")
    }


def insert_verifications(
    sb: Any, verifications: list[Verification], url_to_id: dict[str, str]
) -> None:
    """Inserta las `verifications` correlacionando por `signal_json.profile_url → contact_id`.

    El contact_id real lo asigna Postgres al insertar el contacto (ver `insert_contacts`);
    aquí lo recuperamos por la URL del perfil. Verifications sin correlación (perfil sin
    URL) se omiten en vez de romper.
    """
    rows: list[dict[str, Any]] = []
    for v in verifications:
        url = (v.signal_json or {}).get("profile_url")
        contact_id = url_to_id.get(url) if url else None
        if not contact_id:
            continue
        payload = v.model_dump(mode="json", exclude={"id", "created_at", "contact_id"})
        payload["contact_id"] = contact_id
        rows.append(payload)
    if rows:
        sb.table("verifications").insert(rows).execute()


class SupabaseVerificationCache:
    """Caché de veredictos persistente en `verification_cache` (cruza ejecuciones).

    Implementa el `VerificationCacheStore` del pipeline. Evita pagar dos veces el LLM por
    el mismo perfil+área. Fail-safe: un fallo de lectura/escritura no rompe el lote.
    """

    def __init__(self, sb: Any) -> None:
        self.sb = sb

    def get(self, cache_key: str) -> Verification | None:
        try:
            res = (
                self.sb.table("verification_cache")
                .select("*")
                .eq("cache_key", cache_key)
                .limit(1)
                .execute()
            )
        except Exception:  # noqa: BLE001 - la caché nunca rompe el lote
            return None
        rows = res.data or []
        return Verification.model_validate(rows[0]) if rows else None

    def put(self, cache_key: str, verification: Verification) -> None:
        payload = verification.model_dump(
            mode="json", include={"method", "verdict", "confidence", "signal_json", "cost"}
        )
        payload["cache_key"] = cache_key
        try:
            self.sb.table("verification_cache").upsert(payload, on_conflict="cache_key").execute()
        except Exception:  # noqa: BLE001 - la caché nunca rompe el lote
            pass


def log_event(
    sb: Any, job_id: str, to_status: JobStatus | None, message: str,
    payload: dict[str, Any] | None = None, from_status: JobStatus | None = None,
) -> None:
    sb.table("job_events").insert({
        "job_id": job_id,
        "from_status": from_status.value if from_status else None,
        "to_status": to_status.value if to_status else None,
        "message": message,
        "payload": payload or {},
    }).execute()


def upload_excel(sb: Any, bucket: str, job_id: str, path: Path) -> str:
    """Sube el .xlsx al bucket y devuelve la ruta de almacenamiento."""
    storage_path = f"{job_id}/{path.name}"
    data = path.read_bytes()
    sb.storage.from_(bucket).upload(
        storage_path, data, {"content-type": XLSX_MIME, "upsert": "true"}
    )
    return storage_path


# --------------------------------------------------------------------------- process


def process_job(sb: Any, job: Job, *, use_fixtures: bool) -> None:
    settings = get_settings()
    use_fixtures = use_fixtures or job.use_fixtures
    current = {"status": job.status}

    def on_event(status: JobStatus, message: str, payload: dict[str, Any]) -> None:
        prev = current["status"]
        if status != prev:
            sb.table("jobs").update({"status": status.value}).eq("id", job.id).execute()
            current["status"] = status
        log_event(sb, job.id, status, message, payload, from_status=prev)

    area = load_area_profile_by_id(sb, job.area_profile_id)
    backup = (
        load_area_profile_by_id(sb, job.backup_area_profile_id)
        if job.backup_area_profile_id
        else None
    )
    companies = load_companies(sb, job.id)
    if not companies:
        raise RuntimeError("El job no tiene empresas (la web debe insertarlas al crear el job).")

    apify_client: ApifyClient | None = None
    llm_client: OpenRouterClient | None = None
    harvest_client: HarvestClient | None = None
    if not use_fixtures:
        apify_client = ApifyClient(
            token=settings.apify_token,
            employees_actor_id=settings.apify_employees_actor_id,
            company_url_finder_actor_id=settings.apify_company_url_finder_actor_id,
        )
        # OpenRouter: validación de URL (Parte 2) y verify por LLM (Paso 3). Opcional:
        # sin clave, las URLs sin resultado quedan 'unknown' y los dudosos no se verifican.
        if settings.openrouter_api_key:
            llm_client = OpenRouterClient(
                api_key=settings.openrouter_api_key,
                model=settings.openrouter_model,
                base_url=settings.openrouter_base_url,
                app_title=settings.openrouter_app_title,
                referer=settings.openrouter_referer or None,
            )
        # HarvestAPI (Paso 3 verify). Opcional: sin clave, los dudosos quedan en 'revisar'.
        if settings.harvest_api_key:
            harvest_client = HarvestClient(
                api_key=settings.harvest_api_key,
                base_url=settings.harvest_api_base_url,
            )

    result: PipelineResult = run_pipeline(
        companies,
        area,
        backup_area=backup,
        use_fixtures=use_fixtures,
        fixtures_dir=FIXTURES_DIR if use_fixtures else None,
        apify_client=apify_client,
        llm_client=llm_client,
        harvest_client=harvest_client,
        verification_cache=SupabaseVerificationCache(sb),
        verify_llm_max_tokens=settings.verify_llm_max_tokens,
        max_per_company=settings.search_max_per_company,
        on_event=on_event,
    )

    for company in result.companies:
        persist_company(sb, company)
    url_to_id = insert_contacts(sb, result.contacts)
    insert_verifications(sb, result.verifications, url_to_id)

    # genera el Excel y lo sube a Storage
    with tempfile.TemporaryDirectory() as tmp:
        out = export_excel(
            result.companies,
            result.contacts,
            Path(tmp) / f"resultados_{job.id}.xlsx",
            area_name=area.name,
        )
        storage_path = upload_excel(sb, settings.results_bucket, job.id, out)

    s = result.summary
    sb.table("jobs").update({
        "status": JobStatus.done.value,
        "result_path": storage_path,
        "total_companies": s["companies_total"],
        "resolved_companies": s["companies_resolved"],
        "total_contacts": s["contacts_total"],
        "decisor_count": s["decisor"],
        "revisar_count": s["revisar"],
        "no_result_count": s["companies_no_result"],
    }).eq("id", job.id).execute()
    log_event(sb, job.id, JobStatus.done, "Job completado", s, from_status=current["status"])


def fail_job(sb: Any, job: Job, error: Exception) -> None:
    sb.table("jobs").update(
        {"status": JobStatus.error.value, "error_message": str(error)}
    ).eq("id", job.id).execute()
    log_event(sb, job.id, JobStatus.error, "Job con error", {"error": str(error)})


# --------------------------------------------------------------------------- loop


def run_loop(*, use_fixtures: bool, once: bool) -> int:
    from .supabase_client import get_supabase

    sb = get_supabase()
    settings = get_settings()
    processed = 0
    while True:
        job = claim_next_job(sb)
        if job is None:
            if once:
                print("No hay jobs 'queued'.")
                return 0
            time.sleep(settings.poll_interval_seconds)
            continue
        fx = use_fixtures or job.use_fixtures
        print(f"Procesando job {job.id} (área={job.area_profile_id}, fixtures={fx})")
        try:
            process_job(sb, job, use_fixtures=use_fixtures)
            print(f"Job {job.id} → done")
        except Exception as exc:  # noqa: BLE001 - registrar y continuar
            fail_job(sb, job, exc)
            print(f"Job {job.id} → error: {exc}")
        processed += 1
        if once:
            return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worker.main", description="GAS worker loop")
    parser.add_argument("--use-fixtures", action="store_true", help="Procesa con fixtures locales")
    parser.add_argument("--once", action="store_true", help="Procesa un solo job y sale")
    args = parser.parse_args(argv)
    return run_loop(use_fixtures=args.use_fixtures, once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
