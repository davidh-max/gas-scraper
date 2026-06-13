"""Tests de la clasificación determinista, parametrizada por area_profiles.params."""

import pytest

from worker.pipeline.area_profiles import DEFAULT_AREA_PROFILES
from worker.pipeline.classify import classify
from worker.pipeline.models import Classification

IT_CFG = DEFAULT_AREA_PROFILES["it"]["params"]["classify"]
MAX_CFG = DEFAULT_AREA_PROFILES["maximos"]["params"]["classify"]


@pytest.mark.parametrize(
    "title,expected",
    [
        ("Chief Information Officer", Classification.decisor),
        ("CTO", Classification.decisor),
        ("CIO", Classification.decisor),
        ("Director de Sistemas", Classification.decisor),
        ("Director de Tecnología", Classification.decisor),
        ("Head of IT", Classification.decisor),
        ("IT Director", Classification.decisor),
        ("VP of Engineering", Classification.decisor),  # fallback liderazgo + dominio
        ("Marketing Manager", Classification.revisar),
        ("IT Sales Manager", Classification.revisar),   # 'sales' manda
        ("UX Designer", Classification.revisar),
        ("Recruiter", Classification.revisar),
        ("", Classification.revisar),
    ],
)
def test_classify_it(title, expected):
    assert classify(title, IT_CFG) == expected


@pytest.mark.parametrize(
    "title,expected",
    [
        ("CEO", Classification.decisor),
        ("Chief Executive Officer", Classification.decisor),
        ("Director General", Classification.decisor),
        ("Consejero Delegado", Classification.decisor),
        ("Founder & CTO", Classification.decisor),       # señal fuerte gana al 'cto'
        ("Owner", Classification.decisor),
        ("Propietario", Classification.decisor),
        ("Presidente Ejecutivo", Classification.decisor),
        ("Gerente de franquicia", Classification.revisar),
        ("Store Manager", Classification.revisar),
        ("Franquiciado", Classification.revisar),
        ("Consejero", Classification.revisar),           # consejero a secas
        ("Presidente del Consejo de Administración", Classification.revisar),
        ("CFO", Classification.revisar),
        ("Vicepresidente de Ventas", Classification.revisar),
        ("Director Comercial", Classification.revisar),
    ],
)
def test_classify_maximos(title, expected):
    assert classify(title, MAX_CFG) == expected


def test_classify_is_area_driven():
    """Un mismo cargo cambia de etiqueta según el área (el área es DATO)."""
    # 'CEO' es máximo decisor en 'maximos' pero NO es decisor de IT en 'it'.
    assert classify("CEO", MAX_CFG) == Classification.decisor
    assert classify("CEO", IT_CFG) == Classification.revisar


def test_classify_empty_cfg_defaults_revisar():
    assert classify("CEO", {}) == Classification.revisar
