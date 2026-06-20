"""Modelos Pydantic — espejo de las 11 tablas de `supabase/schema_v2.sql`.

Mantener en sincronía con `web/src/types/db.ts` y el esquema SQL. Los `id` y
`created_at` son opcionales para que un mismo modelo sirva tanto para una fila ya
persistida (con id) como para una a insertar (sin id; los rellena Postgres).

Las **FKs** (`job_id`, `company_id`, `contact_id`) también se declaran opcionales a
propósito: en modo CLI (sin BD) no hay job y nunca se persisten. En el SQL son
`NOT NULL`, así que ANTES de insertar deben estar presentes — el worker lo garantiza
(las companies vienen de la BD con `job_id`, y cada contact toma `company_id`/`job_id`
de su empresa) y `worker.main.insert_contacts` añade una guarda anti-huérfanos.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- enums


class JobStatus(str, Enum):
    queued = "queued"
    resolving = "resolving"
    searching = "searching"
    verifying = "verifying"
    enriching = "enriching"
    done = "done"
    error = "error"
    cancelled = "cancelled"


class CompanyStatus(str, Enum):
    pending = "pending"
    resolved = "resolved"
    no_url = "no_url"
    searching = "searching"
    done = "done"
    no_result = "no_result"
    error = "error"


class SourcePass(str, Enum):
    A = "A"
    B = "B"
    fallback = "fallback"


class Classification(str, Enum):
    decisor = "decisor"
    revisar = "revisar"


class ContactStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    discarded = "discarded"


class ResolutionMethod(str, Enum):
    provided = "provided"
    cache = "cache"
    domain_guess = "domain_guess"
    serp = "serp"
    manual = "manual"
    llm_web = "llm_web"  # URL corregida por Gemini (OpenRouter + web search)
    unresolved = "unresolved"


class VerificationMethod(str, Enum):
    heuristic = "heuristic"
    profile_rescrape = "profile_rescrape"
    llm_web = "llm_web"


class VerificationVerdict(str, Enum):
    confirmed = "confirmed"
    uncertain = "uncertain"
    rejected = "rejected"


class RobinsonStatus(str, Enum):
    unknown = "unknown"
    clean = "clean"
    listed = "listed"
    error = "error"


# --------------------------------------------------------------------------- tablas


class Client(BaseModel):
    id: str | None = None
    name: str
    slug: str
    active: bool = True
    created_at: datetime | None = None


class Profile(BaseModel):
    id: str | None = None
    email: str | None = None
    full_name: str | None = None
    role: str = "operator"
    client_id: str | None = None
    created_at: datetime | None = None


class AreaProfile(BaseModel):
    id: str | None = None
    key: str
    name: str
    description: str | None = None
    params: dict = Field(default_factory=dict)
    active: bool = True
    created_at: datetime | None = None


class Job(BaseModel):
    id: str | None = None
    client_id: str
    area_profile_id: str
    backup_area_profile_id: str | None = None
    name: str | None = None
    status: JobStatus = JobStatus.queued
    use_fixtures: bool = False
    reception_only: bool = False
    total_companies: int = 0
    resolved_companies: int = 0
    total_contacts: int = 0
    decisor_count: int = 0
    revisar_count: int = 0
    no_result_count: int = 0
    result_path: str | None = None
    estimated_cost_usd: float | None = None
    error_message: str | None = None
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class Company(BaseModel):
    id: str | None = None
    job_id: str | None = None
    raw_input: str
    razon_social: str | None = None
    cif: str | None = None
    domain: str | None = None
    linkedin_url: str | None = None
    resolution_method: ResolutionMethod = ResolutionMethod.unresolved
    resolution_confidence: float | None = None
    linkedin_company_id: str | None = None
    status: CompanyStatus = CompanyStatus.pending
    note: str | None = None
    created_at: datetime | None = None


class Contact(BaseModel):
    id: str | None = None
    job_id: str | None = None
    company_id: str | None = None
    source_pass: SourcePass
    first_name: str | None = None
    last_name: str | None = None
    title: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    company_linkedin_url: str | None = None
    classification: Classification = Classification.revisar
    heuristic_score: float | None = None
    verify_flag: str | None = None
    status: ContactStatus = ContactStatus.pending
    created_at: datetime | None = None


class Verification(BaseModel):
    id: str | None = None
    contact_id: str | None = None
    method: VerificationMethod
    verdict: VerificationVerdict
    confidence: float | None = None
    signal_json: dict = Field(default_factory=dict)
    cost: float = 0.0
    created_at: datetime | None = None


class Phone(BaseModel):
    id: str | None = None
    contact_id: str | None = None
    number: str | None = None
    type: str | None = None
    source: str | None = None
    robinson_status: RobinsonStatus = RobinsonStatus.unknown
    legal_basis: str | None = None
    created_at: datetime | None = None


class JobEvent(BaseModel):
    id: str | None = None
    job_id: str | None = None
    from_status: JobStatus | None = None
    to_status: JobStatus | None = None
    message: str | None = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime | None = None


class CompanyUrlCache(BaseModel):
    id: str | None = None
    cache_key: str
    linkedin_url: str | None = None
    linkedin_company_id: str | None = None
    resolution_method: ResolutionMethod = ResolutionMethod.unresolved
    resolution_confidence: float | None = None
    created_at: datetime | None = None
    expires_at: datetime | None = None


class VerificationCache(BaseModel):
    id: str | None = None
    cache_key: str
    method: VerificationMethod
    verdict: VerificationVerdict
    confidence: float | None = None
    signal_json: dict = Field(default_factory=dict)
    cost: float = 0.0
    created_at: datetime | None = None
    expires_at: datetime | None = None
