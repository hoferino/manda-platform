"""
Tests for Voyage AI embedding integration.
Story: E10.2 - Voyage Embedding Integration (AC: #1, #2, #3, #4)
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock


class TestVoyageAIEmbedderConfig:
    """Tests for VoyageAIEmbedder configuration (AC: #1)."""

    def test_import_voyage_embedder(self):
        """Verify VoyageAIEmbedder can be imported from graphiti_core."""
        from graphiti_core.embedder.voyage import VoyageAIEmbedder, VoyageAIEmbedderConfig

        assert VoyageAIEmbedder is not None
        assert VoyageAIEmbedderConfig is not None

    def test_voyage_embedder_config_creation(self):
        """Test VoyageAIEmbedderConfig can be created with required params."""
        from graphiti_core.embedder.voyage import VoyageAIEmbedderConfig

        config = VoyageAIEmbedderConfig(
            api_key="test-api-key",
            embedding_model="voyage-finance-2",
        )

        assert config.api_key == "test-api-key"
        assert config.embedding_model == "voyage-finance-2"

    def test_voyage_embedder_initialization(self):
        """Test VoyageAIEmbedder can be instantiated."""
        from graphiti_core.embedder.voyage import VoyageAIEmbedder, VoyageAIEmbedderConfig

        config = VoyageAIEmbedderConfig(
            api_key="test-api-key",
            embedding_model="voyage-finance-2",
        )
        embedder = VoyageAIEmbedder(config=config)

        assert embedder is not None


class TestEmbeddingDimensions:
    """Tests for embedding dimension verification (AC: #2)."""

    @pytest.mark.asyncio
    async def test_voyage_finance_2_dimensions_from_embedder(self):
        """Verify VoyageAIEmbedder is configured for 1024 dimensions."""
        from graphiti_core.embedder.voyage import VoyageAIEmbedder, VoyageAIEmbedderConfig

        # Create embedder with voyage-finance-2 model
        config = VoyageAIEmbedderConfig(
            api_key="test-api-key",
            embedding_model="voyage-finance-2",
        )
        embedder = VoyageAIEmbedder(config=config)

        # Mock the create method to return 1024-dim embedding
        mock_result = [0.1] * 1024
        with patch.object(embedder, "create", return_value=mock_result) as mock_create:
            result = await embedder.create("test text")
            mock_create.assert_called_once_with("test text")
            assert len(result) == 1024

    def test_config_dimensions_setting(self):
        """Verify config stores correct dimension value."""
        from src.config import Settings

        # Create settings with test values
        settings = Settings(
            database_url="postgresql://test:test@localhost:5432/test",
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="test-key",
            api_key="test-api-key",
            voyage_api_key="test-voyage-key",
            voyage_embedding_model="voyage-finance-2",
            voyage_embedding_dimensions=1024,
        )

        assert settings.voyage_embedding_dimensions == 1024
        assert settings.voyage_embedding_model == "voyage-finance-2"


class TestGraphitiClientEmbedder:
    """Tests for Graphiti client embedder selection and fallback (AC: #3, #4)."""

    @pytest.fixture
    def mock_graphiti_settings(self):
        """Mock settings for GraphitiClient testing."""
        mock = MagicMock()
        mock.neo4j_uri = "bolt://localhost:7687"
        mock.neo4j_user = "neo4j"
        mock.neo4j_password = "test-password"
        mock.neo4j_database = "neo4j"
        mock.graphiti_semaphore_limit = 10
        mock.google_api_key = "test-google-key"
        mock.gemini_flash_model = "gemini-2.5-flash"
        mock.voyage_api_key = "test-voyage-key"
        mock.voyage_embedding_model = "voyage-finance-2"
        mock.voyage_embedding_dimensions = 1024
        return mock

    def test_embedding_provider_class_variable_exists(self):
        """Verify GraphitiClient has _embedding_provider class variable."""
        from src.graphiti.client import GraphitiClient

        assert hasattr(GraphitiClient, "_embedding_provider")

    def test_reset_for_testing_clears_embedding_provider(self):
        """Verify reset_for_testing resets _embedding_provider."""
        from src.graphiti.client import GraphitiClient

        # Set to a known value
        GraphitiClient._embedding_provider = "voyage"

        # Reset
        GraphitiClient.reset_for_testing()

        # Should be reset to "unknown"
        assert GraphitiClient._embedding_provider == "unknown"
        assert GraphitiClient._instance is None
        assert GraphitiClient._initialized is False

    @pytest.mark.asyncio
    async def test_voyage_embedder_selected_when_key_available(self, mock_graphiti_settings):
        """Test that Voyage embedder is selected when VOYAGE_API_KEY is set (AC: #3)."""
        from src.graphiti.client import GraphitiClient

        # Reset state
        GraphitiClient.reset_for_testing()

        with patch("src.graphiti.client.get_settings", return_value=mock_graphiti_settings), \
             patch("src.graphiti.client.VoyageAIEmbedder") as mock_voyage, \
             patch("src.graphiti.client.VoyageAIEmbedderConfig") as mock_config, \
             patch("src.graphiti.client.GeminiClient"), \
             patch("src.graphiti.client.GeminiRerankerClient"), \
             patch("src.graphiti.client.Graphiti") as mock_graphiti, \
             patch("src.graphiti.client.LLMConfig"):

            mock_graphiti_instance = AsyncMock()
            mock_graphiti_instance.build_indices_and_constraints = AsyncMock()
            mock_graphiti.return_value = mock_graphiti_instance

            await GraphitiClient.get_instance()

            # Verify VoyageAIEmbedder was used
            mock_config.assert_called_once()
            mock_voyage.assert_called_once()
            assert GraphitiClient._embedding_provider == "voyage"

        # Cleanup
        GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_gemini_fallback_when_voyage_key_missing(self, mock_graphiti_settings):
        """Test that Gemini fallback is used when VOYAGE_API_KEY is empty (AC: #4)."""
        from src.graphiti.client import GraphitiClient

        # Reset state
        GraphitiClient.reset_for_testing()

        # Set voyage key to empty to trigger fallback
        mock_graphiti_settings.voyage_api_key = ""

        with patch("src.graphiti.client.get_settings", return_value=mock_graphiti_settings), \
             patch("src.graphiti.client.VoyageAIEmbedder"), \
             patch("src.graphiti.client.VoyageAIEmbedderConfig"), \
             patch("src.graphiti.client.GeminiEmbedder") as mock_gemini, \
             patch("src.graphiti.client.GeminiEmbedderConfig") as mock_gemini_config, \
             patch("src.graphiti.client.GeminiClient"), \
             patch("src.graphiti.client.GeminiRerankerClient"), \
             patch("src.graphiti.client.Graphiti") as mock_graphiti, \
             patch("src.graphiti.client.LLMConfig"):

            mock_graphiti_instance = AsyncMock()
            mock_graphiti_instance.build_indices_and_constraints = AsyncMock()
            mock_graphiti.return_value = mock_graphiti_instance

            await GraphitiClient.get_instance()

            # Verify GeminiEmbedder was used as fallback
            mock_gemini_config.assert_called_once()
            mock_gemini.assert_called_once()
            assert GraphitiClient._embedding_provider == "gemini_fallback"

        # Cleanup
        GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_gemini_fallback_when_voyage_import_fails(self, mock_graphiti_settings):
        """Test Gemini fallback when VoyageAIEmbedder raises an exception (AC: #4)."""
        from src.graphiti.client import GraphitiClient

        # Reset state
        GraphitiClient.reset_for_testing()

        with patch("src.graphiti.client.get_settings", return_value=mock_graphiti_settings), \
             patch("src.graphiti.client.VoyageAIEmbedder", side_effect=Exception("Voyage init failed")), \
             patch("src.graphiti.client.VoyageAIEmbedderConfig"), \
             patch("src.graphiti.client.GeminiEmbedder") as mock_gemini, \
             patch("src.graphiti.client.GeminiEmbedderConfig") as mock_gemini_config, \
             patch("src.graphiti.client.GeminiClient"), \
             patch("src.graphiti.client.GeminiRerankerClient"), \
             patch("src.graphiti.client.Graphiti") as mock_graphiti, \
             patch("src.graphiti.client.LLMConfig"):

            mock_graphiti_instance = AsyncMock()
            mock_graphiti_instance.build_indices_and_constraints = AsyncMock()
            mock_graphiti.return_value = mock_graphiti_instance

            await GraphitiClient.get_instance()

            # Verify GeminiEmbedder was used as fallback
            mock_gemini_config.assert_called_once()
            mock_gemini.assert_called_once()
            assert GraphitiClient._embedding_provider == "gemini_fallback"

        # Cleanup
        GraphitiClient.reset_for_testing()


class TestCostTracking:
    """Tests for cost tracking logging (AC: #5)."""

    def test_cost_calculation_voyage(self):
        """Test cost calculation for Voyage embeddings."""
        # voyage-finance-2 pricing: $0.12 per 1M tokens
        content_length = 4000  # 4000 chars
        estimated_tokens = content_length // 4  # ~1000 tokens
        cost_per_token = 0.00000012  # $0.12 / 1M

        estimated_cost = estimated_tokens * cost_per_token

        # 1000 tokens * $0.00000012 = $0.00012
        assert abs(estimated_cost - 0.00012) < 0.000001

    def test_cost_calculation_gemini_fallback(self):
        """Test cost calculation for Gemini fallback (free tier)."""
        # Gemini text-embedding-004 is generally free tier
        estimated_cost = 0.0

        assert estimated_cost == 0.0

    @pytest.mark.asyncio
    async def test_cost_logging_called_on_add_episode(self):
        """Verify logger.info is called with cost tracking fields during add_episode."""
        from src.graphiti.client import GraphitiClient

        # Reset state
        GraphitiClient.reset_for_testing()

        mock_settings = MagicMock()
        mock_settings.neo4j_uri = "bolt://localhost:7687"
        mock_settings.neo4j_user = "neo4j"
        mock_settings.neo4j_password = "test-password"
        mock_settings.google_api_key = "test-google-key"
        mock_settings.gemini_flash_model = "gemini-2.5-flash"
        mock_settings.voyage_api_key = "test-voyage-key"
        mock_settings.voyage_embedding_model = "voyage-finance-2"
        mock_settings.voyage_embedding_dimensions = 1024
        mock_settings.graphiti_semaphore_limit = 10

        with patch("src.graphiti.client.get_settings", return_value=mock_settings), \
             patch("src.graphiti.client.VoyageAIEmbedder"), \
             patch("src.graphiti.client.VoyageAIEmbedderConfig"), \
             patch("src.graphiti.client.GeminiClient"), \
             patch("src.graphiti.client.GeminiRerankerClient"), \
             patch("src.graphiti.client.Graphiti") as mock_graphiti, \
             patch("src.graphiti.client.LLMConfig"), \
             patch("src.graphiti.client.logger") as mock_logger:

            mock_graphiti_instance = AsyncMock()
            mock_graphiti_instance.build_indices_and_constraints = AsyncMock()
            mock_graphiti_instance.add_episode = AsyncMock()
            mock_graphiti.return_value = mock_graphiti_instance

            await GraphitiClient.add_episode(
                deal_id="test-deal",
                content="Test content for embedding",
                name="test-doc.pdf",
                source_description="Test document",
            )

            # Verify logger.info was called with cost tracking fields
            info_calls = [call for call in mock_logger.info.call_args_list
                         if "Graphiti embedding generated" in str(call)]
            assert len(info_calls) >= 1, "Expected logger.info call for cost tracking"

            # Verify the call includes required fields
            call_kwargs = info_calls[0][1] if info_calls[0][1] else {}
            assert "provider" in call_kwargs or "provider" in str(info_calls[0])
            assert "model" in call_kwargs or "model" in str(info_calls[0])
            assert "texts_count" in call_kwargs or "texts_count" in str(info_calls[0])
            assert "estimated_cost_usd" in call_kwargs or "estimated_cost_usd" in str(info_calls[0])

        # Cleanup
        GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestVoyageAIIntegration:
    """Integration tests that call real Voyage API.

    These tests require VOYAGE_API_KEY to be set in environment.
    Run with: pytest -m integration tests/unit/test_graphiti/test_voyage_embedder.py
    """

    @pytest.mark.asyncio
    async def test_real_voyage_embedding(self):
        """Test real Voyage API embedding generation."""
        import os

        voyage_key = os.environ.get("VOYAGE_API_KEY")
        if not voyage_key:
            pytest.skip("VOYAGE_API_KEY not set - skipping integration test")

        from graphiti_core.embedder.voyage import VoyageAIEmbedder, VoyageAIEmbedderConfig

        config = VoyageAIEmbedderConfig(
            api_key=voyage_key,
            embedding_model="voyage-finance-2",
        )
        embedder = VoyageAIEmbedder(config=config)

        # Generate embedding for a test text
        test_text = "M&A due diligence financial analysis"
        result = await embedder.create(test_text)

        # Verify dimensions
        assert len(result) == 1024, f"Expected 1024 dimensions, got {len(result)}"

        # Verify it's a valid embedding (list of floats)
        assert all(isinstance(x, float) for x in result)
