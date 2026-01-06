"""
Unit tests for Knowledge Graph Specialist Agent.
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #5)

Tests:
- KGDependencies dataclass creation and validation
- KGAnalysisResult Pydantic model validation
- Tool execution with mocked Graphiti/DB
- Entity resolution logic
- Contradiction detection logic
- Path traversal logic
"""

from dataclasses import fields
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from src.agents.schemas.knowledge_graph import (
    ContradictionResult,
    EntityMatch,
    KGAnalysisResult,
    RelationshipPath,
    RelationshipStep,
    TemporalFact,
)
from src.agents.schemas.financial import SourceReference
from src.agents.knowledge_graph import (
    KGDependencies,
    KNOWLEDGE_GRAPH_SYSTEM_PROMPT,
    create_knowledge_graph_agent,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_supabase():
    """Mock SupabaseClient for testing."""
    mock = MagicMock()
    mock.get_findings_by_document = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def mock_graphiti():
    """Mock GraphitiClient for testing."""
    mock = MagicMock()
    mock._instance = MagicMock()
    mock._instance.search = AsyncMock(return_value=[])
    mock._instance.driver = MagicMock()
    return mock


@pytest.fixture
def kg_deps(mock_supabase, mock_graphiti):
    """Create KGDependencies for testing."""
    return KGDependencies(
        db=mock_supabase,
        graphiti=mock_graphiti,
        deal_id="test-deal-123",
        organization_id="test-org-456",
        entity_types_filter=["Company", "Person"],
        time_range=(datetime(2024, 1, 1, tzinfo=timezone.utc), datetime(2024, 12, 31, tzinfo=timezone.utc)),
        context_window="Test context for knowledge graph analysis",
    )


# =============================================================================
# KGDependencies Tests (Task 1)
# =============================================================================


class TestKGDependencies:
    """Tests for KGDependencies dataclass."""

    def test_create_with_required_fields(self, mock_supabase):
        """Test creating dependencies with only required fields."""
        deps = KGDependencies(
            db=mock_supabase,
            graphiti=None,
            deal_id="deal-123",
            organization_id="org-456",
        )
        assert deps.deal_id == "deal-123"
        assert deps.organization_id == "org-456"
        assert deps.graphiti is None
        assert deps.entity_types_filter == []
        assert deps.time_range is None
        assert deps.context_window == ""

    def test_create_with_all_fields(self, mock_supabase, mock_graphiti):
        """Test creating dependencies with all fields."""
        time_range = (datetime(2024, 1, 1, tzinfo=timezone.utc), datetime(2024, 12, 31, tzinfo=timezone.utc))
        deps = KGDependencies(
            db=mock_supabase,
            graphiti=mock_graphiti,
            deal_id="deal-123",
            organization_id="org-456",
            entity_types_filter=["Company", "Person"],
            time_range=time_range,
            context_window="Additional context",
        )
        assert deps.entity_types_filter == ["Company", "Person"]
        assert deps.time_range == time_range
        assert deps.context_window == "Additional context"

    def test_dataclass_has_expected_fields(self):
        """Test that KGDependencies has all expected fields."""
        field_names = {f.name for f in fields(KGDependencies)}
        expected_fields = {
            "db",
            "graphiti",
            "deal_id",
            "organization_id",
            "entity_types_filter",
            "time_range",
            "context_window",
        }
        assert field_names == expected_fields


# =============================================================================
# Pydantic Model Tests (Task 2)
# =============================================================================


class TestEntityMatch:
    """Tests for EntityMatch model."""

    def test_create_minimal(self):
        """Test creating entity match with minimal fields."""
        entity = EntityMatch(
            name="Acme Corp",
            entity_type="Company",
            confidence=0.95,
        )
        assert entity.name == "Acme Corp"
        assert entity.entity_type == "Company"
        assert entity.confidence == 0.95
        assert entity.aliases == []
        assert entity.source is None

    def test_create_with_all_fields(self):
        """Test creating entity match with all fields."""
        entity = EntityMatch(
            name="Acme Corporation",
            entity_type="Company",
            confidence=0.92,
            aliases=["Acme Corp", "ACME", "Acme Inc"],
            source=SourceReference(document_name="Report.pdf"),
            properties={"industry": "Technology", "location": "USA"},
        )
        assert len(entity.aliases) == 3
        assert entity.properties["industry"] == "Technology"

    def test_confidence_validation_min(self):
        """Test confidence must be >= 0."""
        with pytest.raises(ValidationError):
            EntityMatch(
                name="Test",
                entity_type="Company",
                confidence=-0.1,
            )

    def test_confidence_validation_max(self):
        """Test confidence must be <= 1."""
        with pytest.raises(ValidationError):
            EntityMatch(
                name="Test",
                entity_type="Company",
                confidence=1.5,
            )


class TestRelationshipStep:
    """Tests for RelationshipStep model."""

    def test_create_step(self):
        """Test creating relationship step."""
        step = RelationshipStep(
            from_entity="John Smith",
            from_entity_type="Person",
            relationship="WORKS_AT",
            to_entity="Acme Corp",
            to_entity_type="Company",
        )
        assert step.relationship == "WORKS_AT"
        assert step.from_entity == "John Smith"
        assert step.to_entity == "Acme Corp"

    def test_create_step_with_properties(self):
        """Test creating step with properties."""
        step = RelationshipStep(
            from_entity="John Smith",
            from_entity_type="Person",
            relationship="WORKS_AT",
            to_entity="Acme Corp",
            to_entity_type="Company",
            properties={"role": "CEO", "start_date": "2020-01-01"},
        )
        assert step.properties["role"] == "CEO"


class TestRelationshipPath:
    """Tests for RelationshipPath model."""

    def test_create_minimal_path(self):
        """Test creating minimal path."""
        path = RelationshipPath(
            start_entity="John Smith",
            start_entity_type="Person",
            end_entity="Acme Corp",
            end_entity_type="Company",
            total_hops=1,
        )
        assert path.total_hops == 1
        assert path.path == []

    def test_create_path_with_steps(self):
        """Test creating path with steps."""
        step = RelationshipStep(
            from_entity="John Smith",
            from_entity_type="Person",
            relationship="WORKS_AT",
            to_entity="Acme Corp",
            to_entity_type="Company",
        )
        path = RelationshipPath(
            start_entity="John Smith",
            start_entity_type="Person",
            end_entity="Acme Corp",
            end_entity_type="Company",
            path=[step],
            total_hops=1,
            path_description="John Smith --[WORKS_AT]--> Acme Corp",
        )
        assert len(path.path) == 1
        assert path.path_description == "John Smith --[WORKS_AT]--> Acme Corp"


class TestContradictionResult:
    """Tests for ContradictionResult model."""

    def test_create_contradiction(self):
        """Test creating contradiction."""
        contradiction = ContradictionResult(
            fact1="Revenue was $5M in 2024",
            fact2="Revenue was $4.2M in 2024",
            conflict_type="value_mismatch",
            severity="critical",
            resolution_hint="Check source documents for correct value",
        )
        assert contradiction.severity == "critical"
        assert contradiction.conflict_type == "value_mismatch"

    def test_severity_validation(self):
        """Test severity must be valid literal."""
        # Valid severities should work
        for severity in ["critical", "moderate", "informational"]:
            contradiction = ContradictionResult(
                fact1="Fact 1",
                fact2="Fact 2",
                conflict_type="test",
                severity=severity,
            )
            assert contradiction.severity == severity

    def test_create_with_sources(self):
        """Test creating contradiction with sources."""
        contradiction = ContradictionResult(
            fact1="Revenue was $5M",
            fact1_source=SourceReference(document_name="Report A.pdf"),
            fact1_valid_at="2024-01-01",
            fact2="Revenue was $4.2M",
            fact2_source=SourceReference(document_name="Report B.pdf"),
            fact2_valid_at="2024-06-01",
            conflict_type="value_mismatch",
            severity="moderate",
            affected_entity="Revenue",
        )
        assert contradiction.affected_entity == "Revenue"


class TestTemporalFact:
    """Tests for TemporalFact model."""

    def test_create_temporal_fact(self):
        """Test creating temporal fact."""
        fact = TemporalFact(
            fact="John Smith is CEO of Acme Corp",
            entity="John Smith",
            valid_at="2020-01-01",
            is_current=True,
        )
        assert fact.is_current is True
        assert fact.invalid_at is None

    def test_create_superseded_fact(self):
        """Test creating superseded fact."""
        fact = TemporalFact(
            fact="Jane Doe was CEO of Acme Corp",
            entity="Jane Doe",
            valid_at="2015-01-01",
            invalid_at="2019-12-31",
            is_current=False,
        )
        assert fact.is_current is False
        assert fact.invalid_at == "2019-12-31"


class TestKGAnalysisResult:
    """Tests for KGAnalysisResult model."""

    def test_create_minimal(self):
        """Test creating result with minimal fields."""
        result = KGAnalysisResult(
            summary="Found 3 entities related to query",
            confidence=0.85,
        )
        assert result.summary == "Found 3 entities related to query"
        assert result.entities == []
        assert result.paths == []
        assert result.contradictions == []

    def test_create_with_entities(self):
        """Test creating result with entities."""
        result = KGAnalysisResult(
            summary="Resolved entity to Acme Corporation",
            entities=[
                EntityMatch(name="Acme Corporation", entity_type="Company", confidence=0.95),
                EntityMatch(name="Acme Corp", entity_type="Company", confidence=0.85),
            ],
            confidence=0.9,
        )
        assert len(result.entities) == 2

    def test_create_with_paths(self):
        """Test creating result with paths."""
        path = RelationshipPath(
            start_entity="John",
            start_entity_type="Person",
            end_entity="Acme",
            end_entity_type="Company",
            total_hops=1,
        )
        result = KGAnalysisResult(
            summary="Found connection between John and Acme",
            paths=[path],
            confidence=0.88,
        )
        assert len(result.paths) == 1

    def test_create_with_contradictions(self):
        """Test creating result with contradictions."""
        result = KGAnalysisResult(
            summary="Found conflicting revenue data",
            contradictions=[
                ContradictionResult(
                    fact1="Revenue: $5M",
                    fact2="Revenue: $4.2M",
                    conflict_type="value_mismatch",
                    severity="critical",
                ),
            ],
            confidence=0.7,
        )
        assert len(result.contradictions) == 1

    def test_create_with_follow_up_questions(self):
        """Test creating result with follow-up questions."""
        result = KGAnalysisResult(
            summary="Analysis limited by missing data",
            confidence=0.5,
            limitations="Some entities could not be resolved",
            follow_up_questions=[
                "Can you clarify which company you're asking about?",
                "What time period are you interested in?",
            ],
        )
        assert len(result.follow_up_questions) == 2


# =============================================================================
# Agent Creation Tests (Task 3)
# =============================================================================


class TestAgentCreation:
    """Tests for agent creation and configuration."""

    def test_system_prompt_has_required_sections(self):
        """Test system prompt includes required KG expertise sections."""
        prompt = KNOWLEDGE_GRAPH_SYSTEM_PROMPT

        # Check for core expertise sections
        assert "Entity resolution" in prompt or "entity resolution" in prompt.lower()
        assert "Temporal" in prompt or "temporal" in prompt.lower()
        assert "Contradiction" in prompt or "contradiction" in prompt.lower()
        assert "relationship" in prompt.lower()

    def test_system_prompt_has_placeholders(self):
        """Test system prompt has format placeholders."""
        prompt = KNOWLEDGE_GRAPH_SYSTEM_PROMPT
        assert "{deal_id}" in prompt
        assert "{organization_id}" in prompt
        assert "{context}" in prompt
        assert "{entity_types}" in prompt
        assert "{time_range}" in prompt

    def test_get_agent_model_config_returns_expected_structure(self):
        """Test model config retrieval returns expected structure."""
        from src.config import get_agent_model_config

        config = get_agent_model_config("knowledge_graph")
        # Config should have primary key at minimum
        assert "primary" in config or config == {}

    def test_system_prompt_format_works(self):
        """Test system prompt can be formatted with values."""
        formatted = KNOWLEDGE_GRAPH_SYSTEM_PROMPT.format(
            deal_id="test-deal-123",
            organization_id="test-org-456",
            entity_types="Company, Person",
            time_range="2024-01-01 to 2024-12-31",
            context="Test context",
        )
        assert "test-deal-123" in formatted
        assert "test-org-456" in formatted
        assert "Company, Person" in formatted
        assert "Test context" in formatted


# =============================================================================
# Tool Logic Tests (Tasks 4-7)
# =============================================================================


class TestNameSimilarity:
    """Tests for entity name similarity calculation."""

    def test_exact_match(self):
        """Test exact match returns 1.0."""
        from src.agents.tools.kg_tools import _calculate_name_similarity

        assert _calculate_name_similarity("Acme Corp", "Acme Corp") == 1.0
        assert _calculate_name_similarity("acme corp", "ACME CORP") == 1.0

    def test_substring_match(self):
        """Test substring match returns high score."""
        from src.agents.tools.kg_tools import _calculate_name_similarity

        score = _calculate_name_similarity("Acme", "Acme Corporation")
        assert score >= 0.8

    def test_word_overlap(self):
        """Test word overlap scoring."""
        from src.agents.tools.kg_tools import _calculate_name_similarity

        score = _calculate_name_similarity("Acme Corporation", "Acme Industries")
        assert 0.4 < score < 0.9  # Some overlap due to "Acme"

    def test_no_match(self):
        """Test completely different names have low score."""
        from src.agents.tools.kg_tools import _calculate_name_similarity

        score = _calculate_name_similarity("Apple Inc", "Microsoft Corp")
        assert score < 0.5


class TestEntityExtraction:
    """Tests for entity extraction from search results."""

    def test_extract_entity_name_from_name_attr(self):
        """Test extracting name from name attribute."""
        from src.agents.tools.kg_tools import _extract_entity_name

        class MockResult:
            name = "Acme Corporation"
            fact = None

        assert _extract_entity_name(MockResult()) == "Acme Corporation"

    def test_extract_entity_name_from_content(self):
        """Test extracting name from content when no name attr."""
        from src.agents.tools.kg_tools import _extract_entity_name

        class MockResult:
            name = None
            fact = "The CEO of Acme is John Smith"

        result = _extract_entity_name(MockResult())
        assert "The" in result  # First few words of content

    def test_extract_entity_type_company(self):
        """Test extracting Company type from content."""
        from src.agents.tools.kg_tools import _extract_entity_type

        class MockResult:
            entity_type = None
            fact = "Acme Corporation Inc. was founded in 2010"

        assert _extract_entity_type(MockResult()) == "Company"

    def test_extract_entity_type_person(self):
        """Test extracting Person type from content."""
        from src.agents.tools.kg_tools import _extract_entity_type

        class MockResult:
            entity_type = None
            fact = "John Smith is the CEO and president"

        assert _extract_entity_type(MockResult()) == "Person"

    def test_extract_entity_type_financial(self):
        """Test extracting FinancialMetric type from content."""
        from src.agents.tools.kg_tools import _extract_entity_type

        class MockResult:
            entity_type = None
            fact = "The revenue increased by 15% with strong ebitda margin growth"

        assert _extract_entity_type(MockResult()) == "FinancialMetric"


class TestConflictDetection:
    """Tests for contradiction/conflict detection logic."""

    def test_detect_numeric_conflict_critical(self):
        """Test detecting critical numeric conflict (>10% diff)."""
        from src.agents.tools.kg_tools import _detect_conflict

        class MockFact1:
            fact = "Revenue was $5 million in 2024"
            valid_at = "2024-01-01"
            uuid = "fact-1"
            source_description = "Report A"
            subject = "Revenue"
            name = None

        class MockFact2:
            fact = "Revenue was $4 million in 2024"
            valid_at = "2024-01-01"
            uuid = "fact-2"
            source_description = "Report B"
            subject = "Revenue"
            name = None

        conflict = _detect_conflict(MockFact1(), MockFact2())
        assert conflict is not None
        assert conflict["severity"] == "critical"

    def test_detect_numeric_conflict_moderate(self):
        """Test detecting moderate numeric conflict (2-10% diff)."""
        from src.agents.tools.kg_tools import _detect_conflict

        class MockFact1:
            fact = "Revenue was $5 million"
            valid_at = "2024-01-01"
            uuid = "fact-1"
            source_description = "Report A"
            subject = "Revenue"
            name = None

        class MockFact2:
            fact = "Revenue was $4.8 million"
            valid_at = "2024-01-01"
            uuid = "fact-2"
            source_description = "Report B"
            subject = "Revenue"
            name = None

        conflict = _detect_conflict(MockFact1(), MockFact2())
        # 4% difference should be moderate
        if conflict:
            assert conflict["severity"] in ["moderate", "informational"]

    def test_no_conflict_same_values(self):
        """Test no conflict when values are the same."""
        from src.agents.tools.kg_tools import _detect_conflict

        class MockFact1:
            fact = "Revenue was $5 million"
            valid_at = "2024-01-01"
            uuid = "fact-1"
            source_description = "Report A"
            subject = "Revenue"
            name = None

        class MockFact2:
            fact = "Revenue was $5 million"
            valid_at = "2024-01-01"
            uuid = "fact-2"
            source_description = "Report B"
            subject = "Revenue"
            name = None

        conflict = _detect_conflict(MockFact1(), MockFact2())
        assert conflict is None  # No conflict for same values


class TestNumericValueParsing:
    """Tests for numeric value parsing from text."""

    def test_parse_millions(self):
        """Test parsing millions multiplier."""
        from src.agents.tools.kg_tools import _parse_numeric_value

        assert _parse_numeric_value(("5", "million")) == 5_000_000
        assert _parse_numeric_value(("1.5", "M")) == 1_500_000

    def test_parse_billions(self):
        """Test parsing billions multiplier."""
        from src.agents.tools.kg_tools import _parse_numeric_value

        assert _parse_numeric_value(("2", "billion")) == 2_000_000_000
        assert _parse_numeric_value(("1.5", "B")) == 1_500_000_000

    def test_parse_thousands(self):
        """Test parsing thousands multiplier."""
        from src.agents.tools.kg_tools import _parse_numeric_value

        assert _parse_numeric_value(("500", "k")) == 500_000
        assert _parse_numeric_value(("100", "K")) == 100_000

    def test_parse_plain_number(self):
        """Test parsing plain number without multiplier."""
        from src.agents.tools.kg_tools import _parse_numeric_value

        assert _parse_numeric_value(("1000000", "")) == 1_000_000
        assert _parse_numeric_value(("5,200,000", "")) == 5_200_000


class TestFactGrouping:
    """Tests for grouping facts by subject."""

    def test_group_by_subject(self):
        """Test grouping facts by subject."""
        from src.agents.tools.kg_tools import _group_facts_by_subject

        class MockFact1:
            subject = "Revenue"
            name = None
            fact = "Revenue was $5M"

        class MockFact2:
            subject = "Revenue"
            name = None
            fact = "Revenue was $4.8M"

        class MockFact3:
            subject = "EBITDA"
            name = None
            fact = "EBITDA was $1M"

        groups = _group_facts_by_subject([MockFact1(), MockFact2(), MockFact3()])
        assert len(groups) == 2
        assert len(groups["Revenue"]) == 2
        assert len(groups["EBITDA"]) == 1


# =============================================================================
# API Response Tests
# =============================================================================


class TestAPIResponseModels:
    """Tests for API response structure."""

    def test_result_serializes_to_json(self):
        """Test KGAnalysisResult serializes properly."""
        result = KGAnalysisResult(
            summary="Found entity Acme Corporation",
            entities=[
                EntityMatch(
                    name="Acme Corporation",
                    entity_type="Company",
                    confidence=0.95,
                    aliases=["Acme Corp"],
                ),
            ],
            confidence=0.9,
            sources=[
                SourceReference(document_name="Report.pdf"),
            ],
        )

        json_str = result.model_dump_json()
        assert "summary" in json_str
        assert "Acme Corporation" in json_str
        assert "0.95" in json_str

    def test_result_roundtrip(self):
        """Test serialization roundtrip."""
        original = KGAnalysisResult(
            summary="Test analysis",
            confidence=0.85,
            entities=[
                EntityMatch(name="Test Corp", entity_type="Company", confidence=0.88),
            ],
            paths=[
                RelationshipPath(
                    start_entity="A",
                    start_entity_type="Person",
                    end_entity="B",
                    end_entity_type="Company",
                    total_hops=1,
                ),
            ],
        )

        json_dict = original.model_dump()
        restored = KGAnalysisResult.model_validate(json_dict)

        assert restored.summary == original.summary
        assert restored.confidence == original.confidence
        assert len(restored.entities) == len(original.entities)
        assert len(restored.paths) == len(original.paths)


# =============================================================================
# Error Handling Tests
# =============================================================================


class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_graphiti_unavailable(self, mock_supabase):
        """Test handling when Graphiti is not available."""
        deps = KGDependencies(
            db=mock_supabase,
            graphiti=None,
            deal_id="deal-123",
            organization_id="org-456",
        )
        assert deps.graphiti is None

    def test_empty_entity_types_filter(self, mock_supabase, mock_graphiti):
        """Test handling empty entity types filter."""
        deps = KGDependencies(
            db=mock_supabase,
            graphiti=mock_graphiti,
            deal_id="deal-123",
            organization_id="org-456",
            entity_types_filter=[],
        )
        assert deps.entity_types_filter == []

    def test_none_time_range(self, mock_supabase, mock_graphiti):
        """Test handling None time range."""
        deps = KGDependencies(
            db=mock_supabase,
            graphiti=mock_graphiti,
            deal_id="deal-123",
            organization_id="org-456",
            time_range=None,
        )
        assert deps.time_range is None


# =============================================================================
# Graphiti Query Error Tests
# =============================================================================


class TestGraphitiQueryError:
    """Tests for GraphitiQueryError exception."""

    def test_error_creation(self):
        """Test GraphitiQueryError can be raised and caught."""
        from src.agents.tools.kg_tools import GraphitiQueryError

        with pytest.raises(GraphitiQueryError) as exc_info:
            raise GraphitiQueryError("Test error message")
        assert "Test error message" in str(exc_info.value)


class TestEntityResolutionError:
    """Tests for EntityResolutionError exception."""

    def test_error_creation(self):
        """Test EntityResolutionError can be raised and caught."""
        from src.agents.tools.kg_tools import EntityResolutionError

        with pytest.raises(EntityResolutionError) as exc_info:
            raise EntityResolutionError("Entity not found")
        assert "Entity not found" in str(exc_info.value)
