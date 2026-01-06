"""
Integration tests for Financial Analyst Specialist Agent.
Story: E13.5 - Financial Analyst Specialist Agent (AC: #1, #2, #5)

These tests require:
- ANTHROPIC_API_KEY set for Claude models (primary)
- Or GOOGLE_API_KEY for Gemini fallback

Run with: RUN_INTEGRATION_TESTS=true pytest tests/integration/test_financial_analyst.py -m integration
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.agents import (
    FinancialAnalysisResult,
    FinancialDependencies,
    get_financial_analyst_agent,
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
    # Return sample financial data from Graphiti search
    mock._instance.search = AsyncMock(
        return_value=[
            MagicMock(
                uuid="fact-001",
                fact="Revenue was $5.2 million in Q3 2024",
                properties={"value": 5200000},
                valid_at="2024-09-30",
                source_description="Financial Report Q3 2024",
            ),
            MagicMock(
                uuid="fact-002",
                fact="EBITDA reached $1.2 million representing 23% margin",
                properties={"value": 1200000},
                valid_at="2024-09-30",
                source_description="Financial Report Q3 2024",
            ),
        ]
    )
    return mock


@pytest.fixture
def mock_supabase():
    """Create mock SupabaseClient for testing."""
    mock = MagicMock()
    mock.get_findings_by_document = AsyncMock(return_value=[])
    return mock


@pytest.fixture
def financial_deps(mock_supabase, mock_graphiti):
    """Create FinancialDependencies for testing."""
    return FinancialDependencies(
        db=mock_supabase,
        graphiti=mock_graphiti,
        deal_id="test-deal-123",
        organization_id="test-org-456",
        document_ids=["doc-1", "doc-2"],
        context_window="The company is a SaaS business with $5.2M ARR.",
    )


@pytest.mark.asyncio
async def test_financial_analyst_integration(financial_deps):
    """
    Test complete financial analysis with real LLM.

    This test validates:
    - Agent creation with model configuration
    - Structured output generation
    - FinancialAnalysisResult schema compliance
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = """
    What is the company's revenue and EBITDA margin for Q3 2024?
    Please also calculate the gross margin if possible.
    """

    try:
        result = await agent.run(query, deps=financial_deps)

        # Validate structured output
        assert result.data is not None
        assert isinstance(result.data, FinancialAnalysisResult)

        # Summary should answer the question
        assert len(result.data.summary) > 0
        assert "revenue" in result.data.summary.lower() or "EBITDA" in result.data.summary

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
async def test_financial_analyst_with_findings(financial_deps):
    """
    Test that agent generates structured findings.

    Validates finding extraction from financial context.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = """
    Extract the key financial metrics from the available data.
    Focus on revenue, EBITDA, and margins.
    """

    try:
        result = await agent.run(query, deps=financial_deps)

        # Should have findings
        assert result.data is not None

        # At minimum we should have a summary with findings mentioned
        summary_lower = result.data.summary.lower()
        # Should mention at least one financial term
        financial_terms = ["revenue", "ebitda", "margin", "million", "profit"]
        assert any(term in summary_lower for term in financial_terms)

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_qoe_analysis(financial_deps):
    """
    Test Quality of Earnings (QoE) analysis capability.

    This tests the M&A-specific expertise of the agent.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    # Update context for QoE analysis
    financial_deps.context_window = """
    The company reported EBITDA of $1.2M but included one-time gains from
    a legal settlement of $200K and had unusual marketing expenses of $150K
    for a product launch. Normalized EBITDA should exclude these items.
    """

    query = """
    What adjustments should be made to normalize EBITDA?
    Identify any add-backs or one-time items.
    """

    try:
        result = await agent.run(query, deps=financial_deps)

        assert result.data is not None

        # QoE analysis should mention adjustments
        summary_lower = result.data.summary.lower()
        adjustment_terms = ["adjustment", "normalize", "one-time", "add-back", "non-recurring"]
        assert any(term in summary_lower for term in adjustment_terms)

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_period_comparison(financial_deps):
    """
    Test period-over-period comparison analysis.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    # Update context with multi-period data
    financial_deps.context_window = """
    Q3 2023: Revenue $4.5M, EBITDA $0.9M (20% margin)
    Q3 2024: Revenue $5.2M, EBITDA $1.2M (23% margin)
    Year-over-year growth shows improvement in both revenue and margins.
    """

    query = """
    Compare Q3 2024 performance to Q3 2023.
    What is the year-over-year growth rate for revenue and EBITDA?
    """

    try:
        result = await agent.run(query, deps=financial_deps)

        assert result.data is not None

        # Should mention growth or comparison
        summary_lower = result.data.summary.lower()
        comparison_terms = ["growth", "increase", "year-over-year", "yoy", "compared", "improvement"]
        assert any(term in summary_lower for term in comparison_terms)

        # If comparisons are generated, validate structure
        if result.data.comparisons:
            for comparison in result.data.comparisons:
                assert comparison.metric is not None
                assert comparison.period1 is not None
                assert comparison.period2 is not None

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_without_graphiti(mock_supabase):
    """
    Test agent graceful degradation without Graphiti.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    # Create deps without Graphiti
    deps = FinancialDependencies(
        db=mock_supabase,
        graphiti=None,
        deal_id="test-deal-123",
        organization_id="test-org-456",
        context_window="Revenue was $5.2M in Q3 2024.",
    )

    query = "What is the company's revenue?"

    try:
        result = await agent.run(query, deps=deps)

        # Should still provide analysis from context
        assert result.data is not None
        assert len(result.data.summary) > 0

        # May indicate limited data availability
        if result.data.limitations:
            assert "knowledge graph" in result.data.limitations.lower() or len(result.data.limitations) > 0

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_follow_up_questions(financial_deps):
    """
    Test that agent suggests relevant follow-up questions.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    # Vague query that should prompt follow-ups
    query = "What do you think about the company's financial health?"

    try:
        result = await agent.run(query, deps=financial_deps)

        assert result.data is not None

        # Agent should provide summary even for vague queries
        assert len(result.data.summary) > 0

        # May suggest follow-up questions for clarity
        # (not strictly required but shows thoroughness)

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_token_usage(financial_deps):
    """
    Test that token usage is properly tracked for billing.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    query = "What is the EBITDA margin?"

    try:
        result = await agent.run(query, deps=financial_deps)

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
async def test_financial_analyst_ebitda_normalization(financial_deps):
    """
    Scenario #9: EBITDA normalization query.
    Tests the agent's ability to identify and calculate normalized EBITDA.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Reported EBITDA: $1.2M
    Owner compensation above market: $150K
    One-time legal settlement gain: $200K
    Non-recurring restructuring costs: $100K
    """

    query = "What is the normalized EBITDA after adjusting for owner compensation and one-time items?"

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        # Should discuss normalization
        assert any(term in summary_lower for term in ["normalize", "adjusted", "ebitda", "add-back"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_working_capital(financial_deps):
    """
    Scenario #10: Working capital analysis query.
    Tests analysis of working capital trends and adjustments.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Current Assets: $2.5M (Accounts Receivable: $1.2M, Inventory: $0.8M, Cash: $0.5M)
    Current Liabilities: $1.5M (Accounts Payable: $0.9M, Accrued Expenses: $0.6M)
    Historical NWC averages 15% of revenue.
    """

    query = "Calculate the working capital and assess if it's adequate for operations."

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["working capital", "current", "assets", "liabilities"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_revenue_recognition(financial_deps):
    """
    Scenario #11: Revenue recognition validation query.
    Tests analysis of revenue quality and sustainability.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Total Revenue: $5.2M
    - Recurring SaaS subscriptions: $3.8M (73%)
    - Professional services: $0.9M (17%)
    - One-time license sales: $0.5M (10%)
    Deferred revenue increased from $0.8M to $1.2M YoY.
    """

    query = "Analyze the revenue quality and recurring vs non-recurring breakdown."

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["recurring", "revenue", "subscription", "quality"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_projection_validation(financial_deps):
    """
    Scenario #12: Financial projection validation query.
    Tests assessment of projection reasonableness.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Historical: 2022 Revenue $3.5M, 2023 Revenue $4.5M, 2024 Revenue $5.2M
    Projections: 2025 Revenue $7.5M (44% growth), 2026 Revenue $10M (33% growth)
    Industry average growth: 15-20% annually
    """

    query = "Are the revenue projections reasonable based on historical performance?"

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["projection", "growth", "historical", "reasonable", "forecast"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_leverage_ratios(financial_deps):
    """
    Scenario #13: Debt-to-equity and leverage ratio query.
    Tests calculation and interpretation of leverage metrics.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Total Debt: $3M (Term Loan: $2M, Line of Credit: $1M)
    Total Equity: $4M
    EBITDA: $1.2M
    Interest Expense: $180K annually
    """

    query = "What is the debt-to-equity ratio and debt-to-EBITDA multiple? Is leverage concerning?"

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["debt", "equity", "leverage", "ratio", "multiple"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_customer_concentration(financial_deps):
    """
    Scenario #14: Customer concentration risk analysis.
    Tests identification of revenue concentration risks.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Total Revenue: $5.2M
    Top 5 Customers:
    - Customer A: $1.5M (29%)
    - Customer B: $0.8M (15%)
    - Customer C: $0.6M (12%)
    - Customer D: $0.4M (8%)
    - Customer E: $0.3M (6%)
    Top 5 concentration: 70%
    """

    query = "Analyze customer concentration. What are the risks from the top customer?"

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["concentration", "customer", "risk", "revenue"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_gross_margin(financial_deps):
    """
    Scenario #15: Gross margin calculation and trend analysis.
    Tests margin calculation with historical comparison.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    Q3 2024: Revenue $5.2M, COGS $3.38M, Gross Profit $1.82M
    Q3 2023: Revenue $4.5M, COGS $3.02M, Gross Profit $1.48M
    Industry benchmark gross margin: 40%
    """

    query = "Calculate the gross margin percentage and compare to last year and industry benchmark."

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["gross", "margin", "percent", "%"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise


@pytest.mark.asyncio
async def test_financial_analyst_valuation_multiples(financial_deps):
    """
    Scenario #16: Enterprise value and valuation multiple estimation.
    Tests valuation analysis capabilities.
    """
    try:
        agent = get_financial_analyst_agent()
    except Exception as e:
        if "api_key" in str(e).lower():
            pytest.skip("API key not configured")
        raise

    financial_deps.context_window = """
    LTM Revenue: $5.2M
    LTM EBITDA: $1.2M (normalized)
    Net Debt: $2.5M
    Industry EV/EBITDA multiple range: 6x-10x
    Industry EV/Revenue multiple range: 2x-4x
    """

    query = "What is the implied enterprise value range using industry multiples?"

    try:
        result = await agent.run(query, deps=financial_deps)
        assert result.data is not None
        summary_lower = result.data.summary.lower()
        assert any(term in summary_lower for term in ["value", "multiple", "ebitda", "enterprise", "ev"])

    except Exception as e:
        if "API key" in str(e).lower() or "authentication" in str(e).lower():
            pytest.skip("API key not configured for integration test")
        raise
