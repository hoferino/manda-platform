"""
Unit tests for Hybrid Retrieval Service.
Story: E10.7 - Hybrid Retrieval with Reranking (AC: #2, #3, #4, #6, #8)

Tests:
- VoyageReranker: rerank() with mocked API
- HybridRetrievalService: retrieve() with mocked Graphiti + Voyage
- Source citation extraction from various edge types
- Superseded fact filtering logic
- Fallback behavior when Voyage unavailable
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import asdict

# Fixed datetime for deterministic tests
FIXED_DATETIME = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)

from src.graphiti.retrieval import (
    HybridRetrievalService,
    RetrievalResult,
    KnowledgeItem,
    SourceCitation,
)
from src.reranking.voyage import VoyageReranker, RerankResult


# =============================================================================
# Test Data Fixtures
# =============================================================================


class MockEntityEdge:
    """Mock EntityEdge for testing."""

    def __init__(
        self,
        uuid: str,
        name: str,
        fact: str,
        group_id: str = "deal-123",
        valid_at: datetime | None = None,
        invalid_at: datetime | None = None,
        attributes: dict | None = None,
    ):
        self.uuid = uuid
        self.name = name
        self.fact = fact
        self.group_id = group_id
        self.valid_at = valid_at
        self.invalid_at = invalid_at
        self.attributes = attributes or {}
        self.source_node_uuid = "source-123"
        self.target_node_uuid = "target-456"
        self.episodes = ["episode-1"]
        self.created_at = FIXED_DATETIME


@pytest.fixture
def sample_edges():
    """Sample EntityEdges for testing."""
    return [
        MockEntityEdge(
            uuid="edge-1",
            name="revenue_fact",
            fact="Q3 revenue was $5.2 million, representing 15% growth.",
            attributes={"confidence": 0.85, "source_channel": "document"},
        ),
        MockEntityEdge(
            uuid="edge-2",
            name="ebitda_fact",
            fact="EBITDA margin improved to 25% from 22% last year.",
            attributes={"confidence": 0.90, "source_channel": "qa_response"},
        ),
        MockEntityEdge(
            uuid="edge-3",
            name="ceo_fact",
            fact="John Smith was appointed CEO in January 2024.",
            attributes={"confidence": 0.85, "source_channel": "document"},
        ),
        MockEntityEdge(
            uuid="edge-4",
            name="risk_fact",
            fact="Key customer concentration risk identified - top 3 customers = 60% revenue.",
            invalid_at=FIXED_DATETIME,  # Superseded fact
            attributes={"confidence": 0.80},
        ),
        MockEntityEdge(
            uuid="edge-5",
            name="market_fact",
            fact="Market size estimated at $2.5 billion with 8% CAGR.",
            attributes={"confidence": 0.75},
        ),
    ]


@pytest.fixture
def mock_rerank_results():
    """Mock rerank results from Voyage."""
    return [
        RerankResult(index=0, relevance_score=0.95, document="Q3 revenue was $5.2 million..."),
        RerankResult(index=1, relevance_score=0.88, document="EBITDA margin improved..."),
        RerankResult(index=2, relevance_score=0.75, document="John Smith was appointed CEO..."),
        RerankResult(index=3, relevance_score=0.65, document="Key customer concentration risk..."),  # Superseded
        RerankResult(index=4, relevance_score=0.55, document="Market size estimated..."),
    ]


# =============================================================================
# VoyageReranker Tests
# =============================================================================


class TestVoyageReranker:
    """Tests for VoyageReranker class."""

    @pytest.fixture
    def mock_voyage_client(self):
        """Create a mock Voyage client."""
        mock_client = MagicMock()

        # Mock rerank response
        mock_result = MagicMock()
        mock_result.index = 0
        mock_result.relevance_score = 0.95

        mock_result2 = MagicMock()
        mock_result2.index = 1
        mock_result2.relevance_score = 0.85

        mock_response = MagicMock()
        mock_response.results = [mock_result, mock_result2]

        mock_client.rerank.return_value = mock_response
        return mock_client

    @pytest.mark.asyncio
    async def test_rerank_with_valid_api_key(self, mock_voyage_client):
        """Rerank returns results when API key is valid."""
        with patch("src.reranking.voyage.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                voyage_api_key="valid-api-key",
                voyage_rerank_model="rerank-2.5",
            )

            with patch("voyageai.Client", return_value=mock_voyage_client):
                reranker = VoyageReranker(api_key="valid-api-key")
                reranker._client = mock_voyage_client

                results = await reranker.rerank(
                    query="What is revenue?",
                    documents=["Revenue was $5M", "EBITDA was $2M"],
                    top_k=2,
                )

                assert len(results) == 2
                assert results[0].relevance_score == 0.95
                assert results[1].relevance_score == 0.85

    @pytest.mark.asyncio
    async def test_rerank_fallback_without_api_key(self):
        """Rerank returns original order when API key is missing."""
        with patch("src.reranking.voyage.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                voyage_api_key="",
                voyage_rerank_model="rerank-2.5",
            )

            reranker = VoyageReranker()
            documents = ["Doc A", "Doc B", "Doc C"]

            results = await reranker.rerank(
                query="test query",
                documents=documents,
                top_k=3,
            )

            # Should return original order with decreasing scores
            assert len(results) == 3
            assert results[0].index == 0
            assert results[0].document == "Doc A"
            assert results[0].relevance_score == 1.0
            assert results[1].relevance_score == 0.99
            assert results[2].relevance_score == 0.98

    @pytest.mark.asyncio
    async def test_rerank_empty_documents(self):
        """Rerank handles empty document list."""
        with patch("src.reranking.voyage.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                voyage_api_key="valid-key",
                voyage_rerank_model="rerank-2.5",
            )

            reranker = VoyageReranker()
            results = await reranker.rerank(
                query="test",
                documents=[],
                top_k=10,
            )

            assert results == []

    @pytest.mark.asyncio
    async def test_rerank_api_error_fallback(self, mock_voyage_client):
        """Rerank falls back to original order on API error."""
        mock_voyage_client.rerank.side_effect = Exception("API Error")

        with patch("src.reranking.voyage.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                voyage_api_key="valid-key",
                voyage_rerank_model="rerank-2.5",
            )

            with patch("voyageai.Client", return_value=mock_voyage_client):
                reranker = VoyageReranker()
                reranker._client = mock_voyage_client

                documents = ["Doc A", "Doc B"]
                results = await reranker.rerank(
                    query="test",
                    documents=documents,
                    top_k=2,
                )

                # Should fall back to original order
                assert len(results) == 2
                assert results[0].index == 0

    @pytest.mark.asyncio
    async def test_rerank_top_k_limits_results(self, mock_voyage_client):
        """top_k limits the number of results returned."""
        with patch("src.reranking.voyage.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                voyage_api_key="",
                voyage_rerank_model="rerank-2.5",
            )

            reranker = VoyageReranker()
            documents = ["A", "B", "C", "D", "E"]

            results = await reranker.rerank(
                query="test",
                documents=documents,
                top_k=3,
            )

            assert len(results) == 3


# =============================================================================
# HybridRetrievalService Tests
# =============================================================================


class TestHybridRetrievalService:
    """Tests for HybridRetrievalService class."""

    @pytest.fixture
    def mock_reranker(self, mock_rerank_results):
        """Create a mock reranker."""
        reranker = MagicMock(spec=VoyageReranker)
        reranker.rerank = AsyncMock(return_value=mock_rerank_results)
        return reranker

    @pytest.fixture
    def service(self, mock_reranker):
        """Create a HybridRetrievalService with mocked reranker."""
        return HybridRetrievalService(reranker=mock_reranker)

    @pytest.mark.asyncio
    async def test_retrieve_returns_results(self, service, sample_edges, mock_rerank_results):
        """Retrieve returns reranked results."""
        with patch(
            "src.graphiti.retrieval.GraphitiClient.search",
            new_callable=AsyncMock,
            return_value=sample_edges,
        ):
            result = await service.retrieve(
                query="What is Q3 revenue?",
                deal_id="deal-123",
                num_results=10,
            )

            assert isinstance(result, RetrievalResult)
            # 4 results expected (1 superseded filtered out)
            assert len(result.results) == 4
            assert result.latency_ms >= 0
            assert result.candidate_count == 5

    @pytest.mark.asyncio
    async def test_retrieve_filters_superseded_facts(self, service, sample_edges, mock_rerank_results):
        """Superseded facts (invalid_at set) are filtered out."""
        with patch(
            "src.graphiti.retrieval.GraphitiClient.search",
            new_callable=AsyncMock,
            return_value=sample_edges,
        ):
            result = await service.retrieve(
                query="What are the risks?",
                deal_id="deal-123",
            )

            # Edge-4 has invalid_at set, should be filtered
            result_ids = [r.id for r in result.results]
            assert "edge-4" not in result_ids

    @pytest.mark.asyncio
    async def test_retrieve_empty_search_results(self, service):
        """Retrieve handles empty search results."""
        with patch(
            "src.graphiti.retrieval.GraphitiClient.search",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await service.retrieve(
                query="nonexistent query",
                deal_id="deal-123",
            )

            assert len(result.results) == 0
            assert len(result.sources) == 0
            assert result.candidate_count == 0

    @pytest.mark.asyncio
    async def test_retrieve_passes_num_candidates_to_graphiti(self, service, sample_edges):
        """num_candidates is passed to Graphiti search."""
        with patch(
            "src.graphiti.retrieval.GraphitiClient.search",
            new_callable=AsyncMock,
            return_value=sample_edges,
        ) as mock_search:
            await service.retrieve(
                query="test",
                deal_id="deal-123",
                num_candidates=100,
            )

            mock_search.assert_called_once()
            call_kwargs = mock_search.call_args.kwargs
            assert call_kwargs["num_results"] == 100

    @pytest.mark.asyncio
    async def test_retrieve_tracks_latency(self, service, sample_edges):
        """Retrieval result includes latency metrics."""
        with patch(
            "src.graphiti.retrieval.GraphitiClient.search",
            new_callable=AsyncMock,
            return_value=sample_edges,
        ):
            result = await service.retrieve(
                query="test",
                deal_id="deal-123",
            )

            assert result.latency_ms >= 0
            assert result.graphiti_latency_ms >= 0
            assert result.rerank_latency_ms >= 0

    @pytest.mark.asyncio
    async def test_retrieve_extracts_entities_from_edge_names(self, service, mock_rerank_results):
        """Entities are extracted from edge names with underscores."""
        # Create edges with entity-like names
        edges_with_entities = [
            MockEntityEdge(
                uuid="edge-1",
                name="revenue_fact",
                fact="Revenue was $5M",
                attributes={"confidence": 0.85},
            ),
            MockEntityEdge(
                uuid="edge-2",
                name="John_Smith_CEO",
                fact="John Smith is the CEO",
                attributes={"confidence": 0.90, "source_entity_name": "John Smith"},
            ),
        ]

        # Mock rerank results for 2 edges
        mock_results = [
            RerankResult(index=0, relevance_score=0.95, document="Revenue was $5M"),
            RerankResult(index=1, relevance_score=0.88, document="John Smith is the CEO"),
        ]

        mock_reranker = MagicMock(spec=VoyageReranker)
        mock_reranker.rerank = AsyncMock(return_value=mock_results)
        service_with_mock = HybridRetrievalService(reranker=mock_reranker)

        with patch(
            "src.graphiti.retrieval.GraphitiClient.search",
            new_callable=AsyncMock,
            return_value=edges_with_entities,
        ):
            result = await service_with_mock.retrieve(
                query="Who is the CEO?",
                deal_id="deal-123",
            )

            # Should have extracted entities from edge names
            assert len(result.entities) > 0
            # "Revenue Fact" from "revenue_fact" edge name
            assert any("Revenue" in e for e in result.entities)
            # "John Smith" from attributes.source_entity_name
            assert "John Smith" in result.entities


class TestSourceCitationExtraction:
    """Tests for source citation extraction."""

    @pytest.fixture
    def service(self):
        """Create service for testing."""
        mock_reranker = MagicMock()
        return HybridRetrievalService(reranker=mock_reranker)

    def test_extract_citation_document_type(self, service):
        """Extract citation from document-type edge."""
        edge = MockEntityEdge(
            uuid="edge-1",
            name="financial_report",
            fact="Revenue was $5M",
            attributes={
                "confidence": 0.85,
                "source_channel": "document",
                "page_number": 5,
                "chunk_index": 2,
            },
        )

        citation = service._extract_citation(edge)

        assert citation.type == "document"
        assert citation.id == "edge-1"
        assert citation.confidence == 0.85
        assert citation.page == 5
        assert citation.chunk_index == 2

    def test_extract_citation_qa_type(self, service):
        """Extract citation from Q&A-type edge."""
        edge = MockEntityEdge(
            uuid="edge-2",
            name="qa-response-123",
            fact="Answer from Q&A session",
            attributes={"confidence": 0.95, "source_channel": "qa_response"},
        )

        citation = service._extract_citation(edge)

        assert citation.type == "qa"
        assert citation.confidence == 0.95

    def test_extract_citation_chat_type(self, service):
        """Extract citation from chat-type edge."""
        edge = MockEntityEdge(
            uuid="edge-3",
            name="chat-fact-456",
            fact="Insight from analyst chat",
            attributes={"confidence": 0.90, "source_channel": "analyst_chat"},
        )

        citation = service._extract_citation(edge)

        assert citation.type == "chat"

    def test_extract_citation_default_confidence(self, service):
        """Default confidence is used when not in attributes."""
        edge = MockEntityEdge(
            uuid="edge-4",
            name="some_fact",
            fact="Some content",
            attributes={},
        )

        citation = service._extract_citation(edge)

        assert citation.confidence == 0.85  # Default

    def test_extract_citation_excerpt(self, service):
        """Citation includes fact excerpt."""
        long_fact = "A" * 300  # Longer than 200 chars
        edge = MockEntityEdge(
            uuid="edge-5",
            name="long_fact",
            fact=long_fact,
        )

        citation = service._extract_citation(edge)

        assert citation.excerpt is not None
        assert len(citation.excerpt) == 200


class TestSupersededFactFiltering:
    """Tests for superseded fact filtering."""

    @pytest.fixture
    def service(self):
        """Create service for testing."""
        mock_reranker = MagicMock()
        return HybridRetrievalService(reranker=mock_reranker)

    def test_is_superseded_with_invalid_at(self, service):
        """Edge with invalid_at is superseded."""
        edge = MockEntityEdge(
            uuid="edge-1",
            name="old_fact",
            fact="Old information",
            invalid_at=FIXED_DATETIME,
        )

        assert service._is_superseded(edge) is True

    def test_is_not_superseded_without_invalid_at(self, service):
        """Edge without invalid_at is not superseded."""
        edge = MockEntityEdge(
            uuid="edge-1",
            name="current_fact",
            fact="Current information",
            invalid_at=None,
        )

        assert service._is_superseded(edge) is False

    def test_is_superseded_with_valid_at_only(self, service):
        """Edge with only valid_at (no invalid_at) is not superseded."""
        edge = MockEntityEdge(
            uuid="edge-1",
            name="current_fact",
            fact="Current information",
            valid_at=FIXED_DATETIME,
            invalid_at=None,
        )

        assert service._is_superseded(edge) is False


# =============================================================================
# RerankResult Tests
# =============================================================================


class TestRerankResult:
    """Tests for RerankResult dataclass."""

    def test_rerank_result_creation(self):
        """RerankResult can be created with all fields."""
        result = RerankResult(
            index=5,
            relevance_score=0.92,
            document="Test document content",
        )

        assert result.index == 5
        assert result.relevance_score == 0.92
        assert result.document == "Test document content"


# =============================================================================
# KnowledgeItem Tests
# =============================================================================


class TestKnowledgeItem:
    """Tests for KnowledgeItem dataclass."""

    def test_knowledge_item_creation(self):
        """KnowledgeItem can be created with required fields."""
        item = KnowledgeItem(
            id="item-1",
            content="Test content",
            score=0.85,
            source_type="fact",
            source_channel="document",
            confidence=0.90,
        )

        assert item.id == "item-1"
        assert item.content == "Test content"
        assert item.score == 0.85
        assert item.source_type == "fact"
        assert item.source_channel == "document"
        assert item.confidence == 0.90
        assert item.valid_at is None
        assert item.invalid_at is None
        assert item.citation is None

    def test_knowledge_item_with_citation(self):
        """KnowledgeItem can include citation."""
        citation = SourceCitation(
            type="document",
            id="citation-1",
            title="Report.pdf",
            page=5,
        )

        item = KnowledgeItem(
            id="item-1",
            content="Test content",
            score=0.85,
            source_type="fact",
            source_channel="document",
            confidence=0.90,
            citation=citation,
        )

        assert item.citation is not None
        assert item.citation.title == "Report.pdf"
        assert item.citation.page == 5


# =============================================================================
# SourceCitation Tests
# =============================================================================


class TestSourceCitation:
    """Tests for SourceCitation dataclass."""

    def test_source_citation_document(self):
        """SourceCitation for document type."""
        citation = SourceCitation(
            type="document",
            id="doc-1",
            title="financial-report.pdf",
            page=10,
            chunk_index=3,
            confidence=0.85,
        )

        assert citation.type == "document"
        assert citation.title == "financial-report.pdf"
        assert citation.page == 10

    def test_source_citation_qa(self):
        """SourceCitation for Q&A type."""
        citation = SourceCitation(
            type="qa",
            id="qa-1",
            title="Q&A Response",
            confidence=0.95,
        )

        assert citation.type == "qa"
        assert citation.confidence == 0.95

    def test_source_citation_defaults(self):
        """SourceCitation uses defaults for optional fields."""
        citation = SourceCitation(
            type="document",
            id="doc-1",
            title="test.pdf",
        )

        assert citation.page is None
        assert citation.chunk_index is None
        assert citation.excerpt is None
        assert citation.confidence == 0.85


# =============================================================================
# RetrievalResult Tests
# =============================================================================


class TestRetrievalResult:
    """Tests for RetrievalResult dataclass."""

    def test_retrieval_result_creation(self):
        """RetrievalResult can be created with all fields."""
        result = RetrievalResult(
            results=[],
            sources=[],
            entities=["Company A", "Person B"],
            latency_ms=250,
            graphiti_latency_ms=150,
            rerank_latency_ms=100,
            candidate_count=50,
        )

        assert result.entities == ["Company A", "Person B"]
        assert result.latency_ms == 250
        assert result.graphiti_latency_ms == 150
        assert result.rerank_latency_ms == 100
        assert result.candidate_count == 50

    def test_retrieval_result_defaults(self):
        """RetrievalResult uses defaults for timing fields."""
        result = RetrievalResult(
            results=[],
            sources=[],
            entities=[],
            latency_ms=100,
        )

        assert result.graphiti_latency_ms == 0
        assert result.rerank_latency_ms == 0
        assert result.candidate_count == 0


# =============================================================================
# API Endpoint Tests (E10.7)
# =============================================================================


class TestHybridSearchAPI:
    """Tests for POST /api/search/hybrid endpoint."""

    @pytest.mark.asyncio
    async def test_hybrid_search_request_validation(self):
        """HybridSearchRequest validates required fields."""
        from src.api.routes.search import HybridSearchRequest
        from pydantic import ValidationError

        # Valid request
        request = HybridSearchRequest(
            query="What is revenue?",
            deal_id="deal-123",
            num_results=10,
        )
        assert request.query == "What is revenue?"
        assert request.deal_id == "deal-123"
        assert request.num_results == 10

        # Missing required fields
        with pytest.raises(ValidationError):
            HybridSearchRequest(query="test")  # Missing deal_id

    @pytest.mark.asyncio
    async def test_hybrid_search_request_query_length(self):
        """HybridSearchRequest validates query length."""
        from src.api.routes.search import HybridSearchRequest
        from pydantic import ValidationError

        # Empty query should fail
        with pytest.raises(ValidationError):
            HybridSearchRequest(query="", deal_id="deal-123")

    @pytest.mark.asyncio
    async def test_hybrid_search_request_num_results_bounds(self):
        """HybridSearchRequest validates num_results bounds."""
        from src.api.routes.search import HybridSearchRequest
        from pydantic import ValidationError

        # Too low
        with pytest.raises(ValidationError):
            HybridSearchRequest(query="test", deal_id="deal-123", num_results=0)

        # Too high
        with pytest.raises(ValidationError):
            HybridSearchRequest(query="test", deal_id="deal-123", num_results=100)

        # Valid bounds
        request = HybridSearchRequest(query="test", deal_id="deal-123", num_results=50)
        assert request.num_results == 50

    @pytest.mark.asyncio
    async def test_hybrid_search_response_model(self):
        """HybridSearchResponse has correct structure."""
        from src.api.routes.search import HybridSearchResponse, HybridSourceCitation

        response = HybridSearchResponse(
            query="test query",
            results=[],
            sources=[],
            entities=["Company A"],
            latency_ms=250,
            result_count=0,
        )

        assert response.query == "test query"
        assert response.latency_ms == 250
        assert response.result_count == 0

    @pytest.mark.asyncio
    async def test_verify_deal_exists_found(self):
        """verify_deal_exists returns True when deal exists."""
        from src.api.routes.search import verify_deal_exists

        # Mock the full chain: db.client.table(...).select(...).eq(...).execute()
        mock_result = MagicMock()
        mock_result.data = [{"id": "deal-123"}]

        mock_db = MagicMock()
        mock_db.client.table.return_value.select.return_value.eq.return_value.execute = AsyncMock(
            return_value=mock_result
        )

        result = await verify_deal_exists("deal-123", mock_db)
        assert result is True

    @pytest.mark.asyncio
    async def test_verify_deal_exists_not_found(self):
        """verify_deal_exists returns False when deal not found."""
        from src.api.routes.search import verify_deal_exists

        # Mock the full chain: db.client.table(...).select(...).eq(...).execute()
        mock_result = MagicMock()
        mock_result.data = []  # No results

        mock_db = MagicMock()
        mock_db.client.table.return_value.select.return_value.eq.return_value.execute = AsyncMock(
            return_value=mock_result
        )

        result = await verify_deal_exists("nonexistent-deal", mock_db)
        assert result is False

    @pytest.mark.asyncio
    async def test_verify_deal_exists_error_handling(self):
        """verify_deal_exists handles database errors gracefully."""
        from src.api.routes.search import verify_deal_exists

        # Mock to raise exception on the chain
        mock_db = MagicMock()
        mock_db.client.table.return_value.select.return_value.eq.return_value.execute = AsyncMock(
            side_effect=Exception("Database error")
        )

        result = await verify_deal_exists("deal-123", mock_db)
        assert result is False

    @pytest.mark.asyncio
    async def test_hybrid_source_citation_model(self):
        """HybridSourceCitation validates type field."""
        from src.api.routes.search import HybridSourceCitation
        from pydantic import ValidationError

        # Valid types
        citation = HybridSourceCitation(
            type="document",
            id="doc-1",
            title="Report.pdf",
            confidence=0.85,
        )
        assert citation.type == "document"

        citation_qa = HybridSourceCitation(
            type="qa",
            id="qa-1",
            title="Q&A Response",
            confidence=0.95,
        )
        assert citation_qa.type == "qa"

        citation_chat = HybridSourceCitation(
            type="chat",
            id="chat-1",
            title="Analyst Chat",
            confidence=0.90,
        )
        assert citation_chat.type == "chat"

        # Invalid type
        with pytest.raises(ValidationError):
            HybridSourceCitation(
                type="invalid",
                id="test",
                title="Test",
                confidence=0.5,
            )
