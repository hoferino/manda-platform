"""
Error classification system for document processing retry logic.
Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #3)

This module provides:
- ErrorCategory enum for classifying errors as transient, permanent, or unknown
- ClassifiedError dataclass with error details and retry recommendation
- ErrorClassifier class for analyzing exceptions and determining retry behavior
- ProcessingStage enum for stage-aware retry logic
"""

import re
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)


class ErrorCategory(str, Enum):
    """Categories of errors for retry decisions."""

    TRANSIENT = "transient"   # Should retry - temporary failures
    PERMANENT = "permanent"   # Should NOT retry - permanent failures
    UNKNOWN = "unknown"       # Default to retry once


class ProcessingStage(str, Enum):
    """Processing pipeline stages for stage-aware retry."""

    PENDING = "pending"       # Not started
    PARSED = "parsed"         # Document parsed, chunks created
    EMBEDDED = "embedded"     # Embeddings generated
    ANALYZED = "analyzed"     # LLM analysis complete
    COMPLETE = "complete"     # All processing complete


# Stage ordering for determining next stage
STAGE_ORDER = [
    ProcessingStage.PENDING,
    ProcessingStage.PARSED,
    ProcessingStage.EMBEDDED,
    ProcessingStage.ANALYZED,
    ProcessingStage.COMPLETE,
]


def get_next_stage(last_completed: Optional[ProcessingStage]) -> ProcessingStage:
    """
    Determine which stage to start from based on last completed stage.

    Args:
        last_completed: The last successfully completed processing stage

    Returns:
        The next stage to process
    """
    if last_completed is None:
        return ProcessingStage.PENDING

    try:
        current_idx = STAGE_ORDER.index(last_completed)
        if current_idx + 1 < len(STAGE_ORDER):
            return STAGE_ORDER[current_idx + 1]
        return ProcessingStage.COMPLETE
    except ValueError:
        return ProcessingStage.PENDING


def stage_to_status(stage: ProcessingStage) -> str:
    """
    Convert a ProcessingStage to the corresponding processing_status value.

    Args:
        stage: The processing stage

    Returns:
        The status string used in the database
    """
    stage_status_map = {
        ProcessingStage.PENDING: "pending",
        ProcessingStage.PARSED: "parsed",
        ProcessingStage.EMBEDDED: "embedded",
        ProcessingStage.ANALYZED: "analyzed",
        ProcessingStage.COMPLETE: "complete",
    }
    return stage_status_map.get(stage, "pending")


def status_to_stage(status: str) -> Optional[ProcessingStage]:
    """
    Convert a processing_status value to the corresponding ProcessingStage.

    Args:
        status: The status string from the database

    Returns:
        The ProcessingStage, or None if status doesn't map to a stage
    """
    status_stage_map = {
        "pending": ProcessingStage.PENDING,
        "processing": ProcessingStage.PENDING,
        "parsing": ProcessingStage.PENDING,
        "parsed": ProcessingStage.PARSED,
        "embedding": ProcessingStage.PARSED,
        "embedded": ProcessingStage.EMBEDDED,
        "analyzing": ProcessingStage.EMBEDDED,
        "analyzed": ProcessingStage.ANALYZED,
        "complete": ProcessingStage.COMPLETE,
    }
    return status_stage_map.get(status)


@dataclass
class ClassifiedError:
    """
    A classified error with retry recommendation and user-friendly messages.

    Attributes:
        category: The error category (transient, permanent, unknown)
        error_type: Specific error type identifier (e.g., "timeout", "invalid_file")
        message: Full error message
        should_retry: Whether this error should trigger automatic retry
        user_message: User-friendly error message for UI display
        guidance: Actionable guidance for the user (optional)
        stage: Processing stage where error occurred (optional)
        timestamp: When the error occurred
        stack_trace: Truncated stack trace for debugging (optional)
        retry_count: Current retry attempt number (optional)
    """

    category: ErrorCategory
    error_type: str
    message: str
    should_retry: bool
    user_message: str
    guidance: Optional[str] = None
    stage: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    stack_trace: Optional[str] = None
    retry_count: int = 0

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON storage."""
        return {
            "category": self.category.value,
            "error_type": self.error_type,
            "message": self.message,
            "should_retry": self.should_retry,
            "user_message": self.user_message,
            "guidance": self.guidance,
            "stage": self.stage,
            "timestamp": self.timestamp,
            "stack_trace": self.stack_trace,
            "retry_count": self.retry_count,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ClassifiedError":
        """Create from dictionary (e.g., from JSON storage)."""
        return cls(
            category=ErrorCategory(data.get("category", "unknown")),
            error_type=data.get("error_type", "unknown"),
            message=data.get("message", ""),
            should_retry=data.get("should_retry", True),
            user_message=data.get("user_message", "An error occurred"),
            guidance=data.get("guidance"),
            stage=data.get("stage"),
            timestamp=data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            stack_trace=data.get("stack_trace"),
            retry_count=data.get("retry_count", 0),
        )


class ErrorClassifier:
    """
    Classify errors for retry decisions in document processing.

    Uses regex patterns to identify error types and determine whether
    they are transient (should retry) or permanent (should fail immediately).
    """

    # Transient error patterns - these should trigger retry
    # NOTE: Order matters! More specific patterns must come before generic ones.
    # e.g., "gateway timeout" should match gateway_error, not generic timeout.
    TRANSIENT_PATTERNS: list[tuple[str, str]] = [
        # Specific timeout types (before generic timeout)
        (r"gateway.?(timeout|error)|502|504", "gateway_error"),
        (r"socket.?(error|timeout)", "socket_error"),
        (r"deadlock|lock.?timeout", "database_lock"),
        # Generic timeout (after specific types)
        (r"timeout|timed out", "timeout"),
        # Rate limiting
        (r"rate.?limit|429|too many requests", "rate_limit"),
        (r"quota.?exceeded", "quota_exceeded"),
        # Service/server errors
        (r"service.?unavailable|503", "service_unavailable"),
        (r"internal.?server.?error|500", "server_error"),
        # Connection errors
        (r"connection.?(refused|reset|error)", "connection_error"),
        (r"network.?(error|failure)", "network_error"),
        # Generic transient
        (r"temporary|transient", "transient_error"),
        (r"resource.?busy|try.?again", "resource_busy"),
    ]

    # Permanent error patterns - these should NOT trigger retry
    PERMANENT_PATTERNS: list[tuple[str, str]] = [
        (r"invalid.?file|file.?corrupt", "invalid_file"),
        (r"unsupported.?(format|type)", "unsupported_format"),
        (r"permission.?denied|403|unauthorized|401", "auth_error"),
        (r"not.?found|404|does.?not.?exist", "not_found"),
        (r"validation.?error|invalid.?data", "validation_error"),
        (r"file.?too.?large|size.?limit", "file_too_large"),
        (r"empty.?file|no.?content", "empty_file"),
        (r"password.?protected|encrypted", "encrypted_file"),
        (r"malformed|parse.?error|syntax.?error", "parse_error"),
        (r"bad.?request|400", "bad_request"),
    ]

    # User-friendly messages for each error type
    USER_MESSAGES: dict[str, str] = {
        # Transient
        "timeout": "Processing timed out",
        "rate_limit": "Service temporarily busy",
        "service_unavailable": "Processing service unavailable",
        "connection_error": "Network connection error",
        "database_lock": "Database temporarily busy",
        "transient_error": "Temporary error occurred",
        "network_error": "Network error occurred",
        "socket_error": "Connection error",
        "server_error": "Server error occurred",
        "gateway_error": "Gateway error",
        "resource_busy": "Resource temporarily busy",
        "quota_exceeded": "API quota exceeded",
        # Permanent
        "invalid_file": "File appears to be invalid or corrupted",
        "unsupported_format": "File format not supported",
        "auth_error": "Access denied",
        "not_found": "Document file not found",
        "validation_error": "Invalid document data",
        "file_too_large": "File is too large to process",
        "empty_file": "File is empty or has no content",
        "encrypted_file": "File is password protected",
        "parse_error": "Could not parse document content",
        "bad_request": "Invalid request",
        # Default
        "unknown": "An unexpected error occurred",
    }

    # Guidance messages for each error type
    GUIDANCE_MESSAGES: dict[str, str] = {
        # Transient
        "timeout": "Will retry automatically. Large documents may take longer.",
        "rate_limit": "Will retry in a few seconds.",
        "service_unavailable": "Will retry automatically.",
        "connection_error": "Will retry automatically.",
        "database_lock": "Will retry automatically.",
        "transient_error": "Will retry automatically.",
        "network_error": "Check your network connection.",
        "socket_error": "Will retry automatically.",
        "server_error": "Will retry automatically. Contact support if issue persists.",
        "gateway_error": "Will retry automatically.",
        "resource_busy": "Will retry automatically.",
        "quota_exceeded": "Will retry in a few minutes. Usage limits may apply.",
        # Permanent
        "invalid_file": "Please re-upload the document or try a different file.",
        "unsupported_format": "Supported formats: PDF, XLSX, DOCX, TXT, and common office formats.",
        "auth_error": "Contact administrator if issue persists.",
        "not_found": "Please re-upload the document.",
        "validation_error": "Check the document and try again.",
        "file_too_large": "Maximum file size is 100MB. Try splitting the document.",
        "empty_file": "The file has no extractable content. Check the file and re-upload.",
        "encrypted_file": "Please remove password protection and re-upload.",
        "parse_error": "The document format may be corrupted. Try re-saving and re-uploading.",
        "bad_request": "Please try again. Contact support if issue persists.",
    }

    def classify(
        self,
        error: Exception,
        stage: Optional[str] = None,
        retry_count: int = 0,
        include_stack_trace: bool = True,
        max_stack_trace_length: int = 500,
    ) -> ClassifiedError:
        """
        Classify an error for retry decisions.

        Args:
            error: The exception to classify
            stage: The processing stage where the error occurred
            retry_count: Current retry attempt number
            include_stack_trace: Whether to include a truncated stack trace
            max_stack_trace_length: Maximum length for stack trace

        Returns:
            ClassifiedError with classification and retry recommendation
        """
        message = str(error).lower()
        error_name = type(error).__name__

        # Get stack trace if requested
        stack_trace = None
        if include_stack_trace:
            try:
                full_trace = traceback.format_exc()
                if len(full_trace) > max_stack_trace_length:
                    stack_trace = full_trace[:max_stack_trace_length] + "..."
                else:
                    stack_trace = full_trace
            except Exception:
                pass

        # Check transient patterns first
        for pattern, error_type in self.TRANSIENT_PATTERNS:
            if re.search(pattern, message, re.IGNORECASE):
                logger.debug(
                    "Classified error as transient",
                    error_type=error_type,
                    pattern=pattern,
                    original_error=error_name,
                )
                return ClassifiedError(
                    category=ErrorCategory.TRANSIENT,
                    error_type=error_type,
                    message=str(error),
                    should_retry=True,
                    user_message=self.USER_MESSAGES.get(error_type, "A temporary error occurred"),
                    guidance=self.GUIDANCE_MESSAGES.get(error_type),
                    stage=stage,
                    stack_trace=stack_trace,
                    retry_count=retry_count,
                )

        # Check permanent patterns
        for pattern, error_type in self.PERMANENT_PATTERNS:
            if re.search(pattern, message, re.IGNORECASE):
                logger.debug(
                    "Classified error as permanent",
                    error_type=error_type,
                    pattern=pattern,
                    original_error=error_name,
                )
                return ClassifiedError(
                    category=ErrorCategory.PERMANENT,
                    error_type=error_type,
                    message=str(error),
                    should_retry=False,
                    user_message=self.USER_MESSAGES.get(error_type, "The document could not be processed"),
                    guidance=self.GUIDANCE_MESSAGES.get(error_type),
                    stage=stage,
                    stack_trace=stack_trace,
                    retry_count=retry_count,
                )

        # Check exception type name for additional classification hints
        error_name_lower = error_name.lower()

        # Common transient exception types
        transient_exception_types = [
            "timeout", "connectionerror", "networkerror", "socketerror",
            "temporaryerror", "retryable", "ratelimit",
        ]
        for exc_type in transient_exception_types:
            if exc_type in error_name_lower:
                return ClassifiedError(
                    category=ErrorCategory.TRANSIENT,
                    error_type="transient_error",
                    message=str(error),
                    should_retry=True,
                    user_message="A temporary error occurred",
                    guidance="Will retry automatically.",
                    stage=stage,
                    stack_trace=stack_trace,
                    retry_count=retry_count,
                )

        # Common permanent exception types
        permanent_exception_types = [
            "valueerror", "typeerror", "keyerror", "indexerror",
            "attributeerror", "invalidfile", "unsupported",
        ]
        for exc_type in permanent_exception_types:
            if exc_type in error_name_lower:
                return ClassifiedError(
                    category=ErrorCategory.PERMANENT,
                    error_type="validation_error",
                    message=str(error),
                    should_retry=False,
                    user_message="Invalid document data",
                    guidance="Check the document and try again.",
                    stage=stage,
                    stack_trace=stack_trace,
                    retry_count=retry_count,
                )

        # Default: unknown, retry once
        logger.info(
            "Could not classify error, defaulting to unknown (will retry)",
            error_type=error_name,
            message=str(error)[:200],
        )
        return ClassifiedError(
            category=ErrorCategory.UNKNOWN,
            error_type="unknown",
            message=str(error),
            should_retry=True,
            user_message="An unexpected error occurred",
            guidance="Will retry automatically. Contact support if issue persists.",
            stage=stage,
            stack_trace=stack_trace,
            retry_count=retry_count,
        )

    def is_retryable(self, error: Exception) -> bool:
        """
        Quick check if an error is retryable.

        Args:
            error: The exception to check

        Returns:
            True if the error should trigger retry
        """
        classified = self.classify(error)
        return classified.should_retry


# Global classifier instance
_classifier: Optional[ErrorClassifier] = None


def get_error_classifier() -> ErrorClassifier:
    """Get or create the global ErrorClassifier instance."""
    global _classifier
    if _classifier is None:
        _classifier = ErrorClassifier()
    return _classifier


__all__ = [
    "ErrorCategory",
    "ProcessingStage",
    "ClassifiedError",
    "ErrorClassifier",
    "get_error_classifier",
    "get_next_stage",
    "stage_to_status",
    "status_to_stage",
    "STAGE_ORDER",
]
