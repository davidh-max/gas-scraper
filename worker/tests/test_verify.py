"""Tests del companyId-match básico (Paso 3, anti-homónimos)."""

from worker.pipeline.models import Classification, Contact, SourcePass, VerificationVerdict
from worker.pipeline.verify import (
    VERIFY_FLAG_COMPANY,
    apply_company_match,
    verify_company_match,
)

CANONICAL = "55501"


def _contact(company_linkedin_url=None, classification=Classification.decisor):
    return Contact(
        source_pass=SourcePass.A,
        title="Director de Sistemas",
        company_linkedin_url=company_linkedin_url,
        classification=classification,
    )


def test_match_confirmed():
    c = _contact("https://www.linkedin.com/company/55501")
    v = verify_company_match(c, CANONICAL)
    assert v.verdict == VerificationVerdict.confirmed
    keep, _ = apply_company_match(c, CANONICAL)
    assert keep is True
    assert c.verify_flag is None
    assert c.classification == Classification.decisor


def test_mismatch_rejected_and_dropped():
    c = _contact("https://www.linkedin.com/company/88888")
    v = verify_company_match(c, CANONICAL)
    assert v.verdict == VerificationVerdict.rejected
    keep, _ = apply_company_match(c, CANONICAL)
    assert keep is False  # homónimo: se descarta


def test_profile_without_id_is_degraded_not_dropped():
    c = _contact(None, classification=Classification.decisor)
    v = verify_company_match(c, CANONICAL)
    assert v.verdict == VerificationVerdict.uncertain
    keep, _ = apply_company_match(c, CANONICAL)
    assert keep is True
    assert c.verify_flag == VERIFY_FLAG_COMPANY
    assert c.classification == Classification.revisar  # degradado, no borrado


def test_company_without_canonical_keeps_as_is():
    c = _contact(None, classification=Classification.decisor)
    v = verify_company_match(c, "")
    assert v.verdict == VerificationVerdict.uncertain
    keep, _ = apply_company_match(c, "")
    assert keep is True
    assert c.verify_flag is None
    assert c.classification == Classification.decisor  # no verificable → sin cambios


def test_numeric_id_extracted_from_url():
    c = _contact("https://es.linkedin.com/company/55501/about/")
    v = verify_company_match(c, CANONICAL)
    assert v.signal_json["profile_company_id"] == "55501"
    assert v.verdict == VerificationVerdict.confirmed
