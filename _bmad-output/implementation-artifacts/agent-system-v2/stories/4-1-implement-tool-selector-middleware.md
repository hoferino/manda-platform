# Story 4.1: Implement Tool Selector Middleware

Status: ready-for-dev

## Story

As a **developer**,
I want **tools filtered based on workflow mode and permissions**,
So that **the supervisor only sees relevant tools**.

## Acceptance Criteria

1. **AC #1: Middleware Creation** - Create `lib/agent/v2/middleware/tool-selector.ts` that filters available tools based on workflow mode
2. **AC #2: Mode-Based Filtering** - In 'chat' mode, general specialist tools are available; workflow-specific tools are excluded
3. **AC #3: Permission Filtering** - Tools are filtered based on user permissions from runtime context (scratchpad.userId → role lookup)
4. **AC #4: Specialist Availability** - Middleware checks if specialists are enabled/disabled via configuration
5. **AC #5: State Transformation** - Middleware returns filtered tool list in `state.availableTools` for supervisor consumption
6. **AC #6: Middleware Order** - Integrates into middleware stack after workflow-router (position 2)
7. **AC #7: Test Coverage** - Unit tests verify tool filtering for each workflow mode and permission combination

## Tasks / Subtasks

- [ ] Task 1: Create tool-selector middleware file (AC: #1)
  - [ ] 1.1: Create `lib/agent/v2/middleware/tool-selector.ts`
  - [ ] 1.2: Add `availableTools` field to AgentState in `state.ts`
  - [ ] 1.3: Define `ToolAvailability` type in `types.ts`

- [ ] Task 2: Implement mode-based tool filtering (AC: #2)
  - [ ] 2.1: Define tool → mode mapping constant
  - [ ] 2.2: Filter specialistTools based on workflowMode
  - [ ] 2.3: Handle 'chat' mode (all general specialists)
  - [ ] 2.4: Handle 'cim' mode (exclude IRL-specific tools when added)
  - [ ] 2.5: Handle 'irl' mode (exclude CIM-specific tools when added)

- [ ] Task 3: Implement permission-based filtering (AC: #3)
  - [ ] 3.1: Extract userId from state.scratchpad
  - [ ] 3.2: Create stub for permission lookup (actual role lookup deferred)
  - [ ] 3.3: Filter tools based on role capabilities

- [ ] Task 4: Implement specialist availability checks (AC: #4)
  - [ ] 4.1: Create tool configuration interface
  - [ ] 4.2: Check enabled/disabled status before including tool

- [ ] Task 5: Update middleware exports and ordering (AC: #6)
  - [ ] 5.1: Export from `middleware/index.ts`
  - [ ] 5.2: Document middleware order in index.ts comments
  - [ ] 5.3: Update CLAUDE.md if middleware order section exists

- [ ] Task 6: Write unit tests (AC: #7)
  - [ ] 6.1: Test chat mode filtering
  - [ ] 6.2: Test cim mode filtering
  - [ ] 6.3: Test irl mode filtering
  - [ ] 6.4: Test permission filtering
  - [ ] 6.5: Test disabled specialist handling

## Dev Notes

### Architecture Pattern

The tool-selector middleware is part of the 4-pillar context engineering approach (Write/Select/Compress/Isolate). It implements the **Isolate** pillar by ensuring the supervisor only sees tools relevant to the current workflow mode and user permissions.

**Middleware Order (Critical):**
```typescript
const middlewareStack = [
  workflowRouterMiddleware,    // 1. Set system prompt by mode (Story 2-3, DONE)
  toolSelectorMiddleware,      // 2. Filter tools by mode/permissions (Story 4-1, THIS STORY)
  summarizationMiddleware,     // 3. Compress at 70% threshold (Story 4-7)
]
```

### Existing Code to Extend

1. **Specialist tools already defined**: `lib/agent/v2/tools/specialist-definitions.ts`
   - 4 tools: `financial-analyst`, `document-researcher`, `kg-expert`, `due-diligence`
   - All are general-purpose, applicable to all workflow modes currently

2. **Middleware infrastructure exists**: `lib/agent/v2/middleware/index.ts`
   - Types defined: `SyncMiddleware`, `AsyncMiddleware`, `Middleware`
   - Pattern: Input state → Output state (immutable)

3. **Workflow router implemented**: `lib/agent/v2/middleware/workflow-router.ts`
   - Sets `state.systemPrompt` based on `state.workflowMode`
   - Handles 'chat', 'cim', 'irl' modes

### State Schema Changes Required

Add to `lib/agent/v2/state.ts`:

```typescript
/**
 * Available tools for this invocation.
 * Set by tool-selector middleware based on mode and permissions.
 */
availableTools: Annotation<string[]>({
  reducer: (_, next) => next,
  default: () => [],
}),
```

Add to `lib/agent/v2/types.ts`:

```typescript
/**
 * Tool availability configuration.
 */
export interface ToolAvailability {
  toolName: string
  modes: WorkflowMode[]  // Which modes this tool is available in
  minRole?: string       // Minimum role required (future)
  enabled: boolean       // Global enable/disable
}
```

### Implementation Approach

```typescript
// lib/agent/v2/middleware/tool-selector.ts

import type { AgentStateType } from '../state'
import { SPECIALIST_TOOL_NAMES } from '../tools/specialist-definitions'

/**
 * Tool availability configuration.
 * All current specialists are available in all modes.
 * This will evolve as workflow-specific tools are added.
 */
const TOOL_CONFIG: Record<string, { modes: WorkflowMode[], enabled: boolean }> = {
  'financial-analyst': { modes: ['chat', 'cim', 'irl'], enabled: true },
  'document-researcher': { modes: ['chat', 'cim', 'irl'], enabled: true },
  'kg-expert': { modes: ['chat', 'cim', 'irl'], enabled: true },
  'due-diligence': { modes: ['chat', 'cim', 'irl'], enabled: true },
}

export function toolSelectorMiddleware(state: AgentStateType): AgentStateType {
  const mode = state.workflowMode || 'chat'

  // Filter tools by mode
  const modeFiltered = Object.entries(TOOL_CONFIG)
    .filter(([_, config]) => config.modes.includes(mode) && config.enabled)
    .map(([name]) => name)

  // Permission filtering (stub - actual role lookup in future)
  // const userId = state.scratchpad?.userId as string | undefined
  // const role = userId ? await lookupUserRole(userId) : 'analyst'
  // const permFiltered = modeFiltered.filter(tool => hasPermission(role, tool))

  return {
    ...state,
    availableTools: modeFiltered,
  }
}
```

### Supervisor Integration

The supervisor node at `lib/agent/v2/nodes/supervisor.ts` currently binds all specialist tools:

```typescript
const llm = getSupervisorLLMWithTools() // binds all tools
```

After this story, the supervisor should read `state.availableTools` and only bind those tools. However, this integration change is **out of scope** for this story - it belongs in Story 4.2 (Implement Specialist Tool Definitions) or a separate integration story.

For now, implement the middleware to set `state.availableTools`. The supervisor update can happen in a follow-up.

### Testing Strategy

Location: `lib/agent/v2/middleware/__tests__/tool-selector.test.ts`

```typescript
import { toolSelectorMiddleware } from '../tool-selector'
import { createInitialState } from '../../state'

describe('toolSelectorMiddleware', () => {
  it('includes all general tools in chat mode', () => {
    const state = createInitialState('chat')
    const result = toolSelectorMiddleware(state)

    expect(result.availableTools).toContain('financial-analyst')
    expect(result.availableTools).toContain('document-researcher')
    expect(result.availableTools).toContain('kg-expert')
    expect(result.availableTools).toContain('due-diligence')
  })

  it('filters tools by workflow mode', () => {
    // When workflow-specific tools are added
  })

  it('handles null workflowMode gracefully', () => {
    const state = { ...createInitialState(), workflowMode: null as any }
    const result = toolSelectorMiddleware(state)

    expect(result.availableTools).toBeDefined()
    expect(result.availableTools.length).toBeGreaterThan(0)
  })
})
```

### Project Structure Notes

- File location follows existing pattern: `lib/agent/v2/middleware/tool-selector.ts`
- Test file follows pattern: `lib/agent/v2/middleware/__tests__/tool-selector.test.ts`
- Export from barrel file: `lib/agent/v2/middleware/index.ts`
- Naming convention: kebab-case files, camelCase exports

### References

- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Middleware Ordering]
- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 4.1]
- [Source: lib/agent/v2/middleware/index.ts] - Middleware type definitions
- [Source: lib/agent/v2/middleware/workflow-router.ts] - Reference implementation
- [Source: lib/agent/v2/tools/specialist-definitions.ts] - Current tool definitions

## Dev Agent Record

### Agent Model Used

(To be filled during implementation)

### Debug Log References

### Completion Notes List

### File List

- `lib/agent/v2/middleware/tool-selector.ts` (CREATE)
- `lib/agent/v2/middleware/index.ts` (EDIT - add export)
- `lib/agent/v2/state.ts` (EDIT - add availableTools field)
- `lib/agent/v2/types.ts` (EDIT - add ToolAvailability interface)
- `lib/agent/v2/middleware/__tests__/tool-selector.test.ts` (CREATE)
