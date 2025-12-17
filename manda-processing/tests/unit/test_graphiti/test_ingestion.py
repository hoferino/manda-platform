"""
Unit tests for Graphiti ingestion service.
Story: E10.4 - Document Ingestion Pipeline (AC: #1, #2, #3, #7)

Tests the GraphitiIngestionService and IngestionResult classes:
- Chunk iteration and episode creation
- Episode naming with chunk index
- Source description generation
- IngestionResult metrics accuracy
- Error handling
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import asdict

from src.graphiti.ingestion import (
    GraphitiIngestionService,
    IngestionResult,
)


class TestIngestionResult:
    """Tests for IngestionResult dataclass."""

    def test_default_values(self):
        """IngestionResult with required fields only."""
        result = IngestionResult(episode_count=5, elapsed_ms=1234)
        assert result.episode_count == 5
        assert result.elapsed_ms == 1234
        assert result.estimated_cost_usd == 0.0

    def test_all_values(self):
        """IngestionResult with all fields populated."""
        result = IngestionResult(
            episode_count=10,
            elapsed_ms=5000,
            estimated_cost_usd=0.000012,
        )
        assert result.episode_count == 10
        assert result.elapsed_ms == 5000
        assert result.estimated_cost_usd == 0.000012

    def test_as_dict(self):
        """Can convert to dict for serialization."""
        result = IngestionResult(episode_count=3, elapsed_ms=100, estimated_cost_usd=0.001)
        result_dict = asdict(result)
        assert result_dict == {
            "episode_count": 3,
            "elapsed_ms": 100,
            "estimated_cost_usd": 0.001,
        }


class TestGraphitiIngestionServiceSourceDescription:
    """Tests for source description generation."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    def test_basic_source_description(self, service):
        """Source description with minimal chunk data."""
        chunk = {"chunk_type": "text"}
        result = service._build_source_description(chunk, "report.pdf")
        assert "From: report.pdf" in result
        assert "Type: text" in result

    def test_source_description_with_page(self, service):
        """Source description includes page number."""
        chunk = {"chunk_type": "text", "page_number": 5}
        result = service._build_source_description(chunk, "report.pdf")
        assert "From: report.pdf" in result
        assert "Page 5" in result
        assert "Type: text" in result

    def test_source_description_with_sheet(self, service):
        """Source description includes sheet name for Excel."""
        chunk = {"chunk_type": "table", "sheet_name": "Financials"}
        result = service._build_source_description(chunk, "data.xlsx")
        assert "From: data.xlsx" in result
        assert "Sheet: Financials" in result
        assert "Type: table" in result

    def test_source_description_full(self, service):
        """Source description with all available metadata."""
        chunk = {
            "chunk_type": "table",
            "page_number": 3,
            "sheet_name": "Summary",
        }
        result = service._build_source_description(chunk, "financial-model.xlsx")
        assert "From: financial-model.xlsx" in result
        assert "Page 3" in result
        assert "Sheet: Summary" in result
        assert "Type: table" in result

    def test_source_description_missing_chunk_type(self, service):
        """Defaults to 'text' when chunk_type missing."""
        chunk = {}
        result = service._build_source_description(chunk, "doc.pdf")
        assert "Type: text" in result


class TestGraphitiIngestionServiceIngest:
    """Tests for ingest_document_chunks method."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    @pytest.fixture
    def sample_chunks(self):
        """Sample document chunks for testing."""
        return [
            {
                "id": "chunk-1",
                "content": "Revenue increased 15% year over year.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
                "sheet_name": None,
                "token_count": 10,
            },
            {
                "id": "chunk-2",
                "content": "EBITDA margin improved to 25%.",
                "chunk_index": 1,
                "page_number": 1,
                "chunk_type": "text",
                "sheet_name": None,
                "token_count": 8,
            },
            {
                "id": "chunk-3",
                "content": "Financial data table with Q1-Q4 results.",
                "chunk_index": 2,
                "page_number": 2,
                "chunk_type": "table",
                "sheet_name": None,
                "token_count": 15,
            },
        ]

    @pytest.mark.asyncio
    async def test_ingest_empty_chunks(self, service):
        """Ingesting empty chunk list returns zero episode count."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            result = await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="deal-456",
                document_name="empty.pdf",
                chunks=[],
            )

            assert result.episode_count == 0
            assert result.elapsed_ms >= 0
            assert result.estimated_cost_usd == 0.0
            mock_add_episode.assert_not_called()

    @pytest.mark.asyncio
    async def test_ingest_single_chunk(self, service):
        """Ingesting single chunk creates one episode."""
        chunk = {
            "id": "chunk-1",
            "content": "Test content for ingestion.",
            "chunk_index": 0,
            "page_number": 1,
            "chunk_type": "text",
        }

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            result = await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="deal-456",
                document_name="test.pdf",
                chunks=[chunk],
            )

            assert result.episode_count == 1
            assert result.elapsed_ms >= 0

            # Verify add_episode was called with correct arguments
            mock_add_episode.assert_called_once()
            call_args = mock_add_episode.call_args

            assert call_args.kwargs["deal_id"] == "deal-456"
            assert call_args.kwargs["content"] == "Test content for ingestion."
            assert call_args.kwargs["name"] == "test.pdf#chunk-0"
            assert "From: test.pdf" in call_args.kwargs["source_description"]
            assert call_args.kwargs["entity_types"] is not None
            assert call_args.kwargs["edge_types"] is not None
            assert call_args.kwargs["edge_type_map"] is not None

    @pytest.mark.asyncio
    async def test_ingest_multiple_chunks(self, service, sample_chunks):
        """Ingesting multiple chunks creates correct number of episodes."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            result = await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="deal-456",
                document_name="report.pdf",
                chunks=sample_chunks,
            )

            assert result.episode_count == 3
            assert mock_add_episode.call_count == 3

    @pytest.mark.asyncio
    async def test_episode_naming(self, service, sample_chunks):
        """Episodes are named with document name and chunk index."""
        episode_names = []

        async def capture_episode_name(**kwargs):
            episode_names.append(kwargs["name"])

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            side_effect=capture_episode_name,
        ):
            await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="deal-456",
                document_name="financial-report.pdf",
                chunks=sample_chunks,
            )

            assert episode_names == [
                "financial-report.pdf#chunk-0",
                "financial-report.pdf#chunk-1",
                "financial-report.pdf#chunk-2",
            ]

    @pytest.mark.asyncio
    async def test_deal_id_passed_as_group_id(self, service, sample_chunks):
        """deal_id is passed to add_episode for namespace isolation."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="my-special-deal-id",
                document_name="report.pdf",
                chunks=sample_chunks,
            )

            # All calls should use the same deal_id
            for call in mock_add_episode.call_args_list:
                assert call.kwargs["deal_id"] == "my-special-deal-id"

    @pytest.mark.asyncio
    async def test_cost_estimation(self, service):
        """Cost is estimated based on character count."""
        # Create chunks with known character counts
        chunks = [
            {"content": "A" * 1000, "chunk_index": 0, "chunk_type": "text"},
            {"content": "B" * 3000, "chunk_index": 1, "chunk_type": "text"},
        ]  # Total: 4000 chars = ~1000 tokens

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ):
            result = await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="deal-456",
                document_name="test.pdf",
                chunks=chunks,
            )

            # 4000 chars / 4 = 1000 tokens
            # 1000 tokens * $0.00000012 = $0.00012
            assert result.estimated_cost_usd == pytest.approx(0.00012, rel=0.01)

    @pytest.mark.asyncio
    async def test_schema_types_passed(self, service):
        """Entity types, edge types, and edge type map are passed to add_episode."""
        chunk = {"content": "Test", "chunk_index": 0, "chunk_type": "text"}

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_document_chunks(
                document_id="doc-123",
                deal_id="deal-456",
                document_name="test.pdf",
                chunks=[chunk],
            )

            call_kwargs = mock_add_episode.call_args.kwargs

            # Verify schema types are provided
            assert "entity_types" in call_kwargs
            assert "edge_types" in call_kwargs
            assert "edge_type_map" in call_kwargs

            # Verify they contain expected keys (from E10.3 schema)
            assert "Company" in call_kwargs["entity_types"]
            assert "EXTRACTED_FROM" in call_kwargs["edge_types"]
            assert isinstance(call_kwargs["edge_type_map"], dict)

    @pytest.mark.asyncio
    async def test_graphiti_error_propagates(self, service, sample_chunks):
        """GraphitiConnectionError from add_episode propagates up."""
        from src.graphiti.client import GraphitiConnectionError

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
            side_effect=GraphitiConnectionError("Neo4j unavailable"),
        ):
            with pytest.raises(GraphitiConnectionError) as exc_info:
                await service.ingest_document_chunks(
                    document_id="doc-123",
                    deal_id="deal-456",
                    document_name="test.pdf",
                    chunks=sample_chunks,
                )

            assert "Neo4j unavailable" in str(exc_info.value)


class TestGraphitiIngestionServiceProgressLogging:
    """Tests for progress logging during ingestion."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    @pytest.mark.asyncio
    async def test_progress_logging_every_10_chunks(self, service):
        """Progress is logged every 10 chunks."""
        # Create 25 chunks
        chunks = [
            {"content": f"Content {i}", "chunk_index": i, "chunk_type": "text"}
            for i in range(25)
        ]

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ):
            with patch("src.graphiti.ingestion.logger") as mock_logger:
                await service.ingest_document_chunks(
                    document_id="doc-123",
                    deal_id="deal-456",
                    document_name="large.pdf",
                    chunks=chunks,
                )

                # Should log progress at chunks 10, 20
                progress_calls = [
                    call
                    for call in mock_logger.info.call_args_list
                    if len(call.args) > 0 and call.args[0] == "Ingestion progress"
                ]
                assert len(progress_calls) == 2
