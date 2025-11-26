# Manda Processing Service

Document processing backend for the Manda platform. This FastAPI service handles background job processing for document parsing, embedding generation, and LLM analysis.

## Architecture

This service is a sibling to the `manda-app` Next.js frontend:

```
manda-platform/
├── manda-app/          # Next.js frontend
└── manda-processing/   # FastAPI backend (this service)
```

The service integrates with:
- **Supabase PostgreSQL** - Shared database with manda-app
- **pg-boss** - Job queue (shared tables with TypeScript service)
- **Google Cloud Storage** - Document file storage

## Prerequisites

- Python 3.12+
- Docker and Docker Compose (for local development)
- Access to Supabase project
- GCS credentials (for document access)

## Quick Start

### 1. Clone and Setup

```bash
cd manda-processing

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# - DATABASE_URL from Supabase
# - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# - API_KEY (generate a secure random key)
# - GCS credentials
```

### 2. Local Development with Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f api

# Stop services
docker compose down
```

### 3. Local Development without Docker

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -e ".[dev]"

# Run the API server
uvicorn src.main:app --reload --port 8000

# Run the worker (in a separate terminal)
python -m src.jobs
```

## API Endpoints

### Health Checks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check (always returns 200 if running) |
| `/ready` | GET | Readiness check (validates DB and queue connections) |

### Example Responses

```bash
# Health check
curl http://localhost:8000/health
# {"status": "healthy"}

# Readiness check
curl http://localhost:8000/ready
# {"status": "ready", "database": "connected", "queue": "connected"}
```

## Authentication

### API Key Authentication

Protected endpoints require an API key in the `x-api-key` header:

```bash
curl -H "x-api-key: your-api-key" http://localhost:8000/api/processing/...
```

### Webhook Validation

Supabase webhooks are validated using HMAC-SHA256 signatures in the `x-supabase-signature` header.

## Job Queue

The service uses pg-boss for background job processing. Jobs are enqueued via the `JobQueue` class:

```python
from src.jobs.queue import get_job_queue

queue = await get_job_queue()
job_id = await queue.enqueue("document-parse", {
    "document_id": "...",
    "file_path": "gs://...",
    "file_type": "pdf"
})
```

### Job Types

| Job Type | Description | Priority |
|----------|-------------|----------|
| `document-parse` | Parse documents with Docling | 5 |
| `generate-embeddings` | Generate vector embeddings | 4 |
| `analyze-document` | LLM analysis | 3 |
| `update-graph` | Neo4j updates | 6 |

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/unit/test_api/test_health.py

# Run with verbose output
pytest -v
```

## Project Structure

```
manda-processing/
├── src/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry point
│   ├── config.py                  # Pydantic Settings configuration
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py        # Auth middleware
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── health.py          # /health, /ready endpoints
│   └── jobs/
│       ├── __init__.py
│       ├── queue.py               # pg-boss job queue wrapper
│       └── worker.py              # Background worker process
├── tests/
│   ├── conftest.py                # Pytest configuration
│   ├── unit/
│   │   ├── test_api/
│   │   └── test_jobs/
│   └── integration/
├── pyproject.toml                 # Python dependencies
├── Dockerfile                     # Production image
├── Dockerfile.dev                 # Development image
├── docker-compose.yaml            # Local development
└── .env.example                   # Environment template
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `API_KEY` | Yes | API key for authentication |
| `WEBHOOK_SECRET` | No | Supabase webhook secret |
| `GCS_BUCKET` | Yes | GCS bucket name |
| `GCS_PROJECT_ID` | Yes | GCS project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Path to GCS service account JSON |
| `APP_ENV` | No | Environment (development/staging/production) |
| `DEBUG` | No | Enable debug mode (default: false) |
| `LOG_LEVEL` | No | Logging level (default: INFO) |
| `LOG_FORMAT` | No | Log format (json/console) |

## Development Notes

### Adding New Job Handlers

1. Create handler function in `src/jobs/handlers/`:
```python
async def my_job_handler(job: Job) -> dict[str, Any]:
    # Process job
    return {"result": "success"}
```

2. Register handler in worker:
```python
worker.register("my-job", my_job_handler)
```

3. Add job type to `DEFAULT_JOB_OPTIONS` in `queue.py`.

### Database Migrations

pg-boss tables are managed by the TypeScript service. The Python service uses the same tables via direct SQL.

## Related Documentation

- [Epic 3 Technical Specification](../docs/sprint-artifacts/tech-spec-epic-E3.md)
- [Architecture Document](../docs/manda-architecture.md)
- [pg-boss Documentation](https://github.com/timgit/pg-boss)
