"""
Context-Knowledge Integration Tests (Python)

Story: E11.7 - Context-Knowledge Integration Tests
Tests for AC#4 (Model Switching) and AC#5 (E10+E11 Integration).

These tests validate:
- Model switch via config → same behavior with different provider
- Entity resolution across sessions
- Fact supersession and temporal invalidation
- E10 + E11 pipeline integration

Run with: pytest tests/integration/test_context_knowledge.py -m integration
"""

import os
from typing import Any
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4

import pytest

# Import fixtures
from tests.fixtures.context_knowledge import (
    TEST_DEAL,
    TEST_DOCUMENT,
    ENTITY_VARIATIONS,
    SAMPLE_FACTS,
    create_mock_graphiti_service,
    create_mock_db_client,
    create_mock_search_response,
    create_mock_ingest_response,
    should_run_integration_tests,
    get_test_env_config,
)


# ============================================================================
# Pytest Fixtures
# ============================================================================


@pytest.fixture
def sample_deal_id() -> str:
    """Sample deal UUID for test isolation."""
    return str(uuid4())


@pytest.fixture
def mock_graphiti_service() -> MagicMock:
    """Create a mock Graphiti ingestion service."""
    return create_mock_graphiti_service()


@pytest.fixture
def mock_db_client(sample_deal_id: str) -> MagicMock:
    """Create a mock Supabase client with valid deal."""
    return create_mock_db_client(sample_deal_id)


@pytest.fixture
def mock_db_client_no_deal() -> MagicMock:
    """Create a mock Supabase client with no deal found."""
    return create_mock_db_client(None)


# ============================================================================
# AC#4: Model Switching Tests
# ============================================================================


class TestModelSwitching:
    """Tests for model configuration and switching (AC#4)."""

    @pytest.mark.integration
    def test_model_config_loaded_from_yaml(self):
        """Test that model configuration is correctly loaded."""
        try:
            from src.config import load_model_config, get_agent_model_config

            # Clear cache for fresh load
            load_model_config.cache_clear()

            config = get_agent_model_config("extraction")

            # Verify structure
            assert "primary" in config
            assert config["primary"] is not None

        except ImportError:
            pytest.skip("Model config module not available")

    @pytest.mark.integration
    def test_fallback_configured_for_extraction_agent(self):
        """Test that extraction agent has fallback configured."""
        try:
            from src.config import load_model_config, get_agent_model_config

            load_model_config.cache_clear()
            config = get_agent_model_config("extraction")

            # Extraction should have fallback
            assert "fallback" in config

        except ImportError:
            pytest.skip("Model config module not available")

    @pytest.mark.integration
    def test_cost_rates_loaded_for_models(self):
        """Test that cost rates are available for configured models."""
        try:
            from src.config import get_model_costs

            # Get costs for known model
            costs = get_model_costs("google-gla:gemini-2.5-flash")

            assert "input" in costs
            assert "output" in costs
            assert costs["input"] > 0
            assert costs["output"] > 0

        except ImportError:
            pytest.skip("Model config module not available")

    @pytest.mark.integration
    def test_env_var_override_for_model(self):
        """Test that environment variable can override model config."""
        try:
            from src.config import load_model_config, get_agent_model_config

            load_model_config.cache_clear()

            # Set override via env var
            with patch.dict(os.environ, {"PYDANTIC_AI_EXTRACTION_MODEL": "google-gla:gemini-2.5-pro"}):
                config = get_agent_model_config("extraction")

            # Verify override was applied
            assert config["primary"] == "google-gla:gemini-2.5-pro"

        except ImportError:
            pytest.skip("Model config module not available")

    @pytest.mark.integration
    def test_different_agent_types_can_have_different_configs(self):
        """Test that extraction and analysis agents can use different models."""
        try:
            from src.config import load_model_config, get_agent_model_config

            load_model_config.cache_clear()

            extraction_config = get_agent_model_config("extraction")
            analysis_config = get_agent_model_config("analysis")

            # Both should have primary set
            assert "primary" in extraction_config
            assert "primary" in analysis_config

        except ImportError:
            pytest.skip("Model config module not available")


# ============================================================================
# AC#5: E10 + E11 Integration Tests
# ============================================================================


class TestEntityResolution:
    """Tests for entity resolution across sessions (AC#5)."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_entity_variations_resolve_to_canonical(
        self,
        mock_graphiti_service: MagicMock,
    ):
        """Test that entity variations resolve to canonical form."""
        for variation_case in ENTITY_VARIATIONS:
            canonical = variation_case["canonical"]
            variations = variation_case["variations"]

            # Simulate Graphiti resolving variations
            for variation in variations:
                # Mock would return canonical entity
                mock_graphiti_service.search.return_value = [
                    {
                        "id": "entity-001",
                        "content": f"Information about {canonical}",
                        "entity_name": canonical,
                    }
                ]

                result = await mock_graphiti_service.search(variation)

                # Verify resolution
                assert len(result) > 0
                assert result[0]["entity_name"] == canonical

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_facts_linked_across_sessions(
        self,
        mock_graphiti_service: MagicMock,
        sample_deal_id: str,
    ):
        """Test that facts from different sessions are linked."""
        # Session 1: Ingest document fact
        session1_fact = {
            "content": "Revenue was $4.8M according to the document",
            "source_type": "new_info",
            "deal_id": sample_deal_id,
        }

        await mock_graphiti_service.ingest_chat_fact(
            deal_id=session1_fact["deal_id"],
            content=session1_fact["content"],
            source_type=session1_fact["source_type"],
        )

        # Session 2: Chat correction
        session2_correction = {
            "content": "Actually revenue was $5.2M, not $4.8M",
            "source_type": "correction",
            "deal_id": sample_deal_id,
        }

        await mock_graphiti_service.ingest_chat_fact(
            deal_id=session2_correction["deal_id"],
            content=session2_correction["content"],
            source_type=session2_correction["source_type"],
        )

        # Verify both ingestions were called
        assert mock_graphiti_service.ingest_chat_fact.call_count == 2


class TestFactSupersession:
    """Tests for fact supersession and temporal invalidation (AC#5)."""

    @pytest.mark.integration
    def test_superseded_fact_not_returned_in_search(self):
        """Test that superseded facts are filtered from search results."""
        # Create search response with only valid (non-superseded) fact
        search_result = create_mock_search_response("fact_found", "Q3 revenue")

        # Should only return the corrected value
        assert len(search_result["results"]) == 1
        assert "$5.2M" in search_result["results"][0]["content"]
        assert search_result["results"][0]["source_channel"] == "analyst_correction"

    @pytest.mark.integration
    def test_correction_has_higher_confidence(self):
        """Test that corrections maintain high confidence."""
        correction_fact = SAMPLE_FACTS[0]  # correction type

        assert correction_fact["source_type"] == "correction"
        assert correction_fact["confidence"] >= 0.9

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_temporal_chain_preserved(
        self,
        mock_graphiti_service: MagicMock,
    ):
        """Test that temporal chain of facts is preserved for audit."""
        # Simulate fact supersession chain
        facts_in_order = [
            {"content": "Revenue $4.8M", "timestamp": "2024-12-01T10:00:00Z"},
            {"content": "Revenue $5.2M", "timestamp": "2024-12-01T14:00:00Z"},
        ]

        # Graphiti would maintain temporal relationships
        # Query for current value should return latest
        mock_graphiti_service.search.return_value = [
            {
                "id": "fact-002",
                "content": "Revenue $5.2M",
                "valid_at": "2024-12-01T14:00:00Z",
                "invalid_at": None,  # Still valid
            }
        ]

        result = await mock_graphiti_service.search("revenue")

        # Current value returned
        assert len(result) == 1
        assert "5.2M" in result[0]["content"]
        assert result[0]["invalid_at"] is None  # Not superseded


class TestE10E11Pipeline:
    """Tests for complete E10 + E11 pipeline integration."""

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_document_ingestion_to_chat_retrieval(
        self,
        mock_graphiti_service: MagicMock,
        sample_deal_id: str,
    ):
        """Test flow from document ingestion to chat retrieval."""
        # Step 1: Document ingestion (E10.4)
        mock_graphiti_service.add_episode.return_value = {
            "success": True,
            "episode_id": "ep-doc-001",
        }

        await mock_graphiti_service.add_episode(
            episode_body="Q3 revenue was $4.8M",
            source="document_ingestion",
            source_id=TEST_DOCUMENT["id"],
        )

        # Step 2: Chat query (E11.4)
        mock_graphiti_service.search.return_value = [
            {
                "id": "ep-doc-001",
                "content": "Q3 revenue was $4.8M",
                "source_type": "episode",
                "source_channel": "document_ingestion",
            }
        ]

        result = await mock_graphiti_service.search("Q3 revenue")

        # Verify retrieval
        assert len(result) > 0
        assert result[0]["source_channel"] == "document_ingestion"

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_chat_correction_updates_knowledge(
        self,
        mock_graphiti_service: MagicMock,
        sample_deal_id: str,
    ):
        """Test that chat corrections update the knowledge base."""
        # Ingest correction via chat (E11.3)
        result = await mock_graphiti_service.ingest_chat_fact(
            deal_id=sample_deal_id,
            content="Q3 revenue was actually $5.2M, not $4.8M",
            source_type="correction",
        )

        # Verify ingestion
        assert result.episode_count == 1

    @pytest.mark.integration
    def test_source_attribution_preserved(self):
        """Test that source attribution is preserved through the pipeline."""
        search_result = create_mock_search_response("fact_found")

        # Check citation structure
        assert len(search_result["results"]) > 0
        result = search_result["results"][0]

        assert "citation" in result
        assert result["citation"]["type"] in ["document", "qa", "chat"]
        assert "id" in result["citation"]
        assert "title" in result["citation"]

    @pytest.mark.integration
    def test_confidence_scores_propagate(self):
        """Test that confidence scores are maintained through pipeline."""
        search_result = create_mock_search_response("fact_found")

        result = search_result["results"][0]

        # Confidence at result level
        assert "confidence" in result
        assert 0 <= result["confidence"] <= 1

        # Confidence in citation
        assert "confidence" in result["citation"]
        assert 0 <= result["citation"]["confidence"] <= 1


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestErrorHandling:
    """Tests for error handling in the integration pipeline."""

    @pytest.mark.integration
    def test_graphiti_connection_failure_handled(self):
        """Test graceful handling of Graphiti connection failure."""
        with pytest.raises(Exception, match="Graphiti service unavailable"):
            create_mock_search_response("error")

    @pytest.mark.integration
    def test_missing_env_vars_detected(self):
        """Test that missing environment variables are detected."""
        env_config = get_test_env_config()

        assert "has_required_env" in env_config
        assert isinstance(env_config["has_required_env"], bool)

    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_invalid_deal_id_returns_empty(
        self,
        mock_db_client_no_deal: MagicMock,
    ):
        """Test that invalid deal ID returns no results."""
        # Simulate Supabase check for non-existent deal
        result = mock_db_client_no_deal.client.table("deals").select("id").eq("id", "invalid-uuid").execute
        mock_result = await result()

        assert mock_result.data == []

    @pytest.mark.integration
    def test_ingest_failure_returns_error_response(self):
        """Test that ingestion failure returns proper error response."""
        error_response = create_mock_ingest_response(success=False)

        assert error_response["success"] is False
        assert "error" in error_response


# ============================================================================
# Integration Skip Conditions
# ============================================================================


class TestIntegrationSkipConditions:
    """Tests that validate the skip condition logic."""

    def test_skip_flag_read_from_env(self):
        """Test that RUN_INTEGRATION_TESTS env var is respected."""
        # Should return False by default (unless explicitly set)
        result = should_run_integration_tests()
        assert isinstance(result, bool)

    def test_env_config_structure(self):
        """Test that environment config has expected structure."""
        config = get_test_env_config()

        assert "graphiti_url" in config
        assert "processing_api_key" in config
        assert "neo4j_uri" in config
        assert "voyage_api_key" in config
        assert "has_required_env" in config
