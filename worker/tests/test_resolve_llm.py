"""Tests de la validación de URL con Gemini (Parte 2) en modo fixtures."""

from pathlib import Path

import pytest

from worker.pipeline.llm.openrouter import OpenRouterError, _parse_json_content
from worker.pipeline.models import Company
from worker.pipeline.resolve_llm import validate_company_url

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def _company(url: str) -> Company:
    return Company(raw_input="X", razon_social="X", linkedin_url=url)


def _check(handle: str):
    return validate_company_url(
        _company(f"https://www.linkedin.com/company/{handle}/"),
        llm_client=None,
        use_fixtures=True,
        fixtures_dir=FIXTURES_DIR,
    )


def test_fixture_incorrect_returns_normalized_correct_url():
    chk = _check("empresa-corregida")
    assert chk.url_status == "incorrect"
    assert chk.correct_url == "https://www.linkedin.com/company/empresa-corregida-real/"


def test_fixture_correct():
    assert _check("empresa-respaldo").url_status == "correct"


def test_fixture_unknown():
    assert _check("empresa-fantasma").url_status == "unknown"


def test_missing_handle_is_unknown():
    assert _check("no-existe-en-el-fixture").url_status == "unknown"


def test_no_client_no_fixtures_is_unknown():
    chk = validate_company_url(
        _company("https://www.linkedin.com/company/whatever/"),
        llm_client=None,
        use_fixtures=False,
    )
    assert chk.url_status == "unknown"


# ----------------------------------------------------------------- parser de OpenRouter


def test_parse_json_plain():
    assert _parse_json_content('{"a": 1}') == {"a": 1}


def test_parse_json_with_fence():
    assert _parse_json_content('```json\n{"a": 1}\n```') == {"a": 1}


def test_parse_json_invalid_raises():
    with pytest.raises(OpenRouterError):
        _parse_json_content("esto no es json")
