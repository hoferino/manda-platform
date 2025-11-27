"""
Pydantic models for findings extracted from document analysis.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #3)

This module provides:
- Finding model with all required fields
- FindingType and Domain enums
- SourceReference model for source attribution
- ExtractionResult for batch extraction output
- Validation for confidence scores (0-100 range)
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class FindingType(str, Enum):
    """Type of finding extracted from documents."""

    METRIC = "metric"  # Quantitative data (revenue, margins, growth rates)
    FACT = "fact"  # Qualitative statements (history, products, customers)
    RISK = "risk"  # Potential concerns or red flags
    OPPORTUNITY = "opportunity"  # Growth potential or positive indicators
    CONTRADICTION = "contradiction"  # Conflicts with other information


class Domain(str, Enum):
    """Business domain classification for findings."""

    FINANCIAL = "financial"  # Revenue, costs, profitability, cash flow
    OPERATIONAL = "operational"  # Processes, efficiency, capacity
    MARKET = "market"  # Industry, competition, market position
    LEGAL = "legal"  # Contracts, compliance, litigation
    TECHNICAL = "technical"  # Technology, systems, infrastructure


class ValidationStatus(str, Enum):
    """Validation status for findings."""

    PENDING = "pending"  # Not yet validated
    VALIDATED = "validated"  # Confirmed by user/analyst
    REJECTED = "rejected"  # Marked as incorrect


class SourceReference(BaseModel):
    """Source attribution for a finding."""

    page: Optional[int] = Field(None, description="Page number in document")
    sheet: Optional[str] = Field(None, description="Sheet name for Excel documents")
    cell: Optional[str] = Field(None, description="Cell reference for Excel")
    line_number: Optional[int] = Field(None, description="Line number in text")
    section: Optional[str] = Field(None, description="Section heading if identifiable")
    context: Optional[str] = Field(
        None, description="Brief quote or context from source"
    )

    model_config = {"extra": "allow"}


class FindingCreate(BaseModel):
    """Schema for creating a new finding."""

    content: str = Field(..., min_length=1, description="The extracted finding text")
    finding_type: FindingType = Field(..., description="Type of finding")
    domain: Domain = Field(..., description="Business domain")
    confidence_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="Confidence score from LLM (0-100)",
    )
    source_reference: SourceReference = Field(
        default_factory=SourceReference,
        description="Source attribution",
    )
    chunk_id: Optional[UUID] = Field(
        None, description="ID of source chunk (if single chunk)"
    )
    metadata: dict = Field(default_factory=dict, description="Additional metadata")

    @field_validator("confidence_score")
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        """Ensure confidence score is in valid range."""
        if not 0 <= v <= 100:
            raise ValueError("confidence_score must be between 0 and 100")
        return round(v, 2)


class Finding(FindingCreate):
    """Full finding model including IDs and timestamps."""

    id: UUID = Field(..., description="Unique finding ID")
    project_id: UUID = Field(..., description="Parent project ID")
    document_id: UUID = Field(..., description="Source document ID")
    validation_status: ValidationStatus = Field(
        default=ValidationStatus.PENDING,
        description="Validation status",
    )
    validated_by: Optional[UUID] = Field(
        None, description="User who validated (if any)"
    )
    validated_at: Optional[datetime] = Field(
        None, description="When validated (if validated)"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Creation timestamp",
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Last update timestamp",
    )


class ExtractionResult(BaseModel):
    """Result of extracting findings from a document or batch."""

    findings: list[FindingCreate] = Field(
        default_factory=list,
        description="Extracted findings",
    )
    document_id: Optional[UUID] = Field(None, description="Source document ID")
    total_chunks_processed: int = Field(
        0, description="Number of chunks analyzed"
    )
    input_tokens: int = Field(0, description="Total input tokens used")
    output_tokens: int = Field(0, description="Total output tokens used")
    model_used: str = Field("gemini-2.5-flash", description="Model used for extraction")
    processing_time_ms: int = Field(0, description="Processing time in milliseconds")
    errors: list[str] = Field(
        default_factory=list,
        description="Any errors encountered during extraction",
    )

    @property
    def success_rate(self) -> float:
        """Calculate success rate based on errors."""
        if self.total_chunks_processed == 0:
            return 1.0
        error_count = len(self.errors)
        return 1.0 - (error_count / self.total_chunks_processed)

    @property
    def finding_count(self) -> int:
        """Number of findings extracted."""
        return len(self.findings)


def finding_from_dict(
    data: dict,
    project_id: UUID,
    document_id: UUID,
    chunk_id: Optional[UUID] = None,
) -> FindingCreate:
    """
    Convert a dict from LLM response to FindingCreate model.

    Args:
        data: Dict with finding data from LLM
        project_id: Parent project ID
        document_id: Source document ID
        chunk_id: Source chunk ID (optional)

    Returns:
        FindingCreate model instance
    """
    # Normalize finding_type
    finding_type_str = data.get("finding_type", "fact").lower()
    try:
        finding_type = FindingType(finding_type_str)
    except ValueError:
        finding_type = FindingType.FACT

    # Normalize domain
    domain_str = data.get("domain", "operational").lower()
    try:
        domain = Domain(domain_str)
    except ValueError:
        domain = Domain.OPERATIONAL

    # Normalize confidence score
    confidence = data.get("confidence_score", 70)
    if isinstance(confidence, str):
        try:
            confidence = float(confidence)
        except ValueError:
            confidence = 70
    confidence = max(0, min(100, float(confidence)))

    # Build source reference
    source_ref_data = data.get("source_reference", {})
    if not isinstance(source_ref_data, dict):
        source_ref_data = {}

    source_reference = SourceReference(
        page=source_ref_data.get("page"),
        sheet=source_ref_data.get("sheet"),
        cell=source_ref_data.get("cell"),
        line_number=source_ref_data.get("line_number"),
        section=source_ref_data.get("section"),
        context=source_ref_data.get("context"),
    )

    # Use chunk_id from data if not provided as argument
    actual_chunk_id = chunk_id or data.get("chunk_id")
    if actual_chunk_id and isinstance(actual_chunk_id, str):
        try:
            actual_chunk_id = UUID(actual_chunk_id)
        except ValueError:
            actual_chunk_id = None

    return FindingCreate(
        content=data.get("content", ""),
        finding_type=finding_type,
        domain=domain,
        confidence_score=confidence,
        source_reference=source_reference,
        chunk_id=actual_chunk_id,
        metadata=data.get("metadata", {}),
    )


__all__ = [
    "FindingType",
    "Domain",
    "ValidationStatus",
    "SourceReference",
    "FindingCreate",
    "Finding",
    "ExtractionResult",
    "finding_from_dict",
]
