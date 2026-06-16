"""Tests del Paso 3 — capa LLM del verify (input reducido, prompt, orquestación).

Todo en modo fixtures (gratis): el perfil sale de `harvest_profile_sample.json` y el
veredicto de `verify_llm_sample.json`. Sin red ni claves.
"""

import json
from pathlib import Path

from worker.pipeline.area_profiles import default_area_profile
from worker.pipeline.models import (
    AreaProfile,
    Classification,
    Company,
    CompanyStatus,
    Contact,
    SourcePass,
    VerificationMethod,
    VerificationVerdict,
)
from worker.pipeline.pipeline import run_pipeline
from worker.pipeline.verify import (
    InMemoryVerificationCache,
    needs_llm_review,
    run_layered_verification,
)
from worker.pipeline.verify_llm import (
    area_verify_block,
    build_system_prompt,
    current_company_id,
    reduce_profile,
    required_location,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
IT = default_area_profile("it")


def _element(handle: str) -> dict:
    data = json.load(open(FIXTURES_DIR / "harvest_profile_sample.json", encoding="utf-8"))
    return data[handle]["element"]


def _contact(handle: str, title: str = "Coordinadora de Sistemas") -> Contact:
    return Contact(
        source_pass=SourcePass.A,
        title=title,
        linkedin_url=f"https://www.linkedin.com/in/{handle}",
        classification=Classification.revisar,
    )


def _company() -> Company:
    return Company(
        raw_input="VerifyCo",
        razon_social="VerifyCo",
        linkedin_url="https://www.linkedin.com/company/verifyco",
    )


def _verify(contact: Contact, *, canonical_id: str = "", cache=None):
    return run_layered_verification(
        contact,
        area=IT,
        company=_company(),
        canonical_id=canonical_id,
        use_fixtures=True,
        fixtures_dir=FIXTURES_DIR,
        cache=cache or InMemoryVerificationCache(),
    )


# ----------------------------------------------------------------- input reducido


def test_reduce_profile_maps_core_fields():
    reduced = reduce_profile(_element("beatriz-cio-amadeus"))
    assert reduced["nombre"] == "Beatriz Méndez-Villamil"
    assert reduced["cargos_actuales"][0]["cargo"] == "Global CIO"
    assert reduced["cargos_actuales"][0]["company_id"] == "2780"
    assert reduced["ubicacion"]["pais_code"] == "ES"
    assert reduced["headline_es"].startswith("Directiva")
    assert reduced["honores"] == ["Best CIO 2026 — Forbes"]
    assert "about" in reduced and "top_skills" in reduced


def test_reduce_profile_discards_noise():
    reduced = reduce_profile(_element("beatriz-cio-amadeus"))
    # ruido que NO debe llegar al LLM (coste): fotos, certificaciones, etc.
    assert "profilePicture" not in reduced
    assert "certifications" not in reduced


def test_reduce_profile_defensive_plural_and_title():
    # `currentPositions` (plural) + `title` en vez de `position` → se mapea igual.
    reduced = reduce_profile(_element("pedro-ventas-it"))
    assert reduced["cargos_actuales"][0]["cargo"] == "Sales Manager"


def test_current_company_id_from_field_and_from_url():
    assert current_company_id(_element("beatriz-cio-amadeus")) == "2780"
    only_url = {"currentPosition": [{"companyLinkedinUrl": "https://www.linkedin.com/company/12345"}]}
    assert current_company_id(only_url) == "12345"
    assert current_company_id({}) == ""


# ----------------------------------------------------------------- bloques por área + prompt


def test_area_verify_block_known():
    nombre, perfil = area_verify_block(IT)
    assert nombre == "Tecnología / IT"
    assert "CIO" in perfil


def test_area_verify_block_params_override():
    area = AreaProfile(
        key="x",
        name="X",
        params={"verify_llm": {"area_nombre": "Custom", "perfil_decisor_area": "BLOQUE"}},
    )
    assert area_verify_block(area) == ("Custom", "BLOQUE")


def test_area_verify_block_generic_fallback():
    area = AreaProfile(key="area-nueva-sin-bloque", name="Área Nueva", params={})
    nombre, perfil = area_verify_block(area)
    assert nombre == "Área Nueva"
    assert "Área Nueva" in perfil  # el genérico cita el nombre del área


def test_required_location_spain():
    assert required_location(IT) == "España"


def test_build_system_prompt_substitutes_vars():
    sp = build_system_prompt(
        area=IT,
        empresa_objetivo="Amadeus",
        empresa_handle="amadeus",
        empresa_company_id="2780",
        company_match_previo="coincide (companyId 2780)",
    )
    assert "Tecnología / IT" in sp
    assert "Amadeus" in sp and "2780" in sp
    assert "España" in sp


# ----------------------------------------------------------------- run_layered_verification


def test_confirmed_promotes_to_decisor():
    c = _contact("beatriz-cio-amadeus")
    keep, vs = _verify(c)
    assert keep is True
    assert c.classification == Classification.decisor
    assert len(vs) == 1
    assert vs[0].method == VerificationMethod.llm_web
    assert vs[0].verdict == VerificationVerdict.confirmed
    assert vs[0].signal_json["profile_url"].endswith("beatriz-cio-amadeus")


def test_rejected_outside_spain_is_dropped():
    c = _contact("john-london-cto")
    keep, vs = _verify(c, canonical_id="2780")  # companyId coincide → llega al LLM
    assert keep is False
    assert vs[-1].method == VerificationMethod.llm_web
    assert vs[-1].verdict == VerificationVerdict.rejected
    assert vs[-1].signal_json["ubicacion_ok"] is False


def test_uncertain_keeps_revisar():
    c = _contact("pedro-ventas-it")
    keep, vs = _verify(c, canonical_id="2780")
    assert keep is True
    assert c.classification == Classification.revisar
    assert vs[0].verdict == VerificationVerdict.uncertain


def test_homonimo_recheck_rejects_without_llm():
    # companyId del perfil (99999) ≠ canónico (2780) → rejected en el re-check barato.
    c = _contact("homonimo-distinto")
    keep, vs = _verify(c, canonical_id="2780")
    assert keep is False
    assert len(vs) == 1  # NO se gastó LLM
    assert vs[0].method == VerificationMethod.profile_rescrape
    assert vs[0].verdict == VerificationVerdict.rejected


def test_missing_profile_is_uncertain():
    c = _contact("no-existe-en-fixtures")
    keep, vs = _verify(c)
    assert keep is True
    assert c.classification == Classification.revisar
    assert vs[0].method == VerificationMethod.llm_web
    assert vs[0].verdict == VerificationVerdict.uncertain


def test_null_element_profile_is_uncertain():
    c = _contact("perfil-sin-datos")  # element: null en el fixture
    keep, vs = _verify(c)
    assert keep is True
    assert vs[0].verdict == VerificationVerdict.uncertain


def test_cache_hit_is_free_and_consistent():
    cache = InMemoryVerificationCache()
    first = _contact("beatriz-cio-amadeus")
    _verify(first, cache=cache)
    second = _contact("beatriz-cio-amadeus")
    keep, vs = _verify(second, cache=cache)
    assert keep is True
    assert second.classification == Classification.decisor
    assert vs[0].cost == 0.0
    assert vs[0].signal_json.get("cached") is True


def test_needs_llm_review_selects_dudosos():
    revisar = Contact(source_pass=SourcePass.A, classification=Classification.revisar)
    assert needs_llm_review(revisar) is True
    flagged = Contact(
        source_pass=SourcePass.A,
        classification=Classification.decisor,
        verify_flag="verificar_empresa",
    )
    assert needs_llm_review(flagged) is True
    high = Contact(
        source_pass=SourcePass.A, classification=Classification.decisor, heuristic_score=0.85
    )
    assert needs_llm_review(high) is False
    low = Contact(
        source_pass=SourcePass.A, classification=Classification.decisor, heuristic_score=0.5
    )
    assert needs_llm_review(low) is True


# ----------------------------------------------------------------- integración pipeline


def test_pipeline_verifies_dudosos_end_to_end():
    c = Company(
        raw_input="verifyco",
        razon_social="VerifyCo",
        linkedin_url="https://www.linkedin.com/company/verifyco",
    )
    res = run_pipeline([c], IT, use_fixtures=True, fixtures_dir=FIXTURES_DIR)

    assert c.status == CompanyStatus.done
    # Beatriz: dudosa (Coordinadora de Sistemas) → LLM la confirma como decisor.
    assert any(
        ct.first_name == "Beatriz" and ct.classification == Classification.decisor
        for ct in res.contacts
    )
    # John: dudoso (Coordinador de IT) pero en Londres → LLM lo descarta (no se conserva).
    assert all(ct.first_name != "John" for ct in res.contacts)
    # Hay un veredicto LLM confirmado y otro rechazado entre las verifications.
    llm = [v for v in res.verifications if v.method == VerificationMethod.llm_web]
    verdicts = {v.verdict for v in llm}
    assert VerificationVerdict.confirmed in verdicts
    assert VerificationVerdict.rejected in verdicts
