# Story 13.2: Tier-Based Tool Loading

Status: done

## Story

As an **M&A analyst**,
I want the **conversational agent to dynamically load only the tools needed for my query complexity**,
so that **simple queries respond faster with fewer tokens, reducing TTFT from 19.4s to <500ms and token usage from 8,577 to <2,000**.

## Acceptance Criteria

1. **AC1: Create TOOL_TIERS configuration mapping complexity to tools**
   - Define `TOOL_TIERS` constant mapping complexity levels to tool arrays
   - Simple tier: `[]` (no tools - direct LLM response)
   - Medium tier: `['query_knowledge_base', 'get_document_info', 'get_finding_source', 'validate_finding', 'add_qa_item']`
   - Complex tier: `'all'` (full 18 tools or route to specialist)
   - Configuration must be easily extensible for future tiers

2. **AC2: Implement `getToolsForIntent(intent)` function**
   - Accept `EnhancedIntentResult` from E13.1 as input
   - Return filtered tool array based on `intent.complexity`
   - If `complexity` is undefined, default to `'complex'` (backward compatibility)
   - Log tool tier selection for debugging
   - Export function for use by executor

3. **AC3: Modify agent executor to use dynamic tool loading**
   - Update `createChatAgent()` in `executor.ts` to accept optional complexity
   - When complexity is provided, filter `allChatTools` before passing to `createReactAgent`
   - Preserve existing behavior when no complexity provided (all tools)
   - Ensure tool isolation still applies to filtered tool set

4. **AC4: Verify token reduction in LangSmith traces**
   - Simple queries should show 0 tools in trace
   - Medium queries should show 5 tools in trace
   - Complex queries should show full tool count (18)
   - Log tool count in trace metadata for analysis

5. **AC5: Implement tool escalation fallback**
   - If model attempts tool call but tool not in current tier → escalate to next tier
   - Log escalation events with query and missing tool for classification improvement
   - Escalation should be transparent to user (retry with more tools)
   - Add `wasEscalated: boolean` to response metadata

6. **AC6: Create comprehensive tests**
   - Test each tier returns correct tools
   - Test backward compatibility (undefined complexity → all tools)
   - Test tool isolation still works with filtered tools
   - Test escalation logic (mock tool call for missing tool)
   - Test LangSmith metadata includes tool count

## Tasks / Subtasks

- [x] **Task 1: Create tool-loader.ts module** (AC: #1, #2)
  - [x] Create `manda-app/lib/agent/tools/tool-loader.ts`
  - [x] Import `TOOLS_BY_COMPLEXITY` from `intent.ts` (already defined in E13.1)
  - [x] Use existing `getToolByName()` from `all-tools.ts` for tool lookup
  - [x] Implement `getToolsForIntent(intent: EnhancedIntentResult): StructuredToolInterface[]`
  - [x] Implement `getToolsForComplexity(complexity: ComplexityLevel): StructuredToolInterface[]`
  - [x] Add logging for tier selection decisions
  - [x] Export all functions from `tools/index.ts`

- [x] **Task 2: Update executor.ts for dynamic tool loading** (AC: #3)
  - [x] Add optional `complexity?: ComplexityLevel` to `ChatAgentConfig`
  - [x] Modify `createChatAgent()` to call `getToolsForComplexity()` when complexity provided
  - [x] Update tool count validation to be dynamic (current validates against 18)
  - [x] Pass filtered tools to `createReactAgent`
  - [x] Ensure `isolateAllTools()` receives filtered tool array
  - [x] Add `toolCount` to agent metadata for tracing

- [x] **Task 3: Integrate with streamChat flow** (AC: #3, #4)
  - [x] Modify `streamChat()` to classify intent before creating agent
  - [x] Pass complexity from `classifyIntentAsync()` result to agent config
  - [x] Log tool tier selection in LangSmith trace metadata
  - [x] Add tool count to `logLLMUsage()` call

- [x] **Task 4: Implement escalation mechanism** (AC: #5 - partially met)
  - [x] Create `handleToolEscalation(error, currentTier): EscalationResult`
  - [x] Detect tool-not-found errors in agent execution
  - [x] Implement tier progression: simple → medium → complex
  - [x] Log escalation events with full context
  - [x] Add `wasEscalated` and `originalTier` to response metadata
  - [ ] Re-execute with higher tier on escalation (**DEFERRED**: Full retry requires non-trivial refactor of streaming flow; currently logs escalation events for classification improvement)

- [x] **Task 5: Write comprehensive tests** (AC: #6)
  - [x] Create `manda-app/__tests__/lib/agent/tools/tool-loader.test.ts`
  - [x] Test `getToolsForComplexity('simple')` returns empty array
  - [x] Test `getToolsForComplexity('medium')` returns 5 specific tools
  - [x] Test `getToolsForComplexity('complex')` returns all 18 tools
  - [x] Test backward compatibility with undefined complexity
  - [x] Test tool isolation integration
  - [x] Test escalation logic
  - [x] Test tool isolation integration with filtered tools (added in code review)
  - [x] 44 tests passing in tool-loader.test.ts

## Dev Notes

### E13.1 Foundation Already In Place

E13.1 implemented the classification foundation this story builds on:

```typescript
// manda-app/lib/agent/intent.ts (lines 187-197)
export const TOOLS_BY_COMPLEXITY: Record<ComplexityLevel, string[] | 'all'> = {
  simple: [], // No tools - direct LLM response
  medium: [
    'query_knowledge_base',    // Primary knowledge retrieval
    'get_document_info',       // Document metadata lookup
    'get_finding_source',      // Source attribution for findings
    'validate_finding',        // Verify finding accuracy
    'add_qa_item',             // Add Q&A items during conversation
  ],
  complex: 'all', // Full 18 tools or route to specialist (E13.4+)
}

// Helper functions already exported (lines 299-359):
export function hasAllToolsAccess(complexity: ComplexityLevel): boolean
export function getSuggestedTools(complexity: ComplexityLevel): string[]
export function classifyComplexity(message: string): ComplexityResult
```

**DO NOT duplicate these constants. Import and use them from `intent.ts`.**

### Current Tool Registry (18 Tools)

**File: `manda-app/lib/agent/tools/all-tools.ts`**

The codebase has exactly **18 tools** (not 17):

| Category | Tools |
|----------|-------|
| Knowledge | `query_knowledge_base`, `update_knowledge_base`, `validate_finding`, `update_knowledge_graph`, `index_to_knowledge_base` |
| Correction | `correct_finding`, `get_finding_source`, `get_correction_history` |
| Intelligence | `detect_contradictions`, `find_gaps` |
| Document | `get_document_info`, `trigger_analysis` |
| Workflow | `suggest_questions`, `add_to_qa`, `add_qa_item`, `create_irl`, `generate_irl_suggestions`, `add_to_irl` |

Key exports:
- `allChatTools: StructuredToolInterface[]` - Array of all 18 tools
- `TOOL_COUNT = 18` - Constant for validation
- `getToolByName(name: string)` - **USE THIS** for tool lookup (don't create new Map)
- `TOOL_CATEGORIES` - Tools grouped by functional area

### Integration Points

**Tool Loading Flow (New):**
```
streamChat() receives user message
  ↓
classifyIntentAsync(message) → EnhancedIntentResult with complexity
  ↓
getToolsForComplexity(complexity) → filtered tool array (0, 5, or 18 tools)
  ↓
Apply isolation check (disableIsolation flag)
  ↓
isolateAllTools(filteredTools, cache, config) → isolated tools (if enabled)
  ↓
createReactAgent(llm, tools, ...) → agent
  ↓
agent.streamEvents() → response
```

**Escalation Flow (New):**
```
Agent attempts tool call
  ↓
Tool not in current tier (e.g., 'detect_contradictions' in simple tier)
  ↓
Catch tool-not-found error
  ↓
Log escalation event with context
  ↓
Upgrade tier: simple → medium → complex
  ↓
Retry with expanded tool set
```

### Critical Implementation Details

**1. Use Existing Tool Lookup**

The `all-tools.ts` already has `getToolByName()`. Use it:

```typescript
// tool-loader.ts
import { allChatTools, getToolByName } from './all-tools'
import { TOOLS_BY_COMPLEXITY, ComplexityLevel, hasAllToolsAccess } from '../intent'

export function getToolsForComplexity(complexity: ComplexityLevel): StructuredToolInterface[] {
  if (hasAllToolsAccess(complexity)) {
    return allChatTools  // All 18 tools for complex tier
  }

  const toolNames = TOOLS_BY_COMPLEXITY[complexity] as string[]
  return toolNames
    .map(name => getToolByName(name))  // Use existing lookup function
    .filter((tool): tool is StructuredToolInterface => tool !== undefined)
}
```

**2. Executor Integration with Isolation Flag**

Handle both `complexity` and `disableIsolation` correctly:

```typescript
// executor.ts - in createChatAgent()
interface ChatAgentConfig {
  // ... existing fields
  complexity?: ComplexityLevel  // NEW: Optional complexity for tool filtering
}

export function createChatAgent(config: ChatAgentConfig): ChatAgentWithCache {
  const { complexity, disableIsolation, ...restConfig } = config

  // Step 1: Get base tools based on complexity (default to all if not provided)
  const baseTools = complexity
    ? getToolsForComplexity(complexity)
    : allChatTools

  // Step 2: Apply isolation if not disabled
  const tools = disableIsolation
    ? baseTools
    : isolateAllTools(baseTools, toolResultCache, isolationConfig)

  // Log tool selection for debugging and LangSmith
  console.log(`[Agent] Complexity: ${complexity ?? 'all'}, Tools: ${baseTools.length}`)

  // ... rest of existing logic with `tools` variable
}
```

**3. Escalation Detection**

LangGraph ReAct agents throw specific errors when tool not found:

```typescript
function isToolNotFoundError(error: unknown): boolean {
  return error instanceof Error &&
    (error.message.includes('Tool') && error.message.includes('not found')) ||
    error.message.includes('is not a valid tool')
}

function getNextTier(current: ComplexityLevel): ComplexityLevel {
  const progression: Record<ComplexityLevel, ComplexityLevel> = {
    simple: 'medium',
    medium: 'complex',
    complex: 'complex',  // Already at max
  }
  return progression[current]
}

// In streamChat error handler
catch (error) {
  if (isToolNotFoundError(error) && currentTier !== 'complex') {
    console.warn(`[Escalation] Tool not found in ${currentTier} tier, escalating to ${getNextTier(currentTier)}`)
    return streamChat(agent, input, history, callbacks, {
      ...options,
      complexity: getNextTier(currentTier),
      wasEscalated: true,
      originalTier: currentTier
    })
  }
  throw error
}
```

### Backward Compatibility Requirements

**All existing callers must continue working without changes:**

1. `ChatAgentConfig.complexity` must be **optional** (default undefined = all tools)
2. Existing tests must pass without modification
3. When `complexity` is undefined, behavior identical to current implementation
4. Tool isolation behavior unchanged (controlled by `disableIsolation` flag)

### Project Structure Notes

**New File:**
- `manda-app/lib/agent/tools/tool-loader.ts` - Tool tier logic

**Modified Files:**
- `manda-app/lib/agent/executor.ts` - Add complexity config, use dynamic tools
- `manda-app/lib/agent/tools/index.ts` - Export tool-loader functions

**DO NOT Modify:**
- `manda-app/lib/agent/intent.ts` - Already complete from E13.1
- `manda-app/lib/agent/tools/all-tools.ts` - Keep static registry intact
- `manda-app/lib/agent/tool-isolation.ts` - Isolation logic unchanged

### Testing Strategy

**Unit Tests (tool-loader.test.ts):**
```typescript
import { getToolsForComplexity } from '../tool-loader'
import { allChatTools } from '../all-tools'

describe('getToolsForComplexity', () => {
  it('returns empty array for simple complexity', () => {
    const tools = getToolsForComplexity('simple')
    expect(tools).toHaveLength(0)
  })

  it('returns 5 specific tools for medium complexity', () => {
    const tools = getToolsForComplexity('medium')
    expect(tools).toHaveLength(5)
    const names = tools.map(t => t.name)
    expect(names).toContain('query_knowledge_base')
    expect(names).toContain('get_document_info')
    expect(names).toContain('get_finding_source')
    expect(names).toContain('validate_finding')
    expect(names).toContain('add_qa_item')
  })

  it('returns all 18 tools for complex complexity', () => {
    const tools = getToolsForComplexity('complex')
    expect(tools).toHaveLength(18)
    expect(tools).toEqual(allChatTools)
  })

  it('defaults to all tools when complexity undefined', () => {
    // This tests backward compatibility via executor integration
  })
})

describe('tool escalation', () => {
  it('escalates from simple to medium on tool not found', () => {
    // Mock agent throwing tool not found error
    // Verify retry with medium tier
  })

  it('escalates from medium to complex on tool not found', () => {
    // Mock agent throwing tool not found error
    // Verify retry with complex tier
  })

  it('does not escalate when already at complex tier', () => {
    // Verify error propagates instead of infinite loop
  })
})
```

**Integration Tests (executor.test.ts):**
- Mock `createReactAgent` to capture passed tools
- Verify correct tool count for each complexity level
- Verify tool isolation still applied to filtered tools

### Token Savings Measurement

To verify token reduction in tests and LangSmith:

```typescript
// Approximate token calculation for tool schemas
function estimateToolTokens(tools: StructuredToolInterface[]): number {
  // Each tool contributes ~200-400 tokens (name, description, schema)
  return tools.reduce((sum, tool) => {
    const schemaTokens = JSON.stringify(tool.schema).length / 4  // ~4 chars per token
    const descTokens = (tool.description?.length ?? 0) / 4
    return sum + schemaTokens + descTokens + 20  // 20 for name/metadata
  }, 0)
}

// Expected savings
// Simple: 0 tools → saves ~3,500 tokens (100%)
// Medium: 5 tools → saves ~2,500 tokens (~70%)
// Complex: 18 tools → baseline (no savings)
```

**LangSmith Verification:**
After implementation, run test queries and verify in LangSmith dashboard:
1. Simple query → trace shows `toolCount: 0`
2. Medium query → trace shows `toolCount: 5`
3. Complex query → trace shows `toolCount: 18`

### Anti-Patterns to Avoid

1. **DO NOT** create a new tool registry - use existing `allChatTools`
2. **DO NOT** duplicate `TOOLS_BY_COMPLEXITY` - import from `intent.ts`
3. **DO NOT** create new tool lookup Map - use existing `getToolByName()`
4. **DO NOT** modify tool definitions - only filter the array
5. **DO NOT** skip tool isolation for filtered tools - apply to whatever tools are selected
6. **DO NOT** hardcode tool counts - derive from constants (`TOOL_COUNT = 18`)
7. **DO NOT** break backward compatibility - undefined complexity = all tools
8. **DO NOT** ignore `disableIsolation` flag when adding complexity logic

### Performance Expectations

| Complexity | Tool Count | Estimated Token Savings | Target TTFT |
|------------|------------|------------------------|-------------|
| simple     | 0          | ~3,500 tokens (100%)   | <500ms      |
| medium     | 5          | ~2,500 tokens (~70%)   | <3s         |
| complex    | 18         | 0 tokens (baseline)    | 5-15s       |

### References

- [Source: manda-app/lib/agent/intent.ts:187-197] - TOOLS_BY_COMPLEXITY constant
- [Source: manda-app/lib/agent/intent.ts:199-207] - MODEL_BY_COMPLEXITY constant
- [Source: manda-app/lib/agent/intent.ts:259-297] - classifyComplexity function
- [Source: manda-app/lib/agent/intent.ts:299-359] - Helper functions (hasAllToolsAccess, getSuggestedTools, getSuggestedModel)
- [Source: manda-app/lib/agent/tools/all-tools.ts:79-136] - allChatTools array (18 tools)
- [Source: manda-app/lib/agent/tools/all-tools.ts:133] - TOOL_COUNT = 18
- [Source: manda-app/lib/agent/tools/all-tools.ts:138-140] - getToolByName function
- [Source: manda-app/lib/agent/executor.ts:127-163] - createChatAgent function
- [Source: manda-app/lib/agent/executor.ts:266-471] - streamChat function
- [Source: manda-app/lib/agent/tool-isolation.ts:368-374] - isolateAllTools function
- [Source: docs/sprint-artifacts/stories/e13-1-enhanced-intent-classification.md] - E13.1 implementation details
- [Source: docs/sprint-artifacts/epics/epic-E13.md#E13.2] - Epic requirements

### Previous Story Learnings (E13.1)

From E13.1 implementation:
- **Pattern:** Add optional fields for backward compatibility
- **Pattern:** Export both helper functions (hasAllToolsAccess, getSuggestedTools) for API clarity
- **Tests:** Created 80+ tests covering edge cases - follow same thoroughness
- **Code review fixes:** Added helper functions after review - anticipate similar needs
- **Integration:** Keep changes minimal to affected files only
- **Note:** E13.1 originally had wrong tool names in TOOLS_BY_COMPLEXITY - fixed as part of E13.2 story creation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Tool-loader tests: 44 tests passing (41 + 3 added in code review)
- Intent tests: 193 tests passing
- All agent tests: 677 passed, 4 pre-existing failures unrelated to this story

### Completion Notes List

1. **Task 1 Complete**: Created `tool-loader.ts` with tier configuration, `getToolsForComplexity()`, `getToolsForIntent()`, `getToolCountForComplexity()`, escalation helpers (`getNextTier`, `canEscalate`, `isToolNotFoundError`, `handleToolEscalation`), and LangSmith tracing support.

2. **Task 2 Complete**: Updated `executor.ts` - added `complexity?: ComplexityLevel` to `ChatAgentConfig`, updated `createChatAgent()` to use dynamic tool loading based on complexity, added `toolCount` and `complexity` to `ChatAgentWithCache` for tracing.

3. **Task 3 Complete**: Updated `app/api/projects/[id]/chat/route.ts` - integrated `classifyIntentAsync()` before agent creation, passes complexity to `createChatAgent()`, added tool tier metadata to response headers (`X-Tool-Tier`, `X-Tool-Count`, `X-Was-Escalated`) and feature usage logging.

4. **Task 4 Complete**: Implemented escalation detection and logging in chat route error handler. Full retry deferred due to streaming complexity - currently logs escalation events for classification improvement. Functions `handleToolEscalation()`, `isToolNotFoundError()`, `getNextTier()`, `canEscalate()` all implemented and tested.

5. **Task 5 Complete**: Created comprehensive test suite with 41 tests covering all tool-loader functionality including tier configurations, tool filtering, backward compatibility, escalation logic, and LangSmith tracing.

6. **E13.1 Bug Fix**: Fixed `TOOLS_BY_COMPLEXITY.medium` in `intent.ts` to use actual tool names (replaced non-existent `search_knowledge_graph`, `get_finding`, `get_qa_item` with `get_finding_source`, `validate_finding`, `add_qa_item`).

### Code Review Fixes (2026-01-06)

1. **Removed TOKEN DEBUG block** (`executor.ts:360-434`): Removed 75-line debug logging block that was marked "remove after debugging" and used hardcoded `allChatTools.length` instead of respecting tier-based tool loading.

2. **Removed unused imports** (`executor.ts`): Removed `estimateMessagesTokens` and `PreModelHookResult` imports that were only used by the removed debug block.

3. **Fixed comment** (`intent.ts:309`): Changed "17 tools" to "18 tools" in code comment.

4. **Added tool isolation integration tests** (`tool-loader.test.ts`): Added 3 tests verifying `isolateAllTools()` works correctly with filtered tool sets for simple, medium, and complex tiers.

5. **Clarified task 4.5 status**: Marked escalation retry subtask as deferred (not complete) with explanation of why full retry is not yet implemented.

### File List

**New Files:**
- `manda-app/lib/agent/tools/tool-loader.ts` - Tool tier logic and escalation helpers
- `manda-app/__tests__/lib/agent/tools/tool-loader.test.ts` - 41 comprehensive tests

**Modified Files:**
- `manda-app/lib/agent/executor.ts` - Added complexity config, dynamic tool loading
- `manda-app/lib/agent/tools/index.ts` - Export tool-loader functions
- `manda-app/lib/agent/intent.ts` - Fixed TOOLS_BY_COMPLEXITY.medium tool names (E13.1 bug)
- `manda-app/app/api/projects/[id]/chat/route.ts` - Integrated intent classification and tool tier metadata
- `docs/sprint-artifacts/stories/e13-1-enhanced-intent-classification.md` - Added post-implementation fix note
- `docs/sprint-artifacts/sprint-status.yaml` - Status: ready-for-dev → in-progress → review

