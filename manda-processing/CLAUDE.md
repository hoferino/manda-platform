# Backend Context (manda-processing)

This file provides context for working on the FastAPI backend.

## Architecture

- **Framework**: FastAPI with Python 3.12+
- **Package Manager**: uv
- **Config**: Pydantic Settings in `src/config.py`
- **Logging**: structlog for structured logging

## Directory Structure

```
src/
  api/
    routes/           # FastAPI endpoints
  jobs/
    handlers/         # pg-boss job handlers
  services/           # Business logic
  config.py           # Pydantic settings
  main.py             # FastAPI app
tests/
  unit/               # Unit tests
  integration/        # Integration tests
```

## Setup

```bash
# First time setup
uv venv .venv
source .venv/bin/activate
uv pip install -e ".[dev]"

# Each session
source .venv/bin/activate
```

## Running

```bash
# API server
uvicorn src.main:app --reload --port 8000

# Background worker
python -m src.jobs
```

## Job Handlers

Add new job handlers to `src/jobs/handlers/` and register in the worker.

```python
# src/jobs/handlers/my_handler.py
async def handle_my_job(job_data: dict) -> dict:
    """Process job data and return result."""
    # Implementation
    return {"status": "completed"}
```

The job queue (pg-boss) is shared with the Next.js frontend:
- Frontend enqueues jobs
- Python workers process jobs

## Document Processing Pipeline

```
Upload → GCS Storage → Webhook → pg-boss Queue → Workers
                                      ↓
              document-parse (Docling) → ingest-graphiti
                                      ↓
              analyze-document (Gemini) → extract-financials
```

- **Docling**: ML-based document parsing (PDF, DOCX, XLSX)
- **Graphiti + Neo4j**: Knowledge graph storage with Voyage embeddings
- **Gemini 2.5 Flash**: Document analysis

## Testing

```bash
pytest                                    # All tests
pytest tests/unit/test_api/test_health.py # Single file
pytest --cov=src --cov-report=html        # With coverage
```

- Uses pytest with asyncio mode auto-enabled
- Mock external services in unit tests

## Code Quality

```bash
ruff check .    # Linting
mypy src        # Type checking
```

## Documentation

- **Parser Details**: `docs/parsers.md`
- **Architecture**: `docs/manda-architecture.md`
