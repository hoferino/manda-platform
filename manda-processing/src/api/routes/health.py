"""
Health check endpoints.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #1)
"""

from typing import Literal

import asyncpg
import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from src.config import get_settings

router = APIRouter()
logger = structlog.get_logger(__name__)


class HealthResponse(BaseModel):
    """Health check response model."""

    status: Literal["healthy", "unhealthy"]


class ReadyResponse(BaseModel):
    """Readiness check response model."""

    status: Literal["ready", "not_ready"]
    database: Literal["connected", "disconnected"]
    queue: Literal["connected", "disconnected"]


# Database connection pool (will be initialized in lifespan)
_db_pool = None


def set_db_pool(pool) -> None:  # type: ignore[no-untyped-def]
    """Set the database pool for health checks."""
    global _db_pool
    _db_pool = pool


def get_db_pool():  # type: ignore[no-untyped-def]
    """Get the database pool."""
    return _db_pool


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Basic health check endpoint.
    Returns 200 OK if the service is running.
    """
    return HealthResponse(status="healthy")


@router.get("/ready", response_model=ReadyResponse)
async def readiness_check() -> ReadyResponse:
    """
    Readiness check endpoint.
    Validates database and queue connections.
    """
    settings = get_settings()
    db_status: Literal["connected", "disconnected"] = "disconnected"
    queue_status: Literal["connected", "disconnected"] = "disconnected"

    # Check database connection
    try:
        conn = await asyncpg.connect(settings.database_url)
        await conn.execute("SELECT 1")
        await conn.close()
        db_status = "connected"
        logger.debug("Database connection check passed")
    except Exception as e:
        logger.warning("Database connection check failed", error=str(e))

    # Check pg-boss queue tables exist
    try:
        conn = await asyncpg.connect(settings.database_url)
        # Check if pg-boss schema and job table exist
        result = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = $1
                AND table_name = 'job'
            )
            """,
            settings.pgboss_schema,
        )
        await conn.close()
        if result:
            queue_status = "connected"
            logger.debug("Queue connection check passed")
        else:
            logger.warning("pg-boss tables not found", schema=settings.pgboss_schema)
    except Exception as e:
        logger.warning("Queue connection check failed", error=str(e))

    overall_status: Literal["ready", "not_ready"] = (
        "ready" if db_status == "connected" and queue_status == "connected" else "not_ready"
    )

    return ReadyResponse(
        status=overall_status,
        database=db_status,
        queue=queue_status,
    )
