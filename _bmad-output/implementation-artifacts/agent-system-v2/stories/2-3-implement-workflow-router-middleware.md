# Story 2.3: Implement Workflow Router Middleware

Status: complete

<!--
Note: Sprint-status shows this as 2-3 (workflow-router), while epics file shows
Story 2.3 as context-loader. The sprint-status ordering takes precedence - context-loader
was moved to Epic 3 (Story 3.1) to allow workflow-router to be implemented first.
-->

## Story

As a **developer**,
I want **the system prompt to adapt based on workflow mode**,
So that **the agent behaves appropriately for each context (chat vs CIM vs IRL)**.

## Acceptance Criteria

1. **Given** the middleware architecture from the architecture doc
   **When** I create `lib/agent/v2/middleware/workflow-router.ts`
   **Then** it sets the system prompt based on `workflowMode`:
   - 'chat' → general assistant prompt with deal context (from `lib/agent/prompts.ts`)
   - 'cim' → CIM builder workflow prompt (from `lib/agent/cim/prompts.ts`)
   - 'irl' → placeholder prompt via `getIRLSystemPrompt(dealName?: string)`

2. **Given** middleware order requirements from architecture
   **When** the middleware stack is assembled
   **Then** workflow-router runs after context-loader (when implemented in Story 3.1)
   **And** before tool-selector (when implemented in Story 4.1)
   **And** middleware operates independently but assumes `state.dealContext` may be populated

3. **Given** a chat workflow request
   **When** workflow-router middleware executes
   **Then** it sets `state.systemPrompt` to the chat system prompt
   **And** includes deal context if `state.dealContext` is populated
   **And** does NOT modify `state.messages` array

4. **Given** a CIM workflow request with `workflowMode: 'cim'`
   **When** workflow-router middleware executes
   **Then** it uses the phase-specific CIM prompt via `getCIMSystemPrompt()`
   **And** includes the current CIM phase from `state.cimState.currentPhase`
   **And** handles null `cimState` gracefully (defaults to 'persona' phase)

5. **Given** integration with supervisor node
   **When** workflow-router processes state
   **Then** it does NOT call the LLM directly (no LLM invocation in middleware)
   **And** it sets `state.systemPrompt` field for supervisor consumption
   **And** supervisor reads `state.systemPrompt` and appends specialist guidance

6. **Given** edge cases in workflow mode
   **When** `workflowMode` is null/undefined or `cimState` is null in CIM mode
   **Then** middleware defaults to 'chat' mode for null workflowMode
   **And** logs a warning about unexpected state
   **And** defaults to 'persona' phase if cimState is null in CIM mode

## Tasks / Subtasks

- [x] Task 1: Update state schema with systemPrompt field (AC: #3, #5)
  - [x] 1.1 Add `systemPrompt: Annotation<string | null>` to `lib/agent/v2/state.ts`
  - [x] 1.2 Add reducer: `(_, next) => next` with default `() => null`
  - [x] 1.3 Export updated `AgentStateType` (existing export covers this)
  - [x] 1.4 Update `lib/agent/v2/types.ts` JSDoc if needed

- [x] Task 2: Create middleware infrastructure (AC: #2)
  - [x] 2.1 Create `lib/agent/v2/middleware/` directory
  - [x] 2.2 Create `lib/agent/v2/middleware/index.ts` with barrel export
  - [x] 2.3 Define and export `Middleware` type signature:
    ```typescript
    export type Middleware = (state: AgentStateType) => AgentStateType
    ```
  - [x] 2.4 Verify `WorkflowMode` type exists in types.ts ('chat' | 'cim' | 'irl')

- [x] Task 3: Implement workflow-router middleware (AC: #1, #3, #4, #6)
  - [x] 3.1 Create `lib/agent/v2/middleware/workflow-router.ts`
  - [x] 3.2 Import existing prompt functions (verify imports work):
    - `getSystemPromptWithContext` from `@/lib/agent/prompts`
    - `getCIMSystemPrompt` from `@/lib/agent/cim/prompts`
  - [x] 3.3 Create `getIRLSystemPrompt(dealName?: string): string` placeholder
  - [x] 3.4 Implement `workflowRouterMiddleware(state: AgentStateType): AgentStateType`
  - [x] 3.5 Handle chat mode: call `getSystemPromptWithContext(dealName)`
  - [x] 3.6 Handle CIM mode: call `getCIMSystemPrompt(phase, dealName)` with null-safe phase
  - [x] 3.7 Handle IRL mode: call `getIRLSystemPrompt(dealName)`
  - [x] 3.8 Handle edge cases: null workflowMode defaults to 'chat', log warning
  - [x] 3.9 Export from `lib/agent/v2/middleware/index.ts`

- [x] Task 4: Refactor supervisor node to consume systemPrompt (AC: #5)
  - [x] 4.1 In `lib/agent/v2/nodes/supervisor.ts`, modify `supervisorNode()`:
    - Read `state.systemPrompt` instead of calling `buildSupervisorSystemPrompt()`
    - If `state.systemPrompt` is null, fall back to inline build (backward compat)
  - [x] 4.2 Keep `buildSupervisorSystemPrompt()` for specialist guidance appendage
  - [x] 4.3 Extract specialist guidance to constant `SPECIALIST_GUIDANCE`
  - [x] 4.4 Update JSDoc to reference Story 2.3

- [x] Task 5: Write unit tests (AC: #1, #2, #3, #4, #5, #6) - **22 tests passed**
  - [x] 5.1 Create `lib/agent/v2/middleware/__tests__/workflow-router.test.ts`
  - [x] 5.2 Test: chat mode returns correct prompt (mock getSystemPromptWithContext)
  - [x] 5.3 Test: CIM mode returns phase-specific prompt (mock getCIMSystemPrompt)
  - [x] 5.4 Test: CIM mode passes correct phase from cimState.currentPhase
  - [x] 5.5 Test: CIM mode defaults to 'persona' if cimState is null
  - [x] 5.6 Test: IRL mode returns placeholder prompt
  - [x] 5.7 Test: deal name included in prompt when dealContext populated
  - [x] 5.8 Test: default chat prompt when dealContext is null
  - [x] 5.9 Test: null workflowMode defaults to 'chat' with warning
  - [x] 5.10 Test: does NOT modify messages array
  - [x] 5.11 Test: preserves all other state fields unchanged
  - [x] 5.12 Test: output type matches AgentStateType
  - [x] 5.13 Test: middleware is synchronous (returns state, not Promise)

- [x] Task 6: Write integration tests (AC: #5) - **6 tests passed**
  - [x] 6.1 Create integration test in `lib/agent/v2/__tests__/workflow-router.integration.test.ts`
  - [x] 6.2 Test: middleware sets systemPrompt, supervisor uses it
  - [x] 6.3 Test: full middleware → supervisor chain produces valid messages array
  - [x] 6.4 Guard with `RUN_INTEGRATION_TESTS=true`

- [x] Task 7: Update exports and documentation (AC: #2)
  - [x] 7.1 Export `workflowRouterMiddleware` from `lib/agent/v2/index.ts`
  - [x] 7.2 Export `Middleware` type from `lib/agent/v2/index.ts`
  - [x] 7.3 Export `getIRLSystemPrompt` from middleware index
  - [x] 7.4 Add JSDoc with story references to all new functions

## Dev Notes

### Story Context Clarification

The sprint-status shows workflow-router as Story 2.3, while the original epics file had context-loader as 2.3. **The sprint ordering takes precedence** - context-loader was moved to Epic 3 (Story 3.1) to allow workflow-router to be built first. This middleware should work independently, assuming `dealContext` may or may not be populated.

### Architecture Context

This is the **second middleware** in the 4-pillar context engineering stack:

```
Middleware Order (Critical - from architecture doc):
1. contextLoaderMiddleware  - Load deal context (Story 3.1 - Epic 3) - NOT YET IMPLEMENTED
2. workflowRouterMiddleware - Set system prompt by mode ← THIS STORY
3. toolSelectorMiddleware   - Filter tools by mode/permissions (Story 4.1 - Epic 4)
4. summarizationMiddleware  - Compress at 70% threshold (Story 4.7 - Epic 4)
```

**Dependency Note:** Context-loader (position #1) is in Epic 3. This middleware is positioned AFTER it in the stack when both exist. For now, implement independently but handle missing `dealContext` gracefully.

### State Schema Change (REQUIRED)

Add `systemPrompt` field to `lib/agent/v2/state.ts`:

```typescript
/**
 * System prompt set by workflow-router middleware.
 * Supervisor reads this field instead of building inline.
 * Story: 2-3 Implement Workflow Router Middleware (AC: #3, #5)
 */
systemPrompt: Annotation<string | null>({
  reducer: (_, next) => next,
  default: () => null,
}),
```

**Why state field over scratchpad:**
1. Type-safe - TypeScript catches if supervisor forgets to use it
2. Visible in LangSmith traces - `systemPrompt` appears in state inspection
3. Explicit contract - other middleware/nodes can rely on it existing
4. Avoid conflicts - scratchpad might be overwritten by other code

### Implementation Pattern - Middleware as State Transformer

Middleware in Agent v2 follows a **pure function pattern**:
- **Input:** Current AgentState
- **Output:** Modified AgentState (new object, not mutated)
- **NO side effects:** No LLM calls, no DB queries, no network requests
- **Synchronous:** Returns state directly (not Promise unless truly async)
- **Composable:** Middleware chain processes state sequentially

```typescript
// Middleware type signature
export type Middleware = (state: AgentStateType) => AgentStateType

// Example implementation
export function workflowRouterMiddleware(state: AgentStateType): AgentStateType {
  const systemPrompt = selectPromptForMode(state)
  return { ...state, systemPrompt }
}
```

### Existing Prompt Functions (DO NOT DUPLICATE)

**Chat Mode (`lib/agent/prompts.ts`):**
```typescript
// VERIFIED EXISTS - call this function, don't copy its content
export function getSystemPromptWithContext(dealName?: string): string
```
- 400+ line comprehensive prompt with P2 compliance, source attribution, Q&A flow
- Already includes tool usage guidance

**CIM Mode (`lib/agent/cim/prompts.ts`):**
```typescript
// VERIFIED EXISTS - call this function, don't copy its content
export function getCIMSystemPrompt(phase: CIMPhase, dealName?: string): string
```
- Phase-specific prompts for: persona, thesis, outline, content_creation, visual_concepts, review, complete
- Note: CIMPhase in this file differs slightly from types.ts - verify at implementation time

**IRL Mode (CREATE NEW):**
```typescript
// Create this placeholder function in workflow-router.ts
export function getIRLSystemPrompt(dealName?: string): string {
  const base = `You are an IRL (Information Request List) Builder Assistant helping M&A professionals create and manage information request lists for due diligence.

## Core Responsibilities
1. Help structure information requests by category
2. Track which items have been received vs outstanding
3. Prioritize requests based on deal phase and urgency
4. Generate professional request language for client communication

## Response Style
- Be structured and organized
- Use clear category headers
- Include deadlines and priorities where relevant`

  return dealName
    ? `${base}\n\n## Current Deal Context\nYou are building an IRL for: "${dealName}"`
    : base
}
```

### Supervisor Node Refactoring

**Current Implementation (Story 2.1):**
```typescript
// supervisor.ts - builds prompt inline
export async function supervisorNode(state: AgentStateType) {
  const dealName = state.dealContext?.dealName
  const systemPrompt = buildSupervisorSystemPrompt(state, dealName)  // ← INLINE BUILD
  const messages = [new SystemMessage(systemPrompt), ...state.messages]
  // ...
}
```

**New Implementation (This Story):**
```typescript
// supervisor.ts - reads from state, appends specialist guidance
const SPECIALIST_GUIDANCE = `
## Specialist Delegation (Agent System v2)
// ... existing specialist guidance from buildSupervisorSystemPrompt ...
`

export async function supervisorNode(state: AgentStateType) {
  // Read base prompt from middleware (or fall back for backward compat)
  const basePrompt = state.systemPrompt ?? getSystemPromptWithContext(state.dealContext?.dealName)

  // Append specialist-specific guidance (supervisor's responsibility)
  const systemPrompt = basePrompt + SPECIALIST_GUIDANCE

  const messages = [new SystemMessage(systemPrompt), ...state.messages]
  // ... rest unchanged
}
```

**Key Changes:**
1. `buildSupervisorSystemPrompt()` is simplified or removed
2. Specialist guidance extracted to constant
3. Fallback ensures backward compatibility if middleware doesn't run

### Edge Case Handling

```typescript
export function workflowRouterMiddleware(state: AgentStateType): AgentStateType {
  const dealName = state.dealContext?.dealName

  // Handle null/undefined workflowMode
  if (!state.workflowMode) {
    console.warn('[workflow-router] workflowMode is null/undefined, defaulting to chat')
    return { ...state, systemPrompt: getSystemPromptWithContext(dealName) }
  }

  switch (state.workflowMode) {
    case 'chat':
      return { ...state, systemPrompt: getSystemPromptWithContext(dealName) }

    case 'cim': {
      // Handle null cimState gracefully
      const phase = state.cimState?.currentPhase ?? 'persona'
      if (!state.cimState) {
        console.warn('[workflow-router] CIM mode but cimState is null, defaulting to persona phase')
      }
      return { ...state, systemPrompt: getCIMSystemPrompt(phase, dealName) }
    }

    case 'irl':
      return { ...state, systemPrompt: getIRLSystemPrompt(dealName) }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = state.workflowMode
      console.warn(`[workflow-router] Unknown workflowMode: ${_exhaustive}, defaulting to chat`)
      return { ...state, systemPrompt: getSystemPromptWithContext(dealName) }
    }
  }
}
```

### CIM Phase Type Verification

From `lib/agent/cim/prompts.ts`, the actual CIMPhase values:
```typescript
type CIMPhase = 'persona' | 'thesis' | 'outline' | 'content_creation' | 'visual_concepts' | 'review' | 'complete'
```

From `lib/agent/v2/types.ts`:
```typescript
export type CIMPhase = 'persona' | 'outline' | 'content' | 'visuals' | 'export'
```

**IMPORTANT:** These differ! At implementation time, verify which type `getCIMSystemPrompt` expects and ensure `cimState.currentPhase` uses the matching type. May need to map between them.

### Testing Strategy

**Unit Tests (13 tests):**
| # | Test Case | Verifies |
|---|-----------|----------|
| 1 | Chat mode returns correct prompt | AC #1 |
| 2 | CIM mode returns phase-specific prompt | AC #1, #4 |
| 3 | CIM mode passes correct phase from cimState | AC #4 |
| 4 | CIM mode defaults to 'persona' if cimState null | AC #6 |
| 5 | IRL mode returns placeholder prompt | AC #1 |
| 6 | Deal name included when dealContext populated | AC #3 |
| 7 | Default chat prompt when dealContext null | AC #3 |
| 8 | Null workflowMode defaults to chat with warning | AC #6 |
| 9 | Does NOT modify messages array | AC #3 |
| 10 | Preserves all other state fields unchanged | AC #3 |
| 11 | Output type matches AgentStateType | AC #5 |
| 12 | Middleware is synchronous | Implementation |
| 13 | Mock verification: correct prompt function called | AC #1 |

**Integration Tests (3 tests):**
| # | Test Case | Verifies |
|---|-----------|----------|
| 14 | Middleware sets systemPrompt, supervisor uses it | AC #5 |
| 15 | Deal context from state included in final prompt | AC #3, #5 |
| 16 | CIM phase correctly passed through chain | AC #4, #5 |

**Mock Requirements:**
```typescript
vi.mock('@/lib/agent/prompts', () => ({
  getSystemPromptWithContext: vi.fn().mockReturnValue('chat-prompt')
}))

vi.mock('@/lib/agent/cim/prompts', () => ({
  getCIMSystemPrompt: vi.fn().mockReturnValue('cim-prompt')
}))
```

### File Structure After Implementation

```
lib/agent/v2/
├── middleware/
│   ├── index.ts                    # Middleware type + barrel export
│   ├── workflow-router.ts          # workflowRouterMiddleware + getIRLSystemPrompt
│   └── __tests__/
│       └── workflow-router.test.ts # 13 unit tests
├── __tests__/
│   └── workflow-router.integration.test.ts  # 3 integration tests
├── state.ts                        # + systemPrompt field
├── types.ts                        # Existing (verify CIMPhase)
├── nodes/
│   └── supervisor.ts               # Refactored to read state.systemPrompt
└── index.ts                        # + middleware exports
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't call LLM in middleware
const response = await llm.invoke(messages)

// ❌ Don't duplicate prompt content - call existing functions
const prompt = `You are an M&A assistant...`  // Duplicating prompts.ts

// ❌ Don't modify messages in this middleware
return { ...state, messages: [...state.messages, systemMessage] }

// ❌ Don't hardcode workflow mode strings without type check
if (mode === 'chat') { }  // Use switch with exhaustiveness check

// ❌ Don't assume middleware order is enforced
const dealName = state.dealContext!.dealName  // Context may not be loaded yet

// ✅ DO set state.systemPrompt for supervisor
return { ...state, systemPrompt: buildPrompt() }

// ✅ DO handle null dealContext gracefully
const dealName = state.dealContext?.dealName  // Optional chaining

// ✅ DO use type-safe switch with exhaustiveness
const _exhaustive: never = unknownMode  // Compiler catches missing cases
```

### Code Patterns from Previous Stories

**From Story 2.1 (Supervisor Node):**
- JSDoc with story references: `Story: 2-1 Implement Supervisor... (AC: #1, #2)`
- Error classification helper functions
- Type assertion comments for LangChain generics

**From Story 2.2 (Token Streaming):**
- Discriminated union event types with `type` field
- Timestamp inclusion in all events
- Guard integration tests with `RUN_INTEGRATION_TESTS`

### References

- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 2.4] - Original story definition
- [Source: lib/agent/prompts.ts:427-442] - `getSystemPromptWithContext` function
- [Source: lib/agent/cim/prompts.ts:749-764] - `getCIMSystemPrompt` function
- [Source: lib/agent/v2/nodes/supervisor.ts:144-183] - Current `buildSupervisorSystemPrompt`
- [Source: lib/agent/v2/state.ts] - State schema to modify
- [Source: CLAUDE.md#Middleware Order (Critical)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - All tests passed on first run

### Completion Notes List

1. **State Schema Updated (Task 1):** Added `systemPrompt: Annotation<string | null>` field to AgentState with replace reducer, updated both `createInitialState()` and `createInitialCIMState()` helpers.

2. **Middleware Infrastructure (Task 2):** Created `lib/agent/v2/middleware/` directory with `index.ts` barrel export and `Middleware` type definition.

3. **Workflow Router Implementation (Task 3):** Implemented `workflowRouterMiddleware` with:
   - Chat mode: calls `getSystemPromptWithContext()`
   - CIM mode: calls `getCIMSystemPrompt()` with phase mapping (v2 phases → legacy phases)
   - IRL mode: calls local `getIRLSystemPrompt()` placeholder
   - Edge cases: null workflowMode defaults to 'chat', null cimState defaults to 'persona'

4. **CIM Phase Mapping:** Created internal mapping function to bridge v2 CIMPhase types to legacy CIMPhase:
   - 'persona' → 'persona'
   - 'outline' → 'outline'
   - 'content' → 'content_creation'
   - 'visuals' → 'visual_concepts'
   - 'export' → 'complete'

5. **Supervisor Refactoring (Task 4):** Updated `supervisorNode()` to:
   - Read `state.systemPrompt` if set (from middleware)
   - Fall back to inline build if null (backward compatibility)
   - Append `SPECIALIST_GUIDANCE` constant to final prompt
   - Marked `buildSupervisorSystemPrompt()` as deprecated

6. **Tests (Tasks 5-6):**
   - 22 unit tests in `workflow-router.test.ts` (all passing)
   - 6 integration tests in `workflow-router.integration.test.ts` (all passing)
   - Total: 287 v2 agent tests passing

7. **Exports Updated (Task 7):** Added to `lib/agent/v2/index.ts`:
   - `Middleware` type
   - `workflowRouterMiddleware` function
   - `getIRLSystemPrompt` function
   - `SPECIALIST_GUIDANCE` constant

### File List

**New Files:**
- `manda-app/lib/agent/v2/middleware/index.ts` - Middleware type and barrel exports
- `manda-app/lib/agent/v2/middleware/workflow-router.ts` - Middleware implementation
- `manda-app/lib/agent/v2/middleware/__tests__/workflow-router.test.ts` - Unit tests (22)
- `manda-app/lib/agent/v2/__tests__/workflow-router.integration.test.ts` - Integration tests (6)

**Modified Files:**
- `manda-app/lib/agent/v2/state.ts` - Added systemPrompt field
- `manda-app/lib/agent/v2/nodes/supervisor.ts` - Refactored to read state.systemPrompt
- `manda-app/lib/agent/v2/index.ts` - Added middleware exports
- `manda-app/lib/agent/v2/__tests__/state.test.ts` - Updated for 12 fields

