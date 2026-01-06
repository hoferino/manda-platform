"""
Integration tests for Knowledge Graph Specialist Agent.
Story: E13.6 - Knowledge Graph Specialist Agent (AC: #1, #2, #5, #6)

These tests require:
- GOOGLE_API_KEY set for Gemini models (primary)
- Or ANTHROPIC_API_KEY for Claude fallback

Run with: RUN_INTEGRATION_TESTS=true pytest tests/integration/test_knowledge_graph.py -m integration

CI Integration:
- Tests are marked with @pytest.mark.integration and skip by default
- CI pipelines should set RUN_INTEGRATION_TESTS=true for nightly/weekly runs
- API keys should be configured via CI secrets

AC #6 - Accuracy Measurement Notes:
- These tests validate structured output quality and query handling
- For formal accuracy comparison (15%+ improvement target), run benchmark suite:
  1. Execute same queries against general agent (baseline)
  2. Execute against KG specialist (treatment)
  3. Compare response quality using golden answers
  4. Log comparison metrics to LangSmith via `langsmith.Client().create_run()`
- Baseline comparison not automated here due to LLM cost/time constraints
- Manual validation showed improved entity resolution on fuzzy matching queries
"""

import os
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from src.agents import (
    KGAnalysisResult,
    KGDependencies,
    get_knowledge_graph_agent,
)


# Skip all tests if integration tests are disabled
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("RUN_INTEGRATION_TESTS", "").lower() != "true",
        reason="Integration tests disabled (set RUN_INTEGRATION_TESTS=true)",
    ),
]


@pytest.fixture
def mock_graphiti():
    """Create mock GraphitiClient for testing."""
    mock = MagicMock()
    mock._instance = MagicMock()
    # Return sample entity/relationship data from Graphiti search
    mock._instance.search = AsyncMock(
        return_value=[
            MagicMock(
                uuid="entity-001",
                name="Acme Corporation",
                entity_type="Company",
                fact="Acme Corporation is a technology company founded in 2010",
                properties={"industry": "Technology", "founded": "2010"},
                valid_at="2024-01-01",
                source_description="Company Overview Document",
                aliases=["Acme Corp", "ACME", "Acme Inc"],
            ),
            MagicMock(
                uuid="entity-002",
                name="John Smith",
                entity_type="Person",
                fact="John Smith is the CEO of Acme Corporation since 2020",
                properties={"role": "CEO", "start_date": "2020-01-01"},
                valid_at="2024-01-01",
                source_description="Management Team Profile",
            ),
            MagicMock(
                uuid="fact-001",
                name="Revenue",
                entity_type="FinancialMetric",
                fact="Revenue was $5.2 million in Q3 2024",
                properties={"value": 5200000, "period": "Q3 2024"},
                valid_at="2024-09-30",
                source_description="Financial Report Q3 2024",
            ),
        ]
    )
    # Mock Neo4j driver for traversal tests
    mock._instance.driver = MagicMock()
    mock_session = MagicMock()
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)
    mock_session.run = AsyncMock(
        return_value=MagicMock(
            data=AsyncMock(return_value=[])
        )
    )
    mock._instance.driver.session = MagicMock(return_value=mock_session)
    return mock


@pytest.fixture
def mock_supabase():
    """Create mock SupabaseClient for testing."""
    mock = MagicMock()
    mock.get_findings_by_document = AsyncMock(return_value=[])
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
        time_range=(
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            datetime(2024, 12, 31, tzinfo=timezone.utc),
        ),
        context_window="Analyzing Acme Corporation's management team and organizational structure.",
    )


@pytest.mark.asyncio
async def test_knowledge_graph_integration(kg_deps):
    """
    Test complete knowledge graph analysis with real LLM.

    This test validates:
    - Agent creation with model configuration
    - Structured output generation
    - KGAnalysisResult schema compliance
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = """
    Who is the CEO of Acme Corporation?
    When did they start in this role?
    """

    try:
        result = await agent.run(query, deps=kg_deps)

        # Validate structured output
        assert result.data is not None
        assert isinstance(result.data, KGAnalysisResult)

        # Summary should answer the question
        assert len(result.data.summary) > 0
        # Should mention CEO or person-related info
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["ceo", "john", "smith", "acme", "corporation"])

        # Confidence should be valid
        assert 0.0 <= result.data.confidence <= 1.0

        # Usage should be tracked
        usage = result.usage()
        assert usage is not None
        assert usage.request_tokens > 0

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_entity_resolution(kg_deps):
    """
    Test entity resolution capabilities.

    Validates the agent can resolve entity references across variations.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = """
    What do you know about ACME? Is it the same as Acme Corporation?
    """

    try:
        result = await agent.run(query, deps=kg_deps)

        assert result.data is not None

        # Should discuss entity resolution or matching
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["acme", "same", "corporation", "company", "alias"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_relationship_query(kg_deps):
    """
    Test relationship traversal query.

    Validates the agent can explain relationships between entities.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = """
    What is the relationship between John Smith and Acme Corporation?
    """

    try:
        result = await agent.run(query, deps=kg_deps)

        assert result.data is not None

        # Should discuss relationship
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["ceo", "works", "relationship", "role", "position"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_temporal_facts(kg_deps):
    """
    Test temporal fact tracking capabilities.

    Validates the agent handles temporal context correctly.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    John Smith became CEO in 2020.
    Before John, Jane Doe was CEO from 2015 to 2019.
    """

    query = """
    Who was the CEO before John Smith? When did the transition happen?
    """

    try:
        result = await agent.run(query, deps=kg_deps)

        assert result.data is not None

        # Should discuss temporal aspects
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["before", "2015", "2019", "2020", "transition", "jane"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_without_graphiti(mock_supabase):
    """
    Test agent graceful degradation without Graphiti.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    # Create deps without Graphiti
    deps = KGDependencies(
        db=mock_supabase,
        graphiti=None,
        deal_id="test-deal-123",
        organization_id="test-org-456",
        context_window="Acme Corporation was founded in 2010 by Jane Doe.",
    )

    query = "When was Acme founded?"

    try:
        result = await agent.run(query, deps=deps)

        # Should still provide analysis from context
        assert result.data is not None
        assert len(result.data.summary) > 0

        # Should mention the founding info from context
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["2010", "founded", "acme"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_token_usage(kg_deps):
    """
    Test that token usage is properly tracked for billing.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = "Who is the CEO of Acme?"

    try:
        result = await agent.run(query, deps=kg_deps)

        # Token usage must be tracked
        usage = result.usage()
        assert usage is not None
        assert usage.request_tokens > 0
        assert usage.response_tokens > 0

        # Total tokens should be sum
        total = usage.request_tokens + usage.response_tokens
        assert total > 0

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


# =============================================================================
# Additional Test Scenarios for AC #5 (15+ query scenarios)
# =============================================================================


@pytest.mark.asyncio
async def test_knowledge_graph_subsidiary_relationships(kg_deps):
    """
    Scenario #7: Subsidiary and ownership relationships.
    Tests traversal of corporate structure.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Acme Corporation owns 100% of Widget Inc.
    Widget Inc. is a manufacturing subsidiary.
    Acme Corporation also has 60% stake in TechStart LLC.
    """

    query = "What subsidiaries does Acme Corporation own?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["subsidiary", "widget", "owns", "ownership", "techstart"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_management_team(kg_deps):
    """
    Scenario #8: Management team identification.
    Tests extraction of key personnel.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Management Team:
    - John Smith: CEO since 2020
    - Sarah Johnson: CFO since 2021
    - Mike Brown: CTO since 2019
    - Lisa Chen: VP Sales since 2022
    """

    query = "Who are the key executives at Acme Corporation?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["ceo", "cfo", "cto", "management", "executive"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_board_composition(kg_deps):
    """
    Scenario #9: Board of directors analysis.
    Tests extraction of governance structure.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Board of Directors:
    - Robert Wilson (Chairman) - Independent director since 2015
    - John Smith - CEO, executive director
    - Emily Davis - Independent director since 2020
    - Mark Thompson - Investor representative from Venture Capital Partners
    """

    query = "Who are the independent directors on the board?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["independent", "board", "director", "wilson", "davis"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_investor_relationships(kg_deps):
    """
    Scenario #10: Investor and shareholder relationships.
    Tests ownership structure analysis.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Shareholders:
    - Founders (John Smith, Jane Doe): 45%
    - Venture Capital Partners: 30%
    - Angel investors: 15%
    - Employee stock options: 10%
    """

    query = "Who are the major shareholders of Acme Corporation?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["shareholder", "founder", "venture", "ownership", "45%", "30%"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_customer_relationships(kg_deps):
    """
    Scenario #11: Key customer relationship analysis.
    Tests extraction of business relationships.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Key Customers:
    - GlobalTech Inc: $1.5M annual contract, 5-year relationship
    - MegaCorp Ltd: $0.8M annual contract, 3-year relationship
    - StartupXYZ: $0.5M annual contract, new customer in 2024
    """

    query = "What are the key customer relationships?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["customer", "globaltech", "megacorp", "contract", "relationship"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_supplier_relationships(kg_deps):
    """
    Scenario #12: Supplier and vendor relationships.
    Tests supply chain entity extraction.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Key Suppliers:
    - Component Co: Primary chip supplier, 10-year exclusive contract
    - AssemblyPro: Manufacturing partner in Vietnam
    - LogiCorp: Logistics and warehousing provider
    """

    query = "Who are Acme's key suppliers?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["supplier", "component", "manufacturing", "logistics"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_competitor_analysis(kg_deps):
    """
    Scenario #13: Competitor identification.
    Tests market relationship extraction.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Competitive Landscape:
    - DirectCompete Inc: Main competitor, similar product offering
    - BigTech Solutions: Larger player, overlapping in enterprise segment
    - NewStartup AI: Emerging competitor with AI-focused approach
    """

    query = "Who are Acme Corporation's main competitors?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["competitor", "directcompete", "bigtech", "compete"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_geographic_presence(kg_deps):
    """
    Scenario #14: Geographic location and presence.
    Tests extraction of location-based entities.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Locations:
    - Headquarters: San Francisco, CA
    - Engineering office: Austin, TX
    - Sales office: New York, NY
    - Manufacturing: Shenzhen, China
    - European HQ: London, UK
    """

    query = "Where does Acme Corporation have offices?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["san francisco", "austin", "new york", "london", "office", "headquarters"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_contract_relationships(kg_deps):
    """
    Scenario #15: Contract and agreement relationships.
    Tests extraction of legal/contractual entities.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Key Contracts:
    - Master Services Agreement with GlobalTech: $5M over 3 years
    - IP License Agreement with PatentCo: Exclusive rights until 2027
    - Joint Venture Agreement with EuropeCorp: 50/50 partnership
    """

    query = "What are the key contractual agreements?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["contract", "agreement", "license", "partnership", "joint venture"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_contradiction_detection(kg_deps):
    """
    Scenario #16: Contradiction detection in facts.
    Tests the agent's ability to identify conflicting information.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Document A (March 2024): Company revenue was $4.8M in 2023.
    Document B (April 2024): Company achieved $5.2M revenue in 2023.
    Document C (May 2024): Annual report shows 2023 revenue of $4.8M.
    """

    query = "Are there any contradictions in the reported revenue figures?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["contradiction", "conflict", "different", "discrepancy", "4.8", "5.2"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_data_provenance(kg_deps):
    """
    Scenario #17: Data lineage and provenance tracking.
    Tests source attribution capabilities.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = "Where does the information about Acme's CEO come from?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None

        # Should cite sources
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["source", "document", "management", "profile", "report"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_knowledge_graph_historical_changes(kg_deps):
    """
    Scenario #18: Historical entity changes.
    Tests tracking of entity changes over time.
    """
    try:
        agent = get_knowledge_graph_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    kg_deps.context_window = """
    Company History:
    - 2010: Founded as Acme Solutions
    - 2015: Rebranded to Acme Corporation
    - 2018: Acquired Widget Inc.
    - 2020: John Smith became CEO
    - 2023: IPO on NASDAQ
    """

    query = "What major changes has Acme Corporation gone through?"

    try:
        result = await agent.run(query, deps=kg_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["2010", "founded", "rebrand", "acquired", "ipo"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise
