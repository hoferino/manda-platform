"""
Unit tests for Graphiti schema module.
Story: E10.3 - Sell-Side Spine Schema (AC: #1, #2, #3, #6)

Tests entity and edge model validation, as well as helper functions
that return type dictionaries for Graphiti add_episode().
"""

import pytest
from pydantic import BaseModel, ValidationError

from src.graphiti.schema import (
    EDGE_TYPE_MAP,
    EDGE_TYPES,
    ENTITY_TYPES,
    RELATIONSHIP_TYPES,
    get_edge_type_map,
    get_edge_types,
    get_entity_types,
)
from src.graphiti.schema.edges import (
    CompetesWith,
    ContradictsEdge,
    ExtractedFrom,
    InvestsIn,
    MentionsEdge,
    SupersedesEdge,
    SuppliesEdge,
    SupportsEdge,
    WorksFor,
)
from src.graphiti.schema.entities import (
    Company,
    Finding,
    FinancialMetric,
    Person,
    Risk,
)


class TestCompanyEntity:
    """Tests for Company entity model (AC: #1)."""

    def test_valid_company_minimal(self):
        """Company with required fields only."""
        company = Company(name="ABC Corporation", role="target")
        assert company.name == "ABC Corporation"
        assert company.role == "target"
        assert company.industry is None
        assert company.aliases == []

    def test_valid_company_full(self):
        """Company with all fields populated."""
        company = Company(
            name="ABC Corporation",
            role="acquirer",
            industry="Technology",
            aliases=["ABC Corp", "ABC Inc"],
        )
        assert company.name == "ABC Corporation"
        assert company.role == "acquirer"
        assert company.industry == "Technology"
        assert company.aliases == ["ABC Corp", "ABC Inc"]

    def test_valid_company_roles(self):
        """All valid company roles work."""
        valid_roles = ["target", "acquirer", "competitor", "customer", "supplier", "investor"]
        for role in valid_roles:
            company = Company(name="Test", role=role)
            assert company.role == role

    def test_invalid_company_role(self):
        """Invalid company role raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Company(name="Test", role="invalid_role")
        assert "role" in str(exc_info.value)

    def test_company_missing_name(self):
        """Missing name raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Company(role="target")
        assert "name" in str(exc_info.value)

    def test_company_missing_role(self):
        """Missing role raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Company(name="Test")
        assert "role" in str(exc_info.value)


class TestPersonEntity:
    """Tests for Person entity model (AC: #1)."""

    def test_valid_person_minimal(self):
        """Person with required fields only."""
        person = Person(name="John Smith", role="executive")
        assert person.name == "John Smith"
        assert person.role == "executive"
        assert person.title is None
        assert person.company_id is None

    def test_valid_person_full(self):
        """Person with all fields populated."""
        person = Person(
            name="John Smith",
            title="CEO",
            role="executive",
            company_id="company-123",
        )
        assert person.name == "John Smith"
        assert person.title == "CEO"
        assert person.role == "executive"
        assert person.company_id == "company-123"

    def test_valid_person_roles(self):
        """All valid person roles work."""
        valid_roles = ["executive", "advisor", "board", "investor", "employee"]
        for role in valid_roles:
            person = Person(name="Test", role=role)
            assert person.role == role

    def test_invalid_person_role(self):
        """Invalid person role raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Person(name="Test", role="invalid_role")
        assert "role" in str(exc_info.value)


class TestFinancialMetricEntity:
    """Tests for FinancialMetric entity model (AC: #1)."""

    def test_valid_metric_minimal(self):
        """FinancialMetric with required fields only."""
        metric = FinancialMetric(
            metric_type="revenue",
            value=4800000.0,
            period="FY 2023",
        )
        assert metric.metric_type == "revenue"
        assert metric.value == 4800000.0
        assert metric.period == "FY 2023"
        assert metric.currency == "USD"
        assert metric.basis is None

    def test_valid_metric_full(self):
        """FinancialMetric with all fields populated."""
        metric = FinancialMetric(
            metric_type="ebitda",
            value=1200000.0,
            period="Q3 2024",
            currency="EUR",
            basis="adjusted",
        )
        assert metric.metric_type == "ebitda"
        assert metric.value == 1200000.0
        assert metric.period == "Q3 2024"
        assert metric.currency == "EUR"
        assert metric.basis == "adjusted"

    def test_metric_type_freeform(self):
        """metric_type accepts any string (free-form for novel metrics)."""
        metric = FinancialMetric(
            metric_type="custom_ltm_margin",
            value=15.5,
            period="LTM",
        )
        assert metric.metric_type == "custom_ltm_margin"

    def test_metric_invalid_value_type(self):
        """Non-numeric value raises ValidationError."""
        with pytest.raises(ValidationError):
            FinancialMetric(
                metric_type="revenue",
                value="not a number",
                period="FY 2023",
            )


class TestFindingEntity:
    """Tests for Finding entity model (AC: #1)."""

    def test_valid_finding_minimal(self):
        """Finding with required fields only."""
        finding = Finding(
            content="Revenue increased 15% year-over-year",
            confidence=0.85,
            source_channel="document",
            finding_type="metric",
        )
        assert finding.content == "Revenue increased 15% year-over-year"
        assert finding.confidence == 0.85
        assert finding.source_channel == "document"
        assert finding.finding_type == "metric"

    def test_valid_source_channels(self):
        """All valid source channels work."""
        valid_channels = ["document", "qa_response", "meeting_note", "analyst_chat"]
        for channel in valid_channels:
            finding = Finding(
                content="Test",
                confidence=0.5,
                source_channel=channel,
                finding_type="fact",
            )
            assert finding.source_channel == channel

    def test_valid_finding_types(self):
        """All valid finding types work."""
        valid_types = ["fact", "metric", "risk", "opportunity", "insight"]
        for finding_type in valid_types:
            finding = Finding(
                content="Test",
                confidence=0.5,
                source_channel="document",
                finding_type=finding_type,
            )
            assert finding.finding_type == finding_type

    def test_confidence_bounds(self):
        """Confidence must be between 0 and 1."""
        # Valid bounds
        Finding(content="Test", confidence=0.0, source_channel="document", finding_type="fact")
        Finding(content="Test", confidence=1.0, source_channel="document", finding_type="fact")

        # Invalid: below 0
        with pytest.raises(ValidationError):
            Finding(content="Test", confidence=-0.1, source_channel="document", finding_type="fact")

        # Invalid: above 1
        with pytest.raises(ValidationError):
            Finding(content="Test", confidence=1.1, source_channel="document", finding_type="fact")

    def test_invalid_source_channel(self):
        """Invalid source channel raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Finding(
                content="Test",
                confidence=0.5,
                source_channel="invalid_channel",
                finding_type="fact",
            )
        assert "source_channel" in str(exc_info.value)


class TestRiskEntity:
    """Tests for Risk entity model (AC: #1)."""

    def test_valid_risk_minimal(self):
        """Risk with required fields only."""
        risk = Risk(
            description="Key person risk due to founder dependence",
            severity="high",
            category="key_person",
        )
        assert risk.description == "Key person risk due to founder dependence"
        assert risk.severity == "high"
        assert risk.category == "key_person"
        assert risk.mitigation is None

    def test_valid_risk_full(self):
        """Risk with all fields populated."""
        risk = Risk(
            description="Customer concentration risk",
            severity="medium",
            category="customer_concentration",
            mitigation="Diversification plan in place",
        )
        assert risk.description == "Customer concentration risk"
        assert risk.severity == "medium"
        assert risk.category == "customer_concentration"
        assert risk.mitigation == "Diversification plan in place"

    def test_valid_severities(self):
        """All valid severity levels work."""
        for severity in ["high", "medium", "low"]:
            risk = Risk(
                description="Test",
                severity=severity,
                category="test",
            )
            assert risk.severity == severity

    def test_invalid_severity(self):
        """Invalid severity raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            Risk(
                description="Test",
                severity="critical",  # Not a valid literal
                category="test",
            )
        assert "severity" in str(exc_info.value)

    def test_category_freeform(self):
        """category accepts any string (free-form for novel risk types)."""
        risk = Risk(
            description="Test",
            severity="low",
            category="novel_risk_category_xyz",
        )
        assert risk.category == "novel_risk_category_xyz"


class TestWorksForEdge:
    """Tests for WorksFor edge model (AC: #2)."""

    def test_valid_works_for_empty(self):
        """WorksFor with no optional fields."""
        edge = WorksFor()
        assert edge.start_date is None
        assert edge.end_date is None
        assert edge.title is None

    def test_valid_works_for_full(self):
        """WorksFor with all fields populated."""
        edge = WorksFor(
            start_date="2020-01-15",
            end_date="2024-06-30",
            title="Chief Executive Officer",
        )
        assert edge.start_date == "2020-01-15"
        assert edge.end_date == "2024-06-30"
        assert edge.title == "Chief Executive Officer"


class TestSupersedesEdge:
    """Tests for SupersedesEdge edge model (AC: #2)."""

    def test_valid_supersedes_empty(self):
        """SupersedesEdge with no optional fields."""
        edge = SupersedesEdge()
        assert edge.reason is None
        assert edge.superseded_at is None

    def test_valid_supersedes_full(self):
        """SupersedesEdge with all fields populated."""
        edge = SupersedesEdge(
            reason="Updated Q&A response with more accurate data",
            superseded_at="2024-03-15T10:30:00Z",
        )
        assert edge.reason == "Updated Q&A response with more accurate data"
        assert edge.superseded_at == "2024-03-15T10:30:00Z"


class TestContradictsEdge:
    """Tests for ContradictsEdge edge model (AC: #2)."""

    def test_valid_contradicts_empty(self):
        """ContradictsEdge with no optional fields."""
        edge = ContradictsEdge()
        assert edge.detected_at is None
        assert edge.resolution_status is None

    def test_valid_contradicts_full(self):
        """ContradictsEdge with all fields populated."""
        edge = ContradictsEdge(
            detected_at="2024-03-15",
            resolution_status="pending_review",
        )
        assert edge.detected_at == "2024-03-15"
        assert edge.resolution_status == "pending_review"


class TestSupportsEdge:
    """Tests for SupportsEdge edge model (AC: #2)."""

    def test_valid_supports_empty(self):
        """SupportsEdge with no optional fields."""
        edge = SupportsEdge()
        assert edge.correlation_strength is None

    def test_valid_supports_full(self):
        """SupportsEdge with correlation strength."""
        edge = SupportsEdge(correlation_strength=0.92)
        assert edge.correlation_strength == 0.92

    def test_correlation_strength_bounds(self):
        """Correlation strength must be between 0 and 1."""
        # Valid bounds
        edge_zero = SupportsEdge(correlation_strength=0.0)
        assert edge_zero.correlation_strength == 0.0
        edge_one = SupportsEdge(correlation_strength=1.0)
        assert edge_one.correlation_strength == 1.0

        # Invalid: below 0
        with pytest.raises(ValidationError):
            SupportsEdge(correlation_strength=-0.1)

        # Invalid: above 1
        with pytest.raises(ValidationError):
            SupportsEdge(correlation_strength=1.1)


class TestExtractedFromEdge:
    """Tests for ExtractedFrom edge model (AC: #2)."""

    def test_valid_extracted_from_empty(self):
        """ExtractedFrom with no optional fields."""
        edge = ExtractedFrom()
        assert edge.page_number is None
        assert edge.chunk_index is None
        assert edge.confidence is None

    def test_valid_extracted_from_full(self):
        """ExtractedFrom with all fields populated."""
        edge = ExtractedFrom(
            page_number=42,
            chunk_index=5,
            confidence=0.95,
        )
        assert edge.page_number == 42
        assert edge.chunk_index == 5
        assert edge.confidence == 0.95

    def test_confidence_bounds(self):
        """Confidence must be between 0 and 1."""
        # Valid bounds
        edge_zero = ExtractedFrom(confidence=0.0)
        assert edge_zero.confidence == 0.0
        edge_one = ExtractedFrom(confidence=1.0)
        assert edge_one.confidence == 1.0

        # Invalid: below 0
        with pytest.raises(ValidationError):
            ExtractedFrom(confidence=-0.1)

        # Invalid: above 1
        with pytest.raises(ValidationError):
            ExtractedFrom(confidence=1.1)


class TestCompetesWithEdge:
    """Tests for CompetesWith edge model (AC: #2)."""

    def test_valid_competes_with_empty(self):
        """CompetesWith with no optional fields."""
        edge = CompetesWith()
        assert edge.market_segment is None
        assert edge.competitive_intensity is None

    def test_valid_competes_with_full(self):
        """CompetesWith with all fields populated."""
        edge = CompetesWith(
            market_segment="Cloud Infrastructure",
            competitive_intensity="direct",
        )
        assert edge.market_segment == "Cloud Infrastructure"
        assert edge.competitive_intensity == "direct"

    def test_valid_competitive_intensities(self):
        """All valid competitive intensities work."""
        for intensity in ["direct", "indirect", "potential"]:
            edge = CompetesWith(competitive_intensity=intensity)
            assert edge.competitive_intensity == intensity

    def test_invalid_competitive_intensity(self):
        """Invalid competitive intensity raises ValidationError."""
        with pytest.raises(ValidationError):
            CompetesWith(competitive_intensity="invalid")


class TestInvestsInEdge:
    """Tests for InvestsIn edge model (AC: #2)."""

    def test_valid_invests_in_empty(self):
        """InvestsIn with default currency."""
        edge = InvestsIn()
        assert edge.investment_type is None
        assert edge.amount is None
        assert edge.currency == "USD"

    def test_valid_invests_in_full(self):
        """InvestsIn with all fields populated."""
        edge = InvestsIn(
            investment_type="equity",
            amount=5000000.0,
            currency="EUR",
        )
        assert edge.investment_type == "equity"
        assert edge.amount == 5000000.0
        assert edge.currency == "EUR"

    def test_valid_investment_types(self):
        """All valid investment types work."""
        for inv_type in ["equity", "debt", "convertible", "other"]:
            edge = InvestsIn(investment_type=inv_type)
            assert edge.investment_type == inv_type

    def test_invalid_investment_type(self):
        """Invalid investment type raises ValidationError."""
        with pytest.raises(ValidationError):
            InvestsIn(investment_type="invalid")


class TestMentionsEdge:
    """Tests for MentionsEdge edge model (AC: #2)."""

    def test_valid_mentions_empty(self):
        """MentionsEdge with no optional fields."""
        edge = MentionsEdge()
        assert edge.context is None
        assert edge.sentiment is None

    def test_valid_mentions_full(self):
        """MentionsEdge with all fields populated."""
        edge = MentionsEdge(
            context="Revenue growth mentioned in quarterly report",
            sentiment="positive",
        )
        assert edge.context == "Revenue growth mentioned in quarterly report"
        assert edge.sentiment == "positive"

    def test_valid_sentiments(self):
        """All valid sentiment values work."""
        for sentiment in ["positive", "negative", "neutral"]:
            edge = MentionsEdge(sentiment=sentiment)
            assert edge.sentiment == sentiment

    def test_invalid_sentiment(self):
        """Invalid sentiment raises ValidationError."""
        with pytest.raises(ValidationError):
            MentionsEdge(sentiment="invalid")


class TestSuppliesEdge:
    """Tests for SuppliesEdge edge model (AC: #2)."""

    def test_valid_supplies_empty(self):
        """SuppliesEdge with no optional fields."""
        edge = SuppliesEdge()
        assert edge.product_category is None
        assert edge.relationship_strength is None
        assert edge.contract_type is None

    def test_valid_supplies_full(self):
        """SuppliesEdge with all fields populated."""
        edge = SuppliesEdge(
            product_category="Cloud Infrastructure",
            relationship_strength="critical",
            contract_type="exclusive",
        )
        assert edge.product_category == "Cloud Infrastructure"
        assert edge.relationship_strength == "critical"
        assert edge.contract_type == "exclusive"

    def test_valid_relationship_strengths(self):
        """All valid relationship strength values work."""
        for strength in ["critical", "major", "minor"]:
            edge = SuppliesEdge(relationship_strength=strength)
            assert edge.relationship_strength == strength

    def test_invalid_relationship_strength(self):
        """Invalid relationship strength raises ValidationError."""
        with pytest.raises(ValidationError):
            SuppliesEdge(relationship_strength="invalid")

    def test_valid_contract_types(self):
        """All valid contract type values work."""
        for contract_type in ["exclusive", "preferred", "standard"]:
            edge = SuppliesEdge(contract_type=contract_type)
            assert edge.contract_type == contract_type

    def test_invalid_contract_type(self):
        """Invalid contract type raises ValidationError."""
        with pytest.raises(ValidationError):
            SuppliesEdge(contract_type="invalid")


class TestGetEntityTypes:
    """Tests for get_entity_types() helper function (AC: #3)."""

    def test_returns_dict(self):
        """get_entity_types() returns a dictionary."""
        result = get_entity_types()
        assert isinstance(result, dict)

    def test_contains_all_entities(self):
        """Dictionary contains all expected entity types."""
        result = get_entity_types()
        expected_keys = {"Company", "Person", "FinancialMetric", "Finding", "Risk"}
        assert set(result.keys()) == expected_keys

    def test_values_are_basemodel_subclasses(self):
        """All values are Pydantic BaseModel subclasses."""
        result = get_entity_types()
        for key, value in result.items():
            assert issubclass(value, BaseModel), f"{key} is not a BaseModel subclass"

    def test_returns_copy(self):
        """Returns a copy, not the original constant."""
        result1 = get_entity_types()
        result2 = get_entity_types()
        assert result1 is not result2
        assert result1 is not ENTITY_TYPES


class TestGetEdgeTypes:
    """Tests for get_edge_types() helper function (AC: #3)."""

    def test_returns_dict(self):
        """get_edge_types() returns a dictionary."""
        result = get_edge_types()
        assert isinstance(result, dict)

    def test_contains_all_edges(self):
        """Dictionary contains all expected edge types."""
        result = get_edge_types()
        expected_keys = {
            "WORKS_FOR",
            "SUPERSEDES",
            "CONTRADICTS",
            "SUPPORTS",
            "EXTRACTED_FROM",
            "COMPETES_WITH",
            "INVESTS_IN",
            "MENTIONS",
            "SUPPLIES",
        }
        assert set(result.keys()) == expected_keys

    def test_values_are_basemodel_subclasses(self):
        """All values are Pydantic BaseModel subclasses."""
        result = get_edge_types()
        for key, value in result.items():
            assert issubclass(value, BaseModel), f"{key} is not a BaseModel subclass"

    def test_returns_copy(self):
        """Returns a copy, not the original constant."""
        result1 = get_edge_types()
        result2 = get_edge_types()
        assert result1 is not result2
        assert result1 is not EDGE_TYPES


class TestGetEdgeTypeMap:
    """Tests for get_edge_type_map() helper function (AC: #6)."""

    def test_returns_dict(self):
        """get_edge_type_map() returns a dictionary."""
        result = get_edge_type_map()
        assert isinstance(result, dict)

    def test_keys_are_tuples(self):
        """All keys are (source_type, target_type) tuples."""
        result = get_edge_type_map()
        for key in result.keys():
            assert isinstance(key, tuple), f"Key {key} is not a tuple"
            assert len(key) == 2, f"Key {key} does not have 2 elements"
            assert isinstance(key[0], str), f"Key {key} first element is not a string"
            assert isinstance(key[1], str), f"Key {key} second element is not a string"

    def test_values_are_lists_of_strings(self):
        """All values are lists of edge type strings."""
        result = get_edge_type_map()
        for key, value in result.items():
            assert isinstance(value, list), f"Value for {key} is not a list"
            for item in value:
                assert isinstance(item, str), f"Item {item} in {key} is not a string"

    def test_expected_mappings_exist(self):
        """Key entity pair mappings are correct."""
        result = get_edge_type_map()

        # Person → Company should include WORKS_FOR
        assert ("Person", "Company") in result
        assert "WORKS_FOR" in result[("Person", "Company")]

        # Company → Company should include competition relationships
        assert ("Company", "Company") in result
        assert "COMPETES_WITH" in result[("Company", "Company")]

        # Finding → Finding should include truth evolution edges
        assert ("Finding", "Finding") in result
        finding_edges = result[("Finding", "Finding")]
        assert "SUPERSEDES" in finding_edges
        assert "CONTRADICTS" in finding_edges
        assert "SUPPORTS" in finding_edges

    def test_returns_copy(self):
        """Returns a copy, not the original constant."""
        result1 = get_edge_type_map()
        result2 = get_edge_type_map()
        assert result1 is not result2
        assert result1 is not EDGE_TYPE_MAP


class TestRelationshipTypesConstant:
    """Tests for RELATIONSHIP_TYPES constant (AC: #6)."""

    def test_is_list(self):
        """RELATIONSHIP_TYPES is a list."""
        assert isinstance(RELATIONSHIP_TYPES, list)

    def test_contains_expected_types(self):
        """Contains all expected relationship type names."""
        expected = {
            "EXTRACTED_FROM",
            "MENTIONS",
            "SUPERSEDES",
            "CONTRADICTS",
            "SUPPORTS",
            "WORKS_FOR",
            "COMPETES_WITH",
            "SUPPLIES",
            "INVESTS_IN",
        }
        assert expected.issubset(set(RELATIONSHIP_TYPES))

    def test_all_strings(self):
        """All items are strings."""
        for item in RELATIONSHIP_TYPES:
            assert isinstance(item, str)


class TestModuleLevelConstants:
    """Tests for module-level constants."""

    def test_entity_types_constant_exists(self):
        """ENTITY_TYPES constant exists and is correct type."""
        assert isinstance(ENTITY_TYPES, dict)
        assert len(ENTITY_TYPES) == 5

    def test_edge_types_constant_exists(self):
        """EDGE_TYPES constant exists and is correct type."""
        assert isinstance(EDGE_TYPES, dict)
        assert len(EDGE_TYPES) == 9

    def test_edge_type_map_constant_exists(self):
        """EDGE_TYPE_MAP constant exists and is correct type."""
        assert isinstance(EDGE_TYPE_MAP, dict)
        assert len(EDGE_TYPE_MAP) > 0
