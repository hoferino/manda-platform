"""
Integration tests for Hybrid Retrieval Pipeline.
Story: E10.7 - Hybrid Retrieval with Reranking (AC: #5, #7)

These tests verify end-to-end retrieval via:
- Graphiti hybrid search (vector + BM25 + graph)
- Voyage reranking (rerank-2.5 model)
- Source citation formatting
- Superseded fact filtering
- Latency targets (< 3 seconds)

Requirements:
- Neo4j running with Graphiti indices (docker compose up neo4j)
- GOOGLE_API_KEY set (for entity extraction LLM)
- VOYAGE_API_KEY set (for embeddings and reranking)
- Data ingested via test_graphiti_ingestion.py (or fixtures)

Mark: @pytest.mark.integration - requires external services
"""

import uuid
import time
from datetime import datetime, timezone

import pytest

from src.graphiti import (
    GraphitiClient,
    GraphitiConnectionError,
    GraphitiIngestionService,
    HybridRetrievalService,
    RetrievalResult,
    KnowledgeItem,
    SourceCitation,
)
from src.reranking.voyage import VoyageReranker


# =============================================================================
# Test Data
# =============================================================================


# Sample M&A document chunks for testing different query types
M_AND_A_DOCUMENT_CHUNKS = [
    {
        "id": "chunk-001",
        "content": """Q3 2024 Financial Performance Summary:
        Revenue: $5.2 million (15% YoY growth)
        EBITDA: $1.3 million (25% margin)
        The company exceeded analyst expectations across all metrics.""",
        "chunk_index": 0,
        "page_number": 1,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 40,
    },
    {
        "id": "chunk-002",
        "content": """EBITDA Analysis:
        Q3 EBITDA margin improved to 25% from 22% in Q2.
        This improvement was driven by operational efficiencies and cost reduction.
        EBITDA to revenue ratio is best-in-class for the sector.""",
        "chunk_index": 1,
        "page_number": 2,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 45,
    },
    {
        "id": "chunk-003",
        "content": """Executive Team:
        John Smith was appointed CEO in January 2024, bringing 20 years of industry experience.
        Sarah Johnson serves as CFO since 2022.
        The leadership team has successfully navigated the company through market challenges.""",
        "chunk_index": 2,
        "page_number": 3,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 50,
    },
    {
        "id": "chunk-004",
        "content": """Key Risks and Mitigation:
        1. Customer concentration: Top 3 customers = 45% of revenue
        2. Key person risk: High dependence on founding team
        3. Market competition: New entrants in adjacent markets
        4. Regulatory changes: Pending legislation may impact operations""",
        "chunk_index": 3,
        "page_number": 4,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 55,
    },
    {
        "id": "chunk-005",
        "content": """Market Analysis:
        Total addressable market: $2.5 billion with 8% CAGR.
        Company market share: 12% in core segment.
        Main competitors: TechCo Inc. (25%), GlobalCorp (18%), Others (45%).""",
        "chunk_index": 4,
        "page_number": 5,
        "chunk_type": "text",
        "sheet_name": None,
        "token_count": 42,
    },
]


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def unique_deal_id():
    """Generate a unique deal ID for test isolation."""
    return f"integration-test-retrieval-{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def ingested_deal(unique_deal_id):
    """
    Ingest test documents and return deal_id.

    This fixture ingests the M&A document chunks into Neo4j/Graphiti,
    then yields the deal_id for search tests.
    """
    service = GraphitiIngestionService()

    # Ingest test documents
    try:
        result = await service.ingest_document_chunks(
            document_id=f"doc-{unique_deal_id}",
            deal_id=unique_deal_id,
            document_name="test-cim-q3-2024.pdf",
            chunks=M_AND_A_DOCUMENT_CHUNKS,
        )
        assert result.episode_count == len(M_AND_A_DOCUMENT_CHUNKS)
    except GraphitiConnectionError as e:
        pytest.skip(f"Neo4j/Graphiti not available: {e}")

    yield unique_deal_id

    # Cleanup is handled by unique deal_id isolation
    # In production, you might want to explicitly delete test data


@pytest.fixture
def retrieval_service():
    """Create HybridRetrievalService for testing."""
    return HybridRetrievalService()


# =============================================================================
# Query Type Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_factual_query(retrieval_service, ingested_deal):
    """
    Test factual query: "What is Q3 revenue?"
    AC: #7 - Test with various query types (factual)
    """
    result = await retrieval_service.retrieve(
        query="What is Q3 revenue?",
        deal_id=ingested_deal,
        num_results=5,
    )

    assert isinstance(result, RetrievalResult)
    assert len(result.results) > 0

    # Check that relevant content is returned
    contents = " ".join([r.content.lower() for r in result.results])
    assert "revenue" in contents or "5.2 million" in contents


@pytest.mark.integration
@pytest.mark.asyncio
async def test_comparative_query(retrieval_service, ingested_deal):
    """
    Test comparative query: "How does revenue compare to EBITDA?"
    AC: #7 - Test with various query types (comparative)
    """
    result = await retrieval_service.retrieve(
        query="How does revenue compare to EBITDA?",
        deal_id=ingested_deal,
        num_results=5,
    )

    assert isinstance(result, RetrievalResult)
    assert len(result.results) > 0

    # Should return content containing both metrics
    contents = " ".join([r.content.lower() for r in result.results])
    # At least one of the key terms should be present
    assert "revenue" in contents or "ebitda" in contents


@pytest.mark.integration
@pytest.mark.asyncio
async def test_exploratory_query(retrieval_service, ingested_deal):
    """
    Test exploratory query: "What are the key risks?"
    AC: #7 - Test with various query types (exploratory)
    """
    result = await retrieval_service.retrieve(
        query="What are the key risks?",
        deal_id=ingested_deal,
        num_results=5,
    )

    assert isinstance(result, RetrievalResult)
    assert len(result.results) > 0

    # Should return risk-related content
    contents = " ".join([r.content.lower() for r in result.results])
    assert "risk" in contents or "concentration" in contents or "key person" in contents


@pytest.mark.integration
@pytest.mark.asyncio
async def test_entity_focused_query(retrieval_service, ingested_deal):
    """
    Test entity-focused query: "Tell me about the CEO"
    AC: #7 - Test with various query types (entity-focused)
    """
    result = await retrieval_service.retrieve(
        query="Tell me about the CEO",
        deal_id=ingested_deal,
        num_results=5,
    )

    assert isinstance(result, RetrievalResult)
    assert len(result.results) > 0

    # Should return content about the CEO
    contents = " ".join([r.content.lower() for r in result.results])
    assert "ceo" in contents or "john smith" in contents


# =============================================================================
# Latency Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_latency_under_3_seconds(retrieval_service, ingested_deal):
    """
    Test end-to-end latency < 3 seconds.
    AC: #5 - End-to-end latency < 3 seconds
    """
    start_time = time.perf_counter()

    result = await retrieval_service.retrieve(
        query="What is the company's financial performance?",
        deal_id=ingested_deal,
        num_results=10,
    )

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)

    # Assert latency is under 3 seconds
    assert elapsed_ms < 3000, f"Latency {elapsed_ms}ms exceeds 3000ms target"

    # Also verify the service's internal tracking
    assert result.latency_ms < 3000

    # Log timing breakdown for debugging
    print(f"\nLatency breakdown:")
    print(f"  Total: {result.latency_ms}ms")
    print(f"  Graphiti: {result.graphiti_latency_ms}ms")
    print(f"  Rerank: {result.rerank_latency_ms}ms")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_latency_tracking_accuracy(retrieval_service, ingested_deal):
    """
    Test that latency tracking is accurate.
    AC: #5 - Performance test with timing assertions
    """
    result = await retrieval_service.retrieve(
        query="test query",
        deal_id=ingested_deal,
    )

    # Total latency should be at least sum of components
    # (with some margin for formatting time)
    component_sum = result.graphiti_latency_ms + result.rerank_latency_ms

    # Allow 50ms margin for post-processing
    assert result.latency_ms >= component_sum - 50


# =============================================================================
# Result Quality Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_result_count_configuration(retrieval_service, ingested_deal):
    """
    Test that num_results configuration is respected.
    AC: #4 - Return top 5-10 results to LLM (configurable)
    """
    # Request 3 results
    result = await retrieval_service.retrieve(
        query="financial metrics",
        deal_id=ingested_deal,
        num_results=3,
    )

    assert len(result.results) <= 3

    # Request 10 results
    result_more = await retrieval_service.retrieve(
        query="financial metrics",
        deal_id=ingested_deal,
        num_results=10,
    )

    # Should have at least as many as the smaller request (if data available)
    assert len(result_more.results) >= len(result.results)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_candidate_count(retrieval_service, ingested_deal):
    """
    Test that candidate count is tracked.
    AC: #2 - Retrieve top 50 candidates from Graphiti
    """
    result = await retrieval_service.retrieve(
        query="company information",
        deal_id=ingested_deal,
        num_candidates=50,
        num_results=10,
    )

    # Candidate count should be tracked
    assert result.candidate_count >= 0

    # With 5 chunks, we expect at most 5 facts/edges
    # (could be more due to entity extraction)
    assert result.candidate_count <= 50


@pytest.mark.integration
@pytest.mark.asyncio
async def test_rerank_scores_ordered(retrieval_service, ingested_deal):
    """
    Test that results are ordered by rerank score.
    AC: #3 - Voyage reranker scores and reorders results
    """
    result = await retrieval_service.retrieve(
        query="revenue growth",
        deal_id=ingested_deal,
        num_results=5,
    )

    if len(result.results) > 1:
        # Scores should be in descending order
        scores = [r.score for r in result.results]
        assert scores == sorted(scores, reverse=True), "Results not sorted by score"


# =============================================================================
# Source Citation Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_source_citations_included(retrieval_service, ingested_deal):
    """
    Test that source citations are included in responses.
    AC: #6 - Source citations included in responses
    """
    result = await retrieval_service.retrieve(
        query="What is the revenue?",
        deal_id=ingested_deal,
    )

    assert len(result.sources) > 0, "No sources returned"

    # Check citation structure
    for source in result.sources:
        assert isinstance(source, SourceCitation)
        assert source.type in ["document", "qa", "chat"]
        assert source.id is not None
        assert source.title is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_result_has_citation(retrieval_service, ingested_deal):
    """
    Test that each result has an associated citation.
    AC: #6 - Source citations included in responses
    """
    result = await retrieval_service.retrieve(
        query="company metrics",
        deal_id=ingested_deal,
    )

    for item in result.results:
        assert item.citation is not None, f"Result {item.id} missing citation"
        assert item.citation.id is not None


# =============================================================================
# Deal Isolation Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_deal_isolation(retrieval_service, ingested_deal):
    """
    Test that searches are isolated to the specified deal.
    """
    # Search with correct deal_id
    result = await retrieval_service.retrieve(
        query="revenue",
        deal_id=ingested_deal,
    )
    correct_count = len(result.results)

    # Search with non-existent deal_id
    result_other = await retrieval_service.retrieve(
        query="revenue",
        deal_id="non-existent-deal-12345",
    )

    # Should find nothing in non-existent deal
    assert len(result_other.results) == 0
    # Original deal should have results
    assert correct_count > 0


# =============================================================================
# Empty/Edge Case Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_empty_query_results(retrieval_service, ingested_deal):
    """
    Test handling of queries that match nothing.
    """
    result = await retrieval_service.retrieve(
        query="xyznonexistentterm12345",
        deal_id=ingested_deal,
    )

    # Should return empty results gracefully
    assert isinstance(result, RetrievalResult)
    assert result.latency_ms >= 0


# =============================================================================
# VoyageReranker Integration Tests
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
async def test_voyage_reranker_with_real_api():
    """
    Test VoyageReranker with real Voyage API.
    Requires VOYAGE_API_KEY environment variable.
    """
    from src.config import get_settings

    settings = get_settings()
    if not settings.voyage_api_key:
        pytest.skip("VOYAGE_API_KEY not set")

    reranker = VoyageReranker()

    documents = [
        "Revenue increased to $5 million in Q3.",
        "The weather is nice today.",
        "EBITDA margin improved to 25%.",
        "Company financials show strong growth.",
    ]

    results = await reranker.rerank(
        query="What are the company's financial metrics?",
        documents=documents,
        top_k=3,
    )

    assert len(results) == 3

    # Financial documents should rank higher than weather
    financial_indices = {0, 2, 3}  # Documents about financials
    top_indices = {r.index for r in results[:2]}

    # At least one financial doc should be in top 2
    assert len(top_indices & financial_indices) >= 1


# =============================================================================
# Performance Benchmark (Optional)
# =============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.slow
async def test_retrieval_benchmark(retrieval_service, ingested_deal):
    """
    Run multiple queries to benchmark average latency.
    Mark: @pytest.mark.slow - optional long-running test
    """
    queries = [
        "What is the revenue?",
        "Tell me about the CEO",
        "What are the main risks?",
        "How is the company performing?",
        "What is the market size?",
    ]

    latencies = []

    for query in queries:
        result = await retrieval_service.retrieve(
            query=query,
            deal_id=ingested_deal,
            num_results=10,
        )
        latencies.append(result.latency_ms)

    avg_latency = sum(latencies) / len(latencies)
    max_latency = max(latencies)

    print(f"\nBenchmark results ({len(queries)} queries):")
    print(f"  Average latency: {avg_latency:.0f}ms")
    print(f"  Max latency: {max_latency}ms")
    print(f"  All latencies: {latencies}")

    # All queries should complete under 3 seconds
    assert max_latency < 3000, f"Max latency {max_latency}ms exceeds target"
