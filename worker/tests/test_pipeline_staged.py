"""Integración del Buscador de decisores con fixtures (Parte 1 + Parte 2).

Conteo POR EMPRESA: cada empresa termina `done` (alguien encontrado) o `no_result`.
"""

from pathlib import Path

from worker.pipeline.area_profiles import default_area_profile
from worker.pipeline.models import Company, CompanyStatus, ResolutionMethod, SourcePass
from worker.pipeline.pipeline import run_pipeline

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _co(handle: str) -> Company:
    return Company(
        raw_input=handle,
        razon_social=handle,
        linkedin_url=f"https://www.linkedin.com/company/{handle}/",
    )


def _run(companies: list[Company]):
    return run_pipeline(
        companies,
        default_area_profile("it"),
        backup_area=default_area_profile("maximos"),
        use_fixtures=True,
        fixtures_dir=FIXTURES_DIR,
    )


def test_part1_direct_hit():
    c = _co("amadeus")
    res = _run([c])
    assert c.status == CompanyStatus.done
    assert len(res.contacts) >= 1


def test_corrected_url_then_found():
    c = _co("empresa-corregida")  # vacía en A/B; Gemini la corrige y re-busca
    _run([c])
    assert c.linkedin_url == "https://www.linkedin.com/company/empresa-corregida-real/"
    assert c.resolution_method == ResolutionMethod.llm_web
    assert c.status == CompanyStatus.done
    assert "Gemini" in (c.note or "")


def test_correct_url_found_via_backup_area():
    c = _co("empresa-respaldo")  # vacía en A/B; Gemini confirma; aparece en respaldo
    res = _run([c])
    assert c.status == CompanyStatus.done
    assert any(ct.source_pass == SourcePass.fallback for ct in res.contacts)


def test_unknown_verdict_goes_no_result():
    c = _co("empresa-fantasma")  # vacía en A/B; Gemini 'unknown' → no_result
    _run([c])
    assert c.status == CompanyStatus.no_result


def test_per_company_counts_are_not_per_contact():
    companies = [
        _co("amadeus"),           # done (Parte 1)
        _co("empresa-corregida"),  # done (URL corregida)
        _co("empresa-respaldo"),   # done (respaldo)
        _co("empresa-fantasma"),   # no_result (unknown)
    ]
    res = _run(companies)
    s = res.summary
    assert s["companies_total"] == 4
    assert s["companies_resolved"] == 4
    assert s["companies_with_results"] == 3
    assert s["companies_no_result"] == 1
