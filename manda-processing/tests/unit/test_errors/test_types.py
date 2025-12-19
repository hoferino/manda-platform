"""Unit tests for E12.6 error types."""
import pytest
from src.errors.types import (
    UserFacingError,
    RateLimitError,
    GraphitiConnectionError,
    DocumentParsingError,
    DocumentParsingErrorReason,
    LLMServiceError,
    NetworkError,
    classify_error,
)


class TestClassifyError:
    def test_returns_user_facing_error_as_is(self):
        original = RateLimitError("test", 1000)
        assert classify_error(original) is original

    def test_detects_rate_limit_429(self):
        result = classify_error(Exception("Error 429: Too many requests"))
        assert isinstance(result, RateLimitError)

    def test_detects_rate_limit_text(self):
        result = classify_error(Exception("Rate limit exceeded"))
        assert isinstance(result, RateLimitError)

    def test_detects_neo4j(self):
        result = classify_error(Exception("neo4j connection failed"))
        assert isinstance(result, GraphitiConnectionError)

    def test_detects_graphiti(self):
        result = classify_error(Exception("Graphiti service unavailable"))
        assert isinstance(result, GraphitiConnectionError)

    def test_detects_network_timeout(self):
        result = classify_error(Exception("Connection timeout"))
        assert isinstance(result, NetworkError)

    def test_detects_network_econnrefused(self):
        result = classify_error(Exception("ECONNREFUSED"))
        assert isinstance(result, NetworkError)

    def test_detects_network_socket(self):
        result = classify_error(Exception("Socket error"))
        assert isinstance(result, NetworkError)

    def test_detects_llm_service_503(self):
        result = classify_error(Exception("Error 503: Service unavailable"))
        assert isinstance(result, LLMServiceError)

    def test_detects_llm_service_overloaded(self):
        result = classify_error(Exception("API is overloaded"))
        assert isinstance(result, LLMServiceError)

    def test_detects_password_protected(self):
        result = classify_error(Exception("File is password protected"))
        assert isinstance(result, DocumentParsingError)
        assert result.reason == DocumentParsingErrorReason.PASSWORD_PROTECTED

    def test_detects_encrypted(self):
        result = classify_error(Exception("File is encrypted with password"))
        assert isinstance(result, DocumentParsingError)
        assert result.reason == DocumentParsingErrorReason.PASSWORD_PROTECTED

    def test_detects_corrupted(self):
        result = classify_error(Exception("File is corrupted"))
        assert isinstance(result, DocumentParsingError)
        assert result.reason == DocumentParsingErrorReason.CORRUPTED

    def test_detects_malformed(self):
        result = classify_error(Exception("Malformed PDF structure"))
        assert isinstance(result, DocumentParsingError)
        assert result.reason == DocumentParsingErrorReason.CORRUPTED

    def test_detects_unsupported_type(self):
        result = classify_error(Exception("Unsupported file type"))
        assert isinstance(result, DocumentParsingError)
        assert result.reason == DocumentParsingErrorReason.UNSUPPORTED_TYPE

    def test_generic_fallback_preserves_cause(self):
        original = Exception("Random unknown error")
        result = classify_error(original)
        assert isinstance(result, UserFacingError)
        assert result.cause is original
        assert result.is_retryable is True

    def test_generic_fallback_has_safe_message(self):
        result = classify_error(Exception("Internal NullPointerException stack trace..."))
        assert "NullPointer" not in result.user_message
        assert "try again" in result.user_message.lower()


class TestDocumentParsingError:
    @pytest.mark.parametrize("reason,keyword", [
        (DocumentParsingErrorReason.PASSWORD_PROTECTED, "password"),
        (DocumentParsingErrorReason.CORRUPTED, "corrupt"),
        (DocumentParsingErrorReason.UNSUPPORTED_TYPE, "support"),
        (DocumentParsingErrorReason.TOO_LARGE, "large"),
    ])
    def test_reason_messages(self, reason, keyword):
        error = DocumentParsingError(reason)
        assert keyword in str(error).lower()

    def test_only_unknown_is_retryable(self):
        assert DocumentParsingError(DocumentParsingErrorReason.UNKNOWN).is_retryable is True
        assert DocumentParsingError(DocumentParsingErrorReason.CORRUPTED).is_retryable is False
        assert DocumentParsingError(DocumentParsingErrorReason.PASSWORD_PROTECTED).is_retryable is False


class TestRateLimitError:
    def test_properties(self):
        error = RateLimitError("anthropic", 5000)
        assert error.status_code == 429
        assert error.is_retryable is True
        assert error.provider == "anthropic"
        assert error.retry_after_ms == 5000


class TestGraphitiConnectionError:
    def test_properties(self):
        error = GraphitiConnectionError()
        assert error.status_code == 503
        assert error.is_retryable is True

    def test_preserves_cause(self):
        cause = Exception("Original error")
        error = GraphitiConnectionError(cause=cause)
        assert error.cause is cause


class TestNetworkError:
    def test_properties(self):
        error = NetworkError()
        assert error.status_code == 504
        assert error.is_retryable is True

    def test_preserves_cause(self):
        cause = Exception("Original error")
        error = NetworkError(cause=cause)
        assert error.cause is cause


class TestLLMServiceError:
    def test_properties(self):
        error = LLMServiceError("anthropic")
        assert error.status_code == 503
        assert error.is_retryable is True
        assert error.provider == "anthropic"

    def test_preserves_cause(self):
        cause = Exception("Original error")
        error = LLMServiceError("openai", cause=cause)
        assert error.cause is cause
