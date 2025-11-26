"""
pg-boss Job Queue wrapper using direct SQL.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #2)

This implementation interacts directly with pg-boss tables via asyncpg,
following the same patterns as the existing TypeScript pg-boss client.
"""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

import asyncpg
import structlog

from src.config import get_settings

logger = structlog.get_logger(__name__)


class JobState(str, Enum):
    """pg-boss job states."""

    CREATED = "created"
    RETRY = "retry"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass
class Job:
    """Represents a pg-boss job."""

    id: str
    name: str
    data: dict[str, Any]
    state: JobState
    created_on: datetime
    started_on: datetime | None = None
    completed_on: datetime | None = None
    retry_count: int = 0
    expire_in: timedelta | None = None


@dataclass
class EnqueueOptions:
    """Options for enqueueing jobs."""

    priority: int = 0
    retry_limit: int = 3
    retry_delay: int = 30  # seconds
    retry_backoff: bool = True
    expire_in_seconds: int = 3600  # 1 hour
    singleton_key: str | None = None
    start_after: datetime | None = None


# Default options matching TypeScript definitions
DEFAULT_JOB_OPTIONS: dict[str, EnqueueOptions] = {
    "test-job": EnqueueOptions(
        priority=1,
        retry_limit=3,
        retry_delay=1,
        retry_backoff=True,
    ),
    "document-parse": EnqueueOptions(
        priority=5,
        retry_limit=3,
        retry_delay=5,
        retry_backoff=True,
        expire_in_seconds=3600,
    ),
    "generate-embeddings": EnqueueOptions(
        priority=4,
        retry_limit=3,
        retry_delay=2,
        retry_backoff=True,
        expire_in_seconds=1800,
    ),
    "analyze-document": EnqueueOptions(
        priority=3,
        retry_limit=3,
        retry_delay=5,
        retry_backoff=True,
        expire_in_seconds=3600,
    ),
}


class JobQueue:
    """
    pg-boss compatible job queue using direct SQL.

    This class provides a Python interface to pg-boss tables,
    allowing interoperability with the existing TypeScript service.
    """

    def __init__(self, pool: asyncpg.Pool) -> None:
        """Initialize with an asyncpg connection pool."""
        self._pool = pool
        settings = get_settings()
        self._schema = settings.pgboss_schema

    async def enqueue(
        self,
        name: str,
        data: dict[str, Any],
        options: EnqueueOptions | None = None,
    ) -> str:
        """
        Enqueue a job for processing.

        Args:
            name: Job type name (e.g., "document-parse")
            data: Job payload data
            options: Optional job configuration

        Returns:
            The created job ID
        """
        if options is None:
            options = DEFAULT_JOB_OPTIONS.get(name, EnqueueOptions())

        job_id = str(uuid.uuid4())

        # Calculate expiration and start time
        expire_in = f"{options.expire_in_seconds} seconds"
        start_after = options.start_after or datetime.now(timezone.utc)

        async with self._pool.acquire() as conn:
            await conn.execute(
                f"""
                INSERT INTO {self._schema}.job (
                    id, name, data, priority,
                    retry_limit, retry_delay, retry_backoff,
                    expire_in, start_after, singleton_key,
                    state, created_on
                ) VALUES (
                    $1, $2, $3, $4,
                    $5, $6, $7,
                    $8::interval, $9, $10,
                    'created', NOW()
                )
                """,
                job_id,
                name,
                json.dumps(data),
                options.priority,
                options.retry_limit,
                options.retry_delay,
                options.retry_backoff,
                expire_in,
                start_after,
                options.singleton_key,
            )

        logger.info(
            "Job enqueued",
            job_id=job_id,
            name=name,
            priority=options.priority,
        )

        return job_id

    async def dequeue(self, name: str, batch_size: int = 1) -> list[Job]:
        """
        Fetch and lock jobs for processing.

        Args:
            name: Job type to fetch
            batch_size: Number of jobs to fetch

        Returns:
            List of locked jobs ready for processing
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                UPDATE {self._schema}.job
                SET state = 'active',
                    started_on = NOW()
                WHERE id IN (
                    SELECT id FROM {self._schema}.job
                    WHERE name = $1
                    AND state IN ('created', 'retry')
                    AND start_after <= NOW()
                    ORDER BY priority DESC, created_on ASC
                    LIMIT $2
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, name, data, state, created_on, started_on, retry_count
                """,
                name,
                batch_size,
            )

        jobs = []
        for row in rows:
            jobs.append(
                Job(
                    id=str(row["id"]),
                    name=row["name"],
                    data=json.loads(row["data"]) if row["data"] else {},
                    state=JobState.ACTIVE,
                    created_on=row["created_on"],
                    started_on=row["started_on"],
                    retry_count=row["retry_count"],
                )
            )

        if jobs:
            logger.debug("Jobs dequeued", count=len(jobs), name=name)

        return jobs

    async def complete(self, job_id: str, output: dict[str, Any] | None = None) -> None:
        """
        Mark a job as completed.

        Args:
            job_id: ID of the job to complete
            output: Optional output data from job execution
        """
        async with self._pool.acquire() as conn:
            await conn.execute(
                f"""
                UPDATE {self._schema}.job
                SET state = 'completed',
                    completed_on = NOW(),
                    output = $2
                WHERE id = $1
                """,
                job_id,
                json.dumps(output) if output else None,
            )

        logger.info("Job completed", job_id=job_id)

    async def fail(self, job_id: str, error: str) -> None:
        """
        Mark a job as failed, potentially triggering retry.

        Args:
            job_id: ID of the job that failed
            error: Error message describing the failure
        """
        async with self._pool.acquire() as conn:
            # Check if we should retry
            row = await conn.fetchrow(
                f"""
                SELECT retry_count, retry_limit, retry_delay, retry_backoff
                FROM {self._schema}.job
                WHERE id = $1
                """,
                job_id,
            )

            if row and row["retry_count"] < row["retry_limit"]:
                # Calculate retry delay with optional backoff
                delay = row["retry_delay"]
                if row["retry_backoff"]:
                    delay = delay * (2 ** row["retry_count"])

                # Schedule for retry
                await conn.execute(
                    f"""
                    UPDATE {self._schema}.job
                    SET state = 'retry',
                        retry_count = retry_count + 1,
                        start_after = NOW() + ($2 || ' seconds')::interval,
                        output = $3
                    WHERE id = $1
                    """,
                    job_id,
                    str(delay),
                    json.dumps({"error": error}),
                )
                logger.warning(
                    "Job failed, scheduled for retry",
                    job_id=job_id,
                    retry_count=row["retry_count"] + 1,
                    next_attempt_delay=delay,
                )
            else:
                # Mark as permanently failed
                await conn.execute(
                    f"""
                    UPDATE {self._schema}.job
                    SET state = 'failed',
                        completed_on = NOW(),
                        output = $2
                    WHERE id = $1
                    """,
                    job_id,
                    json.dumps({"error": error}),
                )
                logger.error(
                    "Job failed permanently",
                    job_id=job_id,
                    error=error,
                )

    async def get_job(self, job_id: str) -> Job | None:
        """
        Get a job by ID.

        Args:
            job_id: The job ID to fetch

        Returns:
            The job if found, None otherwise
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f"""
                SELECT id, name, data, state, created_on, started_on, completed_on, retry_count
                FROM {self._schema}.job
                WHERE id = $1
                """,
                job_id,
            )

        if not row:
            return None

        return Job(
            id=str(row["id"]),
            name=row["name"],
            data=json.loads(row["data"]) if row["data"] else {},
            state=JobState(row["state"]),
            created_on=row["created_on"],
            started_on=row["started_on"],
            completed_on=row["completed_on"],
            retry_count=row["retry_count"],
        )

    async def get_queue_counts(self) -> dict[str, dict[str, int]]:
        """
        Get job counts by name and state.

        Returns:
            Dict mapping job names to state counts
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT name, state, COUNT(*) as count
                FROM {self._schema}.job
                GROUP BY name, state
                """
            )

        counts: dict[str, dict[str, int]] = {}
        for row in rows:
            name = row["name"]
            if name not in counts:
                counts[name] = {}
            counts[name][row["state"]] = row["count"]

        return counts


# Global pool instance
_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """Create the database connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=5,
            max_size=20,
        )
        logger.info("Database pool created")
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Get or create the database connection pool."""
    global _pool
    if _pool is None:
        return await create_pool()
    return _pool


async def close_pool() -> None:
    """Close the database connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


async def get_job_queue() -> JobQueue:
    """Get a JobQueue instance with the current pool."""
    pool = await get_pool()
    return JobQueue(pool)
