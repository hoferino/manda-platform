"""
Unit tests for Pydantic AI agent module.
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #1, #2, #3, #4, #5)

Tests:
- Agent creation with different model strings
- Dependency injection via RunContext
- Structured output validation
- Tool execution with mocked dependencies
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import ValidationError

from src.llm.pydantic_agent import (
    AnalysisDependencies,
    create_analysis_agent,
    get_analysis_agent,
)
from src.llm.schemas import (
    FindingResult,
    ChunkClassification,
    BatchAnalysisResult,
)


class TestAnalysisDependencies:
    """Test the AnalysisDependencies dataclass."""

    def test_dependencies_creation(self):
        """Test creating dependencies with all required fields."""
        mock_db = MagicMock()
        deps = AnalysisDependencies(
            db=mock_db,
            graphiti=None,
            deal_id="deal-123",
            document_id="doc-456",
            document_name="test.pdf",
        )

        assert deps.db == mock_db
        assert deps.graphiti is None
        assert deps.deal_id == "deal-123"
        assert deps.document_id == "doc-456"
        assert deps.document_name == "test.pdf"

    def test_dependencies_optional_graphiti(self):
        """Test dependencies work with optional Graphiti client."""
        mock_db = MagicMock()
        mock_graphiti = MagicMock()

        deps = AnalysisDependencies(
            db=mock_db,
            graphiti=mock_graphiti,
            deal_id="deal-123",
            document_id="doc-456",
        )

        assert deps.graphiti == mock_graphiti

    def test_dependencies_default_document_name(self):
        """Test default empty string for document_name."""
        deps = AnalysisDependencies(
            db=MagicMock(),
            graphiti=None,
            deal_id="deal-123",
            document_id="doc-456",
        )

        assert deps.document_name == ""


class TestFindingResult:
    """Test the FindingResult Pydantic model."""

    def test_finding_result_valid(self):
        """Test creating a valid FindingResult."""
        finding = FindingResult(
            content="Revenue was $5.2M in Q3",
            finding_type="metric",
            confidence=0.92,
            source_reference={"page_number": 12},
        )

        assert finding.content == "Revenue was $5.2M in Q3"
        assert finding.finding_type == "metric"
        assert finding.confidence == 0.92
        assert finding.source_reference == {"page_number": 12}

    def test_finding_result_all_types(self):
        """Test all valid finding types."""
        valid_types = ["fact", "metric", "risk", "opportunity", "assumption"]

        for finding_type in valid_types:
            finding = FindingResult(
                content="Test content",
                finding_type=finding_type,
                confidence=0.5,
                source_reference={},
            )
            assert finding.finding_type == finding_type

    def test_finding_result_invalid_type(self):
        """Test that invalid finding_type raises ValidationError."""
        with pytest.raises(ValidationError):
            FindingResult(
                content="Test",
                finding_type="invalid_type",
                confidence=0.5,
                source_reference={},
            )

    def test_finding_result_confidence_bounds(self):
        """Test confidence must be between 0.0 and 1.0."""
        # Valid bounds
        FindingResult(
            content="Test",
            finding_type="fact",
            confidence=0.0,
            source_reference={},
        )
        FindingResult(
            content="Test",
            finding_type="fact",
            confidence=1.0,
            source_reference={},
        )

        # Invalid: below 0
        with pytest.raises(ValidationError):
            FindingResult(
                content="Test",
                finding_type="fact",
                confidence=-0.1,
                source_reference={},
            )

        # Invalid: above 1
        with pytest.raises(ValidationError):
            FindingResult(
                content="Test",
                finding_type="fact",
                confidence=1.1,
                source_reference={},
            )


class TestChunkClassification:
    """Test the ChunkClassification Pydantic model."""

    def test_classification_valid(self):
        """Test creating a valid ChunkClassification."""
        classification = ChunkClassification(
            is_financial=True,
            content_type="financial",
            confidence=0.85,
        )

        assert classification.is_financial is True
        assert classification.content_type == "financial"
        assert classification.confidence == 0.85

    def test_classification_all_types(self):
        """Test all valid content types."""
        valid_types = ["financial", "operational", "legal", "other"]

        for content_type in valid_types:
            classification = ChunkClassification(
                is_financial=False,
                content_type=content_type,
                confidence=0.5,
            )
            assert classification.content_type == content_type


class TestBatchAnalysisResult:
    """Test the BatchAnalysisResult Pydantic model."""

    def test_batch_result_empty(self):
        """Test empty batch result."""
        result = BatchAnalysisResult(
            findings=[],
            tokens_used=0,
        )

        assert result.findings == []
        assert result.tokens_used == 0

    def test_batch_result_with_findings(self):
        """Test batch result with multiple findings."""
        findings = [
            FindingResult(
                content="Finding 1",
                finding_type="fact",
                confidence=0.9,
                source_reference={"page": 1},
            ),
            FindingResult(
                content="Finding 2",
                finding_type="metric",
                confidence=0.85,
                source_reference={"page": 2},
            ),
        ]

        result = BatchAnalysisResult(
            findings=findings,
            tokens_used=1500,
        )

        assert len(result.findings) == 2
        assert result.tokens_used == 1500


class TestCreateAnalysisAgent:
    """Test the create_analysis_agent factory function."""

    @patch("src.llm.pydantic_agent.get_settings")
    def test_agent_creation_default_model(self, mock_settings):
        """Test agent creation with default model from config."""
        # Use google-gla provider (correct Pydantic AI 1.x format)
        mock_settings.return_value.pydantic_ai_extraction_model = "google-gla:gemini-2.5-flash"

        # Agent creation requires API key - skip if not available
        try:
            agent = create_analysis_agent()
            assert agent is not None
            assert agent.deps_type == AnalysisDependencies
        except Exception as e:
            if "api_key" in str(e).lower() or "GOOGLE" in str(e):
                pytest.skip("Google API key not configured")
            raise

    @patch("src.llm.pydantic_agent.get_settings")
    def test_agent_creation_anthropic_model(self, mock_settings):
        """Test agent creation with Anthropic model string."""
        mock_settings.return_value.pydantic_ai_extraction_model = "anthropic:claude-sonnet-4-0"

        try:
            agent = create_analysis_agent(model="anthropic:claude-sonnet-4-0")
            assert agent is not None
        except Exception as e:
            if "api_key" in str(e).lower() or "ANTHROPIC" in str(e):
                pytest.skip("Anthropic API key not configured")
            raise


class TestGetAnalysisAgent:
    """Test the get_analysis_agent singleton function."""

    @patch("src.llm.pydantic_agent._default_agent", None)
    @patch("src.llm.pydantic_agent.get_settings")
    def test_singleton_creation(self, mock_settings):
        """Test that get_analysis_agent returns singleton."""
        mock_settings.return_value.pydantic_ai_extraction_model = "google-gla:gemini-2.5-flash"

        try:
            agent1 = get_analysis_agent()
            agent2 = get_analysis_agent()
            # Should return same instance
            assert agent1 is agent2
        except Exception as e:
            if "api_key" in str(e).lower() or "GOOGLE" in str(e):
                pytest.skip("Google API key not configured")
            raise


class TestModelStringSyntax:
    """Test model string syntax for different providers."""

    @pytest.mark.parametrize(
        "model_string,requires_key",
        [
            ("google-gla:gemini-2.5-flash", "GOOGLE"),
            ("google-gla:gemini-2.5-pro", "GOOGLE"),
            ("anthropic:claude-sonnet-4-0", "ANTHROPIC"),
            ("openai:gpt-4-turbo", "OPENAI"),
        ],
    )
    @patch("src.llm.pydantic_agent.get_settings")
    def test_model_string_formats(self, mock_settings, model_string, requires_key):
        """Test that various model string formats are accepted."""
        mock_settings.return_value.pydantic_ai_extraction_model = model_string

        try:
            agent = create_analysis_agent(model=model_string)
            assert agent is not None
        except Exception as e:
            if "api_key" in str(e).lower() or requires_key in str(e):
                pytest.skip(f"{requires_key} API key not configured")
            raise
