"""Configuración del worker (pydantic-settings, lee `.env`)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno del worker. Ver `.env.example`."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase — el worker usa la service_role y salta RLS.
    supabase_url: str = "https://ftpgnimyjxlomjfdqfqy.supabase.co"
    supabase_service_role_key: str = ""

    # Apify
    apify_token: str = ""
    apify_employees_actor_id: str = "Vb6LZkh4EqRlR0Ka9"
    apify_serp_actor_id: str = ""

    # Storage
    results_bucket: str = "resultados"

    # Loop
    poll_interval_seconds: float = 5.0


def get_settings() -> Settings:
    """Carga (y cachea implícitamente vía import) la configuración."""
    return Settings()
