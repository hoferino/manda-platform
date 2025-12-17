"""
Unit tests for Graphiti entity resolution module.
Story: E10.6 - Entity Resolution (AC: #1, #2, #3, #6)

Tests the M&A-specific entity resolution configuration including:
- Company name normalization with suffix variations
- Person name normalization with initial patterns
- Protected metric detection to prevent auto-merging
- Merge decision functions with confidence scores
"""

import pytest

from src.graphiti.resolution import (
    COMPANY_SUFFIX_VARIATIONS,
    DISTINCT_METRICS,
    RESOLUTION_THRESHOLDS,
    get_manda_resolution_context,
    is_protected_metric,
    normalize_company_name,
    normalize_person_name,
    should_merge_companies,
    should_merge_persons,
)


class TestNormalizeCompanyName:
    """Tests for normalize_company_name() (AC: #1)."""

    def test_normalize_strips_corp_suffix(self):
        """'ABC Corp' normalizes to 'abc'."""
        result = normalize_company_name("ABC Corp")
        assert result == "abc"

    def test_normalize_strips_corporation_suffix(self):
        """'ABC Corporation' normalizes to 'abc'."""
        result = normalize_company_name("ABC Corporation")
        assert result == "abc"

    def test_normalize_strips_inc_suffix(self):
        """'ABC Inc' normalizes to 'abc'."""
        result = normalize_company_name("ABC Inc")
        assert result == "abc"

    def test_normalize_strips_inc_with_period(self):
        """'ABC Inc.' normalizes to 'abc'."""
        result = normalize_company_name("ABC Inc.")
        assert result == "abc"

    def test_normalize_strips_llc_suffix(self):
        """'ABC LLC' normalizes to 'abc'."""
        result = normalize_company_name("ABC LLC")
        assert result == "abc"

    def test_normalize_strips_ltd_suffix(self):
        """'ABC Ltd' normalizes to 'abc'."""
        result = normalize_company_name("ABC Ltd")
        assert result == "abc"

    def test_normalize_strips_limited_suffix(self):
        """'ABC Limited' normalizes to 'abc'."""
        result = normalize_company_name("ABC Limited")
        assert result == "abc"

    def test_normalize_strips_multiple_suffixes(self):
        """'ABC Corp Inc' normalizes to 'abc'."""
        result = normalize_company_name("ABC Corp Inc")
        assert result == "abc"

    def test_normalize_preserves_core_name(self):
        """Multi-word company names preserve core words."""
        result = normalize_company_name("Acme Technology Solutions Inc")
        assert result == "acme technology solutions"

    def test_normalize_handles_punctuation(self):
        """Punctuation is replaced with spaces."""
        result = normalize_company_name("ABC, Inc.")
        assert result == "abc"

    def test_normalize_handles_dashes(self):
        """Dashes are replaced with spaces."""
        result = normalize_company_name("ABC-Corp")
        assert result == "abc"

    def test_normalize_handles_apostrophes(self):
        """Apostrophes are replaced with spaces."""
        result = normalize_company_name("O'Reilly Corp")
        assert result == "o reilly"

    def test_normalize_lowercase(self):
        """Result is lowercase."""
        result = normalize_company_name("ABC CORPORATION")
        assert result == "abc"

    def test_normalize_trims_whitespace(self):
        """Leading/trailing whitespace is trimmed."""
        result = normalize_company_name("  ABC Corp  ")
        assert result == "abc"

    def test_normalize_handles_gmbh_suffix(self):
        """German GmbH suffix is stripped."""
        result = normalize_company_name("ABC GmbH")
        assert result == "abc"

    def test_normalize_handles_plc_suffix(self):
        """UK PLC suffix is stripped."""
        result = normalize_company_name("ABC PLC")
        assert result == "abc"

    def test_normalize_handles_holdings_suffix(self):
        """Holdings suffix is stripped."""
        result = normalize_company_name("ABC Holdings")
        assert result == "abc"

    def test_normalize_handles_group_suffix(self):
        """Group suffix is stripped."""
        result = normalize_company_name("ABC Group")
        assert result == "abc"

    def test_same_company_different_suffixes(self):
        """Different suffixes normalize to same value (AC: #1)."""
        norm1 = normalize_company_name("ABC Corp")
        norm2 = normalize_company_name("ABC Corporation")
        norm3 = normalize_company_name("ABC Inc")
        norm4 = normalize_company_name("ABC, Inc.")
        norm5 = normalize_company_name("ABC LLC")

        assert norm1 == norm2 == norm3 == norm4 == norm5 == "abc"


class TestNormalizePersonName:
    """Tests for normalize_person_name() (AC: #2)."""

    def test_normalize_basic_name(self):
        """Basic name is lowercased."""
        result = normalize_person_name("John Smith")
        assert result == "john smith"

    def test_normalize_strips_title_in_parens(self):
        """Title in parentheses is removed."""
        result = normalize_person_name("John Smith (CEO)")
        assert result == "john smith"

    def test_normalize_strips_multiple_parens(self):
        """Only content after first paren is removed."""
        result = normalize_person_name("John Smith (CEO, ABC Corp)")
        assert result == "john smith"

    def test_normalize_preserves_initials(self):
        """Initials are preserved (for pattern matching)."""
        result = normalize_person_name("J. Smith")
        assert result == "j. smith"

    def test_normalize_preserves_middle_initial(self):
        """Middle initials are preserved."""
        result = normalize_person_name("John Q. Smith")
        assert result == "john q. smith"

    def test_normalize_lowercase(self):
        """Result is lowercase."""
        result = normalize_person_name("JOHN SMITH")
        assert result == "john smith"

    def test_normalize_trims_whitespace(self):
        """Leading/trailing whitespace is trimmed."""
        result = normalize_person_name("  John Smith  ")
        assert result == "john smith"


class TestIsProtectedMetric:
    """Tests for is_protected_metric() (AC: #3)."""

    def test_revenue_is_protected(self):
        """'Revenue' should not be auto-merged."""
        assert is_protected_metric("Revenue") is True

    def test_net_revenue_is_protected(self):
        """'Net Revenue' should not be auto-merged."""
        assert is_protected_metric("Net Revenue") is True

    def test_gross_revenue_is_protected(self):
        """'Gross Revenue' should not be auto-merged."""
        assert is_protected_metric("Gross Revenue") is True

    def test_recurring_revenue_is_protected(self):
        """'Recurring Revenue' should not be auto-merged."""
        assert is_protected_metric("Recurring Revenue") is True

    def test_arr_is_protected(self):
        """'ARR' should not be auto-merged."""
        assert is_protected_metric("ARR") is True

    def test_mrr_is_protected(self):
        """'MRR' should not be auto-merged."""
        assert is_protected_metric("MRR") is True

    def test_gross_margin_is_protected(self):
        """'Gross Margin' should not be auto-merged."""
        assert is_protected_metric("Gross Margin") is True

    def test_operating_margin_is_protected(self):
        """'Operating Margin' should not be auto-merged."""
        assert is_protected_metric("Operating Margin") is True

    def test_net_margin_is_protected(self):
        """'Net Margin' should not be auto-merged."""
        assert is_protected_metric("Net Margin") is True

    def test_ebitda_margin_is_protected(self):
        """'EBITDA Margin' should not be auto-merged."""
        assert is_protected_metric("EBITDA Margin") is True

    def test_company_name_not_protected(self):
        """Company names are not protected."""
        assert is_protected_metric("ABC Company") is False

    def test_person_name_not_protected(self):
        """Person names are not protected."""
        assert is_protected_metric("John Smith") is False

    def test_case_insensitive(self):
        """Detection is case-insensitive."""
        assert is_protected_metric("REVENUE") is True
        assert is_protected_metric("net revenue") is True
        assert is_protected_metric("Net REVENUE") is True

    def test_metric_in_phrase(self):
        """Metrics are detected in phrases."""
        assert is_protected_metric("Q3 2024 Revenue") is True
        assert is_protected_metric("Annual Net Revenue") is True


class TestShouldMergeCompanies:
    """Tests for should_merge_companies() (AC: #1)."""

    def test_exact_match_after_normalization(self):
        """Same company with different suffixes merges."""
        should_merge, confidence = should_merge_companies("ABC Corp", "ABC Inc")
        assert should_merge is True
        assert confidence == 0.95

    def test_exact_match_different_case(self):
        """Same company with different case merges."""
        should_merge, confidence = should_merge_companies("ABC CORP", "abc corporation")
        assert should_merge is True
        assert confidence == 0.95

    def test_substring_match(self):
        """Substring match with lower confidence."""
        should_merge, confidence = should_merge_companies("ABC Corp", "ABC Technology Corp")
        assert should_merge is True
        assert confidence == 0.80

    def test_different_companies_no_merge(self):
        """Different companies do not merge."""
        should_merge, confidence = should_merge_companies("ABC Corp", "XYZ Corp")
        assert should_merge is False
        assert confidence == 0.0

    def test_similar_but_different(self):
        """Similar but distinct companies do not merge."""
        should_merge, confidence = should_merge_companies("ABC Corp", "ABD Corp")
        assert should_merge is False
        assert confidence == 0.0

    def test_empty_strings_no_merge(self):
        """Empty strings do not merge (edge case guard)."""
        should_merge, confidence = should_merge_companies("", "")
        assert should_merge is False
        assert confidence == 0.0

    def test_only_suffix_no_merge(self):
        """Names that are only suffixes normalize to empty and don't merge."""
        # "Corp" and "Inc" both normalize to empty string
        should_merge, confidence = should_merge_companies("Corp", "Inc")
        assert should_merge is False
        assert confidence == 0.0

    def test_one_empty_no_merge(self):
        """One empty string doesn't merge with valid name."""
        should_merge, confidence = should_merge_companies("", "ABC Corp")
        assert should_merge is False
        assert confidence == 0.0

    def test_whitespace_only_no_merge(self):
        """Whitespace-only strings don't merge."""
        should_merge, confidence = should_merge_companies("   ", "ABC Corp")
        assert should_merge is False
        assert confidence == 0.0


class TestShouldMergePersons:
    """Tests for should_merge_persons() (AC: #2)."""

    def test_exact_match(self):
        """Same person name merges."""
        should_merge, confidence = should_merge_persons("John Smith", "John Smith")
        assert should_merge is True
        assert confidence == 0.90

    def test_initial_pattern_first_to_full(self):
        """'J. Smith' matches 'John Smith'."""
        should_merge, confidence = should_merge_persons("J. Smith", "John Smith")
        assert should_merge is True
        assert confidence == 0.75

    def test_initial_pattern_full_to_first(self):
        """'John Smith' matches 'J. Smith'."""
        should_merge, confidence = should_merge_persons("John Smith", "J. Smith")
        assert should_merge is True
        assert confidence == 0.75

    def test_different_roles_no_merge(self):
        """Same name with different roles does not merge."""
        should_merge, confidence = should_merge_persons(
            "John Smith", "John Smith", title1="CEO", title2="CFO"
        )
        assert should_merge is False
        assert confidence == 0.0

    def test_same_roles_merge(self):
        """Same name with same roles merges."""
        should_merge, confidence = should_merge_persons(
            "John Smith", "John Smith", title1="CEO", title2="CEO"
        )
        assert should_merge is True
        assert confidence == 0.90

    def test_different_names_no_merge(self):
        """Different names do not merge."""
        should_merge, confidence = should_merge_persons("John Smith", "Jane Doe")
        assert should_merge is False
        assert confidence == 0.0

    def test_different_last_names_no_merge(self):
        """Same first name, different last name does not merge."""
        should_merge, confidence = should_merge_persons("John Smith", "John Jones")
        assert should_merge is False
        assert confidence == 0.0

    def test_empty_strings_no_merge(self):
        """Empty strings do not merge (edge case guard)."""
        should_merge, confidence = should_merge_persons("", "")
        assert should_merge is False
        assert confidence == 0.0

    def test_one_empty_no_merge(self):
        """One empty string doesn't merge with valid name."""
        should_merge, confidence = should_merge_persons("", "John Smith")
        assert should_merge is False
        assert confidence == 0.0

    def test_whitespace_only_no_merge(self):
        """Whitespace-only strings don't merge."""
        should_merge, confidence = should_merge_persons("   ", "John Smith")
        assert should_merge is False
        assert confidence == 0.0


class TestGetMandaResolutionContext:
    """Tests for get_manda_resolution_context()."""

    def test_returns_string(self):
        """Context is a non-empty string."""
        context = get_manda_resolution_context()
        assert isinstance(context, str)
        assert len(context) > 0

    def test_contains_merge_guidance(self):
        """Context includes merge guidance."""
        context = get_manda_resolution_context()
        assert "MERGE" in context
        assert "ABC Corp" in context or "company" in context.lower()

    def test_contains_separation_guidance(self):
        """Context includes separation guidance."""
        context = get_manda_resolution_context()
        assert "SEPARATE" in context or "KEEP SEPARATE" in context
        assert "Revenue" in context or "metric" in context.lower()


class TestConstants:
    """Tests for module constants."""

    def test_company_suffix_variations_is_set(self):
        """COMPANY_SUFFIX_VARIATIONS is a set."""
        assert isinstance(COMPANY_SUFFIX_VARIATIONS, set)

    def test_company_suffix_variations_contains_expected(self):
        """Contains expected company suffixes."""
        expected = {"corp", "corporation", "inc", "llc", "ltd", "limited"}
        assert expected.issubset(COMPANY_SUFFIX_VARIATIONS)

    def test_distinct_metrics_is_dict(self):
        """DISTINCT_METRICS is a dictionary."""
        assert isinstance(DISTINCT_METRICS, dict)

    def test_distinct_metrics_has_revenue_types(self):
        """Contains revenue type metrics."""
        assert "revenue_types" in DISTINCT_METRICS
        assert isinstance(DISTINCT_METRICS["revenue_types"], list)
        assert "revenue" in DISTINCT_METRICS["revenue_types"]

    def test_distinct_metrics_has_margin_types(self):
        """Contains margin type metrics."""
        assert "margin_types" in DISTINCT_METRICS
        assert isinstance(DISTINCT_METRICS["margin_types"], list)

    def test_resolution_thresholds_is_dict(self):
        """RESOLUTION_THRESHOLDS is a dictionary."""
        assert isinstance(RESOLUTION_THRESHOLDS, dict)

    def test_resolution_thresholds_has_expected_keys(self):
        """Contains expected threshold keys."""
        expected_keys = {"exact_match", "high_confidence", "review_threshold", "low_confidence"}
        assert expected_keys.issubset(set(RESOLUTION_THRESHOLDS.keys()))

    def test_resolution_thresholds_values_in_range(self):
        """Threshold values are between 0 and 1."""
        for key, value in RESOLUTION_THRESHOLDS.items():
            assert 0.0 <= value <= 1.0, f"{key} has invalid value {value}"


class TestPersonEntityAliases:
    """Tests for Person entity aliases field (AC: #2)."""

    def test_person_has_aliases_field(self):
        """Person model has aliases field."""
        from src.graphiti.schema.entities import Person

        person = Person(name="John Smith", role="executive")
        assert hasattr(person, "aliases")
        assert person.aliases == []

    def test_person_aliases_default_empty_list(self):
        """Aliases defaults to empty list."""
        from src.graphiti.schema.entities import Person

        person = Person(name="John Smith", role="executive")
        assert person.aliases == []

    def test_person_aliases_can_be_set(self):
        """Aliases can be set on creation."""
        from src.graphiti.schema.entities import Person

        person = Person(
            name="John Smith",
            role="executive",
            aliases=["J. Smith", "Johnny Smith"],
        )
        assert person.aliases == ["J. Smith", "Johnny Smith"]

    def test_person_aliases_is_list(self):
        """Aliases field is a list type."""
        from src.graphiti.schema.entities import Person

        person = Person(
            name="John Smith",
            role="executive",
            aliases=["J. Smith"],
        )
        assert isinstance(person.aliases, list)


class TestModuleExports:
    """Tests for module exports from graphiti package."""

    def test_resolution_functions_exported(self):
        """Resolution functions are exported from graphiti module."""
        from src.graphiti import (
            normalize_company_name,
            normalize_person_name,
            is_protected_metric,
            should_merge_companies,
            should_merge_persons,
            get_manda_resolution_context,
        )

        assert callable(normalize_company_name)
        assert callable(normalize_person_name)
        assert callable(is_protected_metric)
        assert callable(should_merge_companies)
        assert callable(should_merge_persons)
        assert callable(get_manda_resolution_context)

    def test_resolution_constants_exported(self):
        """Resolution constants are exported from graphiti module."""
        from src.graphiti import (
            COMPANY_SUFFIX_VARIATIONS,
            DISTINCT_METRICS,
            RESOLUTION_THRESHOLDS,
        )

        assert isinstance(COMPANY_SUFFIX_VARIATIONS, set)
        assert isinstance(DISTINCT_METRICS, dict)
        assert isinstance(RESOLUTION_THRESHOLDS, dict)
