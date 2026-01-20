# Coding Conventions

**Analysis Date:** 2026-01-20

## Naming Patterns

**Files:**
- TypeScript/TSX: camelCase (e.g., `useCIMChat.ts`, `streaming.ts`, `confidence.test.ts`)
- Python: snake_case (e.g., `health.py`, `docling_parser.py`, `gcs_client.py`)
- Directories: kebab-case (e.g., `cim-mvp/`, `neo4j/`, `graphiti/`)

**Functions:**
- TypeScript: camelCase for all functions, including React hooks (e.g., `useCIMChat()`, `sendMessage()`, `normalizeConfidence()`)
- Python: snake_case for all functions (e.g., `health_check()`, `readiness_check()`, `extract_financials()`)

**Variables:**
- TypeScript: camelCase for all variable/constant declarations (e.g., `lastUserMessageRef`, `isStreaming`, `dealContext`)
- Python: snake_case for variables; UPPER_SNAKE_CASE for module-level constants (e.g., `db_status`, `CONFIDENCE_THRESHOLDS`)

**Types:**
- TypeScript: PascalCase for interfaces and types (e.g., `SSEEvent`, `UseCIMChatOptions`, `ConversationMessage`)
- Python: PascalCase for Pydantic models and classes (e.g., `HealthResponse`, `ReadyResponse`, `Settings`)

**React Components:**
- PascalCase file names matching component exports (e.g., `CIMBuilderPage.tsx` exports `CIMBuilderPage`)

**Naming Convention Enforcement:**
- ESLint configured to warn on unused variables (except underscore-prefixed `_var`)
- No snake_case in TypeScript codebase (agent system v2 retro action item)
- Strict typing enabled in both TypeScript and Python

## Code Style

**Formatting (TypeScript):**
- Prettier configured implicitly through Next.js (no explicit .prettierrc)
- Target: ES2017
- JSX: `react-jsx` (automatic runtime)

**Formatting (Python):**
- Ruff configured with target Python 3.12
- Line length: 100 characters
- Selected rules: E, F, I, N, W, UP, B, C4, SIM
- Excluded: E501 (line too long - allowing flexibility for long strings)

**Linting (TypeScript):**
- ESLint with eslint-config-next (core-web-vitals + typescript)
- Custom rule overrides:
  - `@typescript-eslint/no-unused-vars`: warn (allow underscore-prefixed)
  - `prefer-const`: warn
  - `no-console`: warn (allow warn, error, info, debug)
  - `curly`: warn (multi-line style)
  - `brace-style`: warn (1tbs with single-line exceptions)
  - React Hooks rules: downgraded to warn for pre-existing issues
- Config: `eslint.config.mjs` (ESLint flat config format)

**Linting (Python):**
- Ruff linter with selection: E, F, I, N, W, UP, B, C4, SIM
- Mypy: strict type checking enabled
- Type checking: `mypy src` with strict=true

**TypeScript Compiler Options:**
- `strict: true` - enables all strict type checking options
- `noUncheckedIndexedAccess: true` - prevents unsafe index access
- `noImplicitOverride: true` - requires override keyword on inherited methods
- `noFallthroughCasesInSwitch: true` - prevents switch statement fallthrough
- `forceConsistentCasingInFileNames: true` - case-sensitive file imports

## Import Organization

**TypeScript Order:**
1. External library imports (React, Next.js, third-party packages)
2. Absolute imports from project (prefixed with `@/`)
3. Relative imports (from same directory or parent)

**Path Aliases:**
- `@/*` - maps to project root
- Used extensively: `@/lib/agent`, `@/components`, `@/app`, etc.

**Import Grouping Convention (Observed):**
```typescript
// External/third-party
import { useState, useCallback, useRef } from 'react'
import type { ConversationMessage } from '@/lib/types/cim'

// Local project imports
import {
  extractConfidenceFromToolResults,
  aggregateConfidence,
} from '@/lib/utils/confidence'
```

**Python Import Organization:**
- Standard library imports first
- Third-party imports second (fastapi, pydantic, asyncpg, structlog, etc.)
- Local application imports last
- Alphabetically sorted within each group

## Error Handling

**TypeScript Patterns:**
- Async/await with try-catch blocks
- Promise-based error handling in hooks
- Set error state: `setError(null)` on start, `catch (e) => setError(e.message)`
- Frontend API errors parsed with `.catch(() => ({}))`
- Return early pattern for guard clauses

**Python Patterns:**
- Exception handling with specific exception types (not bare `except`)
- Context managers for resource cleanup
- Pydantic models for validation (automatic error serialization)
- Structlog for context-enriched error logging
- Custom error types in `src/errors/types.py`

**Global Error Handling:**
- TypeScript: Error logging via `@/lib/audit/logger.ts`
- Python: Structlog with structured context (error=str(e), schema=..., etc.)

## Logging

**Framework:**
- TypeScript: Console methods + `@/lib/audit/logger.ts` for structured logging
- Python: Structlog for structured logging with context

**Patterns:**
- TypeScript: `console.warn()`, `console.error()`, `console.log()` allowed in certain contexts
- Python: `logger.debug()`, `logger.info()`, `logger.warning()` with context dict
  - Example: `logger.debug("Queue connection check passed")`
  - Example: `logger.warning("Queue connection check failed", error=str(e))`
- Include Story/Epic references in header comments
- Always include context/metadata in log calls (dict-based in Python)

## Comments

**When to Comment:**
- Story/Epic references at file top (e.g., `Story: E3.1 - Set up FastAPI Backend`)
- Acceptance criteria (e.g., `AC: #1, #6`)
- Complex algorithm explanations
- TODO/FIXME markers for incomplete work
- Config rationale (e.g., why a specific setting exists)

**JSDoc/TSDoc:**
- Used for exported functions and interfaces
- Includes parameter types and return types
- Example from codebase:
```typescript
/**
 * Readiness check endpoint.
 * Validates database and queue connections.
 */
async def readiness_check() -> ReadyResponse:
```

**Python Docstrings:**
- Triple-quoted docstrings for modules and functions
- Include story/AC references
- Parameter documentation in docstring
- Return type shown in type hints (preferred over docstring docs)

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Hooks typically 50-150 lines (useCIMChat ~120 lines with streaming logic)
- Python functions similarly concise

**Parameters:**
- TypeScript: Use interfaces for options objects
  - Example: `UseCIMChatOptions` interface instead of individual params
  - Optional properties marked with `?`
- Python: Positional args for required params, kwargs for optional
  - Type hints on all parameters

**Return Values:**
- TypeScript: Explicit return types on all functions
  - Interfaces for complex returns
  - Example: `UseCIMChatReturn` interface
- Python: Explicit return type hints
  - Example: `-> ReadyResponse:`

**Async/Await:**
- TypeScript: All async functions use async/await
- Python: Async functions use `async def` and `await` for concurrent operations
- Properly await promises/coroutines - no unhandled promise chains

## Module Design

**Exports:**
- TypeScript: Named exports preferred (e.g., `export function useCIMChat()`)
- Barrel files (`index.ts`) re-export from module subdirectories
- Default exports only when wrapping entire module
- Example: `lib/agent/streaming.ts` exports multiple SSE types and functions

**Barrel Files:**
- Used extensively for cleaner imports
- Located at `index.ts` in directories
- Example: `lib/agent/tools/index.ts` exports all tool functions
- Enables: `import { streamAgentWithTokens } from '@/lib/agent/v2'`

**Module Organization:**
- Separation by concern (e.g., `lib/agent/`, `lib/services/`, `lib/utils/`)
- Utilities grouped by function (confidence, validation, citation parsing)
- Type definitions in separate files (`lib/types/`)

## Multi-Tenant Isolation

**Database Queries:**
- All queries must include `project_id` in WHERE clauses
- RLS policies enforce at PostgreSQL level
- Neo4j uses `group_id` namespacing for tenant isolation
- Backend auth middleware validates org_id in `src/api/middleware/org_auth.py`

## Special Patterns

**SSE (Server-Sent Events):**
- All events include `timestamp: string` field
- Discriminated union types for event payloads
- Events formatted as: `data: ${JSON.stringify(event)}\n\n`

**Agent System Naming:**
- Thread IDs: `cim-mvp:${cimId}` or `{workflowMode}:{dealId}:{userId}:{conversationId}`
- State machines use short descriptive node names (`supervisor`, `retrieval`, `agent`)
- Tools follow verb_noun pattern (`save_buyer_persona`, `create_outline`)

---

*Convention analysis: 2026-01-20*
