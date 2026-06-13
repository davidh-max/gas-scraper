"""Tests de la similitud difusa nombre↔handle y helpers de resolución."""

from worker.pipeline.resolver.base import (
    extract_linkedin_company_url,
    handle_from_domain,
    handle_of,
)
from worker.pipeline.resolver.confidence import name_handle_confidence, normalize_handle


def test_confidence_high_when_handle_matches_name():
    assert name_handle_confidence("Bnext Servicios Financieros SL", "bnext") > 0.8
    assert name_handle_confidence("Amadeus IT Group SA",
                                  "https://www.linkedin.com/company/amadeus/") > 0.7


def test_confidence_handles_prefix_match():
    # el handle es un prefijo del nombre ("glovo" ⊂ "glovoapp")
    assert name_handle_confidence("Glovoapp 23 SL", "glovo") > 0.7


def test_confidence_low_when_unrelated():
    assert name_handle_confidence("Servicios Legales Pérez SL", "randomhandle") < 0.6


def test_confidence_zero_on_empty():
    assert name_handle_confidence("", "bnext") == 0.0
    assert name_handle_confidence("Bnext", "") == 0.0


def test_normalize_handle_strips_scheme_and_dashes():
    assert normalize_handle("https://es.linkedin.com/company/tech-corp/") == "tech corp"
    assert normalize_handle("https://www.linkedin.com/company/amadeus") == "amadeus"


def test_handle_of_preserves_dashes_and_normalizes_subdomain():
    assert handle_of("https://es.linkedin.com/company/tech-corp/") == "tech-corp"
    assert handle_of("https://www.linkedin.com/company/Amadeus") == "amadeus"


def test_handle_from_domain():
    assert handle_from_domain("bnext.es") == "bnext"
    assert handle_from_domain("https://www.glovo.com/es") == "glovo"
    assert handle_from_domain(None) is None


def test_extract_linkedin_company_url():
    txt = "contacto: https://es.linkedin.com/company/cabify gracias"
    assert extract_linkedin_company_url(txt) == "https://www.linkedin.com/company/cabify"
    assert extract_linkedin_company_url("sin url") is None
