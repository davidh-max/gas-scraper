"""Paso 4 — teléfono + cumplimiento RGPD (STUB en esta tanda).

Solo firmas. La lógica de obtención del número, cruce con la Lista Robinson y la
determinación de la base legal se diseña en una sesión posterior.
"""

from __future__ import annotations

from .models import Contact, Phone, RobinsonStatus


def enrich_phone(contact: Contact) -> Phone | None:
    """Devuelve un `Phone` para el contacto (o None si no se encuentra). STUB.

    # TODO(paso-4): obtener el número (proveedor de enriquecimiento / fuentes
    #   públicas), clasificar el tipo (mobile/landline/switchboard) y registrar la
    #   `source`. Por ahora no enriquece nada (la columna Teléfono sale vacía).
    """
    return None


def check_robinson(number: str) -> RobinsonStatus:
    """Cruza el número con la Lista Robinson. STUB.

    # TODO(paso-4): integrar el cruce con la Lista Robinson (excluye a quien se
    #   haya dado de baja). Devuelve `listed` para bloquear la llamada.
    """
    return RobinsonStatus.unknown


def legal_basis_for(contact: Contact) -> str | None:
    """Determina la base legal RGPD para contactar. STUB.

    # TODO(paso-4): documentar la base legal (p.ej. interés legítimo B2B) y los
    #   requisitos (información previa, derecho de oposición) por cliente/sector.
    """
    return None
