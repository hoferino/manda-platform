"""
FastAPI application entry point.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #1)
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import health, webhooks, search, processing, financial_metrics, entities, graphiti
from src.config import get_settings

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
        if get_settings().log_format == "json"
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup/shutdown events."""
    settings = get_settings()
    logger.info(
        "Starting manda-processing service",
        env=settings.app_env,
        debug=settings.debug,
    )

    # Startup: Initialize connections
    # TODO: Initialize database pool
    # TODO: Initialize job queue

    yield

    # Shutdown: Clean up resources
    logger.info("Shutting down manda-processing service")
    # TODO: Close database pool
    # TODO: Stop job workers gracefully


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Manda Processing Service",
        description="Document processing backend for Manda platform",
        version="0.1.0",
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
        lifespan=lifespan,
    )

    # Configure CORS for development
    if settings.is_development:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Register routes
    app.include_router(health.router, tags=["Health"])
    app.include_router(webhooks.router, tags=["Webhooks"])
    app.include_router(webhooks.retry_router, tags=["Retry"])  # E3.8: Stage-aware retry
    app.include_router(search.router, tags=["Search"])
    app.include_router(processing.router, tags=["Processing"])
    app.include_router(financial_metrics.router, tags=["Financial Metrics"])  # E3.9
    app.include_router(entities.router, tags=["Entities"])  # E10.6: Entity resolution
    app.include_router(graphiti.router, tags=["Graphiti"])  # E11.3: Knowledge write-back

    return app


# Create the app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_development,
    )
