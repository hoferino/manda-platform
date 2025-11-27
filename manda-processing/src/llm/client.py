"""
Gemini LLM client for document analysis with tiered model support.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #2, #3)

This module provides:
- Async Gemini client with LangChain integration
- Tiered model support (Flash, Pro, Lite)
- Retry logic with exponential backoff
- Structured output via Pydantic models
- Cost tracking for API usage
"""

from dataclasses import dataclass, field
from typing import Any, Optional

import structlog
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from src.config import Settings, get_settings
from src.llm.models import ModelTier, estimate_cost

logger = structlog.get_logger(__name__)


class GeminiError(Exception):
    """Base exception for Gemini API errors."""

    def __init__(self, message: str, retryable: bool = False):
        self.message = message
        self.retryable = retryable
        super().__init__(message)


class GeminiRateLimitError(GeminiError):
    """Raised when Gemini rate limit is hit (429)."""

    def __init__(self, message: str):
        super().__init__(message, retryable=True)


class GeminiAPIError(GeminiError):
    """Raised for Gemini API errors (5xx)."""

    def __init__(self, message: str, retryable: bool = True):
        super().__init__(message, retryable=retryable)


class GeminiInvalidResponseError(GeminiError):
    """Raised when Gemini returns an invalid/unparseable response."""

    def __init__(self, message: str):
        super().__init__(message, retryable=False)


@dataclass
class AnalysisResult:
    """Result of analyzing a single chunk or batch of chunks."""

    findings: list[dict[str, Any]]
    input_tokens: int
    output_tokens: int
    model_tier: ModelTier
    chunk_ids: list[str] = field(default_factory=list)

    @property
    def estimated_cost_usd(self) -> float:
        """Estimate cost based on token usage."""
        return estimate_cost(self.model_tier, self.input_tokens, self.output_tokens)

    @property
    def finding_count(self) -> int:
        """Number of findings extracted."""
        return len(self.findings)


@dataclass
class BatchAnalysisResult:
    """Aggregated result of batch analysis."""

    findings: list[dict[str, Any]]
    total_input_tokens: int
    total_output_tokens: int
    model_tier: ModelTier
    batch_count: int
    failed_batch_indices: list[int] = field(default_factory=list)

    @property
    def estimated_cost_usd(self) -> float:
        """Total estimated cost in USD."""
        return estimate_cost(
            self.model_tier, self.total_input_tokens, self.total_output_tokens
        )

    @property
    def finding_count(self) -> int:
        """Total findings extracted."""
        return len(self.findings)


class GeminiClient:
    """
    Async client for Gemini LLM analysis with tiered model support.

    Features:
    - LangChain integration for structured output
    - Tiered model selection (Flash, Pro, Lite)
    - Automatic retry with exponential backoff (3 attempts)
    - Token counting for cost monitoring
    - Structured logging for observability
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the Gemini client.

        Args:
            api_key: Google API key (uses config if not provided)
            default_model: Default model to use (default: gemini-2.5-flash)
            config: Application settings
        """
        self.config = config or get_settings()

        self.api_key = api_key or self.config.google_api_key
        self.default_model = default_model or self.config.gemini_flash_model

        if not self.api_key:
            raise GeminiError(
                "Google API key not configured. Set GOOGLE_API_KEY environment variable.",
                retryable=False,
            )

        # LangChain models are created lazily per model type
        self._models: dict[str, Any] = {}

        logger.info(
            "GeminiClient initialized",
            default_model=self.default_model,
        )

    def _get_model(self, model_name: str) -> Any:
        """Get or create a LangChain ChatGoogleGenerativeAI model."""
        if model_name not in self._models:
            from langchain_google_genai import ChatGoogleGenerativeAI

            self._models[model_name] = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=self.api_key,
                temperature=0.1,  # Low temp for extraction tasks
                max_retries=0,  # We handle retries ourselves
            )
            logger.debug("Created LangChain model", model=model_name)

        return self._models[model_name]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type((GeminiRateLimitError, GeminiAPIError)),
        reraise=True,
    )
    async def _invoke_model(
        self,
        model_name: str,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> tuple[str, int, int]:
        """
        Invoke a Gemini model with the given prompt.

        Args:
            model_name: The Gemini model to use
            prompt: The user prompt
            system_prompt: Optional system prompt

        Returns:
            Tuple of (response_text, input_tokens, output_tokens)

        Raises:
            GeminiError: If API call fails
        """
        from langchain_core.messages import HumanMessage, SystemMessage

        model = self._get_model(model_name)

        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        logger.debug(
            "Invoking Gemini model",
            model=model_name,
            prompt_length=len(prompt),
        )

        try:
            response = await model.ainvoke(messages)

            # Extract token usage from response metadata
            usage = getattr(response, "usage_metadata", {}) or {}
            input_tokens = usage.get("input_tokens", 0) or usage.get(
                "prompt_token_count", 0
            )
            output_tokens = usage.get("output_tokens", 0) or usage.get(
                "candidates_token_count", 0
            )

            # If no usage info, estimate from text length
            if input_tokens == 0:
                input_tokens = len(prompt) // 4  # Rough estimate
            if output_tokens == 0:
                output_tokens = len(response.content) // 4

            logger.debug(
                "Gemini response received",
                model=model_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )

            return response.content, input_tokens, output_tokens

        except Exception as e:
            error_str = str(e).lower()

            # Check for rate limit errors
            if "429" in error_str or "rate" in error_str or "quota" in error_str:
                logger.warning(
                    "Gemini rate limit hit",
                    model=model_name,
                    error=str(e),
                )
                raise GeminiRateLimitError(f"Rate limit exceeded: {str(e)}")

            # Check for server errors (retryable)
            if "500" in error_str or "503" in error_str or "timeout" in error_str:
                logger.warning(
                    "Gemini server error (retrying)",
                    model=model_name,
                    error=str(e),
                )
                raise GeminiAPIError(f"Server error: {str(e)}", retryable=True)

            # Check for auth errors (not retryable)
            if "401" in error_str or "403" in error_str or "auth" in error_str:
                logger.error(
                    "Gemini authentication error",
                    model=model_name,
                    error=str(e),
                )
                raise GeminiError(f"Authentication failed: {str(e)}", retryable=False)

            # Default to non-retryable error
            logger.error(
                "Gemini API error",
                model=model_name,
                error=str(e),
                error_type=type(e).__name__,
            )
            raise GeminiError(f"API error: {str(e)}", retryable=False)

    async def analyze_chunk(
        self,
        content: str,
        context: dict[str, Any],
        model_tier: ModelTier = ModelTier.FLASH,
        system_prompt: Optional[str] = None,
        extraction_prompt: Optional[str] = None,
    ) -> AnalysisResult:
        """
        Analyze a single chunk and extract findings.

        Args:
            content: The chunk content to analyze
            context: Context dict with document_name, page_number, etc.
            model_tier: Which model tier to use
            system_prompt: Custom system prompt (uses default if not provided)
            extraction_prompt: Custom extraction prompt template

        Returns:
            AnalysisResult with extracted findings and token usage
        """
        from src.llm.prompts import (
            get_system_prompt,
            get_extraction_prompt,
            parse_findings_response,
        )

        # Use provided prompts or defaults
        sys_prompt = system_prompt or get_system_prompt()
        user_prompt = (
            extraction_prompt
            or get_extraction_prompt(
                chunk_content=content,
                document_name=context.get("document_name", "Unknown"),
                page_number=context.get("page_number"),
                chunk_type=context.get("chunk_type", "text"),
            )
        )

        # Call the model
        response_text, input_tokens, output_tokens = await self._invoke_model(
            model_name=model_tier.value,
            prompt=user_prompt,
            system_prompt=sys_prompt,
        )

        # Parse the response
        try:
            findings = parse_findings_response(response_text)
        except Exception as e:
            logger.warning(
                "Failed to parse findings response",
                error=str(e),
                response_preview=response_text[:200] if response_text else "empty",
            )
            raise GeminiInvalidResponseError(f"Failed to parse response: {str(e)}")

        return AnalysisResult(
            findings=findings,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model_tier=model_tier,
            chunk_ids=[context.get("chunk_id", "")],
        )

    async def analyze_batch(
        self,
        chunks: list[dict[str, Any]],
        context: dict[str, Any],
        model_tier: ModelTier = ModelTier.FLASH,
        batch_size: int = 5,
    ) -> BatchAnalysisResult:
        """
        Analyze multiple chunks, batching them for efficient API usage.

        Args:
            chunks: List of chunk dicts with 'id', 'content', 'page_number', etc.
            context: Shared context (document_name, project_name)
            model_tier: Which model tier to use
            batch_size: Number of chunks to process per API call

        Returns:
            BatchAnalysisResult with all findings and aggregated metrics
        """
        from src.llm.prompts import (
            get_system_prompt,
            get_batch_extraction_prompt,
            parse_findings_response,
        )

        if not chunks:
            return BatchAnalysisResult(
                findings=[],
                total_input_tokens=0,
                total_output_tokens=0,
                model_tier=model_tier,
                batch_count=0,
            )

        logger.info(
            "Starting batch analysis",
            chunk_count=len(chunks),
            batch_size=batch_size,
            model_tier=model_tier.value,
        )

        all_findings: list[dict[str, Any]] = []
        total_input_tokens = 0
        total_output_tokens = 0
        batch_count = 0
        failed_batches: list[int] = []

        sys_prompt = get_system_prompt()

        # Process in batches
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i : i + batch_size]
            batch_idx = i // batch_size

            try:
                # Create batch prompt
                user_prompt = get_batch_extraction_prompt(
                    chunks=batch_chunks,
                    document_name=context.get("document_name", "Unknown"),
                    project_name=context.get("project_name", ""),
                )

                # Call the model
                response_text, input_tokens, output_tokens = await self._invoke_model(
                    model_name=model_tier.value,
                    prompt=user_prompt,
                    system_prompt=sys_prompt,
                )

                # Parse findings
                batch_findings = parse_findings_response(response_text)

                # Link findings to chunk IDs
                for finding in batch_findings:
                    # Try to associate finding with specific chunk by page/index
                    if "source_chunk_index" in finding:
                        chunk_idx = finding["source_chunk_index"]
                        if 0 <= chunk_idx < len(batch_chunks):
                            finding["chunk_id"] = batch_chunks[chunk_idx].get("id")

                all_findings.extend(batch_findings)
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                batch_count += 1

                logger.debug(
                    "Batch completed",
                    batch_idx=batch_idx,
                    findings_count=len(batch_findings),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )

            except GeminiInvalidResponseError as e:
                # Log and continue - don't fail entire document for one bad batch
                logger.warning(
                    "Batch analysis failed (parse error)",
                    batch_idx=batch_idx,
                    error=str(e),
                )
                failed_batches.append(batch_idx)

            except GeminiError as e:
                if not e.retryable:
                    logger.error(
                        "Batch analysis failed (non-retryable)",
                        batch_idx=batch_idx,
                        error=str(e),
                    )
                    failed_batches.append(batch_idx)
                else:
                    # Re-raise retryable errors
                    raise

        result = BatchAnalysisResult(
            findings=all_findings,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            model_tier=model_tier,
            batch_count=batch_count,
            failed_batch_indices=failed_batches,
        )

        logger.info(
            "Batch analysis complete",
            total_findings=result.finding_count,
            total_batches=batch_count,
            failed_batches=len(failed_batches),
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            estimated_cost_usd=f"${result.estimated_cost_usd:.4f}",
        )

        return result


# Global client instance
_gemini_client: Optional[GeminiClient] = None


def get_gemini_client() -> GeminiClient:
    """
    Get or create the global Gemini client instance.

    Returns:
        GeminiClient instance

    Raises:
        GeminiError: If client cannot be initialized (e.g., missing API key)
    """
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client


__all__ = [
    "GeminiClient",
    "GeminiError",
    "GeminiRateLimitError",
    "GeminiAPIError",
    "GeminiInvalidResponseError",
    "AnalysisResult",
    "BatchAnalysisResult",
    "get_gemini_client",
]
