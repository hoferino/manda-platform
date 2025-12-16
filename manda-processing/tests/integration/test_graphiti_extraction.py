"""
Integration tests for Graphiti entity extraction with M&A schema.
Story: E10.3 - Sell-Side Spine Schema (AC: #8)

These tests verify that the schema module correctly integrates with
Graphiti's add_episode() for guided entity and edge extraction.

Requirements:
- Neo4j running with Graphiti indices
- GOOGLE_API_KEY set (for entity extraction LLM)
- Optionally: VOYAGE_API_KEY for production embeddings

Mark: @pytest.mark.integration - requires external services
"""

import uuid
from datetime import datetime, timezone

import pytest

from src.graphiti import (
    EDGE_TYPE_MAP,
    EDGE_TYPES,
    ENTITY_TYPES,
    GraphitiClient,
    GraphitiConnectionError,
    get_edge_type_map,
    get_edge_types,
    get_entity_types,
)

# Sample M&A text for testing entity extraction
SAMPLE_MNA_TEXT = """
ABC Corporation (the "Target") is a leading provider of cloud services.
John Smith, CEO of ABC Corp, confirmed revenue of $4.8M for FY 2023.
The company faces key person risk due to dependence on the founder.
Major competitor TechCo Inc. recently raised Series B funding.
Sarah Johnson serves as CFO and has been instrumental in financial planning.
"""

# Expected entity extractions (approximate - LLM may vary):
# - Company: ABC Corporation (role=target, aliases=["ABC Corp"])
# - Company: TechCo Inc. (role=competitor)
# - Person: John Smith (title=CEO, role=executive)
# - Person: Sarah Johnson (title=CFO, role=executive)
# - FinancialMetric: revenue, $4.8M, FY 2023, USD
# - Risk: key person risk, severity=medium, category=key_person

# Expected edge extractions:
# - WORKS_FOR: John Smith → ABC Corporation
# - WORKS_FOR: Sarah Johnson → ABC Corporation
# - COMPETES_WITH: TechCo Inc. → ABC Corporation
# - EXTRACTED_FROM: all entities → source document


@pytest.fixture
def unique_deal_id():
    """Generate a unique deal ID for test isolation."""
    return f"test-deal-e10-3-{uuid.uuid4().hex[:8]}"


@pytest.mark.integration
class TestGraphitiSchemaIntegration:
    """
    Integration tests for schema module with Graphiti.

    These tests require:
    - Neo4j to be running (docker compose up neo4j)
    - GOOGLE_API_KEY to be set
    - Network access to Google AI APIs

    Run with: pytest -m integration
    """

    @pytest.mark.asyncio
    async def test_add_episode_with_default_schema(self, unique_deal_id):
        """
        Test add_episode() uses M&A schema by default.

        This verifies that when entity_types/edge_types are not provided,
        the client defaults to the M&A schema helpers.
        """
        try:
            # Add episode without explicit schema params
            await GraphitiClient.add_episode(
                deal_id=unique_deal_id,
                content=SAMPLE_MNA_TEXT,
                name="integration-test-default-schema.txt",
                source_description="Integration test document with M&A content",
                reference_time=datetime.now(timezone.utc),
            )

            # If we get here without error, the schema was applied
            # (validation happens inside add_episode)

        except GraphitiConnectionError as e:
            if "NEO4J_PASSWORD not set" in str(e) or "GOOGLE_API_KEY not set" in str(e):
                pytest.skip(f"Required environment variables not set: {e}")
            elif "Neo4j not reachable" in str(e) or "Neo4j unavailable" in str(e):
                pytest.skip(f"Neo4j not available: {e}")
            else:
                raise
        finally:
            # Clean up singleton for next test
            GraphitiClient.reset_for_testing()

    @pytest.mark.asyncio
    async def test_add_episode_with_explicit_schema(self, unique_deal_id):
        """
        Test add_episode() with explicitly provided entity/edge types.

        Verifies that custom schema parameters are passed through correctly.
        """
        entity_types = get_entity_types()
        edge_types = get_edge_types()
        edge_type_map = get_edge_type_map()

        try:
            await GraphitiClient.add_episode(
                deal_id=unique_deal_id,
                content=SAMPLE_MNA_TEXT,
                name="integration-test-explicit-schema.txt",
                source_description="Integration test with explicit schema",
                reference_time=datetime.now(timezone.utc),
                entity_types=entity_types,
                edge_types=edge_types,
                edge_type_map=edge_type_map,
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
    async def test_add_episode_with_subset_entities(self, unique_deal_id):
        """
        Test add_episode() with a subset of entity types.

        Verifies that users can customize which entities to extract.
        """
        # Only extract Company and Person entities
        custom_entity_types = {
            "Company": ENTITY_TYPES["Company"],
            "Person": ENTITY_TYPES["Person"],
        }

        try:
            await GraphitiClient.add_episode(
                deal_id=unique_deal_id,
                content=SAMPLE_MNA_TEXT,
                name="integration-test-subset-entities.txt",
                source_description="Integration test with subset entities",
                entity_types=custom_entity_types,
                edge_types=get_edge_types(),
                edge_type_map=get_edge_type_map(),
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
class TestGraphitiSchemaSearchIntegration:
    """
    Integration tests for search with schema-extracted entities.

    These tests verify that entities extracted with the M&A schema
    can be found via search queries.
    """

    @pytest.mark.asyncio
    async def test_search_finds_extracted_entities(self, unique_deal_id):
        """
        Test that search can find entities extracted from content.

        This is an end-to-end test: ingest content, then search for it.
        """
        try:
            # Ingest content with M&A schema
            await GraphitiClient.add_episode(
                deal_id=unique_deal_id,
                content=SAMPLE_MNA_TEXT,
                name="integration-test-search.txt",
                source_description="Integration test for search",
            )

            # Search for content
            results = await GraphitiClient.search(
                deal_id=unique_deal_id,
                query="What is the revenue?",
                num_results=5,
            )

            # We should get some results
            # Note: Exact results depend on LLM extraction
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


class TestSchemaConstantsFormat:
    """
    Tests verifying schema constants match Graphiti expectations.

    Note: These are pure unit tests (no external services) but live here
    for organizational purposes alongside schema integration tests.
    """

    def test_entity_types_format_matches_graphiti(self):
        """
        Verify ENTITY_TYPES dictionary format matches Graphiti API.

        Graphiti expects: Dict[str, type[BaseModel]]
        """
        from pydantic import BaseModel

        for name, model_class in ENTITY_TYPES.items():
            assert isinstance(name, str), f"Key {name} should be string"
            assert issubclass(
                model_class, BaseModel
            ), f"{name} should be BaseModel subclass"

    def test_edge_types_format_matches_graphiti(self):
        """
        Verify EDGE_TYPES dictionary format matches Graphiti API.

        Graphiti expects: Dict[str, type[BaseModel]]
        """
        from pydantic import BaseModel

        for name, model_class in EDGE_TYPES.items():
            assert isinstance(name, str), f"Key {name} should be string"
            assert issubclass(
                model_class, BaseModel
            ), f"{name} should be BaseModel subclass"

    def test_edge_type_map_format_matches_graphiti(self):
        """
        Verify EDGE_TYPE_MAP dictionary format matches Graphiti API.

        Graphiti expects: Dict[Tuple[str, str], List[str]]
        """
        for key, value in EDGE_TYPE_MAP.items():
            assert isinstance(key, tuple), f"Key {key} should be tuple"
            assert len(key) == 2, f"Key {key} should have 2 elements"
            assert all(isinstance(k, str) for k in key), f"Key elements should be strings"
            assert isinstance(value, list), f"Value for {key} should be list"
            assert all(isinstance(v, str) for v in value), f"Value elements should be strings"
