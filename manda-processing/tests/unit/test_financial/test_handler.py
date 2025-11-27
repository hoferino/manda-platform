"""
Tests for ExtractFinancialsHandler.
Story: E3.9 - Financial Model Integration (AC: #6)
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from decimal import Decimal

from src.jobs.handlers.extract_financials import (
    ExtractFinancialsHandler,
    get_extract_financials_handler,
)
from src.jobs.queue import Job, JobState
from src.parsers import ParseResult
from src.models.financial_metrics import (
    FinancialMetricCreate,
    FinancialExtractionResult,
    MetricCategory,
)


@pytest.fixture
def mock_db_client():
    """Create a mock database client."""
    client = AsyncMock()
    client.get_document = AsyncMock(return_value={
        "id": str(uuid4()),
        "deal_id": str(uuid4()),
        "user_id": str(uuid4()),
        "name": "test_model.xlsx",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    client.get_chunks_by_document = AsyncMock(return_value=[])
    client.update_document_status = AsyncMock(return_value=True)
    client.clear_processing_error = AsyncMock(return_value=True)
    client.store_financial_metrics_and_update_status = AsyncMock(return_value=0)
    client.delete_financial_metrics = AsyncMock(return_value=0)
    return client


@pytest.fixture
def mock_extractor():
    """Create a mock financial extractor."""
    extractor = MagicMock()
    extractor.extract = MagicMock(return_value=FinancialExtractionResult(
        document_id=uuid4(),
        has_financial_data=False,
        detection_confidence=0.0,
    ))
    return extractor


@pytest.fixture
def mock_retry_manager():
    """Create a mock retry manager."""
    manager = AsyncMock()
    manager.prepare_stage_retry = AsyncMock()
    manager.mark_stage_complete = AsyncMock()
    manager.handle_job_failure = AsyncMock()
    return manager


@pytest.fixture
def handler(mock_db_client, mock_extractor, mock_retry_manager):
    """Create handler with mocked dependencies."""
    return ExtractFinancialsHandler(
        db_client=mock_db_client,
        extractor=mock_extractor,
        retry_manager=mock_retry_manager,
    )


@pytest.fixture
def sample_job():
    """Create a sample job."""
    return Job(
        id=str(uuid4()),
        name="extract-financials",
        data={
            "document_id": str(uuid4()),
            "deal_id": str(uuid4()),
            "user_id": str(uuid4()),
        },
        retry_count=0,
        state=JobState.ACTIVE,
        created_on=datetime.utcnow(),
    )


class TestExtractFinancialsHandler:
    """Tests for ExtractFinancialsHandler."""

    @pytest.mark.asyncio
    async def test_handle_no_chunks(self, handler, sample_job, mock_db_client, mock_retry_manager):
        """Test handling document with no chunks."""
        result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["metrics_count"] == 0
        assert result["has_financial_data"] is False

        # Should update status to complete
        mock_db_client.update_document_status.assert_called()

        # Should mark stage complete
        mock_retry_manager.mark_stage_complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_with_financial_data(
        self, handler, sample_job, mock_db_client, mock_extractor, mock_retry_manager
    ):
        """Test handling document with financial data."""
        doc_id = uuid4()

        # Mock chunks
        mock_db_client.get_chunks_by_document = AsyncMock(return_value=[
            {
                "id": str(uuid4()),
                "content": "Revenue: 100000",
                "chunk_index": 0,
                "chunk_type": "text",
                "page_number": 1,
                "metadata": {},
            }
        ])

        # Mock extraction result with metrics
        mock_extractor.extract = MagicMock(return_value=FinancialExtractionResult(
            document_id=doc_id,
            metrics=[
                FinancialMetricCreate(
                    document_id=doc_id,
                    metric_name="revenue",
                    metric_category=MetricCategory.INCOME_STATEMENT,
                    value=Decimal("100000"),
                )
            ],
            has_financial_data=True,
            detection_confidence=85.0,
            document_type="income_statement",
        ))

        mock_db_client.store_financial_metrics_and_update_status = AsyncMock(return_value=1)

        result = await handler.handle(sample_job)

        assert result["success"] is True
        assert result["has_financial_data"] is True
        assert result["metrics_count"] == 1

        # Should store metrics and update status
        mock_db_client.store_financial_metrics_and_update_status.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_retry(
        self, handler, sample_job, mock_db_client, mock_retry_manager
    ):
        """Test handling retry job."""
        sample_job.data["is_retry"] = True

        result = await handler.handle(sample_job)

        # Should prepare for retry
        mock_retry_manager.prepare_stage_retry.assert_called_once()

        # Should delete previous metrics
        mock_db_client.delete_financial_metrics.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_document_not_found(
        self, handler, sample_job, mock_db_client, mock_retry_manager
    ):
        """Test handling when document not found."""
        mock_db_client.get_document = AsyncMock(return_value=None)

        with pytest.raises(ValueError, match="Document not found"):
            await handler.handle(sample_job)

        # Should handle failure
        mock_retry_manager.handle_job_failure.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_extraction_error(
        self, handler, sample_job, mock_db_client, mock_extractor, mock_retry_manager
    ):
        """Test handling extraction error."""
        # Mock chunks
        mock_db_client.get_chunks_by_document = AsyncMock(return_value=[
            {"id": str(uuid4()), "content": "test", "chunk_index": 0, "chunk_type": "text", "metadata": {}}
        ])

        # Mock extraction error
        mock_extractor.extract = MagicMock(side_effect=Exception("Extraction failed"))

        with pytest.raises(Exception, match="Extraction failed"):
            await handler.handle(sample_job)

        # Should handle failure
        mock_retry_manager.handle_job_failure.assert_called_once()


class TestReconstructParseResult:
    """Tests for _reconstruct_parse_result method."""

    @pytest.fixture
    def handler_instance(self):
        """Create handler instance for testing."""
        return ExtractFinancialsHandler(
            db_client=AsyncMock(),
            extractor=MagicMock(),
            retry_manager=AsyncMock(),
        )

    def test_reconstruct_empty_chunks(self, handler_instance):
        """Test reconstructing from empty chunks."""
        result = handler_instance._reconstruct_parse_result([])

        assert isinstance(result, ParseResult)
        assert len(result.chunks) == 0
        assert len(result.tables) == 0
        assert len(result.formulas) == 0

    def test_reconstruct_text_chunks(self, handler_instance):
        """Test reconstructing text chunks."""
        chunks = [
            {
                "id": str(uuid4()),
                "content": "This is text content",
                "chunk_index": 0,
                "chunk_type": "text",
                "page_number": 1,
                "metadata": {},
            },
            {
                "id": str(uuid4()),
                "content": "More text content",
                "chunk_index": 1,
                "chunk_type": "text",
                "page_number": 1,
                "metadata": {},
            },
        ]

        result = handler_instance._reconstruct_parse_result(chunks)

        assert len(result.chunks) == 2
        assert result.chunks[0].content == "This is text content"
        assert result.chunks[1].chunk_index == 1


class TestHandlerFactory:
    """Tests for handler factory functions."""

    def test_get_extract_financials_handler_singleton(self):
        """Test that get_extract_financials_handler returns singleton."""
        # Reset global handler
        import src.jobs.handlers.extract_financials as module
        module._handler = None

        handler1 = get_extract_financials_handler()
        handler2 = get_extract_financials_handler()

        assert handler1 is handler2
