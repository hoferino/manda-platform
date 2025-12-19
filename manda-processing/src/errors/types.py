"""
Error types for E12.6 - Error Handling & Graceful Degradation.
Detection patterns must match TypeScript toUserFacingError() for consistency.
Integrates with existing RetryManager from E3.8 (src/jobs/retry_manager.py).
"""

from enum import Enum
from typing import Optional


class ErrorSeverity(Enum):
    LOW = "low"        # Logged but not alerted
    MEDIUM = "medium"  # Logged and may trigger alert
    HIGH = "high"      # Immediate alert
    CRITICAL = "critical"


class DocumentParsingErrorReason(Enum):
    UNSUPPORTED_TYPE = "unsupported_type"
    CORRUPTED = "corrupted"
    PASSWORD_PROTECTED = "password_protected"
    TOO_LARGE = "too_large"
    ENCODING_ERROR = "encoding_error"
    UNKNOWN = "unknown"


class UserFacingError(Exception):
    """Base class for errors safe to show to users."""

    def __init__(self, message: str, *, status_code: int = 500, is_retryable: bool = False,
                 cause: Optional[Exception] = None, severity: ErrorSeverity = ErrorSeverity.MEDIUM):
        super().__init__(message)
        self.status_code = status_code
        self.is_retryable = is_retryable
        self.cause = cause
        self.severity = severity
        self.user_message = message


class RateLimitError(UserFacingError):
    def __init__(self, provider: str, retry_after_ms: int = 1000, cause: Optional[Exception] = None):
        super().__init__("Service is temporarily busy. Please try again in a moment.",
                        status_code=429, is_retryable=True, cause=cause, severity=ErrorSeverity.LOW)
        self.provider = provider
        self.retry_after_ms = retry_after_ms


class GraphitiConnectionError(UserFacingError):
    def __init__(self, cause: Optional[Exception] = None):
        super().__init__("Knowledge graph temporarily unavailable. Basic search is still working.",
                        status_code=503, is_retryable=True, cause=cause, severity=ErrorSeverity.HIGH)


class DocumentParsingError(UserFacingError):
    REASON_MESSAGES = {
        DocumentParsingErrorReason.UNSUPPORTED_TYPE: "This file type isn't supported. Please upload PDF, Word, Excel, or PowerPoint.",
        DocumentParsingErrorReason.CORRUPTED: "This file appears corrupted. Please upload a different version.",
        DocumentParsingErrorReason.PASSWORD_PROTECTED: "This file is password-protected. Please remove the password and try again.",
        DocumentParsingErrorReason.TOO_LARGE: "This file is too large (max 100MB). Please upload a smaller file.",
        DocumentParsingErrorReason.ENCODING_ERROR: "This file has encoding issues. Please save it in a standard format.",
        DocumentParsingErrorReason.UNKNOWN: "There was an issue processing this file. Please try again.",
    }

    def __init__(self, reason: DocumentParsingErrorReason, cause: Optional[Exception] = None):
        message = self.REASON_MESSAGES.get(reason, self.REASON_MESSAGES[DocumentParsingErrorReason.UNKNOWN])
        super().__init__(message, status_code=400, is_retryable=reason == DocumentParsingErrorReason.UNKNOWN,
                        cause=cause, severity=ErrorSeverity.LOW if reason != DocumentParsingErrorReason.UNKNOWN else ErrorSeverity.MEDIUM)
        self.reason = reason


class LLMServiceError(UserFacingError):
    def __init__(self, provider: str, cause: Optional[Exception] = None):
        super().__init__("AI service temporarily unavailable. Please try again in a moment.",
                        status_code=503, is_retryable=True, cause=cause, severity=ErrorSeverity.HIGH)
        self.provider = provider


class NetworkError(UserFacingError):
    """Network/timeout errors - matches TypeScript NetworkError."""
    def __init__(self, cause: Optional[Exception] = None):
        super().__init__("The request timed out or couldn't connect. Please check your connection and try again.",
                        status_code=504, is_retryable=True, cause=cause, severity=ErrorSeverity.MEDIUM)


def classify_error(error: Exception) -> UserFacingError:
    """Classify any error into UserFacingError. Patterns match TypeScript toUserFacingError()."""
    if isinstance(error, UserFacingError):
        return error

    message = str(error).lower()

    # Rate limit detection (matches TS)
    if "rate limit" in message or "429" in message or "too many requests" in message:
        return RateLimitError("unknown", cause=error)
    # Neo4j/Graphiti detection (matches TS)
    if "neo4j" in message or "graphiti" in message or "graph database" in message:
        return GraphitiConnectionError(cause=error)
    # Network/timeout detection (matches TS)
    if "timeout" in message or "network" in message or "econnrefused" in message or "socket" in message:
        return NetworkError(cause=error)
    # LLM service error detection (matches TS)
    if "503" in message or "service unavailable" in message or "overloaded" in message:
        return LLMServiceError("unknown", cause=error)
    # Document parsing detection (matches TS)
    if "password" in message and ("protect" in message or "encrypt" in message):
        return DocumentParsingError(DocumentParsingErrorReason.PASSWORD_PROTECTED, cause=error)
    if "corrupt" in message or "malformed" in message:
        return DocumentParsingError(DocumentParsingErrorReason.CORRUPTED, cause=error)
    if "unsupported" in message and ("type" in message or "format" in message):
        return DocumentParsingError(DocumentParsingErrorReason.UNSUPPORTED_TYPE, cause=error)

    return UserFacingError("Something went wrong. Please try again.", status_code=500, is_retryable=True, cause=error)
