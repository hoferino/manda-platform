"""
Tests for job queue operations.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #2, #6)
"""

import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.jobs.queue import (
    DEFAULT_JOB_OPTIONS,
    EnqueueOptions,
    Job,
    JobQueue,
    JobState,
)


@pytest.fixture
def mock_connection() -> AsyncMock:
    """Create a mock asyncpg connection."""
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=None)
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=True)
    return conn


@pytest.fixture
def mock_pool(mock_connection: AsyncMock) -> MagicMock:
    """Create a mock asyncpg pool with working async context manager."""
    pool = MagicMock()

    @asynccontextmanager
    async def mock_acquire() -> AsyncIterator[AsyncMock]:
        yield mock_connection

    pool.acquire = mock_acquire
    return pool


@pytest.fixture
def job_queue(mock_pool: MagicMock) -> JobQueue:
    """Create a JobQueue instance with mocked pool."""
    with patch("src.jobs.queue.get_settings") as mock_settings:
        mock_settings.return_value.pgboss_schema = "pgboss"
        return JobQueue(mock_pool)


class TestJobQueueEnqueue:
    """Tests for job enqueue operations."""

    @pytest.mark.asyncio
    async def test_enqueue_creates_job(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
        sample_job_data: dict[str, Any],
    ) -> None:
        """Test that enqueue creates a job in the database."""
        job_id = await job_queue.enqueue("document-parse", sample_job_data)

        assert job_id is not None
        mock_connection.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_enqueue_returns_uuid(
        self,
        job_queue: JobQueue,
        sample_job_data: dict[str, Any],
    ) -> None:
        """Test that enqueue returns a valid UUID."""
        job_id = await job_queue.enqueue("test-job", sample_job_data)

        # UUID format check
        assert len(job_id) == 36
        assert job_id.count("-") == 4

    @pytest.mark.asyncio
    async def test_enqueue_uses_default_options(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
        sample_job_data: dict[str, Any],
    ) -> None:
        """Test that enqueue uses default options for known job types."""
        await job_queue.enqueue("document-parse", sample_job_data)

        # Verify the SQL was called with default options
        call_args = mock_connection.execute.call_args
        # Priority should be 5 for document-parse
        assert call_args[0][4] == 5  # priority

    @pytest.mark.asyncio
    async def test_enqueue_with_custom_options(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
        sample_job_data: dict[str, Any],
    ) -> None:
        """Test that enqueue respects custom options."""
        custom_options = EnqueueOptions(
            priority=10,
            retry_limit=5,
            retry_delay=60,
        )

        await job_queue.enqueue("test-job", sample_job_data, custom_options)

        call_args = mock_connection.execute.call_args
        assert call_args[0][4] == 10  # priority
        assert call_args[0][5] == 5  # retry_limit
        assert call_args[0][6] == 60  # retry_delay


class TestJobQueueDequeue:
    """Tests for job dequeue operations."""

    @pytest.mark.asyncio
    async def test_dequeue_returns_empty_when_no_jobs(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that dequeue returns empty list when no jobs available."""
        mock_connection.fetch.return_value = []

        jobs = await job_queue.dequeue("test-job")

        assert jobs == []

    @pytest.mark.asyncio
    async def test_dequeue_returns_jobs(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that dequeue returns available jobs."""
        mock_connection.fetch.return_value = [
            {
                "id": "test-job-id",
                "name": "test-job",
                "data": '{"message": "test"}',
                "state": "active",
                "created_on": datetime.now(),
                "started_on": datetime.now(),
                "retry_count": 0,
            }
        ]

        jobs = await job_queue.dequeue("test-job")

        assert len(jobs) == 1
        assert jobs[0].id == "test-job-id"
        assert jobs[0].name == "test-job"
        assert jobs[0].data == {"message": "test"}

    @pytest.mark.asyncio
    async def test_dequeue_respects_batch_size(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that dequeue respects batch_size parameter."""
        await job_queue.dequeue("test-job", batch_size=5)

        call_args = mock_connection.fetch.call_args
        # batch_size should be passed as $2 parameter
        assert call_args[0][2] == 5


class TestJobQueueComplete:
    """Tests for job completion operations."""

    @pytest.mark.asyncio
    async def test_complete_marks_job_completed(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that complete marks job as completed."""
        await job_queue.complete("test-job-id")

        mock_connection.execute.assert_called_once()
        call_args = mock_connection.execute.call_args
        assert "completed" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_complete_stores_output(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that complete stores output data."""
        output = {"result": "success", "count": 42}

        await job_queue.complete("test-job-id", output)

        call_args = mock_connection.execute.call_args
        assert json.dumps(output) in str(call_args)


class TestJobQueueFail:
    """Tests for job failure operations."""

    @pytest.mark.asyncio
    async def test_fail_schedules_retry_when_under_limit(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that fail schedules retry when under retry limit."""
        mock_connection.fetchrow.return_value = {
            "retry_count": 1,
            "retry_limit": 3,
            "retry_delay": 30,
            "retry_backoff": True,
        }

        await job_queue.fail("test-job-id", "Test error")

        # Should update with retry state, not failed
        call_args = mock_connection.execute.call_args
        assert "retry" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_fail_marks_failed_when_at_limit(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that fail marks job as failed when at retry limit."""
        mock_connection.fetchrow.return_value = {
            "retry_count": 3,
            "retry_limit": 3,
            "retry_delay": 30,
            "retry_backoff": True,
        }

        await job_queue.fail("test-job-id", "Test error")

        # Should update with failed state
        call_args = mock_connection.execute.call_args
        assert "failed" in call_args[0][0]


class TestJobQueueGetJob:
    """Tests for get_job operation."""

    @pytest.mark.asyncio
    async def test_get_job_returns_job_when_found(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that get_job returns a job when found."""
        mock_connection.fetchrow.return_value = {
            "id": "test-job-id",
            "name": "test-job",
            "data": '{"message": "hello"}',
            "state": "completed",
            "created_on": datetime.now(),
            "started_on": datetime.now(),
            "completed_on": datetime.now(),
            "retry_count": 0,
        }

        job = await job_queue.get_job("test-job-id")

        assert job is not None
        assert job.id == "test-job-id"
        assert job.name == "test-job"
        assert job.data == {"message": "hello"}
        assert job.state == JobState.COMPLETED

    @pytest.mark.asyncio
    async def test_get_job_returns_none_when_not_found(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that get_job returns None when job not found."""
        mock_connection.fetchrow.return_value = None

        job = await job_queue.get_job("nonexistent-id")

        assert job is None

    @pytest.mark.asyncio
    async def test_get_job_handles_null_data(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that get_job handles null data field."""
        mock_connection.fetchrow.return_value = {
            "id": "test-job-id",
            "name": "test-job",
            "data": None,
            "state": "created",
            "created_on": datetime.now(),
            "started_on": None,
            "completed_on": None,
            "retry_count": 0,
        }

        job = await job_queue.get_job("test-job-id")

        assert job is not None
        assert job.data == {}


class TestJobQueueGetQueueCounts:
    """Tests for get_queue_counts operation."""

    @pytest.mark.asyncio
    async def test_get_queue_counts_returns_empty_when_no_jobs(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that get_queue_counts returns empty dict when no jobs."""
        mock_connection.fetch.return_value = []

        counts = await job_queue.get_queue_counts()

        assert counts == {}

    @pytest.mark.asyncio
    async def test_get_queue_counts_groups_by_name_and_state(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that get_queue_counts groups jobs correctly."""
        mock_connection.fetch.return_value = [
            {"name": "document-parse", "state": "created", "count": 5},
            {"name": "document-parse", "state": "active", "count": 2},
            {"name": "test-job", "state": "completed", "count": 10},
        ]

        counts = await job_queue.get_queue_counts()

        assert counts == {
            "document-parse": {"created": 5, "active": 2},
            "test-job": {"completed": 10},
        }


class TestJobQueueFailWithBackoff:
    """Tests for fail operation with exponential backoff."""

    @pytest.mark.asyncio
    async def test_fail_calculates_exponential_backoff(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that fail calculates exponential backoff correctly."""
        mock_connection.fetchrow.return_value = {
            "retry_count": 2,
            "retry_limit": 5,
            "retry_delay": 10,
            "retry_backoff": True,
        }

        await job_queue.fail("test-job-id", "Test error")

        # With retry_count=2 and base delay=10, backoff should be 10 * 2^2 = 40
        call_args = mock_connection.execute.call_args
        assert "40" in str(call_args)  # delay should be 40 seconds

    @pytest.mark.asyncio
    async def test_fail_uses_linear_delay_without_backoff(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that fail uses linear delay when backoff is disabled."""
        mock_connection.fetchrow.return_value = {
            "retry_count": 2,
            "retry_limit": 5,
            "retry_delay": 30,
            "retry_backoff": False,
        }

        await job_queue.fail("test-job-id", "Test error")

        # Without backoff, delay should remain 30
        call_args = mock_connection.execute.call_args
        assert "30" in str(call_args)

    @pytest.mark.asyncio
    async def test_fail_marks_failed_when_row_not_found(
        self,
        job_queue: JobQueue,
        mock_connection: AsyncMock,
    ) -> None:
        """Test that fail marks as failed when job row not found."""
        mock_connection.fetchrow.return_value = None

        await job_queue.fail("test-job-id", "Test error")

        # Should still execute update with 'failed' state
        call_args = mock_connection.execute.call_args
        assert "failed" in call_args[0][0]


class TestDefaultJobOptions:
    """Tests for default job options configuration."""

    def test_document_parse_has_high_priority(self) -> None:
        """Test that document-parse has appropriate priority."""
        options = DEFAULT_JOB_OPTIONS["document-parse"]
        assert options.priority == 5

    def test_document_parse_has_retry_config(self) -> None:
        """Test that document-parse has retry configuration."""
        options = DEFAULT_JOB_OPTIONS["document-parse"]
        assert options.retry_limit == 3
        assert options.retry_backoff is True

    def test_test_job_has_options(self) -> None:
        """Test that test-job has options configured."""
        assert "test-job" in DEFAULT_JOB_OPTIONS
        options = DEFAULT_JOB_OPTIONS["test-job"]
        assert options.retry_limit == 3

    def test_generate_embeddings_options(self) -> None:
        """Test that generate-embeddings has options configured."""
        assert "generate-embeddings" in DEFAULT_JOB_OPTIONS
        options = DEFAULT_JOB_OPTIONS["generate-embeddings"]
        assert options.priority == 4

    def test_analyze_document_options(self) -> None:
        """Test that analyze-document has options configured."""
        assert "analyze-document" in DEFAULT_JOB_OPTIONS
        options = DEFAULT_JOB_OPTIONS["analyze-document"]
        assert options.priority == 3


class TestPoolFunctions:
    """Tests for pool management functions."""

    @pytest.mark.asyncio
    async def test_close_pool_when_pool_exists(self) -> None:
        """Test that close_pool closes an existing pool."""
        from src.jobs import queue

        mock_pool = AsyncMock()
        queue._pool = mock_pool

        await queue.close_pool()

        mock_pool.close.assert_called_once()
        assert queue._pool is None

    @pytest.mark.asyncio
    async def test_close_pool_when_pool_is_none(self) -> None:
        """Test that close_pool does nothing when pool is None."""
        from src.jobs import queue

        queue._pool = None

        await queue.close_pool()  # Should not raise

        assert queue._pool is None

    @pytest.mark.asyncio
    async def test_get_pool_creates_pool_when_none(self) -> None:
        """Test that get_pool creates pool when it doesn't exist."""
        from src.jobs import queue

        queue._pool = None

        with patch.object(queue, "create_pool", new_callable=AsyncMock) as mock_create:
            mock_pool = AsyncMock()
            mock_create.return_value = mock_pool

            result = await queue.get_pool()

            mock_create.assert_called_once()
            assert result == mock_pool

    @pytest.mark.asyncio
    async def test_get_pool_returns_existing_pool(self) -> None:
        """Test that get_pool returns existing pool."""
        from src.jobs import queue

        mock_pool = MagicMock()
        queue._pool = mock_pool

        result = await queue.get_pool()

        assert result == mock_pool

        # Cleanup
        queue._pool = None

    @pytest.mark.asyncio
    async def test_get_job_queue_returns_queue_with_pool(self) -> None:
        """Test that get_job_queue returns a JobQueue with pool."""
        from src.jobs import queue

        mock_pool = MagicMock()

        with patch.object(queue, "get_pool", new_callable=AsyncMock) as mock_get_pool:
            mock_get_pool.return_value = mock_pool

            with patch("src.jobs.queue.get_settings") as mock_settings:
                mock_settings.return_value.pgboss_schema = "pgboss"
                job_queue = await queue.get_job_queue()

            assert job_queue._pool == mock_pool
