"""Unit tests for E12.1 usage tracking models."""
import pytest
from decimal import Decimal
from datetime import datetime
from uuid import uuid4
from pydantic import ValidationError

from src.storage.models import (
    LLMProvider,
    LLMFeature,
    FeatureStatus,
    FeatureName,
    LlmUsage,
    LlmUsageCreate,
    FeatureUsage,
    FeatureUsageCreate,
)


class TestLlmUsageModels:
    """Test LLM usage Pydantic models."""

    def test_llm_usage_create_valid(self):
        """Valid LlmUsageCreate should pass validation."""
        usage = LlmUsageCreate(
            deal_id=uuid4(),
            user_id=uuid4(),
            organization_id=uuid4(),
            provider=LLMProvider.GOOGLE_GLA,
            model="gemini-2.5-flash",
            feature=LLMFeature.CHAT,
            input_tokens=1000,
            output_tokens=500,
            cost_usd=Decimal("0.0015"),
            latency_ms=1234,
        )
        assert usage.provider == LLMProvider.GOOGLE_GLA
        assert usage.input_tokens == 1000
        assert usage.cost_usd == Decimal("0.0015")

    def test_llm_usage_create_minimal(self):
        """LlmUsageCreate with only required fields."""
        usage = LlmUsageCreate(
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-0",
            feature=LLMFeature.DOCUMENT_ANALYSIS,
        )
        assert usage.deal_id is None
        assert usage.input_tokens == 0
        assert usage.cost_usd == Decimal("0")

    def test_llm_usage_full_model(self):
        """Full LlmUsage model with id and created_at."""
        usage = LlmUsage(
            id=uuid4(),
            provider=LLMProvider.VOYAGE,
            model="voyage-3.5",
            feature=LLMFeature.EMBEDDINGS,
            input_tokens=5000,
            output_tokens=0,
            cost_usd=Decimal("0.0003"),
            created_at=datetime.now(),
        )
        assert usage.id is not None
        assert usage.created_at is not None

    def test_llm_provider_values(self):
        """Verify LLMProvider enum values."""
        assert LLMProvider.GOOGLE_GLA.value == "google-gla"
        assert LLMProvider.ANTHROPIC.value == "anthropic"
        assert LLMProvider.VOYAGE.value == "voyage"
        assert LLMProvider.OPENAI.value == "openai"

    def test_llm_feature_values(self):
        """Verify LLMFeature enum values."""
        assert LLMFeature.CHAT.value == "chat"
        assert LLMFeature.EMBEDDINGS.value == "embeddings"
        assert LLMFeature.RERANKING.value == "reranking"


class TestFeatureUsageModels:
    """Test feature usage Pydantic models."""

    def test_feature_usage_create_success(self):
        """FeatureUsageCreate for successful operation."""
        usage = FeatureUsageCreate(
            deal_id=uuid4(),
            feature_name=FeatureName.UPLOAD_DOCUMENT,
            status=FeatureStatus.SUCCESS,
            duration_ms=5432,
            metadata={"document_count": 3, "total_bytes": 1024000},
        )
        assert usage.status == FeatureStatus.SUCCESS
        assert usage.error_message is None
        assert usage.metadata["document_count"] == 3

    def test_feature_usage_create_error(self):
        """FeatureUsageCreate for failed operation."""
        usage = FeatureUsageCreate(
            feature_name=FeatureName.CHAT,
            status=FeatureStatus.ERROR,
            error_message="Rate limit exceeded",
            metadata={"retry_count": 3},
        )
        assert usage.status == FeatureStatus.ERROR
        assert "Rate limit" in usage.error_message

    def test_feature_usage_create_timeout(self):
        """FeatureUsageCreate for timeout."""
        usage = FeatureUsageCreate(
            feature_name=FeatureName.SEARCH,
            status=FeatureStatus.TIMEOUT,
            duration_ms=30000,
        )
        assert usage.status == FeatureStatus.TIMEOUT
        assert usage.duration_ms == 30000

    def test_feature_status_values(self):
        """Verify FeatureStatus enum values."""
        assert FeatureStatus.SUCCESS.value == "success"
        assert FeatureStatus.ERROR.value == "error"
        assert FeatureStatus.TIMEOUT.value == "timeout"

    def test_feature_name_values(self):
        """Verify FeatureName enum values."""
        assert FeatureName.UPLOAD_DOCUMENT.value == "upload_document"
        assert FeatureName.CHAT.value == "chat"
        assert FeatureName.KNOWLEDGE_RETRIEVAL.value == "knowledge_retrieval"


class TestValidationErrors:
    """Test validation error handling."""

    def test_invalid_llm_provider_rejected(self):
        """Invalid LLM provider should raise ValidationError."""
        with pytest.raises(ValidationError):
            LlmUsageCreate(
                provider="invalid-provider",  # type: ignore
                model="test-model",
                feature=LLMFeature.CHAT,
            )

    def test_invalid_llm_feature_rejected(self):
        """Invalid LLM feature should raise ValidationError."""
        with pytest.raises(ValidationError):
            LlmUsageCreate(
                provider=LLMProvider.GOOGLE_GLA,
                model="test-model",
                feature="invalid-feature",  # type: ignore
            )

    def test_invalid_feature_name_rejected(self):
        """Invalid feature name should raise ValidationError."""
        with pytest.raises(ValidationError):
            FeatureUsageCreate(
                feature_name="invalid_feature",  # type: ignore
                status=FeatureStatus.SUCCESS,
            )

    def test_invalid_feature_status_rejected(self):
        """Invalid feature status should raise ValidationError."""
        with pytest.raises(ValidationError):
            FeatureUsageCreate(
                feature_name=FeatureName.CHAT,
                status="invalid_status",  # type: ignore
            )
