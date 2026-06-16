"""Tests de `build_pass_input`: claves por pasada, max_per_company y reglas de oro."""

import pytest

from worker.pipeline.apify.employees import build_pass_input
from worker.pipeline.area_profiles import default_area_profile

IT = default_area_profile("it").params
MAXIMOS = default_area_profile("maximos").params


def test_pass_a_it_uses_function_and_seniority():
    inp = build_pass_input(["u1"], IT, "A")
    assert inp["functionIds"] == ["13"]
    assert "seniorityLevelIds" in inp
    assert "jobTitles" not in inp


def test_pass_b_it_uses_jobtitles():
    inp = build_pass_input(["u1"], IT, "B")
    assert "jobTitles" in inp
    assert "seniorityLevelIds" not in inp


def test_backup_a_uses_pass_a_of_backup_area():
    # maximos.pass_a = jobTitles → backup_a debe traer jobTitles, no seniority
    inp = build_pass_input(["u1"], MAXIMOS, "backup_a")
    assert "jobTitles" in inp
    assert "seniorityLevelIds" not in inp


def test_backup_b_uses_pass_b_of_backup_area():
    # maximos.pass_b = seniorityLevelIds → backup_b debe traer seniority, no jobTitles
    inp = build_pass_input(["u1"], MAXIMOS, "backup_b")
    assert "seniorityLevelIds" in inp
    assert "jobTitles" not in inp


def test_max_per_company_threads_to_max_items():
    inp = build_pass_input(["u1", "u2", "u3"], IT, "A", max_per_company=3)
    assert inp["maxItemsPerCompany"] == 3
    assert inp["maxItems"] == 9
    assert inp["companyBatchMode"] == "one_by_one"
    assert inp["profileScraperMode"] == "Short ($4 per 1k)"
    assert inp["locations"] == ["Spain"]


def test_mixing_jobtitles_and_seniority_raises():
    bad = {"locations": ["Spain"], "pass_a": {"jobTitles": ["CEO"], "seniorityLevelIds": ["310"]}}
    with pytest.raises(ValueError):
        build_pass_input(["u1"], bad, "A")
