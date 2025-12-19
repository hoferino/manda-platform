"""
Context-Knowledge Integration Test Fixtures

Story: E11.7 - Context-Knowledge Integration Tests
Python fixtures for integration testing of the context-knowledge pipeline.

Provides:
- Sample deal and document data
- Entity variation test cases
- Mock Graphiti response factories
- Test configuration helpers
"""

import os
from typing import Any
from uuid import uuid4
from unittest.mock import MagicMock, AsyncMock


# ============================================================================
# Test Data Constants
# ============================================================================

def sample_deal_id() -> str:
    """Generate a sample deal UUID for testing."""
    return str(uuid4())


def sample_document_id() -> str:
    """Generate a sample document UUID for testing."""
    return str(uuid4())


# Static test deal for consistent testing
TEST_DEAL = {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Test Acquisition Target",
    "created_at": "2024-12-01T00:00:00Z",
}

TEST_DOCUMENT = {
    "id": "doc-001-test",
    "name": "Q3 Financials 2024.pdf",
    "type": "financial",
    "deal_id": TEST_DEAL["id"],
}


# ============================================================================
# Entity Variation Test Cases
# ============================================================================

ENTITY_VARIATIONS = [
    {
        "canonical": "ABC Corporation",
        "variations": ["ABC Corp", "A.B.C. Corporation", "ABC Inc", "ABC"],
        "expected_resolution": "ABC Corporation",
    },
    {
        "canonical": "Q3 2024",
        "variations": ["Q3'24", "3Q 2024", "Third Quarter 2024", "Q3-2024"],
        "expected_resolution": "Q3 2024",
    },
    {
        "canonical": "John Smith",
        "variations": ["J. Smith", "John S.", "Mr. Smith", "Smith, John"],
        "expected_resolution": "John Smith",
    },
]


# ============================================================================
# Sample Facts for Testing
# ============================================================================

SAMPLE_FACTS = [
    {
        "content": "Q3 revenue was $5.2M, corrected from initial $4.8M estimate",
        "source_type": "correction",
        "confidence": 0.95,
    },
    {
        "content": "The company has 150 employees as of December 2024",
        "source_type": "new_info",
        "confidence": 0.85,
    },
    {
        "content": "Yes, EBITDA margins were 22% in Q3, confirmed",
        "source_type": "confirmation",
        "confidence": 0.90,
    },
]


# ============================================================================
# Mock Factories
# ============================================================================

def create_mock_graphiti_service() -> MagicMock:
    """Create a mock Graphiti ingestion service for testing."""
    mock = MagicMock()

    # Mock add_episode response
    mock_result = MagicMock()
    mock_result.episode_count = 1
    mock_result.elapsed_ms = 150
    mock_result.estimated_cost_usd = 0.00001

    mock.ingest_chat_fact = AsyncMock(return_value=mock_result)
    mock.add_episode = AsyncMock(return_value={
        "success": True,
        "episode_id": f"ep-{uuid4()}",
    })
    mock.search = AsyncMock(return_value=[])

    return mock


def create_mock_db_client(deal_id: str | None = None) -> MagicMock:
    """Create a mock Supabase client for testing.

    Args:
        deal_id: Optional deal ID to return. If None, returns empty (deal not found).
    """
    mock = MagicMock()

    # Mock table().select().eq().execute() chain
    mock_table = MagicMock()
    mock_select = MagicMock()
    mock_eq = MagicMock()
    mock_execute = MagicMock()

    if deal_id:
        mock_execute.data = [{"id": deal_id}]
    else:
        mock_execute.data = []

    mock_eq.execute = AsyncMock(return_value=mock_execute)
    mock_select.eq = MagicMock(return_value=mock_eq)
    mock_table.select = MagicMock(return_value=mock_select)
    mock.client.table = MagicMock(return_value=mock_table)

    return mock


def create_mock_search_response(
    scenario: str = "fact_found",
    query: str = "test query"
) -> dict[str, Any]:
    """Create a mock hybrid search response.

    Args:
        scenario: One of 'fact_found', 'no_results', 'multiple_results', 'error'
        query: The search query string
    """
    if scenario == "error":
        raise Exception("Graphiti service unavailable")

    if scenario == "no_results":
        return {
            "query": query,
            "results": [],
            "sources": [],
            "entities": [],
            "latency_ms": 30,
            "result_count": 0,
        }

    results = [
        {
            "id": "ep-001",
            "content": "Q3 revenue was $5.2M",
            "score": 0.95,
            "source_type": "episode",
            "source_channel": "analyst_correction",
            "confidence": 0.95,
            "citation": {
                "type": "chat",
                "id": "chat-001",
                "title": "Analyst Correction",
                "excerpt": "User corrected Q3 revenue from $4.8M to $5.2M",
                "confidence": 0.95,
            },
        },
    ]

    if scenario == "multiple_results":
        results.append({
            "id": "ep-002",
            "content": "Company has 150 employees",
            "score": 0.88,
            "source_type": "episode",
            "source_channel": "chat_ingestion",
            "confidence": 0.85,
            "citation": {
                "type": "chat",
                "id": "chat-002",
                "title": "User Input",
                "excerpt": "User provided employee count",
                "confidence": 0.85,
            },
        })

    return {
        "query": query,
        "results": results,
        "sources": [r["citation"] for r in results if r.get("citation")],
        "entities": ["Q3 2024", "Revenue"],
        "latency_ms": 100 if scenario == "multiple_results" else 50,
        "result_count": len(results),
    }


def create_mock_ingest_response(success: bool = True) -> dict[str, Any]:
    """Create a mock ingestion response.

    Args:
        success: Whether the ingestion succeeded
    """
    if success:
        return {
            "success": True,
            "episode_count": 1,
            "elapsed_ms": 150,
            "estimated_cost_usd": 0.00001,
        }
    else:
        return {
            "success": False,
            "error": "Ingestion failed",
            "elapsed_ms": 50,
        }


# ============================================================================
# Environment Helpers
# ============================================================================

def should_run_integration_tests() -> bool:
    """Check if integration tests should run based on environment."""
    return os.getenv("RUN_INTEGRATION_TESTS", "").lower() == "true"


def get_test_env_config() -> dict[str, Any]:
    """Get test environment configuration."""
    return {
        "graphiti_url": os.getenv("GRAPHITI_API_URL", "http://localhost:8001"),
        "processing_api_key": os.getenv("PROCESSING_API_KEY", ""),
        "neo4j_uri": os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        "voyage_api_key": os.getenv("VOYAGE_API_KEY", ""),
        "has_required_env": bool(os.getenv("PROCESSING_API_KEY")) or os.getenv("PYTEST_CURRENT_TEST") is not None,
    }


def skip_if_no_integration_env(reason: str = "Integration tests require RUN_INTEGRATION_TESTS=true"):
    """Decorator-style check for skipping tests without integration environment."""
    import pytest
    if not should_run_integration_tests():
        pytest.skip(reason)
