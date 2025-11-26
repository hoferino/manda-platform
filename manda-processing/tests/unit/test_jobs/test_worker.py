"""
Tests for job worker.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #2, #6)
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.jobs.queue import Job, JobState
from src.jobs.worker import (
    DEFAULT_WORKER_CONFIG,
    Worker,
    WorkerConfig,
    get_worker,
    handle_test_job,
    setup_default_handlers,
)


@pytest.fixture
def worker() -> Worker:
    """Create a fresh worker instance for testing."""
    return Worker()


@pytest.fixture
def sample_job() -> Job:
    """Create a sample job for testing."""
    return Job(
        id="test-job-123",
        name="test-job",
        data={"message": "Hello, test!"},
        state=JobState.ACTIVE,
        created_on=datetime.now(),
        started_on=datetime.now(),
        retry_count=0,
    )


class TestWorkerConfig:
    """Tests for WorkerConfig."""

    def test_default_values(self) -> None:
        """Test WorkerConfig default values."""
        config = WorkerConfig()
        assert config.batch_size == 1
        assert config.polling_interval_seconds == 5.0

    def test_custom_values(self) -> None:
        """Test WorkerConfig with custom values."""
        config = WorkerConfig(batch_size=10, polling_interval_seconds=2.0)
        assert config.batch_size == 10
        assert config.polling_interval_seconds == 2.0


class TestDefaultWorkerConfig:
    """Tests for default worker configurations."""

    def test_test_job_config(self) -> None:
        """Test test-job configuration."""
        config = DEFAULT_WORKER_CONFIG["test-job"]
        assert config.batch_size == 5
        assert config.polling_interval_seconds == 2

    def test_document_parse_config(self) -> None:
        """Test document-parse configuration."""
        config = DEFAULT_WORKER_CONFIG["document-parse"]
        assert config.batch_size == 3
        assert config.polling_interval_seconds == 5

    def test_generate_embeddings_config(self) -> None:
        """Test generate-embeddings configuration."""
        config = DEFAULT_WORKER_CONFIG["generate-embeddings"]
        assert config.batch_size == 5
        assert config.polling_interval_seconds == 2


class TestWorkerRegistration:
    """Tests for handler registration."""

    def test_register_handler(self, worker: Worker) -> None:
        """Test registering a job handler."""
        async def handler(job: Job) -> dict[str, Any]:
            return {"result": "ok"}

        worker.register("test-job", handler)

        assert "test-job" in worker._handlers
        assert worker._handlers["test-job"] == handler

    def test_register_with_default_config(self, worker: Worker) -> None:
        """Test registering uses default config when available."""
        async def handler(job: Job) -> dict[str, Any]:
            return {"result": "ok"}

        worker.register("test-job", handler)

        config = worker._configs["test-job"]
        assert config.batch_size == DEFAULT_WORKER_CONFIG["test-job"].batch_size

    def test_register_with_custom_config(self, worker: Worker) -> None:
        """Test registering with custom config."""
        async def handler(job: Job) -> dict[str, Any]:
            return {"result": "ok"}

        custom_config = WorkerConfig(batch_size=100, polling_interval_seconds=0.5)
        worker.register("custom-job", handler, custom_config)

        config = worker._configs["custom-job"]
        assert config.batch_size == 100
        assert config.polling_interval_seconds == 0.5

    def test_register_unknown_job_uses_defaults(self, worker: Worker) -> None:
        """Test registering unknown job type uses default WorkerConfig."""
        async def handler(job: Job) -> dict[str, Any]:
            return {"result": "ok"}

        worker.register("unknown-job-type", handler)

        config = worker._configs["unknown-job-type"]
        assert config.batch_size == 1  # Default WorkerConfig values
        assert config.polling_interval_seconds == 5.0


class TestWorkerStop:
    """Tests for worker stop functionality."""

    @pytest.mark.asyncio
    async def test_stop_when_not_running(self, worker: Worker) -> None:
        """Test stop when worker isn't running does nothing."""
        await worker.stop()  # Should not raise

    @pytest.mark.asyncio
    async def test_stop_sets_running_false(self, worker: Worker) -> None:
        """Test stop sets running to False."""
        worker._running = True
        await worker.stop()
        assert worker._running is False


class TestProcessJob:
    """Tests for job processing."""

    @pytest.mark.asyncio
    async def test_process_job_success(self, worker: Worker, sample_job: Job) -> None:
        """Test successful job processing."""
        mock_queue = AsyncMock()
        mock_handler = AsyncMock(return_value={"status": "done"})

        await worker._process_job(sample_job, mock_handler, mock_queue)

        mock_handler.assert_called_once_with(sample_job)
        mock_queue.complete.assert_called_once_with(sample_job.id, {"status": "done"})

    @pytest.mark.asyncio
    async def test_process_job_failure(self, worker: Worker, sample_job: Job) -> None:
        """Test job processing failure."""
        mock_queue = AsyncMock()
        mock_handler = AsyncMock(side_effect=ValueError("Test error"))

        await worker._process_job(sample_job, mock_handler, mock_queue)

        mock_handler.assert_called_once_with(sample_job)
        mock_queue.fail.assert_called_once_with(sample_job.id, "Test error")
        mock_queue.complete.assert_not_called()


class TestHandleTestJob:
    """Tests for the handle_test_job handler."""

    @pytest.mark.asyncio
    async def test_handler_returns_success(self) -> None:
        """Test handler returns success result."""
        job = Job(
            id="test-123",
            name="test-job",
            data={"message": "Hello"},
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            started_on=datetime.now(),
            retry_count=0,
        )

        result = await handle_test_job(job)

        assert result["status"] == "success"
        assert result["message"] == "Hello"

    @pytest.mark.asyncio
    async def test_handler_with_delay(self) -> None:
        """Test handler respects delay setting."""
        job = Job(
            id="test-123",
            name="test-job",
            data={"message": "Delayed", "delayMs": 10},
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            started_on=datetime.now(),
            retry_count=0,
        )

        result = await handle_test_job(job)

        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_handler_intentional_failure(self) -> None:
        """Test handler fails when shouldFail is set."""
        job = Job(
            id="test-123",
            name="test-job",
            data={"message": "Fail me", "shouldFail": True},
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            started_on=datetime.now(),
            retry_count=0,
        )

        with pytest.raises(ValueError, match="intentionally failed"):
            await handle_test_job(job)

    @pytest.mark.asyncio
    async def test_handler_default_message(self) -> None:
        """Test handler uses default message when none provided."""
        job = Job(
            id="test-123",
            name="test-job",
            data={},
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            started_on=datetime.now(),
            retry_count=0,
        )

        result = await handle_test_job(job)

        assert result["message"] == "No message"


class TestSetupDefaultHandlers:
    """Tests for setup_default_handlers."""

    def test_registers_test_job(self) -> None:
        """Test that setup_default_handlers registers test-job."""
        worker = Worker()
        setup_default_handlers(worker)

        assert "test-job" in worker._handlers
        assert worker._handlers["test-job"] == handle_test_job


class TestGetWorker:
    """Tests for get_worker function."""

    def test_creates_worker_singleton(self) -> None:
        """Test get_worker returns the same instance."""
        with patch("src.jobs.worker._worker", None):
            worker1 = get_worker()
            worker2 = get_worker()

            assert worker1 is worker2


class TestPollLoop:
    """Tests for the poll loop functionality."""

    @pytest.mark.asyncio
    async def test_poll_loop_exits_on_cancel(self, worker: Worker) -> None:
        """Test poll loop exits when cancelled."""
        mock_queue = AsyncMock()
        mock_queue.dequeue = AsyncMock(return_value=[])

        async def handler(job: Job) -> dict[str, Any]:
            return {}

        worker.register("test-job", handler, WorkerConfig(polling_interval_seconds=0.01))
        worker._running = True

        with patch("src.jobs.worker.get_job_queue", return_value=mock_queue):
            task = asyncio.create_task(worker._poll_loop("test-job"))
            await asyncio.sleep(0.02)
            worker._running = False
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    @pytest.mark.asyncio
    async def test_poll_loop_processes_jobs(self, worker: Worker, sample_job: Job) -> None:
        """Test poll loop processes available jobs."""
        mock_queue = AsyncMock()
        call_count = 0

        async def mock_dequeue(name: str, batch_size: int) -> list[Job]:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [sample_job]
            return []

        mock_queue.dequeue = mock_dequeue
        mock_queue.complete = AsyncMock()

        async def handler(job: Job) -> dict[str, Any]:
            return {"processed": True}

        worker.register("test-job", handler, WorkerConfig(polling_interval_seconds=0.01))
        worker._running = True

        with patch("src.jobs.worker.get_job_queue", return_value=mock_queue):
            task = asyncio.create_task(worker._poll_loop("test-job"))
            await asyncio.sleep(0.05)
            worker._running = False
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        mock_queue.complete.assert_called_once()

    @pytest.mark.asyncio
    async def test_poll_loop_handles_errors(self, worker: Worker) -> None:
        """Test poll loop continues after errors."""
        mock_queue = AsyncMock()
        mock_queue.dequeue = AsyncMock(side_effect=Exception("DB error"))

        async def handler(job: Job) -> dict[str, Any]:
            return {}

        worker.register("test-job", handler, WorkerConfig(polling_interval_seconds=0.01))
        worker._running = True

        with patch("src.jobs.worker.get_job_queue", return_value=mock_queue):
            task = asyncio.create_task(worker._poll_loop("test-job"))
            await asyncio.sleep(0.05)
            worker._running = False
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Should have retried at least once
        assert mock_queue.dequeue.call_count >= 1


class TestWorkerStart:
    """Tests for worker start functionality."""

    @pytest.mark.asyncio
    async def test_start_when_already_running_returns_early(
        self, worker: Worker
    ) -> None:
        """Test that start returns early if worker is already running."""
        worker._running = True

        # This should return immediately without doing anything
        # We'll use a timeout to ensure it doesn't hang
        async def start_with_timeout() -> None:
            await asyncio.wait_for(worker.start(), timeout=0.1)

        # Should not raise TimeoutError since it returns early
        try:
            await start_with_timeout()
        except asyncio.TimeoutError:
            pytest.fail("start() should have returned immediately")

    @pytest.mark.asyncio
    async def test_stop_cancels_all_tasks(self, worker: Worker) -> None:
        """Test that stop cancels all running tasks."""
        # Create some mock tasks
        async def dummy_task() -> None:
            await asyncio.sleep(10)

        task1 = asyncio.create_task(dummy_task())
        task2 = asyncio.create_task(dummy_task())
        worker._tasks = [task1, task2]
        worker._running = True

        await worker.stop()

        assert worker._running is False
        assert task1.cancelled() or task1.done()
        assert task2.cancelled() or task2.done()
        assert len(worker._tasks) == 0


class TestRunWorker:
    """Tests for run_worker function."""

    @pytest.mark.asyncio
    async def test_run_worker_starts_global_worker(self) -> None:
        """Test that run_worker starts the global worker."""
        from src.jobs import worker as worker_module

        mock_worker = MagicMock()
        mock_worker.start = AsyncMock()

        with patch.object(worker_module, "get_worker", return_value=mock_worker):
            await worker_module.run_worker()

        mock_worker.start.assert_called_once()
