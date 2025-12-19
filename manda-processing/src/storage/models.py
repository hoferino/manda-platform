"""
Storage models for multi-tenant data isolation and usage tracking.
Story: E12.9 - Multi-Tenant Data Isolation (AC: #1, #2)
Story: E12.1 - Usage Tracking Database Schema (AC: #5)

This module provides Pydantic models for:
- Organization: Multi-tenant organization entity
- OrganizationMember: User membership in organizations
- OrganizationContext: Request context for org-scoped operations
- LlmUsage: LLM API usage tracking for cost visibility
- FeatureUsage: Feature-level metrics for performance analysis
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class Organization(BaseModel):
    """Organization for multi-tenant isolation."""

    id: UUID
    name: str
    slug: str = Field(..., pattern=r"^[a-z0-9-]+$", min_length=3)
    created_at: datetime
    created_by: UUID | None = None


class OrganizationMember(BaseModel):
    """User membership in an organization."""

    id: UUID
    organization_id: UUID
    user_id: UUID
    role: Literal["superadmin", "admin", "member"] = "member"
    created_at: datetime


class OrganizationContext(BaseModel):
    """Context for org-scoped operations.

    Used throughout the application to carry validated organization
    context through request processing.
    """

    organization_id: UUID
    user_id: UUID
    role: Literal["superadmin", "admin", "member"]

    def is_superadmin(self) -> bool:
        """Check if the user has superadmin privileges."""
        return self.role == "superadmin"

    def is_admin_or_above(self) -> bool:
        """Check if the user has admin or superadmin privileges."""
        return self.role in ("superadmin", "admin")


# ============================================================
# Usage Tracking Models (E12.1)
# ============================================================


class LLMProvider(str, Enum):
    """LLM provider identifiers."""

    GOOGLE_GLA = "google-gla"
    ANTHROPIC = "anthropic"
    VOYAGE = "voyage"
    OPENAI = "openai"


class LLMFeature(str, Enum):
    """Features that use LLM calls."""

    CHAT = "chat"
    DOCUMENT_ANALYSIS = "document_analysis"
    EXTRACTION = "extraction"
    EMBEDDINGS = "embeddings"
    RERANKING = "reranking"
    CONTRADICTION_DETECTION = "contradiction_detection"
    QA_INGESTION = "qa_ingestion"


class FeatureStatus(str, Enum):
    """Feature execution status."""

    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"


class FeatureName(str, Enum):
    """Feature names for feature_usage tracking."""

    UPLOAD_DOCUMENT = "upload_document"
    CHAT = "chat"
    SEARCH = "search"
    QA_RESPONSE = "qa_response"
    CIM_GENERATION = "cim_generation"
    IRL_GENERATION = "irl_generation"
    DOCUMENT_PROCESSING = "document_processing"
    KNOWLEDGE_RETRIEVAL = "knowledge_retrieval"


class LlmUsage(BaseModel):
    """
    LLM API usage record for cost tracking.

    Story: E12.1 - Usage Tracking Database Schema
    """

    id: UUID
    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    provider: LLMProvider
    model: str
    feature: LLMFeature
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal = Decimal("0")
    latency_ms: int | None = None
    created_at: datetime


class LlmUsageCreate(BaseModel):
    """
    Input for creating LLM usage record.

    Note: id and created_at are auto-generated.
    """

    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    provider: LLMProvider
    model: str
    feature: LLMFeature
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal = Decimal("0")
    latency_ms: int | None = None


class FeatureUsage(BaseModel):
    """
    Feature-level usage record for performance analysis.

    Story: E12.1 - Usage Tracking Database Schema
    """

    id: UUID
    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    feature_name: FeatureName
    status: FeatureStatus
    duration_ms: int | None = None
    error_message: str | None = None
    metadata: dict | None = None
    created_at: datetime


class FeatureUsageCreate(BaseModel):
    """
    Input for creating feature usage record.

    Note: id and created_at are auto-generated.
    """

    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    feature_name: FeatureName
    status: FeatureStatus
    duration_ms: int | None = None
    error_message: str | None = None
    metadata: dict | None = None
