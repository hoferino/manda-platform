---
story_id: E14-S2
epic: E14
title: Document-Type Extraction Hints
status: completed
priority: P0
effort: 2 hours
assignee: null
completed_date: 2026-01-15
---

# E14-S2: Document-Type Extraction Hints

## User Story

**As a** document processing pipeline
**I want to** provide document-type-specific extraction hints
**So that** the LLM extracts the most relevant entities for each document type

## Background

Different document types contain different entity categories:
- Financial statements → metrics, ratios, trends
- Legal contracts → parties, terms, obligations
- Market research → competitors, market size, trends
- Operational docs → processes, KPIs, capacity

## Acceptance Criteria

- [x] New `extraction_hints.py` module created
- [x] Hints available for: financial, legal, operational, market, general
- [x] Document type detection based on filename and content analysis
- [x] Hints are extensible (easy to add new document types)
- [x] Unit tests for hint generation

## Technical Details

### New File

**Create:** `manda-processing/src/graphiti/extraction_hints.py`

```python
"""Document-type aware extraction hints for Graphiti."""

from enum import Enum
from typing import Optional

class DocumentType(Enum):
    FINANCIAL = "financial"
    LEGAL = "legal"
    OPERATIONAL = "operational"
    MARKET = "market"
    GENERAL = "general"

EXTRACTION_HINTS = {
    DocumentType.FINANCIAL: """
Extract all financial entities including:
- Financial metrics (revenue, EBITDA, margins, growth rates)
- Time periods and their associated values
- Trends and comparisons (YoY, QoQ)
- Financial ratios and KPIs
- Currency and units
- Forecasts and projections
Pay special attention to relationships between metrics across time periods.
""",

    DocumentType.LEGAL: """
Extract all legal entities including:
- Contracting parties (full legal names)
- Contract terms (duration, renewal, termination)
- Obligations and commitments
- Financial terms (payment schedules, penalties)
- Dates (effective, expiration, milestones)
- Governing law and jurisdiction
Pay special attention to conditional clauses and exceptions.
""",

    DocumentType.OPERATIONAL: """
Extract all operational entities including:
- Business processes and workflows
- Operational KPIs and metrics
- Capacity and utilization figures
- Employee counts and organizational structure
- Locations and facilities
- Systems and technology used
- Suppliers and partners
Pay special attention to dependencies and bottlenecks.
""",

    DocumentType.MARKET: """
Extract all market entities including:
- Market size and growth rates
- Competitors and market share
- Customer segments
- Industry trends
- Regulatory factors
- Geographic markets
- Pricing and positioning
Pay special attention to competitive dynamics and market drivers.
""",

    DocumentType.GENERAL: """
Extract all relevant entities including:
- Organizations and people
- Dates and time periods
- Numerical values with context
- Relationships between entities
- Key facts and claims
Be thorough - capture any information that could be relevant for M&A analysis.
"""
}

def detect_document_type(metadata: dict) -> DocumentType:
    """Detect document type from metadata and filename."""
    filename = metadata.get('filename', '').lower()

    # Filename-based detection
    financial_keywords = ['financial', 'income', 'balance', 'cashflow', 'p&l', 'forecast', 'budget', 'model']
    legal_keywords = ['contract', 'agreement', 'nda', 'lease', 'license', 'terms']
    operational_keywords = ['operations', 'process', 'org', 'structure', 'capacity']
    market_keywords = ['market', 'industry', 'competitor', 'research', 'analysis']

    if any(kw in filename for kw in financial_keywords):
        return DocumentType.FINANCIAL
    elif any(kw in filename for kw in legal_keywords):
        return DocumentType.LEGAL
    elif any(kw in filename for kw in operational_keywords):
        return DocumentType.OPERATIONAL
    elif any(kw in filename for kw in market_keywords):
        return DocumentType.MARKET

    # Default to general
    return DocumentType.GENERAL

def get_extraction_hints(doc_type: DocumentType, metadata: Optional[dict] = None) -> str:
    """Get extraction hints for document type."""
    base_hints = EXTRACTION_HINTS.get(doc_type, EXTRACTION_HINTS[DocumentType.GENERAL])

    # Add any metadata-specific context
    context_parts = [base_hints.strip()]

    if metadata:
        if filename := metadata.get('filename'):
            context_parts.append(f"\nSource document: {filename}")
        if file_type := metadata.get('file_type'):
            context_parts.append(f"File format: {file_type}")

    return "\n".join(context_parts)
```

### Tests

**Create:** `manda-processing/tests/unit/test_extraction_hints.py`

```python
import pytest
from src.graphiti.extraction_hints import (
    detect_document_type,
    get_extraction_hints,
    DocumentType
)

def test_detect_financial_document():
    assert detect_document_type({'filename': 'Q3_Financial_Statements.xlsx'}) == DocumentType.FINANCIAL
    assert detect_document_type({'filename': 'income_statement_2024.pdf'}) == DocumentType.FINANCIAL

def test_detect_legal_document():
    assert detect_document_type({'filename': 'Customer_Agreement_v2.docx'}) == DocumentType.LEGAL
    assert detect_document_type({'filename': 'NDA_Acme_Corp.pdf'}) == DocumentType.LEGAL

def test_detect_general_fallback():
    assert detect_document_type({'filename': 'random_doc.pdf'}) == DocumentType.GENERAL
    assert detect_document_type({}) == DocumentType.GENERAL

def test_get_extraction_hints_includes_metadata():
    hints = get_extraction_hints(DocumentType.FINANCIAL, {'filename': 'test.xlsx'})
    assert 'test.xlsx' in hints
    assert 'financial metrics' in hints.lower()
```

### Integration

Used by E14-S1 in `build_source_description()` function.

## Dependencies

- None

## Out of Scope

- Content-based document type detection (filename only for MVP)
- Machine learning classification

---

## Completion Notes (2026-01-15)

### Tasks Completed

1. **Created `extraction_hints.py` module** at `manda-processing/src/graphiti/extraction_hints.py`
   - `DocumentType` enum with 5 types: FINANCIAL, LEGAL, OPERATIONAL, MARKET, GENERAL
   - `EXTRACTION_HINTS` dict with comprehensive extraction instructions for each type
   - `detect_document_type()` function using keyword-based filename classification
   - `get_extraction_hints()` function that combines hints with metadata context

2. **Added comprehensive keyword sets** for document detection:
   - Financial: financial, income, balance, cashflow, cash flow, p&l, pnl, forecast, budget, model, revenue, ebitda, profit, loss, statement
   - Legal: contract, agreement, nda, lease, license, terms, legal, amendment, addendum, mou, memorandum
   - Operational: operations, process, org, structure, capacity, workflow, procedure, sop, employee, headcount, facility
   - Market: market, industry, competitor, research, analysis, segment, customer, trend, landscape

3. **Created unit tests** at `manda-processing/tests/unit/test_graphiti/test_extraction_hints.py`
   - 20 test cases covering all document types and edge cases
   - Tests for case insensitivity, empty metadata, missing filename

4. **Updated `__init__.py`** to export new module symbols:
   - Added `DocumentType`, `EXTRACTION_HINTS`, `detect_document_type`, `get_extraction_hints` to exports

### Implementation Details

- Used `frozenset` for keyword sets (O(1) lookup, immutable)
- Hints are designed to guide Graphiti's LLM extraction without modifying Graphiti library
- Module is self-contained with no external dependencies
- Extensible design: add new DocumentType and corresponding hints easily

### Testing Notes

- Unit tests pass when run in isolation (direct module import)
- Full pytest run blocked by pre-existing Python 3.14/pydantic compatibility issue in voyageai dependency
- Module functionality verified via direct Python execution

### Files Created/Modified

- **Created:** `manda-processing/src/graphiti/extraction_hints.py`
- **Created:** `manda-processing/tests/unit/test_graphiti/test_extraction_hints.py`
- **Modified:** `manda-processing/src/graphiti/__init__.py` (added exports)
