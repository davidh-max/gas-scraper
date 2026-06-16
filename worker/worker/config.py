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
    apify_company_url_finder_actor_id: str = "9X6Pju8NeHNTvzRxF"
    apify_serp_actor_id: str = ""

    # OpenRouter — validación de la URL de empresa con Gemini + web search (Paso 2)
    # y verificación de decisor por LLM (Paso 3, sin web search).
    # Modelo confirmado en openrouter.ai (Gemini 3.1 Flash Lite Preview).
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "google/gemini-3.1-flash-lite-preview"
    openrouter_app_title: str = "GAS Scraper"
    openrouter_referer: str = ""
    openrouter_web_max_results: int = 3
    # Paso 3 (verify por LLM): la salida es pequeña, así que el techo es bajo.
    verify_llm_max_tokens: int = 400

    # HarvestAPI — REST directa (api.harvest-api.com) para enriquecer UN perfil en
    # el Paso 3 (verify). OJO: clave DISTINTA del APIFY_TOKEN; superficie distinta del
    # Actor de Apify del Paso 2 (búsqueda de empleados). No confundir ni reutilizar.
    harvest_api_key: str = ""
    harvest_api_base_url: str = "https://api.harvest-api.com"

    # Búsqueda de empleados (máx. perfiles por empresa y pasada).
    search_max_per_company: int = 3

    # Storage
    results_bucket: str = "resultados"

    # Loop
    poll_interval_seconds: float = 5.0


def get_settings() -> Settings:
    """Carga (y cachea implícitamente vía import) la configuración."""
    return Settings()
