# Python & FastAPI Conventions

## General

- Python 3.12+ features are allowed (match/case, type unions with |, etc.)
- Use `type` hints for all function parameters and return values
- Use `ruff` for linting (configured in pyproject.toml)
- Use `mypy` for static type checking
- Follow PEP 8 formatting conventions

## Type Hints

- Use `|` operator for unions (Python 3.10+) instead of `Union[...]`
- Use `typing.TYPE_CHECKING` for imports needed only in type annotations
- Use `from __future__ import annotations` for forward references
- Avoid `Any` - use `Unknown` or `Optional[T]` with proper checks
- Use `@dataclass` or `TypedDict` for data structures

## FastAPI Specific

- Use Pydantic models (BaseModel) for request/response validation
- Use dependency injection for shared resources (DB, config, etc.)
- Return Pydantic models from route handlers, not dicts
- Use `@app.exception_handler` for custom error handlers
- Use `status` codes from `fastapi.status` module

## Async/Await

- Use async/await for I/O operations (database, HTTP, queue)
- Use `async def` for route handlers when calling async code
- Don't mix sync and async - pick one pattern per function
- Use `asyncio.gather()` for concurrent independent operations

## Error Handling

- Raise HTTPException from `fastapi` for API errors
- Use domain-specific exception classes for business logic errors
- Log errors with `structlog` with proper context
- Include request ID in all error logs

## Pydantic

- Use `Field` for validation and metadata
- Use `validator` and `root_validator` for complex validation
- Use `Config` class for model configuration
- Prefer `computed_field` for derived properties (Pydantic v2)

## Testing

- Use `pytest` for all tests
- Use `pytest-asyncio` for async tests (mode auto enabled)
- Use `pytest-mock` for mocking
- Use `faker` for test data generation
- One assertion per test when possible
- Give tests descriptive names using `@pytest.mark.parametrize`

## Logging

- Use `structlog` for structured logging
- Include context (user_id, project_id, request_id) in all logs
- Use appropriate log levels: DEBUG, INFO, WARNING, ERROR
- Don't log sensitive data (passwords, tokens, PII)
- Use JSON format for production logs
