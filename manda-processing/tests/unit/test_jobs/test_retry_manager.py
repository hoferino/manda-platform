"""
Tests for the RetryManager.
Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #6)

Tests cover:
- handle_job_failure error classification and storage
- should_retry_stage retry decision logic
- get_next_retry_stage stage determination
- enqueue_stage_retry job enqueueing
- prepare_stage_retry data clearing
- mark_stage_complete stage tracking
"""

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from src.jobs.errors import (
    ClassifiedError,
    ErrorCategory,
    ErrorClassifier,
    ProcessingStage,
)
from src.jobs.retry_manager import (
    RetryManager,
    get_retry_manager,
    MAX_RETRY_ATTEMPTS,
    MAX_TOTAL_RETRY_ATTEMPTS,
    MANUAL_RETRY_COOLDOWN_SECONDS,
)


# --- Fixtures ---


@pytest.fixture
def mock_db_client() -> MagicMock:
    """Create a mock Supabase client."""
    mock = MagicMock()
    mock.update_processing_error = AsyncMock(return_value=True)
    mock.append_retry_history = AsyncMock(return_value=True)
    mock.get_retry_history = AsyncMock(return_value=[])
    mock.update_document_status = AsyncMock(return_value=True)
    mock.get_document_stage = AsyncMock(return_value=None)
    mock.update_document_stage = AsyncMock(return_value=True)
    mock.clear_processing_error = AsyncMock(return_value=True)
    mock.clear_stage_data = AsyncMock(return_value=True)
    return mock


@pytest.fixture
def mock_classifier() -> MagicMock:
    """Create a mock ErrorClassifier."""
    mock = MagicMock(spec=ErrorClassifier)
    mock.classify = MagicMock(
        return_value=ClassifiedError(
            category=ErrorCategory.TRANSIENT,
            error_type="timeout",
            message="Test error",
            should_retry=True,
            user_message="Processing timed out",
            guidance="Will retry automatically",
            stage="parsing",
            retry_count=0,
        )
    )
    return mock


@pytest.fixture
def mock_job_queue() -> MagicMock:
    """Create a mock job queue."""
    mock = MagicMock()
    mock.enqueue = AsyncMock(return_value="job-123")
    return mock


@pytest.fixture
def sample_document_id() -> UUID:
    """Sample document UUID."""
    return uuid4()


@pytest.fixture
def retry_manager(
    mock_db_client: MagicMock,
    mock_classifier: MagicMock,
) -> RetryManager:
    """Create a RetryManager with mocked dependencies."""
    return RetryManager(
        db_client=mock_db_client,
        error_classifier=mock_classifier,
    )


# --- handle_job_failure Tests ---


class TestHandleJobFailure:
    """Tests for handle_job_failure method."""

    @pytest.mark.asyncio
    async def test_classifies_error(
        self,
        retry_manager: RetryManager,
        mock_classifier: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that error is classified correctly."""
        error = Exception("Connection timeout")

        await retry_manager.handle_job_failure(
            document_id=sample_document_id,
            error=error,
            current_stage="parsing",
            retry_count=0,
        )

        mock_classifier.classify.assert_called_once_with(
            error=error,
            stage="parsing",
            retry_count=0,
        )

    @pytest.mark.asyncio
    async def test_stores_error_info(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that error info is stored in database."""
        error = Exception("Timeout error")

        await retry_manager.handle_job_failure(
            document_id=sample_document_id,
            error=error,
            current_stage="embedding",
            retry_count=1,
        )

        mock_db_client.update_processing_error.assert_called_once()
        call_args = mock_db_client.update_processing_error.call_args
        assert call_args.kwargs["document_id"] == sample_document_id

    @pytest.mark.asyncio
    async def test_appends_retry_history(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that retry history is appended."""
        error = Exception("Network error")

        await retry_manager.handle_job_failure(
            document_id=sample_document_id,
            error=error,
            current_stage="parsing",
            retry_count=2,
        )

        mock_db_client.append_retry_history.assert_called_once()
        call_args = mock_db_client.append_retry_history.call_args
        retry_entry = call_args.kwargs["retry_entry"]

        assert retry_entry["attempt"] == 3  # retry_count + 1
        assert retry_entry["stage"] == "parsing"
        assert "timestamp" in retry_entry

    @pytest.mark.asyncio
    async def test_returns_classified_error(
        self,
        retry_manager: RetryManager,
        sample_document_id: UUID,
    ) -> None:
        """Test that classified error is returned."""
        error = Exception("Test error")

        result = await retry_manager.handle_job_failure(
            document_id=sample_document_id,
            error=error,
            current_stage="analyzing",
            retry_count=0,
        )

        assert isinstance(result, ClassifiedError)
        assert result.category == ErrorCategory.TRANSIENT

    @pytest.mark.asyncio
    async def test_permanent_error_updates_status_to_failed(
        self,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that permanent errors update status to failed."""
        # Create classifier that returns permanent error
        permanent_classifier = MagicMock(spec=ErrorClassifier)
        permanent_classifier.classify = MagicMock(
            return_value=ClassifiedError(
                category=ErrorCategory.PERMANENT,
                error_type="invalid_file",
                message="File corrupt",
                should_retry=False,
                user_message="File is invalid",
            )
        )

        manager = RetryManager(
            db_client=mock_db_client,
            error_classifier=permanent_classifier,
        )

        await manager.handle_job_failure(
            document_id=sample_document_id,
            error=Exception("File corrupt"),
            current_stage="parsing",
            retry_count=0,
        )

        # Should update status to failed
        mock_db_client.update_document_status.assert_called_once()
        call_args = mock_db_client.update_document_status.call_args
        assert call_args.kwargs["processing_status"] == "failed"

    @pytest.mark.asyncio
    async def test_transient_error_does_not_update_status(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that transient errors don't immediately update status."""
        error = Exception("Timeout")

        await retry_manager.handle_job_failure(
            document_id=sample_document_id,
            error=error,
            current_stage="parsing",
            retry_count=0,
        )

        # Should NOT update status (pg-boss handles retry)
        mock_db_client.update_document_status.assert_not_called()

    @pytest.mark.asyncio
    async def test_embedding_failure_status(
        self,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that embedding failures use correct status."""
        permanent_classifier = MagicMock(spec=ErrorClassifier)
        permanent_classifier.classify = MagicMock(
            return_value=ClassifiedError(
                category=ErrorCategory.PERMANENT,
                error_type="auth_error",
                message="API key invalid",
                should_retry=False,
                user_message="Access denied",
            )
        )

        manager = RetryManager(
            db_client=mock_db_client,
            error_classifier=permanent_classifier,
        )

        await manager.handle_job_failure(
            document_id=sample_document_id,
            error=Exception("API key invalid"),
            current_stage="embedding",
            retry_count=0,
        )

        call_args = mock_db_client.update_document_status.call_args
        assert call_args.kwargs["processing_status"] == "embedding_failed"


# --- should_retry_stage Tests ---


class TestShouldRetryStage:
    """Tests for should_retry_stage method."""

    @pytest.mark.asyncio
    async def test_no_history_allows_retry(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that no history means retry is allowed."""
        mock_db_client.get_retry_history.return_value = []

        should_retry, attempts = await retry_manager.should_retry_stage(
            document_id=sample_document_id,
            stage="parsing",
        )

        assert should_retry is True
        assert attempts == 0

    @pytest.mark.asyncio
    async def test_under_max_attempts_allows_retry(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that under max attempts allows retry."""
        mock_db_client.get_retry_history.return_value = [
            {"attempt": 1, "stage": "parsing"},
            {"attempt": 2, "stage": "parsing"},
        ]

        should_retry, attempts = await retry_manager.should_retry_stage(
            document_id=sample_document_id,
            stage="parsing",
        )

        assert should_retry is True
        assert attempts == 2

    @pytest.mark.asyncio
    async def test_at_max_attempts_denies_retry(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that at max attempts denies retry."""
        mock_db_client.get_retry_history.return_value = [
            {"attempt": i, "stage": "parsing"}
            for i in range(1, MAX_RETRY_ATTEMPTS + 1)
        ]

        should_retry, attempts = await retry_manager.should_retry_stage(
            document_id=sample_document_id,
            stage="parsing",
        )

        assert should_retry is False
        assert attempts == MAX_RETRY_ATTEMPTS

    @pytest.mark.asyncio
    async def test_counts_only_specific_stage(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that only specific stage attempts are counted."""
        mock_db_client.get_retry_history.return_value = [
            {"attempt": 1, "stage": "parsing"},
            {"attempt": 2, "stage": "embedding"},  # Different stage
            {"attempt": 3, "stage": "parsing"},
        ]

        should_retry, attempts = await retry_manager.should_retry_stage(
            document_id=sample_document_id,
            stage="parsing",
        )

        assert attempts == 2  # Only parsing attempts


# --- get_next_retry_stage Tests ---


class TestGetNextRetryStage:
    """Tests for get_next_retry_stage method."""

    @pytest.mark.asyncio
    async def test_no_stage_returns_parsing(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that no last stage returns parsing."""
        mock_db_client.get_document_stage.return_value = None

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        assert result == "parsing"

    @pytest.mark.asyncio
    async def test_pending_stage_returns_embedding(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that pending stage returns embedding (next stage is parsed -> maps to embedding job)."""
        mock_db_client.get_document_stage.return_value = "pending"

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        # pending -> get_next_stage(PENDING) = PARSED -> stage_to_job[PARSED] = "embedding"
        assert result == "embedding"

    @pytest.mark.asyncio
    async def test_parsed_stage_returns_analyzing(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that parsed stage returns analyzing (next stage is embedded -> maps to analyzing job)."""
        mock_db_client.get_document_stage.return_value = "parsed"

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        # parsed -> get_next_stage(PARSED) = EMBEDDED -> stage_to_job[EMBEDDED] = "analyzing"
        assert result == "analyzing"

    @pytest.mark.asyncio
    async def test_embedded_stage_returns_none(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that embedded stage returns None (next stage is analyzed -> complete)."""
        mock_db_client.get_document_stage.return_value = "embedded"

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        # embedded -> get_next_stage(EMBEDDED) = ANALYZED -> stage_to_job[ANALYZED] = None
        assert result is None

    @pytest.mark.asyncio
    async def test_analyzed_stage_returns_none(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that analyzed stage returns None (complete)."""
        mock_db_client.get_document_stage.return_value = "analyzed"

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        assert result is None

    @pytest.mark.asyncio
    async def test_complete_stage_returns_none(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that complete stage returns None."""
        mock_db_client.get_document_stage.return_value = "complete"

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        assert result is None

    @pytest.mark.asyncio
    async def test_unknown_stage_returns_parsing(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that unknown stage falls back to parsing."""
        mock_db_client.get_document_stage.return_value = "invalid_stage"

        result = await retry_manager.get_next_retry_stage(sample_document_id)

        assert result == "parsing"


# --- enqueue_stage_retry Tests ---


class TestEnqueueStageRetry:
    """Tests for enqueue_stage_retry method."""

    @pytest.mark.asyncio
    async def test_parsing_stage_enqueues_parse_document(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that parsing stage enqueues parse-document job."""
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            result = await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="parsing",
            )

        mock_job_queue.enqueue.assert_called_once()
        call_args = mock_job_queue.enqueue.call_args
        assert call_args[0][0] == "parse-document"
        assert result == "job-123"

    @pytest.mark.asyncio
    async def test_embedding_stage_enqueues_generate_embeddings(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that embedding stage enqueues generate-embeddings job."""
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            result = await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="embedding",
            )

        call_args = mock_job_queue.enqueue.call_args
        assert call_args[0][0] == "generate-embeddings"

    @pytest.mark.asyncio
    async def test_analyzing_stage_enqueues_analyze_document(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that analyzing stage enqueues analyze-document job."""
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            result = await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="analyzing",
            )

        call_args = mock_job_queue.enqueue.call_args
        assert call_args[0][0] == "analyze-document"

    @pytest.mark.asyncio
    async def test_invalid_stage_returns_none(
        self,
        retry_manager: RetryManager,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that invalid stage returns None."""
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            result = await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="invalid_stage",
            )

        assert result is None
        mock_job_queue.enqueue.assert_not_called()

    @pytest.mark.asyncio
    async def test_clears_error_before_retry(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that error is cleared before retry."""
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="parsing",
            )

        mock_db_client.clear_processing_error.assert_called_once_with(
            sample_document_id
        )

    @pytest.mark.asyncio
    async def test_includes_is_retry_flag(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that job data includes is_retry flag."""
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="parsing",
            )

        call_args = mock_job_queue.enqueue.call_args
        job_data = call_args[0][1]
        assert job_data["is_retry"] is True

    @pytest.mark.asyncio
    async def test_includes_deal_and_user_ids(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that job data includes deal_id and user_id."""
        deal_id = str(uuid4())
        user_id = str(uuid4())

        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            await retry_manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="parsing",
                deal_id=deal_id,
                user_id=user_id,
            )

        call_args = mock_job_queue.enqueue.call_args
        job_data = call_args[0][1]
        assert job_data["deal_id"] == deal_id
        assert job_data["user_id"] == user_id


# --- prepare_stage_retry Tests ---


class TestPrepareStageRetry:
    """Tests for prepare_stage_retry method."""

    @pytest.mark.asyncio
    async def test_clears_stage_data(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that stage data is cleared."""
        await retry_manager.prepare_stage_retry(
            document_id=sample_document_id,
            stage="embedding",
        )

        mock_db_client.clear_stage_data.assert_called_once_with(
            sample_document_id, "embedding"
        )

    @pytest.mark.asyncio
    async def test_updates_status_to_processing(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that status is updated to processing state."""
        await retry_manager.prepare_stage_retry(
            document_id=sample_document_id,
            stage="parsing",
        )

        mock_db_client.update_document_status.assert_called_once()
        call_args = mock_db_client.update_document_status.call_args
        assert call_args[0][1] == "parsing"

    @pytest.mark.asyncio
    async def test_embedding_stage_updates_to_embedding_status(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that embedding stage uses correct status."""
        await retry_manager.prepare_stage_retry(
            document_id=sample_document_id,
            stage="embedding",
        )

        call_args = mock_db_client.update_document_status.call_args
        assert call_args[0][1] == "embedding"

    @pytest.mark.asyncio
    async def test_returns_true_on_success(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that True is returned on success."""
        result = await retry_manager.prepare_stage_retry(
            document_id=sample_document_id,
            stage="analyzing",
        )

        assert result is True


# --- mark_stage_complete Tests ---


class TestMarkStageComplete:
    """Tests for mark_stage_complete method."""

    @pytest.mark.asyncio
    async def test_parsing_stage_marks_parsed(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that parsing stage marks as parsed."""
        await retry_manager.mark_stage_complete(
            document_id=sample_document_id,
            stage="parsing",
        )

        mock_db_client.update_document_stage.assert_called_once()
        call_args = mock_db_client.update_document_stage.call_args
        assert call_args.kwargs["last_completed_stage"] == "parsed"

    @pytest.mark.asyncio
    async def test_parsed_stage_marks_parsed(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that parsed stage marks as parsed."""
        await retry_manager.mark_stage_complete(
            document_id=sample_document_id,
            stage="parsed",
        )

        call_args = mock_db_client.update_document_stage.call_args
        assert call_args.kwargs["last_completed_stage"] == "parsed"

    @pytest.mark.asyncio
    async def test_embedding_stage_marks_embedded(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that embedding stage marks as embedded."""
        await retry_manager.mark_stage_complete(
            document_id=sample_document_id,
            stage="embedding",
        )

        call_args = mock_db_client.update_document_stage.call_args
        assert call_args.kwargs["last_completed_stage"] == "embedded"

    @pytest.mark.asyncio
    async def test_analyzing_stage_marks_analyzed(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that analyzing stage marks as analyzed."""
        await retry_manager.mark_stage_complete(
            document_id=sample_document_id,
            stage="analyzing",
        )

        call_args = mock_db_client.update_document_stage.call_args
        assert call_args.kwargs["last_completed_stage"] == "analyzed"

    @pytest.mark.asyncio
    async def test_returns_true_on_success(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that True is returned on success."""
        mock_db_client.update_document_stage.return_value = True

        result = await retry_manager.mark_stage_complete(
            document_id=sample_document_id,
            stage="parsed",
        )

        assert result is True


# --- get_retry_manager Tests ---


class TestGetRetryManager:
    """Tests for get_retry_manager factory function."""

    def test_returns_retry_manager(self) -> None:
        """Test that function returns RetryManager instance."""
        with patch("src.jobs.retry_manager.get_supabase_client"):
            with patch("src.jobs.retry_manager.get_error_classifier"):
                manager = get_retry_manager()
                assert isinstance(manager, RetryManager)


# --- Integration-style Tests ---


class TestRetryManagerIntegration:
    """Integration-style tests for retry workflow."""

    @pytest.mark.asyncio
    async def test_full_retry_workflow(
        self,
        mock_db_client: MagicMock,
        mock_job_queue: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test a full retry workflow from failure to retry."""
        # Create classifier that returns transient error
        classifier = ErrorClassifier()
        manager = RetryManager(
            db_client=mock_db_client,
            error_classifier=classifier,
        )

        # 1. Handle a job failure
        error = Exception("Connection timeout")
        classified = await manager.handle_job_failure(
            document_id=sample_document_id,
            error=error,
            current_stage="embedding",
            retry_count=0,
        )

        # Verify error was classified as transient
        assert classified.category == ErrorCategory.TRANSIENT
        assert classified.should_retry is True

        # 2. Check retry eligibility
        mock_db_client.get_retry_history.return_value = [
            {"attempt": 1, "stage": "embedding"}
        ]
        should_retry, attempts = await manager.should_retry_stage(
            document_id=sample_document_id,
            stage="embedding",
        )

        assert should_retry is True
        assert attempts == 1

        # 3. Prepare for retry
        result = await manager.prepare_stage_retry(
            document_id=sample_document_id,
            stage="embedding",
        )

        assert result is True
        mock_db_client.clear_stage_data.assert_called()

        # 4. Enqueue retry job
        with patch(
            "src.jobs.retry_manager.get_job_queue",
            return_value=mock_job_queue,
        ):
            job_id = await manager.enqueue_stage_retry(
                document_id=sample_document_id,
                stage="embedding",
            )

        assert job_id == "job-123"

    @pytest.mark.asyncio
    async def test_max_retries_exceeded(
        self,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test behavior when max retries are exceeded."""
        classifier = ErrorClassifier()
        manager = RetryManager(
            db_client=mock_db_client,
            error_classifier=classifier,
        )

        # Set up history with max attempts
        mock_db_client.get_retry_history.return_value = [
            {"attempt": i, "stage": "parsing"}
            for i in range(1, MAX_RETRY_ATTEMPTS + 1)
        ]

        # Check retry eligibility
        should_retry, attempts = await manager.should_retry_stage(
            document_id=sample_document_id,
            stage="parsing",
        )

        assert should_retry is False
        assert attempts == MAX_RETRY_ATTEMPTS


# --- can_manual_retry Tests ---


class TestCanManualRetry:
    """Tests for can_manual_retry method."""

    @pytest.mark.asyncio
    async def test_allows_retry_with_no_history(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that retry is allowed when there's no history."""
        mock_db_client.get_retry_history.return_value = []

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        assert can_retry is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_allows_retry_under_total_cap(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that retry is allowed when under total cap."""
        # History with less than MAX_TOTAL_RETRY_ATTEMPTS entries
        mock_db_client.get_retry_history.return_value = [
            {
                "attempt": i,
                "stage": "parsing",
                "timestamp": "2020-01-01T00:00:00+00:00",  # Old timestamp
            }
            for i in range(1, MAX_TOTAL_RETRY_ATTEMPTS)  # One less than max
        ]

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        assert can_retry is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_denies_retry_at_total_cap(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that retry is denied when at total cap."""
        # History with MAX_TOTAL_RETRY_ATTEMPTS entries
        mock_db_client.get_retry_history.return_value = [
            {"attempt": i, "stage": "parsing"}
            for i in range(1, MAX_TOTAL_RETRY_ATTEMPTS + 1)
        ]

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        assert can_retry is False
        assert reason is not None
        assert "Maximum retry attempts" in reason

    @pytest.mark.asyncio
    async def test_denies_retry_during_cooldown(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that retry is denied during cooldown period."""
        from datetime import datetime, timezone

        # Recent timestamp (within cooldown)
        recent_timestamp = datetime.now(timezone.utc).isoformat()
        mock_db_client.get_retry_history.return_value = [
            {
                "attempt": 1,
                "stage": "parsing",
                "timestamp": recent_timestamp,
            }
        ]

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        assert can_retry is False
        assert reason is not None
        assert "wait" in reason.lower()

    @pytest.mark.asyncio
    async def test_allows_retry_after_cooldown(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that retry is allowed after cooldown period."""
        from datetime import datetime, timezone, timedelta

        # Old timestamp (outside cooldown)
        old_timestamp = (
            datetime.now(timezone.utc) - timedelta(seconds=MANUAL_RETRY_COOLDOWN_SECONDS + 10)
        ).isoformat()
        mock_db_client.get_retry_history.return_value = [
            {
                "attempt": 1,
                "stage": "parsing",
                "timestamp": old_timestamp,
            }
        ]

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        assert can_retry is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_handles_missing_timestamp_gracefully(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that missing timestamp is handled gracefully."""
        mock_db_client.get_retry_history.return_value = [
            {
                "attempt": 1,
                "stage": "parsing",
                # No timestamp
            }
        ]

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        # Should allow retry when timestamp is missing
        assert can_retry is True
        assert reason is None

    @pytest.mark.asyncio
    async def test_handles_invalid_timestamp_gracefully(
        self,
        retry_manager: RetryManager,
        mock_db_client: MagicMock,
        sample_document_id: UUID,
    ) -> None:
        """Test that invalid timestamp is handled gracefully."""
        mock_db_client.get_retry_history.return_value = [
            {
                "attempt": 1,
                "stage": "parsing",
                "timestamp": "not-a-valid-timestamp",
            }
        ]

        can_retry, reason = await retry_manager.can_manual_retry(sample_document_id)

        # Should allow retry when timestamp is invalid
        assert can_retry is True
        assert reason is None
