"""
Tests for LLM prompt generation and response parsing.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #6)
"""

import pytest

from src.llm.prompts import (
    SYSTEM_PROMPT,
    get_system_prompt,
    get_extraction_prompt,
    get_batch_extraction_prompt,
    parse_findings_response,
)


class TestSystemPrompt:
    """Tests for system prompt generation."""

    def test_system_prompt_not_empty(self) -> None:
        """Test that system prompt is defined."""
        assert SYSTEM_PROMPT is not None
        assert len(SYSTEM_PROMPT) > 100

    def test_get_system_prompt_returns_constant(self) -> None:
        """Test that get_system_prompt returns the constant."""
        prompt = get_system_prompt()
        assert prompt == SYSTEM_PROMPT

    def test_system_prompt_mentions_ma(self) -> None:
        """Test that system prompt references M&A analysis."""
        assert "M&A" in SYSTEM_PROMPT

    def test_system_prompt_mentions_finding_types(self) -> None:
        """Test that system prompt defines finding types."""
        assert "metric" in SYSTEM_PROMPT.lower()
        assert "fact" in SYSTEM_PROMPT.lower()
        assert "risk" in SYSTEM_PROMPT.lower()

    def test_system_prompt_mentions_domains(self) -> None:
        """Test that system prompt defines domains."""
        assert "financial" in SYSTEM_PROMPT.lower()
        assert "operational" in SYSTEM_PROMPT.lower()
        assert "legal" in SYSTEM_PROMPT.lower()


class TestExtractionPrompt:
    """Tests for single chunk extraction prompt."""

    def test_extraction_prompt_includes_content(self) -> None:
        """Test that prompt includes chunk content."""
        prompt = get_extraction_prompt(
            chunk_content="This is the document content.",
            document_name="test.pdf",
        )
        assert "This is the document content." in prompt

    def test_extraction_prompt_includes_document_name(self) -> None:
        """Test that prompt includes document name."""
        prompt = get_extraction_prompt(
            chunk_content="Content",
            document_name="financial_model.xlsx",
        )
        assert "financial_model.xlsx" in prompt

    def test_extraction_prompt_includes_page_number(self) -> None:
        """Test that prompt includes page number."""
        prompt = get_extraction_prompt(
            chunk_content="Content",
            document_name="test.pdf",
            page_number=5,
        )
        assert "5" in prompt

    def test_extraction_prompt_handles_none_page(self) -> None:
        """Test that prompt handles missing page number."""
        prompt = get_extraction_prompt(
            chunk_content="Content",
            document_name="test.pdf",
            page_number=None,
        )
        assert "unknown" in prompt

    def test_extraction_prompt_includes_chunk_type(self) -> None:
        """Test that prompt includes chunk type."""
        prompt = get_extraction_prompt(
            chunk_content="Content",
            document_name="test.pdf",
            chunk_type="table",
        )
        assert "table" in prompt


class TestBatchExtractionPrompt:
    """Tests for batch extraction prompt."""

    def test_batch_prompt_includes_all_chunks(self) -> None:
        """Test that batch prompt includes all chunk contents."""
        chunks = [
            {"content": "First chunk", "page_number": 1, "chunk_type": "text"},
            {"content": "Second chunk", "page_number": 2, "chunk_type": "text"},
        ]
        prompt = get_batch_extraction_prompt(
            chunks=chunks,
            document_name="test.pdf",
        )
        assert "First chunk" in prompt
        assert "Second chunk" in prompt

    def test_batch_prompt_includes_chunk_indices(self) -> None:
        """Test that batch prompt numbers chunks."""
        chunks = [
            {"content": "Chunk A", "page_number": 1, "chunk_type": "text"},
            {"content": "Chunk B", "page_number": 2, "chunk_type": "text"},
        ]
        prompt = get_batch_extraction_prompt(
            chunks=chunks,
            document_name="test.pdf",
        )
        assert "CHUNK 0" in prompt
        assert "CHUNK 1" in prompt

    def test_batch_prompt_includes_page_numbers(self) -> None:
        """Test that batch prompt includes page numbers."""
        chunks = [
            {"content": "Content", "page_number": 42, "chunk_type": "text"},
        ]
        prompt = get_batch_extraction_prompt(
            chunks=chunks,
            document_name="test.pdf",
        )
        assert "42" in prompt

    def test_batch_prompt_includes_document_name(self) -> None:
        """Test that batch prompt includes document name."""
        chunks = [{"content": "Content", "page_number": 1, "chunk_type": "text"}]
        prompt = get_batch_extraction_prompt(
            chunks=chunks,
            document_name="important_doc.pdf",
            project_name="Acme Acquisition",
        )
        assert "important_doc.pdf" in prompt
        assert "Acme Acquisition" in prompt


class TestParseFindingsResponse:
    """Tests for parsing LLM response into findings."""

    def test_parse_valid_json_array(self) -> None:
        """Test parsing a valid JSON array."""
        response = """[
            {
                "content": "Revenue was $50M in 2023",
                "finding_type": "metric",
                "domain": "financial",
                "confidence_score": 95,
                "source_reference": {"page": 5, "section": "Financials"}
            }
        ]"""
        findings = parse_findings_response(response)
        assert len(findings) == 1
        assert findings[0]["content"] == "Revenue was $50M in 2023"
        assert findings[0]["finding_type"] == "metric"
        assert findings[0]["domain"] == "financial"
        assert findings[0]["confidence_score"] == 95

    def test_parse_json_in_markdown_code_block(self) -> None:
        """Test parsing JSON wrapped in markdown code block."""
        response = """```json
[
    {
        "content": "Finding text",
        "finding_type": "fact",
        "domain": "operational",
        "confidence_score": 80,
        "source_reference": {}
    }
]
```"""
        findings = parse_findings_response(response)
        assert len(findings) == 1
        assert findings[0]["content"] == "Finding text"

    def test_parse_empty_array(self) -> None:
        """Test parsing empty array."""
        response = "[]"
        findings = parse_findings_response(response)
        assert findings == []

    def test_parse_normalizes_finding_type(self) -> None:
        """Test that unknown finding types default to 'fact'."""
        response = """[{
            "content": "Some finding",
            "finding_type": "unknown_type",
            "domain": "financial",
            "confidence_score": 70,
            "source_reference": {}
        }]"""
        findings = parse_findings_response(response)
        assert findings[0]["finding_type"] == "fact"

    def test_parse_normalizes_domain(self) -> None:
        """Test that unknown domains default to 'operational'."""
        response = """[{
            "content": "Some finding",
            "finding_type": "fact",
            "domain": "unknown_domain",
            "confidence_score": 70,
            "source_reference": {}
        }]"""
        findings = parse_findings_response(response)
        assert findings[0]["domain"] == "operational"

    def test_parse_clamps_confidence_score(self) -> None:
        """Test that confidence scores are clamped to 0-100."""
        response = """[
            {"content": "A", "finding_type": "fact", "domain": "financial", "confidence_score": 150, "source_reference": {}},
            {"content": "B", "finding_type": "fact", "domain": "financial", "confidence_score": -10, "source_reference": {}}
        ]"""
        findings = parse_findings_response(response)
        assert findings[0]["confidence_score"] == 100
        assert findings[1]["confidence_score"] == 0

    def test_parse_handles_string_confidence(self) -> None:
        """Test that string confidence scores are converted."""
        response = """[{
            "content": "Finding",
            "finding_type": "fact",
            "domain": "financial",
            "confidence_score": "85",
            "source_reference": {}
        }]"""
        findings = parse_findings_response(response)
        assert findings[0]["confidence_score"] == 85

    def test_parse_skips_invalid_findings(self) -> None:
        """Test that invalid findings are skipped."""
        response = """[
            {"content": "", "finding_type": "fact", "domain": "financial", "confidence_score": 80},
            {"content": "Valid finding", "finding_type": "fact", "domain": "financial", "confidence_score": 80}
        ]"""
        findings = parse_findings_response(response)
        assert len(findings) == 1
        assert findings[0]["content"] == "Valid finding"

    def test_parse_empty_response_returns_empty(self) -> None:
        """Test that empty response returns empty list."""
        findings = parse_findings_response("")
        assert findings == []

    def test_parse_whitespace_response_returns_empty(self) -> None:
        """Test that whitespace response returns empty list."""
        findings = parse_findings_response("   \n  ")
        assert findings == []

    def test_parse_invalid_json_raises(self) -> None:
        """Test that invalid JSON raises ValueError."""
        with pytest.raises(ValueError):
            parse_findings_response("This is not JSON")

    def test_parse_preserves_source_reference(self) -> None:
        """Test that source reference is preserved."""
        response = """[{
            "content": "Finding",
            "finding_type": "fact",
            "domain": "financial",
            "confidence_score": 80,
            "source_reference": {
                "page": 10,
                "section": "Summary",
                "context": "Quote from document"
            }
        }]"""
        findings = parse_findings_response(response)
        assert findings[0]["source_reference"]["page"] == 10
        assert findings[0]["source_reference"]["section"] == "Summary"
        assert findings[0]["source_reference"]["context"] == "Quote from document"

    def test_parse_multiple_findings(self) -> None:
        """Test parsing multiple findings."""
        response = """[
            {"content": "Finding 1", "finding_type": "metric", "domain": "financial", "confidence_score": 90, "source_reference": {}},
            {"content": "Finding 2", "finding_type": "risk", "domain": "legal", "confidence_score": 85, "source_reference": {}},
            {"content": "Finding 3", "finding_type": "opportunity", "domain": "market", "confidence_score": 75, "source_reference": {}}
        ]"""
        findings = parse_findings_response(response)
        assert len(findings) == 3
        assert findings[0]["finding_type"] == "metric"
        assert findings[1]["finding_type"] == "risk"
        assert findings[2]["finding_type"] == "opportunity"
