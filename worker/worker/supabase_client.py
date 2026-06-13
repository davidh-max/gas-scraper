"""Cliente de Supabase con la clave service_role (el worker salta RLS).

Aísla la dependencia de `supabase` para que el resto del worker reciba un cliente
ya configurado. No contiene lógica de negocio.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Devuelve un cliente Supabase (service_role). Cachéado por proceso."""
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY vacío. Rellena worker/.env (ver .env.example)."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
