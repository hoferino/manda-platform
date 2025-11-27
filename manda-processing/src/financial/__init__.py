"""
Financial extraction module for Manda processing service.
Story: E3.9 - Financial Model Integration

This module provides:
- FinancialDocumentDetector: Detect if a document contains financial data
- FinancialMetricExtractor: Extract financial metrics from parsed documents
"""

from src.financial.detector import (
    FinancialDocumentDetector,
    DetectionResult,
    get_financial_detector,
)
from src.financial.extractor import (
    FinancialMetricExtractor,
    get_financial_extractor,
)

__all__ = [
    "FinancialDocumentDetector",
    "DetectionResult",
    "get_financial_detector",
    "FinancialMetricExtractor",
    "get_financial_extractor",
]
