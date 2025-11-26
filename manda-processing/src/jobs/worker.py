"""
Job worker process for background job execution.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #2)
"""

import asyncio
import signal
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

import structlog

from src.jobs.queue import Job, JobQueue, get_job_queue

logger = structlog.get_logger(__name__)


@dataclass
class WorkerConfig:
    """Configuration for a job worker."""

    batch_size: int = 1
    polling_interval_seconds: float = 5.0


# Default worker configurations matching TypeScript definitions
DEFAULT_WORKER_CONFIG: dict[str, WorkerConfig] = {
    "test-job": WorkerConfig(batch_size=5, polling_interval_seconds=2),
    "document-parse": WorkerConfig(batch_size=3, polling_interval_seconds=5),
    "generate-embeddings": WorkerConfig(batch_size=5, polling_interval_seconds=2),
    "analyze-document": WorkerConfig(batch_size=3, polling_interval_seconds=5),
    "update-graph": WorkerConfig(batch_size=10, polling_interval_seconds=1),
}


# Type alias for job handlers
JobHandler = Callable[[Job], Awaitable[dict[str, Any] | None]]


class Worker:
    """
    Background worker that processes jobs from the queue.

    Polls the job queue at regular intervals and executes
    registered handlers for each job type.
    """

    def __init__(self) -> None:
        """Initialize the worker."""
        self._handlers: dict[str, JobHandler] = {}
        self._configs: dict[str, WorkerConfig] = {}
        self._running = False
        self._tasks: list[asyncio.Task[None]] = []

    def register(
        self,
        job_name: str,
        handler: JobHandler,
        config: WorkerConfig | None = None,
    ) -> None:
        """
        Register a handler for a job type.

        Args:
            job_name: The job type name
            handler: Async function to process the job
            config: Optional worker configuration
        """
        self._handlers[job_name] = handler
        self._configs[job_name] = config or DEFAULT_WORKER_CONFIG.get(
            job_name, WorkerConfig()
        )
        logger.info("Handler registered", job_name=job_name)

    async def start(self) -> None:
        """Start the worker process."""
        if self._running:
            logger.warning("Worker already running")
            return

        self._running = True
        logger.info("Starting worker", job_types=list(self._handlers.keys()))

        # Set up signal handlers for graceful shutdown
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))

        # Start a polling task for each registered job type
        for job_name in self._handlers:
            task = asyncio.create_task(self._poll_loop(job_name))
            self._tasks.append(task)

        # Wait for all tasks to complete (they won't unless stopped)
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def stop(self) -> None:
        """Stop the worker gracefully."""
        if not self._running:
            return

        logger.info("Stopping worker gracefully...")
        self._running = False

        # Cancel all polling tasks
        for task in self._tasks:
            task.cancel()

        # Wait for tasks to finish
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

        logger.info("Worker stopped")

    async def _poll_loop(self, job_name: str) -> None:
        """
        Poll for and process jobs of a specific type.

        Args:
            job_name: The job type to poll for
        """
        config = self._configs[job_name]
        handler = self._handlers[job_name]

        logger.info(
            "Starting poll loop",
            job_name=job_name,
            batch_size=config.batch_size,
            interval=config.polling_interval_seconds,
        )

        while self._running:
            try:
                queue = await get_job_queue()
                jobs = await queue.dequeue(job_name, config.batch_size)

                if jobs:
                    # Process jobs concurrently
                    await asyncio.gather(
                        *[self._process_job(job, handler, queue) for job in jobs]
                    )

                # Wait before next poll
                await asyncio.sleep(config.polling_interval_seconds)

            except asyncio.CancelledError:
                logger.info("Poll loop cancelled", job_name=job_name)
                break
            except Exception as e:
                logger.error(
                    "Error in poll loop",
                    job_name=job_name,
                    error=str(e),
                )
                # Wait a bit before retrying after error
                await asyncio.sleep(config.polling_interval_seconds * 2)

    async def _process_job(
        self,
        job: Job,
        handler: JobHandler,
        queue: JobQueue,
    ) -> None:
        """
        Process a single job.

        Args:
            job: The job to process
            handler: The handler function
            queue: The job queue for completion/failure
        """
        logger.info(
            "Processing job",
            job_id=job.id,
            job_name=job.name,
            retry_count=job.retry_count,
        )

        try:
            result = await handler(job)
            await queue.complete(job.id, result)
            logger.info(
                "Job processed successfully",
                job_id=job.id,
                job_name=job.name,
            )
        except Exception as e:
            error_msg = str(e)
            logger.error(
                "Job processing failed",
                job_id=job.id,
                job_name=job.name,
                error=error_msg,
            )
            await queue.fail(job.id, error_msg)


# Global worker instance
_worker: Worker | None = None


def get_worker() -> Worker:
    """Get or create the global worker instance."""
    global _worker
    if _worker is None:
        _worker = Worker()
    return _worker


async def run_worker() -> None:
    """Run the worker process (main entry point for worker)."""
    worker = get_worker()
    await worker.start()


# Example job handler for the test-job type
async def handle_test_job(job: Job) -> dict[str, Any]:
    """
    Handler for test jobs.

    Args:
        job: The test job to process

    Returns:
        Result of processing
    """
    data = job.data
    message = data.get("message", "No message")
    should_fail = data.get("shouldFail", False)
    delay_ms = data.get("delayMs", 0)

    logger.info("Processing test job", message=message, delay_ms=delay_ms)

    if delay_ms > 0:
        await asyncio.sleep(delay_ms / 1000)

    if should_fail:
        raise ValueError(f"Test job intentionally failed: {message}")

    return {
        "status": "success",
        "message": message,
        "processed_at": str(asyncio.get_event_loop().time()),
    }


def setup_default_handlers(worker: Worker) -> None:
    """Register default job handlers."""
    worker.register("test-job", handle_test_job)

    # Document processing handlers (E3.3)
    from src.jobs.handlers import handle_parse_document

    worker.register("document-parse", handle_parse_document)

    # Future handlers:
    # worker.register("generate-embeddings", generate_embeddings_handler)
    # worker.register("analyze-document", analyze_document_handler)
