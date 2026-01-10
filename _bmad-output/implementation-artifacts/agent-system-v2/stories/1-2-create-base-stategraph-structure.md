# Story 1.2: Create Base StateGraph Structure

Status: done

## Story

As a **developer**,
I want a **base StateGraph with conditional entry points**,
so that **different workflow modes can share the same graph infrastructure**.

## Acceptance Criteria

1. **StateGraph Definition**: Create `lib/agent/v2/graph.ts` that exports a compiled StateGraph using the `AgentState` schema from Story 1.1, with:
   - Import AgentState from `lib/agent/v2/state.ts`
   - Create StateGraph instance using `new StateGraph(AgentState)`
   - Add conditional entry point based on `workflowMode` field
   - Route `'chat'` mode to `'supervisor'` node
   - Route `'cim'` mode to `'cim/phaseRouter'` node
   - Include placeholder nodes that pass through state unchanged

2. **Placeholder Nodes**: Implement minimal placeholder nodes in `lib/agent/v2/nodes/`:
   - `supervisor.ts` - exports `supervisorNode` async function that returns empty object (no state changes)
   - `cim/phase-router.ts` - exports `cimPhaseRouterNode` async function that returns empty object (no state changes)
   - Each node must have correct TypeScript signature: `async (state: AgentStateType) => Promise<Partial<AgentStateType>>`

3. **Graph Compilation**: The StateGraph must:
   - Compile successfully via `.compile()` method
   - Be exported as `agentGraph` from graph.ts
   - Be re-exported from `lib/agent/v2/index.ts`

4. **Entry Point Routing Logic**: Implement conditional entry using LangGraph's `addConditionalEdges` from `START`:
   ```typescript
   import { START, END } from '@langchain/langgraph'

   // Router function determines first node based on workflowMode
   function routeByWorkflowMode(state: AgentStateType): string {
     switch (state.workflowMode) {
       case 'cim': return 'cim/phaseRouter'
       default: return 'supervisor'  // chat, irl, qa all go to supervisor
     }
   }

   graph.addConditionalEdges(START, routeByWorkflowMode, {
     'supervisor': 'supervisor',
     'cim/phaseRouter': 'cim/phaseRouter',
   })
   ```

5. **Unit Tests**: Create `lib/agent/v2/__tests__/graph.test.ts` verifying:
   - Graph compiles without errors
   - Invoking with `workflowMode: 'chat'` routes to supervisor
   - Invoking with `workflowMode: 'cim'` routes to cim/phaseRouter
   - State is returned unchanged through placeholder nodes
   - Graph can be invoked multiple times (stateless compilation)

## Tasks / Subtasks

- [x] Task 1: Create directory structure (AC: #2)
  - [x] Create `lib/agent/v2/nodes/` directory
  - [x] Create `lib/agent/v2/nodes/cim/` subdirectory
  - [x] Create node index.ts barrel files

- [x] Task 2: Implement placeholder supervisor node (AC: #2)
  - [x] Create `lib/agent/v2/nodes/supervisor.ts`
  - [x] Export `supervisorNode` async function with correct type signature
  - [x] Function returns state unchanged (pass-through)
  - [x] Add JSDoc documenting this is a placeholder for Story 2.1

- [x] Task 3: Implement placeholder CIM phase router node (AC: #2)
  - [x] Create `lib/agent/v2/nodes/cim/phase-router.ts`
  - [x] Export `cimPhaseRouterNode` async function with correct type signature
  - [x] Function returns state unchanged (pass-through)
  - [x] Create `lib/agent/v2/nodes/cim/index.ts` barrel export
  - [x] Add JSDoc documenting this is a placeholder for Story 6.1

- [x] Task 4: Create node barrel exports (AC: #2, #3)
  - [x] Create `lib/agent/v2/nodes/index.ts`
  - [x] Export supervisorNode from supervisor.ts
  - [x] Export cimPhaseRouterNode from cim/index.ts
  - [x] Add future specialist/approval node placeholders in comments

- [x] Task 5: Implement StateGraph definition (AC: #1, #3, #4)
  - [x] Create `lib/agent/v2/graph.ts`
  - [x] Import StateGraph, START, END from @langchain/langgraph
  - [x] Import AgentState, AgentStateType from ./state
  - [x] Import node functions from ./nodes
  - [x] Create `routeByWorkflowMode()` router function
  - [x] Create StateGraph instance with AgentState
  - [x] Add supervisor node to graph via `addNode()`
  - [x] Add cim/phaseRouter node to graph via `addNode()`
  - [x] Add conditional edges from START using `addConditionalEdges()`
  - [x] Add END edges from each placeholder node
  - [x] Compile graph and export as `agentGraph`
  - [x] Note: Checkpointer NOT added here (Story 1.3 will add it)

- [x] Task 6: Update barrel exports (AC: #3)
  - [x] Update `lib/agent/v2/index.ts`
  - [x] Export `agentGraph` from graph.ts
  - [x] Export node functions for testing/extension

- [x] Task 7: Write unit tests (AC: #5)
  - [x] Create `lib/agent/v2/__tests__/graph.test.ts`
  - [x] Test graph compilation succeeds
  - [x] Test chat mode routes to supervisor node
  - [x] Test cim mode routes to cim/phaseRouter node
  - [x] Test irl/qa modes fallback to supervisor
  - [x] Test state passes through unchanged
  - [x] Test graph is reusable across multiple invocations
  - [x] Run `npm run test:run` - all tests must pass

- [x] Task 8: Verify TypeScript compilation (AC: #1, #3)
  - [x] Run `npm run type-check` - v2 directory must have zero errors (pre-existing errors in other files are out of scope)
  - [x] Verify no circular import issues
  - [x] Verify graph exports are accessible from index.ts

## Dev Notes

### Architecture Compliance

This story implements the **StateGraph foundation** for Agent System v2.0 per [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Decision 1]:

1. **Single Graph with Workflow Modes**: One StateGraph serves all workflows via conditional entry points
2. **Enterprise Pattern**: "The same graph serving different agent personas or workflows by adjusting runtime configuration parameters"
3. **Extensibility**: Adding new workflows requires only adding nodes and entry conditions, not new graphs

### Technical Requirements

**LangGraph StateGraph Pattern (Required):**
```typescript
import { StateGraph, START, END } from '@langchain/langgraph'
import { AgentState, type AgentStateType } from './state'
import { supervisorNode } from './nodes/supervisor'
import { cimPhaseRouterNode } from './nodes/cim'

// Router function - determines entry point based on workflowMode
function routeByWorkflowMode(state: AgentStateType): string {
  switch (state.workflowMode) {
    case 'cim': return 'cim/phaseRouter'
    default: return 'supervisor'  // chat, irl, qa all route to supervisor
  }
}

// Create graph with state schema
const graphBuilder = new StateGraph(AgentState)

// Add nodes - names MUST match routing targets
graphBuilder.addNode('supervisor', supervisorNode)
graphBuilder.addNode('cim/phaseRouter', cimPhaseRouterNode)

// Conditional entry from START - routes based on workflowMode
graphBuilder.addConditionalEdges(START, routeByWorkflowMode, {
  'supervisor': 'supervisor',
  'cim/phaseRouter': 'cim/phaseRouter',
})

// Placeholder edges to END (will be replaced in later stories)
graphBuilder.addEdge('supervisor', END)
graphBuilder.addEdge('cim/phaseRouter', END)

// Compile and export
export const agentGraph = graphBuilder.compile()
```

**Node Function Signature (Required):**
```typescript
import { type AgentStateType } from '../state'

/**
 * Supervisor node - routes messages to appropriate handlers.
 * Placeholder implementation - passes state unchanged.
 * Full implementation in Story 2.1.
 */
export async function supervisorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // Placeholder: pass through unchanged
  return {}
}
```

**Critical Implementation Notes:**

1. **Node names must be consistent**: The string used in `addNode('supervisor', ...)` MUST match the routing target in `addConditionalEntryPoint`

2. **Async nodes**: All nodes should be async functions returning `Promise<Partial<AgentStateType>>`

3. **Return partial state**: Nodes return only the fields they modify; LangGraph merges with existing state using reducers

4. **END import**: Use `END` from `@langchain/langgraph` for terminal nodes

5. **Graph is stateless**: The compiled graph is reusable - state is passed per invocation via `invoke()` or `stream()`

### Dependency on Story 1-1

This story directly depends on the AgentState schema created in Story 1-1:

**From Story 1-1 (verified complete):**
- `AgentState` - Annotation.Root with 11 fields including `workflowMode`
- `AgentStateType` - TypeScript type extracted via `typeof AgentState.State`
- `createInitialState()` - Helper to create default state for testing
- Located at: `lib/agent/v2/state.ts` and `lib/agent/v2/types.ts`

**Critical field for this story:**
```typescript
workflowMode: Annotation<'chat' | 'cim' | 'irl' | 'qa'>({
  reducer: (_, next) => next,
  default: () => 'chat'
})
```

### Previous Story Intelligence (Story 1-1)

**Patterns established in Story 1-1:**
- All files use kebab-case naming (state.ts, types.ts)
- Barrel exports via index.ts for public API
- JSDoc comments on all exported functions
- TypeScript strict mode compliance
- 58 unit tests covering types and reducers

**Testing approach that worked:**
- Vitest for unit tests in `__tests__/` subdirectory
- Test file naming: `{module}.test.ts`
- Coverage tool (@vitest/coverage-v8) not installed - rely on test count

**Files created in Story 1-1:**
- `lib/agent/v2/index.ts` - barrel exports (needs update)
- `lib/agent/v2/state.ts` - AgentState definition
- `lib/agent/v2/types.ts` - type definitions
- `lib/agent/v2/__tests__/state.test.ts` - 58 tests

### Git Intelligence

**Recent commits show:**
- PostgreSQL checkpointing implemented (commit 58c0cfd) - will connect in Story 1.3
- Redis caching in place (commit 2b1c25f) - ready for middleware in Story 2.3
- Supervisor agent pattern explored (commit b479750) - patterns to follow

### Library Versions (from package.json)

```json
{
  "@langchain/langgraph": "^1.0.7",
  "@langchain/langgraph-checkpoint-postgres": "^1.0.0",
  "@langchain/core": "^1.1.0"
}
```

**LangGraph 1.0.7 API Notes:**
- `StateGraph` constructor takes Annotation.Root as schema
- `addConditionalEdges(START, routerFn, mapping)` for conditional entry routing
- `addNode(name, fn)` registers node with graph
- `addEdge(from, to)` creates unconditional edge
- `compile()` returns executable graph
- `START` and `END` constants from `@langchain/langgraph`

### Project Structure Notes

**Target Directory Structure After This Story:**
```
manda-app/lib/agent/v2/
├── index.ts              # Updated - exports graph
├── state.ts              # From Story 1.1
├── types.ts              # From Story 1.1
├── graph.ts              # NEW - StateGraph definition
├── nodes/
│   ├── index.ts          # NEW - node barrel exports
│   ├── supervisor.ts     # NEW - placeholder supervisor
│   └── cim/
│       ├── index.ts      # NEW - CIM node barrel
│       └── phase-router.ts # NEW - placeholder CIM router
└── __tests__/
    ├── state.test.ts     # From Story 1.1
    └── graph.test.ts     # NEW - graph tests
```

**Import Pattern (per architecture doc):**
```typescript
// Correct - use barrel export
import { agentGraph, supervisorNode } from '@/lib/agent/v2'

// Wrong - deep path import
import { agentGraph } from '@/lib/agent/v2/graph'
```

### Alignment with Architecture

Per [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Implementation Sequence]:
1. `state.ts` - Unified state schema (**Story 1.1 - DONE**)
2. `middleware/context-loader.ts` - Deal context loading (Story 2.3)
3. **`graph.ts` - Single StateGraph definition (THIS STORY)**
4. `nodes/supervisor.ts` - Main routing node (Story 2.1)

This story creates the **infrastructure** that later stories will populate:
- Story 2.1: Replaces supervisor placeholder with LLM routing
- Story 6.1: Replaces cim/phaseRouter placeholder with CIM workflow

### Anti-Patterns to Avoid

```typescript
// WRONG: Node name mismatch
graphBuilder.addNode('supervisor', supervisorNode)
graphBuilder.addConditionalEntryPoint(..., { chat: 'supervisorNode' })  // Wrong name!

// CORRECT: Consistent node names
graphBuilder.addNode('supervisor', supervisorNode)
graphBuilder.addConditionalEntryPoint(..., { chat: 'supervisor' })

// WRONG: Returning full state from node
return state  // Returns everything, may cause issues

// CORRECT: Return only modified fields (empty for placeholder)
return {}

// WRONG: Synchronous node function
function supervisorNode(state: AgentStateType): Partial<AgentStateType> { }

// CORRECT: Async node function
async function supervisorNode(state: AgentStateType): Promise<Partial<AgentStateType>> { }

// WRONG: Missing END edges
// Graph will fail to compile if nodes have no outgoing edges

// CORRECT: All nodes must have edges (to other nodes or END)
graphBuilder.addEdge('supervisor', END)
```

### Testing Strategy

**Unit Tests Required:**
```typescript
describe('agentGraph', () => {
  it('should compile without errors', () => {
    expect(agentGraph).toBeDefined()
    expect(typeof agentGraph.invoke).toBe('function')
  })

  it('should route chat mode to supervisor', async () => {
    const state = createInitialState('chat')
    // Invoke returns state unchanged (placeholder)
    const result = await agentGraph.invoke(state)
    expect(result.workflowMode).toBe('chat')
  })

  it('should route cim mode to cim/phaseRouter', async () => {
    const state = createInitialState('cim')
    const result = await agentGraph.invoke(state)
    expect(result.workflowMode).toBe('cim')
  })
})
```

### References

- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Decision 1: Single Graph with Workflow Modes]
- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#File Organization]
- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 1.2]
- [Source: CLAUDE.md#Agent System v2.0 - Implementation Rules]
- [External: https://langchain-ai.github.io/langgraphjs/how-tos/create-react-agent/]
- [External: https://langchain-ai.github.io/langgraphjs/concepts/low_level/]

### Critical Implementation Notes

1. **This is the GRAPH FOUNDATION** - All subsequent node implementations depend on this structure
2. **Placeholder nodes are intentional** - They prove the routing works before adding complexity
3. **Graph compilation validates structure** - If it compiles, the routing is correctly configured
4. **State passes through reducers** - Even placeholder nodes must respect the state schema
5. **Async pattern required** - All LangGraph nodes must be async for consistency

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript strict mode requires optional chaining (`?.`) for array element access in tests
- Placeholder node parameters prefixed with underscore (`_state`) to silence unused variable warnings while maintaining signature

### Known Deviations from AC

**AC #4 - addConditionalEdges Format:**
- AC example shows object format: `{ 'supervisor': 'supervisor', 'cim/phaseRouter': 'cim/phaseRouter' }`
- Implementation uses array format: `['supervisor', 'cim/phaseRouter']`
- **Reason:** LangGraph 1.0.7 TypeScript types require array format when using chained builder pattern for proper type inference of node names
- **Verified:** Both formats are functionally equivalent; tests confirm routing works correctly

### Completion Notes List

- ✅ Created StateGraph foundation for Agent System v2.0
- ✅ Implemented conditional entry routing based on `workflowMode` field
- ✅ All 4 workflow modes route correctly: chat/irl/qa → supervisor, cim → cim/phaseRouter
- ✅ Graph compiles successfully and is reusable across invocations
- ✅ State passes through placeholder nodes unchanged (verified with 21 new tests)
- ✅ All 81 tests pass (58 from Story 1-1 + 23 graph tests after review fixes)
- ✅ No TypeScript errors in v2 directory (pre-existing errors in other files are out of scope)
- ✅ ESLint passes with only expected placeholder warnings

### File List

**New Files:**
- `manda-app/lib/agent/v2/graph.ts` - StateGraph definition with conditional routing
- `manda-app/lib/agent/v2/nodes/index.ts` - Node barrel exports
- `manda-app/lib/agent/v2/nodes/supervisor.ts` - Placeholder supervisor node
- `manda-app/lib/agent/v2/nodes/cim/index.ts` - CIM node barrel exports
- `manda-app/lib/agent/v2/nodes/cim/phase-router.ts` - Placeholder CIM phase router node
- `manda-app/lib/agent/v2/__tests__/graph.test.ts` - 23 unit tests for graph (including node execution verification)

**Modified Files:**
- `manda-app/lib/agent/v2/index.ts` - Added exports for agentGraph, routeByWorkflowMode, supervisorNode, cimPhaseRouterNode

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-10 | Story implemented: Created StateGraph with conditional entry points, placeholder nodes, 21 unit tests | Claude Opus 4.5 |
