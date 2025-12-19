"""
Pydantic models for structured LLM outputs.
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2)

These models guarantee validated, typed responses from the Pydantic AI agent.
Using Pydantic models as result_type ensures the LLM output matches the schema.
"""

from typing import Literal

from pydantic import BaseModel, Field


class FindingResult(BaseModel):
    """
    Structured finding extracted from document analysis.

    Used as result_type for Pydantic AI agent to guarantee structured output.
    """

    content: str = Field(
        description="The actual finding text extracted from the document"
    )
    finding_type: Literal["fact", "metric", "risk", "opportunity", "assumption"] = Field(
        description="Classification of the finding type"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 to 1.0 based on source clarity",
    )
    source_reference: dict = Field(
        default_factory=dict,
        description="Source location info: page_number, chunk_id, etc.",
    )


class ChunkClassification(BaseModel):
    """
    Classification result for a document chunk.

    Used to prioritize chunks for extraction based on content type.
    """

    is_financial: bool = Field(
        description="Whether the chunk contains financial data"
    )
    content_type: Literal["financial", "operational", "legal", "other"] = Field(
        description="Primary content type classification"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the classification",
    )


class BatchAnalysisResult(BaseModel):
    """
    Aggregated result of batch document analysis.

    Contains all findings from analyzing multiple chunks plus usage metrics.
    """

    findings: list[FindingResult] = Field(
        default_factory=list,
        description="List of findings extracted from the batch",
    )
    tokens_used: int = Field(
        default=0,
        description="Total tokens consumed in the batch analysis",
    )


__all__ = [
    "FindingResult",
    "ChunkClassification",
    "BatchAnalysisResult",
]
