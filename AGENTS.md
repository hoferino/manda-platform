# Droid Project Configuration

This file provides context for Factory Droid when working on this repository.

## Documentation Reference

This project uses the BMAD framework. Please refer to `CLAUDE.md` for comprehensive project documentation including:
- Architecture and design patterns
- Tech stack details
- Codebase organization

## Personal Preferences

Refer to `~/.factory/memories.md` for my coding preferences and past decisions.

## Project Memories

Refer to `.factory/memories.md` for project-specific architecture decisions and known issues.

## Coding Standards

Follow the conventions documented in:
- `.factory/rules/typescript.md` - TypeScript and React patterns
- `.factory/rules/python.md` - Python and FastAPI conventions
- `.factory/rules/testing.md` - Testing conventions

## Build & Test Commands

### Frontend (manda-app)

```bash
cd manda-app
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
npm run test:run              # Vitest unit tests
npm run test:integration      # Integration tests (RUN_INTEGRATION_TESTS=true)
npm run test:e2e              # Playwright E2E tests
```

### Backend (manda-processing)

```bash
cd manda-processing
pytest                                            # Run all tests
pytest --cov=src --cov-report=html                # Tests with coverage
ruff check .                                      # Linting
mypy src                                          # Type checking
```

## Code Style

- **Frontend**: Next.js 16, React 19, TypeScript strict mode, Tailwind CSS 4, shadcn/ui
- **Backend**: Python 3.12+, FastAPI, Pydantic, strict type checking
- Use `ruff` for Python linting and `mypy` for type checking
- Write tests for new features (unit/integration/E2E)
- Multi-tenant isolation: Always include `project_id` in database queries
- Server Components by default, `"use client"` only for interactivity
- Use structured logging with `structlog` in backend
