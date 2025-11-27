"""
Tests for LLM model tier selection logic.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #6)
"""

import pytest

from src.llm.models import (
    ModelTier,
    FINANCIAL_MIME_TYPES,
    select_model_tier,
    get_model_pricing,
    estimate_cost,
)


class TestModelTier:
    """Tests for ModelTier enum."""

    def test_model_tier_flash_value(self) -> None:
        """Test Flash tier value."""
        assert ModelTier.FLASH.value == "gemini-2.5-flash"

    def test_model_tier_pro_value(self) -> None:
        """Test Pro tier value."""
        assert ModelTier.PRO.value == "gemini-2.5-pro"

    def test_model_tier_lite_value(self) -> None:
        """Test Lite tier value."""
        assert ModelTier.LITE.value == "gemini-2.5-flash-lite"


class TestFinancialMimeTypes:
    """Tests for financial MIME type detection."""

    def test_xlsx_is_financial(self) -> None:
        """Test XLSX is in financial types."""
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in FINANCIAL_MIME_TYPES

    def test_xls_is_financial(self) -> None:
        """Test XLS is in financial types."""
        assert "application/vnd.ms-excel" in FINANCIAL_MIME_TYPES

    def test_pdf_is_not_financial(self) -> None:
        """Test PDF is not in financial types."""
        assert "application/pdf" not in FINANCIAL_MIME_TYPES


class TestSelectModelTier:
    """Tests for model tier selection logic."""

    def test_standard_pdf_returns_flash(self) -> None:
        """Test that standard PDF uses Flash model."""
        tier = select_model_tier("application/pdf")
        assert tier == ModelTier.FLASH

    def test_xlsx_returns_pro(self) -> None:
        """Test that Excel documents use Pro model."""
        tier = select_model_tier(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert tier == ModelTier.PRO

    def test_deep_analysis_returns_pro(self) -> None:
        """Test that deep analysis flag forces Pro model."""
        tier = select_model_tier("application/pdf", analysis_depth="deep")
        assert tier == ModelTier.PRO

    def test_batch_analysis_returns_lite(self) -> None:
        """Test that batch analysis uses Lite model."""
        tier = select_model_tier("application/pdf", analysis_depth="batch")
        assert tier == ModelTier.LITE

    def test_unknown_type_returns_flash(self) -> None:
        """Test that unknown MIME type defaults to Flash."""
        tier = select_model_tier("text/plain")
        assert tier == ModelTier.FLASH

    def test_docx_returns_flash(self) -> None:
        """Test that DOCX uses Flash (not Pro)."""
        tier = select_model_tier(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        assert tier == ModelTier.FLASH


class TestGetModelPricing:
    """Tests for model pricing information."""

    def test_flash_pricing(self) -> None:
        """Test Flash model pricing."""
        pricing = get_model_pricing(ModelTier.FLASH)
        assert pricing["input"] == 0.30
        assert pricing["output"] == 2.50

    def test_pro_pricing(self) -> None:
        """Test Pro model pricing."""
        pricing = get_model_pricing(ModelTier.PRO)
        assert pricing["input"] == 1.25
        assert pricing["output"] == 10.00

    def test_lite_pricing(self) -> None:
        """Test Lite model pricing."""
        pricing = get_model_pricing(ModelTier.LITE)
        assert pricing["input"] == 0.10
        assert pricing["output"] == 0.40


class TestEstimateCost:
    """Tests for cost estimation."""

    def test_flash_cost_calculation(self) -> None:
        """Test cost calculation for Flash model."""
        cost = estimate_cost(
            tier=ModelTier.FLASH,
            input_tokens=1_000_000,
            output_tokens=100_000,
        )
        # 1M input @ $0.30 + 100K output @ $2.50
        expected = 0.30 + 0.25
        assert cost == pytest.approx(expected, rel=0.01)

    def test_pro_cost_calculation(self) -> None:
        """Test cost calculation for Pro model."""
        cost = estimate_cost(
            tier=ModelTier.PRO,
            input_tokens=1_000_000,
            output_tokens=100_000,
        )
        # 1M input @ $1.25 + 100K output @ $10.00
        expected = 1.25 + 1.00
        assert cost == pytest.approx(expected, rel=0.01)

    def test_zero_tokens_returns_zero(self) -> None:
        """Test that zero tokens returns zero cost."""
        cost = estimate_cost(
            tier=ModelTier.FLASH,
            input_tokens=0,
            output_tokens=0,
        )
        assert cost == 0.0

    def test_small_token_count(self) -> None:
        """Test cost for small token counts."""
        cost = estimate_cost(
            tier=ModelTier.FLASH,
            input_tokens=1000,
            output_tokens=500,
        )
        # 1K input @ $0.30/M + 500 output @ $2.50/M
        expected = 0.0003 + 0.00125
        assert cost == pytest.approx(expected, rel=0.01)
