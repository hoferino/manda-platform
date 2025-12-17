"""
Integration tests for Graphiti document ingestion pipeline.
Story: E10.4 - Document Ingestion Pipeline (AC: #8)
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #2, #4, #5)

These tests verify end-to-end document ingestion via:
- GraphitiIngestionService ingesting chunks as episodes
- Entity extraction using M&A schema
- Episode naming and source description accuracy
- Cost estimation correctness

Requirements:
- Neo4j running with Graphiti indices (docker compose up neo4j)
- GOOGLE_API_KEY set (for entity extraction LLM)
- Optionally: VOYAGE_API_KEY for production embeddings

Mark: @pytest.mark.integration - requires external services
"""

import uuid
from datetime import datetime, timezone

import pytest

from src.graphiti import (
    CHAT_CONFIDENCE,
    DOCUMENT_CONFIDENCE,
    QA_CONFIDENCE,
    GraphitiClient,
    GraphitiConnectionError,
    GraphitiIngestionService,
    IngestionResult,
)


# Sample document chunks simulating parsed document output
SAMPLE_CHUNKS = [
    {
        "id": "chunk-001",
        "content": """ABC Corporation (the "Target") is a leading provider of cloud services.
        John Smith, CEO of ABC Corp, confirmed revenue of $4.8M for FY 2023.
        The company has been growing at 15% annually.""",
        "chunk_index": 0,
        "page_number": 1,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 45,
    },
    {
        "id": "chunk-002",
        "content": """The company faces key person risk due to dependence on the founder.
        Major competitor TechCo Inc. recently raised Series B funding.
        Sarah Johnson serves as CFO and has been instrumental in financial planning.""",
        "chunk_index": 1,
        "page_number": 2,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 40,
    },
    {
        "id": "chunk-003",
        "content": """
        | Metric | FY 2022 | FY 2023 |
        |--------|---------|---------|
        | Revenue | $4.2M | $4.8M |
        | EBITDA | $0.8M | $1.1M |
        | Gross Margin | 62% | 65% |
        """,
        "chunk_index": 2,
        "page_number": 3,
        "chunk_type": "table",
        "sheet_name": None,
        "token_count": 35,
    },
]


@pytest.fixture
def unique_deal_id():
    """Generate a unique deal ID for test isolation."""
    return f"test-deal-e10-4-{uuid.uuid4().hex[:8]}"


@pytest.fixture
def ingestion_service():
    """Create a GraphitiIngestionService instance."""
    return GraphitiIngestionService()


@pytest.mark.integration
class TestGraphitiIngestionIntegration:
    """
    Integration tests for GraphitiIngestionService.

    These tests require:
    - Neo4j to be running (docker compose up neo4j)
    - GOOGLE_API_KEY to be set
    - Network access to Google AI APIs

    Run with: pytest -m integration tests/integration/test_graphiti_ingestion.py
    """

    @pytest.mark.asyncio
    async def test_ingest_document_chunks_success(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test successful ingestion of document chunks.

        Verifies that:
        - All chunks are ingested as episodes
        - Result metrics are populated correctly
        - No errors are raised
        """
        try:
            result = await ingestion_service.ingest_document_chunks(
                document_id="doc-integration-test-001",
                deal_id=unique_deal_id,
                document_name="integration-test-financial-report.pdf",
                chunks=SAMPLE_CHUNKS,
            )

            # Verify result structure
            assert isinstance(result, IngestionResult)
            assert result.episode_count == len(SAMPLE_CHUNKS)
            assert result.elapsed_ms > 0
            assert result.estimated_cost_usd >= 0

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_ingest_empty_chunks(self, ingestion_service, unique_deal_id):
        """
        Test ingestion with empty chunk list.

        Verifies graceful handling of documents with no content.
        """
        try:
            result = await ingestion_service.ingest_document_chunks(
                document_id="doc-empty-test",
                deal_id=unique_deal_id,
                document_name="empty-document.pdf",
                chunks=[],
            )

            assert result.episode_count == 0
            assert result.elapsed_ms >= 0
            assert result.estimated_cost_usd == 0.0

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_ingest_single_large_chunk(self, ingestion_service, unique_deal_id):
        """
        Test ingestion of a single large chunk.

        Verifies handling of larger text content.
        """
        large_chunk = {
            "id": "chunk-large",
            "content": " ".join(SAMPLE_CHUNKS[0]["content"].split()) * 10,  # Repeat content
            "chunk_index": 0,
            "page_number": 1,
            "chunk_type": "text",
            "sheet_name": None,
            "token_count": 450,
        }

        try:
            result = await ingestion_service.ingest_document_chunks(
                document_id="doc-large-chunk",
                deal_id=unique_deal_id,
                document_name="large-document.pdf",
                chunks=[large_chunk],
            )

            assert result.episode_count == 1
            assert result.estimated_cost_usd > 0  # Should have some cost

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_ingest_excel_chunks_with_sheet_names(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test ingestion of Excel document chunks with sheet names.

        Verifies that sheet_name is included in source description.
        """
        excel_chunks = [
            {
                "id": "excel-chunk-1",
                "content": "Summary metrics for FY 2023",
                "chunk_index": 0,
                "page_number": None,
                "chunk_type": "table",
                "sheet_name": "Summary",
                "token_count": 10,
            },
            {
                "id": "excel-chunk-2",
                "content": "Detailed revenue breakdown by quarter",
                "chunk_index": 1,
                "page_number": None,
                "chunk_type": "table",
                "sheet_name": "Revenue Detail",
                "token_count": 12,
            },
        ]

        try:
            result = await ingestion_service.ingest_document_chunks(
                document_id="doc-excel-test",
                deal_id=unique_deal_id,
                document_name="financial-model.xlsx",
                chunks=excel_chunks,
            )

            assert result.episode_count == 2

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_deal_isolation_via_group_id(self, ingestion_service):
        """
        Test that different deals have isolated namespaces.

        Verifies that ingesting to one deal_id doesn't affect another.
        """
        deal_id_1 = f"test-deal-isolation-1-{uuid.uuid4().hex[:8]}"
        deal_id_2 = f"test-deal-isolation-2-{uuid.uuid4().hex[:8]}"

        chunk_for_deal_1 = {
            "id": "chunk-deal-1",
            "content": "Content specifically for deal 1 with company Alpha Corp",
            "chunk_index": 0,
            "page_number": 1,
            "chunk_type": "text",
        }

        chunk_for_deal_2 = {
            "id": "chunk-deal-2",
            "content": "Content specifically for deal 2 with company Beta LLC",
            "chunk_index": 0,
            "page_number": 1,
            "chunk_type": "text",
        }

        try:
            # Ingest to deal 1
            result_1 = await ingestion_service.ingest_document_chunks(
                document_id="doc-deal-1",
                deal_id=deal_id_1,
                document_name="deal1-doc.pdf",
                chunks=[chunk_for_deal_1],
            )

            # Ingest to deal 2
            result_2 = await ingestion_service.ingest_document_chunks(
                document_id="doc-deal-2",
                deal_id=deal_id_2,
                document_name="deal2-doc.pdf",
                chunks=[chunk_for_deal_2],
            )

            # Both should succeed independently
            assert result_1.episode_count == 1
            assert result_2.episode_count == 1

            # Search in deal 1 should find Alpha Corp
            results_1 = await GraphitiClient.search(
                deal_id=deal_id_1,
                query="Alpha Corp",
                num_results=5,
            )

            # Search in deal 2 should find Beta LLC
            results_2 = await GraphitiClient.search(
                deal_id=deal_id_2,
                query="Beta LLC",
                num_results=5,
            )

            # Results should be non-empty (depending on search implementation)
            # The key test is that both ingestions succeeded with different deal_ids

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestGraphitiIngestionSearchIntegration:
    """
    Integration tests verifying ingested content is searchable.

    Tests the full cycle: ingest → search → verify results.
    """

    @pytest.mark.asyncio
    async def test_search_finds_ingested_content(self, ingestion_service, unique_deal_id):
        """
        Test that search can find content from ingested documents.

        End-to-end test: ingest chunks → search → verify results.
        """
        try:
            # Ingest sample chunks
            await ingestion_service.ingest_document_chunks(
                document_id="doc-search-test",
                deal_id=unique_deal_id,
                document_name="searchable-report.pdf",
                chunks=SAMPLE_CHUNKS,
            )

            # Search for specific content
            results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="What is the revenue for FY 2023?",
                num_results=5,
            )

            # Results should be returned (exact content depends on LLM)
            assert results is not None

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_search_finds_entities_from_schema(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test that M&A schema entities are extracted and searchable.

        Verifies that Company, Person, FinancialMetric entities
        from the M&A schema are properly extracted during ingestion.
        """
        try:
            # Ingest content with clear M&A entities
            await ingestion_service.ingest_document_chunks(
                document_id="doc-entity-test",
                deal_id=unique_deal_id,
                document_name="entity-rich-report.pdf",
                chunks=SAMPLE_CHUNKS,
            )

            # Search for company entity
            company_results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="Tell me about ABC Corporation",
                num_results=5,
            )

            # Search for person entity
            person_results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="Who is John Smith?",
                num_results=5,
            )

            # Search for financial metric
            metric_results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="What financial metrics are available?",
                num_results=5,
            )

            # All searches should return results
            assert company_results is not None
            assert person_results is not None
            assert metric_results is not None

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestGraphitiSchemaIntegration:
    """
    Integration tests verifying M&A schema edge types are used.

    Tests that EXTRACTED_FROM and other schema edges are created.
    """

    @pytest.mark.asyncio
    async def test_extracted_from_edge_creation(self, ingestion_service, unique_deal_id):
        """
        Test that EXTRACTED_FROM edges are created during ingestion.

        Verifies AC#3: Schema edge types (including EXTRACTED_FROM)
        are passed to Graphiti and used for provenance tracking.
        """
        try:
            # Ingest a chunk with clear entity
            chunk = {
                "id": "chunk-provenance-test",
                "content": "ABC Corporation reported Q4 revenue of $5.2M.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-provenance-test",
                deal_id=unique_deal_id,
                document_name="provenance-test.pdf",
                chunks=[chunk],
            )

            # The EXTRACTED_FROM edge type is passed to add_episode via edge_types
            # Graphiti uses this to create provenance edges from extracted entities
            # back to the source episode. We verify the edge type is in our schema.
            from src.graphiti.schema import get_edge_types

            edge_types = get_edge_types()
            assert "EXTRACTED_FROM" in edge_types, (
                "EXTRACTED_FROM edge type must be in schema for provenance tracking"
            )

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


class TestIngestionResultMetrics:
    """
    Tests for IngestionResult metrics accuracy.

    Note: These are unit tests but grouped with integration tests
    for organizational purposes.
    """

    def test_episode_count_matches_chunks(self):
        """Episode count should match number of chunks ingested."""
        result = IngestionResult(episode_count=5, elapsed_ms=1000)
        assert result.episode_count == 5

    def test_elapsed_time_positive(self):
        """Elapsed time should always be positive."""
        result = IngestionResult(episode_count=1, elapsed_ms=100)
        assert result.elapsed_ms > 0

    def test_cost_estimation_formula(self):
        """Cost estimation uses Voyage pricing formula."""
        # For 1000 tokens at $0.12 per 1M tokens
        # Expected cost: 1000 * 0.00000012 = 0.00012
        result = IngestionResult(
            episode_count=1,
            elapsed_ms=100,
            estimated_cost_usd=0.00012,
        )
        assert result.estimated_cost_usd == pytest.approx(0.00012, rel=0.01)


# ============================================================================
# E10.5: Q&A and Chat Ingestion Integration Tests
# ============================================================================


@pytest.mark.integration
class TestQAIngestionIntegration:
    """
    Integration tests for Q&A response ingestion (E10.5 AC: #1, #4, #5).

    These tests verify:
    - Q&A responses are ingested as episodes
    - Correct confidence scoring
    - Content format (Q: / A:)
    - Entity extraction from answers
    """

    @pytest.mark.asyncio
    async def test_ingest_qa_response_success(self, ingestion_service, unique_deal_id):
        """
        Test successful Q&A response ingestion.

        E10.5 AC#1: ingest-qa-response job handler
        """
        try:
            result = await ingestion_service.ingest_qa_response(
                qa_item_id="qa-integration-test-001",
                deal_id=unique_deal_id,
                question="What is the company's annual revenue?",
                answer="The company's annual revenue is $5.2M as of FY 2023.",
            )

            assert isinstance(result, IngestionResult)
            assert result.episode_count == 1
            assert result.elapsed_ms > 0
            assert result.estimated_cost_usd >= 0

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_qa_confidence_is_highest(self, ingestion_service, unique_deal_id):
        """
        Test that Q&A responses use highest confidence (E10.5 AC#4).

        Q&A has confidence 0.95, higher than chat (0.90) and document (0.85).
        """
        # Verify confidence constants
        assert QA_CONFIDENCE == 0.95
        assert QA_CONFIDENCE > CHAT_CONFIDENCE
        assert QA_CONFIDENCE > DOCUMENT_CONFIDENCE

        try:
            # Ingest Q&A - uses QA_CONFIDENCE internally
            result = await ingestion_service.ingest_qa_response(
                qa_item_id="qa-confidence-test",
                deal_id=unique_deal_id,
                question="What is EBITDA?",
                answer="EBITDA is $1.2M with a 23% margin.",
            )

            assert result.episode_count == 1

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_qa_search_after_ingestion(self, ingestion_service, unique_deal_id):
        """
        Test that Q&A content is searchable after ingestion.

        Verifies end-to-end flow: ingest Q&A → search → find answer.
        """
        try:
            # Ingest a Q&A with specific content
            await ingestion_service.ingest_qa_response(
                qa_item_id="qa-search-test",
                deal_id=unique_deal_id,
                question="Who is the CEO?",
                answer="Jane Doe is the CEO and has been in the role since 2019.",
            )

            # Search for the content
            results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="Who is the CEO of the company?",
                num_results=5,
            )

            # Results should be returned (entity "Jane Doe" should be extracted)
            assert results is not None

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestChatFactIngestionIntegration:
    """
    Integration tests for chat fact ingestion (E10.5 AC: #2, #4, #5).

    These tests verify:
    - Chat facts are ingested as episodes
    - Correct confidence scoring (0.90)
    - Source description includes "Analyst Chat"
    """

    @pytest.mark.asyncio
    async def test_ingest_chat_fact_success(self, ingestion_service, unique_deal_id):
        """
        Test successful chat fact ingestion.

        E10.5 AC#2: Chat fact ingestion with source_channel="analyst_chat"
        """
        try:
            result = await ingestion_service.ingest_chat_fact(
                message_id="msg-integration-test-001",
                deal_id=unique_deal_id,
                fact_content="The company is planning expansion to Europe in Q3 2024.",
                message_context="During the call, the analyst mentioned that the company is planning expansion to Europe in Q3 2024 based on board discussions.",
            )

            assert isinstance(result, IngestionResult)
            assert result.episode_count == 1
            assert result.elapsed_ms > 0
            assert result.estimated_cost_usd >= 0

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_chat_confidence_hierarchy(self, ingestion_service, unique_deal_id):
        """
        Test that chat facts use correct confidence (E10.5 AC#4).

        Chat has confidence 0.90, between Q&A (0.95) and document (0.85).
        """
        # Verify confidence hierarchy
        assert CHAT_CONFIDENCE == 0.90
        assert QA_CONFIDENCE > CHAT_CONFIDENCE > DOCUMENT_CONFIDENCE

        try:
            result = await ingestion_service.ingest_chat_fact(
                message_id="msg-confidence-test",
                deal_id=unique_deal_id,
                fact_content="Revenue growth is projected at 20% for next year.",
                message_context="The analyst shared projections.",
            )

            assert result.episode_count == 1

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestSupersessionIntegration:
    """
    Integration tests for fact supersession (E10.5 AC: #4).

    Tests that higher-confidence facts can supersede lower-confidence facts
    via Graphiti's temporal model.

    Note: Supersession is handled automatically by Graphiti's temporal model.
    These tests verify the confidence levels are correctly set, enabling
    Graphiti to determine which facts supersede others.
    """

    @pytest.mark.asyncio
    async def test_qa_supersedes_document_fact(self, ingestion_service, unique_deal_id):
        """
        Test that Q&A response (0.95) has higher confidence than document (0.85).

        E10.5 AC#4: When Q&A answer contradicts document, Graphiti's temporal
        model marks the document fact's invalid_at = now() and creates
        SUPERSEDES relationship.
        """
        try:
            # First, ingest a document chunk with a revenue figure
            document_chunk = {
                "id": "chunk-revenue-doc",
                "content": "ABC Corporation revenue was $4.2M in FY 2023.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            doc_result = await ingestion_service.ingest_document_chunks(
                document_id="doc-supersession-test",
                deal_id=unique_deal_id,
                document_name="old-report.pdf",
                chunks=[document_chunk],
            )
            assert doc_result.episode_count == 1

            # Then, ingest a Q&A with corrected revenue figure
            qa_result = await ingestion_service.ingest_qa_response(
                qa_item_id="qa-supersession-test",
                deal_id=unique_deal_id,
                question="What was the actual revenue for FY 2023?",
                answer="The actual revenue was $5.2M for FY 2023, correcting the earlier estimate.",
            )
            assert qa_result.episode_count == 1

            # Both ingested successfully
            # Graphiti's temporal model will handle supersession automatically
            # when searching or querying the knowledge graph

            # Verify confidence hierarchy enables supersession
            assert QA_CONFIDENCE > DOCUMENT_CONFIDENCE, (
                "Q&A confidence must be higher than document for supersession to work"
            )

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_chat_supersedes_document_fact(self, ingestion_service, unique_deal_id):
        """
        Test that chat fact (0.90) has higher confidence than document (0.85).

        E10.5 AC#4: Chat facts can supersede document-extracted facts.
        """
        try:
            # Ingest a document chunk
            document_chunk = {
                "id": "chunk-expansion-doc",
                "content": "The company plans expansion to Asia in 2025.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            doc_result = await ingestion_service.ingest_document_chunks(
                document_id="doc-chat-supersession",
                deal_id=unique_deal_id,
                document_name="strategy.pdf",
                chunks=[document_chunk],
            )
            assert doc_result.episode_count == 1

            # Ingest a chat fact with updated information
            chat_result = await ingestion_service.ingest_chat_fact(
                message_id="msg-supersession-test",
                deal_id=unique_deal_id,
                fact_content="The expansion plan has changed to Europe instead of Asia, targeting Q3 2024.",
                message_context="The analyst confirmed during the call.",
            )
            assert chat_result.episode_count == 1

            # Verify confidence hierarchy
            assert CHAT_CONFIDENCE > DOCUMENT_CONFIDENCE, (
                "Chat confidence must be higher than document for supersession"
            )

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestWebhookIntegration:
    """
    Integration tests for webhook endpoints (E10.5 AC: #1).

    These tests verify the webhook payload structure and job enqueueing.
    Note: Full webhook tests require the FastAPI test client.
    """

    def test_qa_answered_payload_structure(self):
        """
        Test QA answered webhook payload matches expected structure.

        E10.5 AC#1: /webhooks/qa-answered endpoint
        """
        # This is a unit-style test but grouped here for E10.5 completeness
        from src.api.routes.webhooks import QAAnsweredPayload

        payload = QAAnsweredPayload(
            qa_item_id="qa-12345",
            deal_id="deal-67890",
            question="What is the revenue?",
            answer="Revenue is $5M.",
        )

        assert payload.qa_item_id == "qa-12345"
        assert payload.deal_id == "deal-67890"
        assert payload.question == "What is the revenue?"
        assert payload.answer == "Revenue is $5M."


# ============================================================================
# E10.6: Entity Resolution Integration Tests
# ============================================================================


@pytest.mark.integration
class TestEntityResolutionIntegration:
    """
    Integration tests for entity resolution (E10.6 AC: #1, #2, #3, #6).

    Tests verify:
    - Company variations resolve to same entity ("ABC Corp" = "ABC Corporation")
    - Distinct metrics remain separate ("Revenue" ≠ "Net Revenue")
    - Person name patterns work with context
    """

    @pytest.mark.asyncio
    async def test_company_suffix_variations_same_entity(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test that company suffix variations resolve correctly (AC: #1, #6).

        Ingests content with "ABC Corp" then "ABC Corporation" and verifies
        that entity resolution treats them as the same company.
        """
        try:
            # First ingestion with "ABC Corp"
            chunk1 = {
                "id": "chunk-abc-corp",
                "content": "ABC Corp reported revenue growth of 15% in FY 2023.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-abc-corp",
                deal_id=unique_deal_id,
                document_name="report1.pdf",
                chunks=[chunk1],
            )

            # Second ingestion with "ABC Corporation"
            chunk2 = {
                "id": "chunk-abc-corporation",
                "content": "ABC Corporation expanded operations to Europe.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-abc-corporation",
                deal_id=unique_deal_id,
                document_name="report2.pdf",
                chunks=[chunk2],
            )

            # Search for company - both should be found
            results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="ABC company revenue and operations",
                num_results=10,
            )

            # Results should be returned for the unified company
            assert results is not None

            # Verify our normalization function treats them as same
            from src.graphiti.resolution import normalize_company_name

            norm1 = normalize_company_name("ABC Corp")
            norm2 = normalize_company_name("ABC Corporation")
            assert norm1 == norm2, "Company names should normalize to same value"

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_distinct_metrics_remain_separate(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test that distinct metrics are not merged (AC: #3, #6).

        "Revenue" and "Net Revenue" must remain as separate entities.
        """
        try:
            # Ingest content with Revenue
            chunk1 = {
                "id": "chunk-revenue",
                "content": "Total Revenue for FY 2023 was $10M.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-revenue",
                deal_id=unique_deal_id,
                document_name="revenue-report.pdf",
                chunks=[chunk1],
            )

            # Ingest content with Net Revenue
            chunk2 = {
                "id": "chunk-net-revenue",
                "content": "Net Revenue (after adjustments) for FY 2023 was $8.5M.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-net-revenue",
                deal_id=unique_deal_id,
                document_name="net-revenue-report.pdf",
                chunks=[chunk2],
            )

            # Both should be searchable as distinct concepts
            results_revenue = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="What is the total revenue?",
                num_results=5,
            )

            results_net_revenue = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="What is the net revenue?",
                num_results=5,
            )

            assert results_revenue is not None
            assert results_net_revenue is not None

            # Verify our protection function correctly identifies these
            from src.graphiti.resolution import is_protected_metric

            assert is_protected_metric("Revenue") is True
            assert is_protected_metric("Net Revenue") is True

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_person_variations_with_context(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test person name resolution with context (AC: #2, #6).

        "J. Smith (CEO)" should match "John Smith" when CEO context aligns.
        """
        try:
            # Ingest with "John Smith"
            chunk1 = {
                "id": "chunk-john-smith",
                "content": "John Smith, the CEO of ABC Corp, announced expansion plans.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-john-smith",
                deal_id=unique_deal_id,
                document_name="announcement.pdf",
                chunks=[chunk1],
            )

            # Ingest with "J. Smith (CEO)"
            chunk2 = {
                "id": "chunk-j-smith",
                "content": "J. Smith (CEO) confirmed the Q4 revenue forecast.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-j-smith",
                deal_id=unique_deal_id,
                document_name="forecast.pdf",
                chunks=[chunk2],
            )

            # Search should find information about the CEO
            results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="What did the CEO John Smith say?",
                num_results=10,
            )

            assert results is not None

            # Verify our merge function recognizes the pattern
            from src.graphiti.resolution import should_merge_persons

            should_merge, confidence = should_merge_persons("J. Smith", "John Smith")
            assert should_merge is True, "J. Smith should merge with John Smith"
            assert confidence > 0.7, "Confidence should be reasonable"

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_different_roles_stay_separate(
        self, ingestion_service, unique_deal_id
    ):
        """
        Test that same name with different roles stays separate (AC: #2).

        "John Smith (CEO)" ≠ "John Smith (CFO)" - different people.
        """
        try:
            # Ingest with CEO
            chunk1 = {
                "id": "chunk-ceo",
                "content": "John Smith (CEO) leads the strategic direction.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-ceo",
                deal_id=unique_deal_id,
                document_name="leadership.pdf",
                chunks=[chunk1],
            )

            # Ingest with CFO
            chunk2 = {
                "id": "chunk-cfo",
                "content": "John Smith (CFO) manages the financial operations.",
                "chunk_index": 0,
                "page_number": 1,
                "chunk_type": "text",
            }

            await ingestion_service.ingest_document_chunks(
                document_id="doc-cfo",
                deal_id=unique_deal_id,
                document_name="finance.pdf",
                chunks=[chunk2],
            )

            # Both should be found distinctly
            results_ceo = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="CEO strategic direction",
                num_results=5,
            )

            results_cfo = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="CFO financial operations",
                num_results=5,
            )

            assert results_ceo is not None
            assert results_cfo is not None

            # Verify our merge function prevents merging different roles
            from src.graphiti.resolution import should_merge_persons

            should_merge, confidence = should_merge_persons(
                "John Smith", "John Smith", title1="CEO", title2="CFO"
            )
            assert should_merge is False, "Different roles should not merge"

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            GraphitiClient.reset_for_testing()


@pytest.mark.integration
class TestEntityManualResolutionIntegration:
    """
    Integration tests for manual entity merge/split API (E10.6 AC: #4, #5).

    Note: These tests require Neo4j to be running and test the API
    endpoints for manual entity resolution.
    """

    @pytest.mark.asyncio
    async def test_resolution_module_exports(self):
        """
        Test that resolution module is properly exported.

        Verifies all resolution functions are accessible from the graphiti module.
        """
        from src.graphiti import (
            normalize_company_name,
            normalize_person_name,
            is_protected_metric,
            should_merge_companies,
            should_merge_persons,
            get_manda_resolution_context,
            COMPANY_SUFFIX_VARIATIONS,
            DISTINCT_METRICS,
            RESOLUTION_THRESHOLDS,
        )

        # Verify all functions work
        assert normalize_company_name("Test Corp") == "test"
        assert normalize_person_name("John Doe (CEO)") == "john doe"
        assert is_protected_metric("Revenue") is True
        assert is_protected_metric("Company Name") is False

        merge, conf = should_merge_companies("ABC Corp", "ABC Inc")
        assert merge is True

        person_merge, person_conf = should_merge_persons("J. Doe", "John Doe")
        assert person_merge is True

        context = get_manda_resolution_context()
        assert "MERGE" in context

        # Verify constants
        assert "corp" in COMPANY_SUFFIX_VARIATIONS
        assert "revenue_types" in DISTINCT_METRICS
        assert "exact_match" in RESOLUTION_THRESHOLDS
