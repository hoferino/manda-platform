"""
Tests for the analyze_document job handler.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #6)
"""

import os
from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.jobs.queue import Job, JobState
from src.llm.models import ModelTier

# Set test environment variables
os.environ.setdefault("GOOGLE_API_KEY", "test-google-api-key")


# --- Fixtures ---


@pytest.fixture
def sample_document_id() -> UUID:
    """Sample document UUID."""
    return uuid4()


@pytest.fixture
def sample_deal_id() -> str:
    """Sample deal ID."""
    return str(uuid4())


@pytest.fixture
def sample_user_id() -> str:
    """Sample user ID."""
    return str(uuid4())


@pytest.fixture
def sample_job_payload(
    sample_document_id: UUID,
    sample_deal_id: str,
    sample_user_id: str,
) -> dict[str, Any]:
    """Sample job payload for analyze-document."""
    return {
        "document_id": str(sample_document_id),
        "deal_id": sample_deal_id,
        "user_id": sample_user_id,
    }


@pytest.fixture
def sample_job(sample_job_payload: dict[str, Any]) -> Job:
    """Create a sample Job instance."""
    return Job(
        id=str(uuid4()),
        name="analyze-document",
        data=sample_job_payload,
        state=JobState.ACTIVE,
        created_on=datetime.now(),
        started_on=datetime.now(),
        retry_count=0,
    )


@pytest.fixture
def sample_document(sample_document_id: UUID, sample_deal_id: str) -> dict[str, Any]:
    """Sample document from database."""
    return {
        "id": sample_document_id,
        "deal_id": UUID(sample_deal_id),
        "name": "test_document.pdf",
        "mime_type": "application/pdf",
        "processing_status": "embedded",
    }


@pytest.fixture
def sample_chunks(sample_document_id: UUID) -> list[dict[str, Any]]:
    """Sample chunks from database."""
    return [
        {
            "id": uuid4(),
            "document_id": sample_document_id,
            "chunk_index": 0,
            "content": "Revenue was $50M in 2023, up 25% from prior year.",
            "chunk_type": "text",
            "page_number": 1,
        },
        {
            "id": uuid4(),
            "document_id": sample_document_id,
            "chunk_index": 1,
            "content": "The company has 200 employees across 3 offices.",
            "chunk_type": "text",
            "page_number": 2,
        },
        {
            "id": uuid4(),
            "document_id": sample_document_id,
            "chunk_index": 2,
            "content": "Key risks include regulatory changes in the EU market.",
            "chunk_type": "text",
            "page_number": 3,
        },
    ]


@pytest.fixture
def sample_findings() -> list[dict[str, Any]]:
    """Sample findings from LLM analysis."""
    return [
        {
            "content": "Revenue was $50M in 2023",
            "finding_type": "metric",
            "domain": "financial",
            "confidence_score": 95,
            "source_reference": {"page": 1},
        },
        {
            "content": "25% revenue growth from prior year",
            "finding_type": "metric",
            "domain": "financial",
            "confidence_score": 95,
            "source_reference": {"page": 1},
        },
        {
            "content": "Company has 200 employees",
            "finding_type": "fact",
            "domain": "operational",
            "confidence_score": 90,
            "source_reference": {"page": 2},
        },
    ]


@pytest.fixture
def mock_db_client(
    sample_document: dict[str, Any],
    sample_chunks: list[dict[str, Any]],
) -> MagicMock:
    """Create a mock Supabase client."""
    mock = MagicMock()
    mock.update_document_status = AsyncMock(return_value=True)
    mock.get_document = AsyncMock(return_value=sample_document)
    mock.get_chunks_by_document = AsyncMock(return_value=sample_chunks)
    mock.store_findings_and_update_status = AsyncMock(return_value=3)
    return mock


@pytest.fixture
def mock_llm_client(sample_findings: list[dict[str, Any]]) -> MagicMock:
    """Create a mock Gemini LLM client."""
    from src.llm.client import BatchAnalysisResult

    mock = MagicMock()
    mock.analyze_batch = AsyncMock(
        return_value=BatchAnalysisResult(
            findings=sample_findings,
            total_input_tokens=1500,
            total_output_tokens=300,
            model_tier=ModelTier.FLASH,
            batch_count=1,
            failed_batch_indices=[],
        )
    )
    return mock


@pytest.fixture
def mock_job_queue() -> MagicMock:
    """Create a mock job queue."""
    mock = MagicMock()
    mock.enqueue = AsyncMock(return_value=str(uuid4()))
    return mock


# --- Test Classes ---


class TestAnalyzeDocumentHandlerSuccess:
    """Tests for successful analyze-document handling."""

    @pytest.mark.asyncio
    async def test_handle_success_returns_result(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document_id: UUID,
    ) -> None:
        """Test that successful handling returns proper result."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["document_id"] == str(sample_document_id)
        assert result["findings_count"] == 3
        assert result["chunks_analyzed"] == 3

    @pytest.mark.asyncio
    async def test_handle_updates_status_to_analyzing(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler updates status to analyzing at start."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            await handler.handle(sample_job)

        mock_db_client.update_document_status.assert_called()
        call_args = mock_db_client.update_document_status.call_args_list[0]
        assert call_args[0][1] == "analyzing"

    @pytest.mark.asyncio
    async def test_handle_loads_document_for_context(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document_id: UUID,
    ) -> None:
        """Test that handler loads document for context."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            await handler.handle(sample_job)

        mock_db_client.get_document.assert_called_once_with(sample_document_id)

    @pytest.mark.asyncio
    async def test_handle_loads_chunks_from_database(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document_id: UUID,
    ) -> None:
        """Test that handler loads chunks from database."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            await handler.handle(sample_job)

        mock_db_client.get_chunks_by_document.assert_called_once_with(
            sample_document_id
        )

    @pytest.mark.asyncio
    async def test_handle_calls_llm_with_chunks(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler calls LLM with chunk data."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            await handler.handle(sample_job)

        mock_llm_client.analyze_batch.assert_called_once()
        call_kwargs = mock_llm_client.analyze_batch.call_args.kwargs
        assert "chunks" in call_kwargs
        assert len(call_kwargs["chunks"]) == 3

    @pytest.mark.asyncio
    async def test_handle_stores_findings_atomically(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler stores findings atomically with status update."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            await handler.handle(sample_job)

        mock_db_client.store_findings_and_update_status.assert_called_once()


class TestAnalyzeDocumentModelSelection:
    """Tests for model tier selection."""

    @pytest.mark.asyncio
    async def test_pdf_uses_flash_model(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that PDF documents use Flash model."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        # PDF document
        mock_db_client.get_document.return_value["mime_type"] = "application/pdf"

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            result = await handler.handle(sample_job)

        assert result["model_tier"] == "gemini-2.5-flash"

    @pytest.mark.asyncio
    async def test_excel_uses_pro_model(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that Excel documents use Pro model."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler
        from src.llm.client import BatchAnalysisResult

        # Set Excel MIME type
        mock_db_client.get_document.return_value["mime_type"] = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        # Update mock to return Pro model
        mock_llm_client.analyze_batch.return_value = BatchAnalysisResult(
            findings=[],
            total_input_tokens=100,
            total_output_tokens=50,
            model_tier=ModelTier.PRO,
            batch_count=1,
        )

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            await handler.handle(sample_job)

        # Verify analyze_batch was called with Pro model tier
        call_kwargs = mock_llm_client.analyze_batch.call_args.kwargs
        assert call_kwargs["model_tier"] == ModelTier.PRO


class TestAnalyzeDocumentEmptyDocument:
    """Tests for handling documents with no chunks."""

    @pytest.mark.asyncio
    async def test_handle_empty_chunks_marks_analyzed(
        self,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document: dict[str, Any],
    ) -> None:
        """Test that empty document is still marked as analyzed."""
        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock(return_value=True)
        mock_db.get_document = AsyncMock(return_value=sample_document)
        mock_db.get_chunks_by_document = AsyncMock(return_value=[])

        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db,
                llm_client=mock_llm_client,
            )

            result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["findings_count"] == 0
        assert result["chunks_analyzed"] == 0


class TestAnalyzeDocumentErrors:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_handle_document_not_found_raises(
        self,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that missing document raises error."""
        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock(return_value=True)
        mock_db.get_document = AsyncMock(return_value=None)

        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db,
                llm_client=mock_llm_client,
            )

            with pytest.raises(ValueError) as exc_info:
                await handler.handle(sample_job)

            assert "Document not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_handle_database_error_raises(
        self,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
        sample_document: dict[str, Any],
    ) -> None:
        """Test that database errors are raised for retry."""
        from src.storage.supabase_client import DatabaseError

        mock_db = MagicMock()
        mock_db.update_document_status = AsyncMock(return_value=True)
        mock_db.get_document = AsyncMock(return_value=sample_document)
        mock_db.get_chunks_by_document = AsyncMock(
            side_effect=DatabaseError("Connection failed", retryable=True)
        )

        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db,
                llm_client=mock_llm_client,
            )

            with pytest.raises(DatabaseError):
                await handler.handle(sample_job)

    @pytest.mark.asyncio
    async def test_handle_llm_error_marks_failed(
        self,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that LLM errors mark document as failed."""
        from src.llm.client import GeminiError

        mock_llm = MagicMock()
        mock_llm.analyze_batch = AsyncMock(
            side_effect=GeminiError("API error", retryable=False)
        )

        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm,
            )

            with pytest.raises(GeminiError):
                await handler.handle(sample_job)


class TestAnalyzeDocumentMetrics:
    """Tests for handler metrics."""

    @pytest.mark.asyncio
    async def test_handle_returns_timing_metrics(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns timing metrics."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            result = await handler.handle(sample_job)

        assert "total_time_ms" in result
        assert result["total_time_ms"] >= 0

    @pytest.mark.asyncio
    async def test_handle_returns_token_metrics(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns token metrics."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            result = await handler.handle(sample_job)

        assert "input_tokens" in result
        assert "output_tokens" in result
        assert result["input_tokens"] == 1500
        assert result["output_tokens"] == 300

    @pytest.mark.asyncio
    async def test_handle_returns_cost_estimate(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handler returns cost estimate."""
        from src.jobs.handlers.analyze_document import AnalyzeDocumentHandler

        with patch(
            "src.jobs.handlers.analyze_document.get_job_queue",
            return_value=mock_job_queue,
        ):
            handler = AnalyzeDocumentHandler(
                db_client=mock_db_client,
                llm_client=mock_llm_client,
            )

            result = await handler.handle(sample_job)

        assert "estimated_cost_usd" in result


class TestHandleAnalyzeDocumentFunction:
    """Tests for the module-level handler function."""

    @pytest.mark.asyncio
    async def test_handle_analyze_document_uses_global_handler(
        self,
        mock_db_client: MagicMock,
        mock_llm_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_job: Job,
    ) -> None:
        """Test that handle_analyze_document uses singleton handler."""
        from src.jobs.handlers import analyze_document

        # Reset global handler
        analyze_document._handler = None

        with patch(
            "src.jobs.handlers.analyze_document.get_supabase_client",
            return_value=mock_db_client,
        ):
            with patch(
                "src.jobs.handlers.analyze_document._create_gemini_client",
                return_value=mock_llm_client,
            ):
                with patch(
                    "src.jobs.handlers.analyze_document.get_job_queue",
                    return_value=mock_job_queue,
                ):
                    result = await analyze_document.handle_analyze_document(
                        sample_job
                    )

        assert result["success"] is True

        # Cleanup
        analyze_document._handler = None
