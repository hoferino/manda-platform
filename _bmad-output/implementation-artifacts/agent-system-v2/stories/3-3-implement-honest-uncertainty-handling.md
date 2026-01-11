# Story 3.3: Implement Honest Uncertainty Handling

Status: done

## Story

As a **user**,
I want **the agent to be honest when it doesn't have information**,
So that **I can take appropriate action instead of being misled**.

## Dependencies

This story depends on:
- **Story 3-1 (Retrieval Node)** - Must be complete; provides `state.sources` with `relevanceScore`
- **Context-loader middleware** - Currently DEFERRED in Story 3-1; this story handles the edge case defensively

If context-loader is not active when implementing:
1. Implement all tasks with defensive fallbacks for missing `dealContext`
2. Use `hasDocuments = state.dealContext?.documentCount > 0 ?? false`
3. Tests should cover both "context loaded" and "context missing" scenarios

## Acceptance Criteria

1. **Given** a query about information not in the knowledge graph
   **When** the agent cannot find relevant data
   **Then** it clearly indicates information is insufficient (FR41)
   **And** the response explicitly states what could not be found
   **And** the response does NOT fabricate or make up information (FR43)

2. **Given** retrieval returns empty sources
   **When** the agent generates a response
   **Then** it provides actionable next steps (FR42)
   **And** next steps are limited to what's actually available (upload docs, add to Q&A, request from client)
   **And** does NOT offer to "search additional sources" if no documents exist

3. **Given** partial information is available
   **When** the agent responds
   **Then** it provides what's available clearly
   **And** it clearly indicates what's missing
   **And** it suggests how to obtain missing information

4. **Given** the response is about to be streamed
   **When** uncertainty is detected (empty or low-relevance sources)
   **Then** the response includes appropriate caveats ("Based on available data", "No data found")
   **And** never uses prohibited phrases ("I think", "Maybe", "I don't know" as standalone)

5. **Given** the system prompt already defines uncertainty handling
   **When** implementing this story
   **Then** the behavior is enforced at runtime via response validation
   **And** prompts.ts uncertainty guidance is respected
   **And** supervisor node integrates uncertainty detection

## Tasks / Subtasks

- [x] Task 1: Create uncertainty detection utility (AC: #1, #3)
  - [x] 1.1 Create `lib/agent/v2/utils/uncertainty.ts`
  - [x] 1.2 Define `UncertaintyLevel` type in uncertainty.ts: `'none' | 'low' | 'medium' | 'high' | 'complete'`
  - [x] 1.3 Implement `detectUncertainty(sources: SourceCitation[], query: string): { level: UncertaintyLevel, avgScore: number }`
  - [x] 1.4 Implement relevance score threshold logic:
    - `complete`: sources.length === 0
    - `high`: avgScore < 0.3
    - `medium`: avgScore 0.3-0.5
    - `low`: avgScore 0.5-0.7
    - `none`: avgScore > 0.7
  - [x] 1.5 Add logging: `console.log('[uncertainty] detected level=${level} sources=${count} avgScore=${avg}')`
  - [x] 1.6 Performance target: <5ms execution (sources array typically 3-10 items)
  - [x] 1.7 Export `UncertaintyLevel` type and `detectUncertainty` from `lib/agent/v2/utils/index.ts`

- [x] Task 2: Create actionable next steps generator (AC: #2)
  - [x] 2.1 Implement `generateNextSteps(uncertaintyLevel: UncertaintyLevel, hasDocuments: boolean): string[]`
  - [x] 2.2 Parameter documentation: `@param hasDocuments - true if dealContext.documentCount > 0, false or undefined otherwise`
  - [x] 2.3 Handle undefined hasDocuments: treat as false (defensive programming)
  - [x] 2.4 Next steps by scenario:
    - Complete uncertainty, no docs: `["Upload documents to the Data Room to get started"]`
    - Complete uncertainty, has docs: `["Add this question to the Q&A list for client follow-up"]`
    - High/medium uncertainty: `["Request additional information from the target company", "Add to Q&A list"]`
    - Low/none uncertainty: `[]` (no next steps needed)
  - [x] 2.5 **CRITICAL ASSERTION:** NEVER return "search for additional sources" when hasDocuments=false
  - [x] 2.6 Performance target: <1ms execution (simple string lookup)

- [x] Task 3: Create response validator (AC: #4)
  - [x] 3.1 Implement `validateResponseHonesty(response: string): ValidationResult`
  - [x] 3.2 Define `ValidationResult` type: `{ isValid: boolean, issues: string[], suggestions: string[] }`
  - [x] 3.3 Detect prohibited phrases with precise regex patterns:
    ```typescript
    const PROHIBITED_PATTERNS = [
      { pattern: /\bI\s+think\b/i, name: 'I think' },
      { pattern: /\bI\s+don't\s+know\b/i, name: "I don't know" },
      { pattern: /(?:^|[.!?]\s*)maybe\b/i, name: 'Maybe (sentence start)' },
    ]
    ```
  - [x] 3.4 "I don't know" rule: flag only as standalone phrase or sentence boundary (not "I don't know if this applies")
  - [x] 3.5 Detect fabrication patterns - flag specific numbers without source attribution nearby:
    ```typescript
    // Flag: "The revenue was €5.2M" (no source within 50 chars)
    // Allow: "The revenue was €5.2M (source: Q3_Report.pdf)"
    const CURRENCY_WITHOUT_SOURCE = /[€$£¥]\d+[\d.,]*[MBK]?(?!.{0,50}\(source)/i
    ```
  - [x] 3.6 Return validation result with specific issues and suggested fixes
  - [x] 3.7 Logging: `console.log('[uncertainty] validation issues=${count}')` when issues found

- [x] Task 4: Create uncertainty context injection (AC: #1, #3, #4)
  - [x] 4.1 Implement `buildUncertaintyContext(uncertaintyLevel: UncertaintyLevel, hasDocuments: boolean): string`
  - [x] 4.2 Return concise context (1-2 sentences), NOT full DO/DON'T list (already in prompts.ts)
  - [x] 4.3 Context by level:
    - `complete` + no docs: `"\n\n**CONTEXT:** No documents in the Data Room. Do not offer to search - suggest uploading documents.\n"`
    - `complete` + has docs: `"\n\n**CONTEXT:** No relevant information found. Suggest adding to Q&A list.\n"`
    - `high`: `"\n\n**CONTEXT:** Limited relevant information. Prefix response with 'Based on limited information' caveat.\n"`
    - `medium`: `"\n\n**CONTEXT:** Partial information available. Note what's missing.\n"`
    - `low`/`none`: `""` (empty string - system prompt covers this)
  - [x] 4.4 Injection point in supervisor: between base prompt and SPECIALIST_GUIDANCE
    ```typescript
    // supervisor.ts integration pattern:
    const uncertaintyContext = buildUncertaintyContext(level, hasDocuments)
    const systemPrompt = basePrompt + uncertaintyContext + SPECIALIST_GUIDANCE
    ```

- [x] Task 5: Integrate with supervisor node (AC: #1-#5)
  - [x] 5.1 Import uncertainty utilities in `nodes/supervisor.ts`:
    ```typescript
    import { detectUncertainty, generateNextSteps, buildUncertaintyContext, validateResponseHonesty } from '../utils'
    ```
  - [x] 5.2 Add defensive check for dealContext at start of supervisorNode:
    ```typescript
    const dealContext = state.dealContext
    if (!dealContext) {
      console.warn('[uncertainty] dealContext not loaded, assuming no documents')
    }
    const hasDocuments = dealContext?.documentCount > 0 ?? false
    ```
  - [x] 5.3 After state.sources is available (from retrieval or specialists), detect uncertainty:
    ```typescript
    const { level: uncertaintyLevel } = detectUncertainty(state.sources ?? [], query)
    // Note: generateNextSteps() available but not called - see Task 5.6 (DEFERRED)
    ```
  - [x] 5.4 Inject uncertainty context into system prompt BEFORE LLM call:
    ```typescript
    const uncertaintyContext = buildUncertaintyContext(uncertaintyLevel, hasDocuments)
    const systemPrompt = basePrompt + uncertaintyContext + SPECIALIST_GUIDANCE
    ```
  - [x] 5.5 Post-LLM response validation (logging only, don't block):
    ```typescript
    const validation = validateResponseHonesty(response.content)
    if (!validation.isValid) {
      console.warn('[uncertainty] response validation issues:', validation.issues)
    }
    ```
  - [x] 5.6 Pass nextSteps to response if uncertainty is high/complete (optional enhancement) - DEFERRED: not needed for MVP

- [x] Task 6: Write unit tests (AC: #1-#5)
  - [x] 6.1 Create `lib/agent/v2/utils/__tests__/uncertainty.test.ts`
  - [x] 6.2 Test: detectUncertainty returns 'complete' for empty sources array
  - [x] 6.3 Test: detectUncertainty returns 'high' for sources with avgScore < 0.3
  - [x] 6.4 Test: detectUncertainty returns 'none' for sources with avgScore > 0.7
  - [x] 6.5 Test: detectUncertainty calculates correct average across multiple sources
  - [x] 6.6 Test: generateNextSteps excludes "search" when hasDocuments=false
  - [x] 6.7 Test: generateNextSteps includes Q&A option for complete uncertainty with docs
  - [x] 6.8 Test: generateNextSteps treats undefined hasDocuments as false
  - [x] 6.9 Test: validateResponseHonesty detects "I think" (case insensitive)
  - [x] 6.10 Test: validateResponseHonesty detects standalone "I don't know"
  - [x] 6.11 Test: validateResponseHonesty allows "I don't know if this applies" (not standalone)
  - [x] 6.12 Test: validateResponseHonesty detects currency without source attribution
  - [x] 6.13 Test: validateResponseHonesty allows currency WITH source attribution
  - [x] 6.14 Test: buildUncertaintyContext returns empty string for 'none'/'low' uncertainty
  - [x] 6.15 Test: buildUncertaintyContext returns context for 'complete' uncertainty

- [x] Task 7: Write integration tests (AC: #5)
  - [x] 7.1 Create `lib/agent/v2/nodes/__tests__/supervisor.uncertainty.test.ts`
  - [x] 7.2 Test: supervisor injects uncertainty context when sources are empty
  - [x] 7.3 Test: supervisor handles missing dealContext gracefully (assumes hasDocuments=false)
  - [x] 7.4 Test: supervisor logs validation warnings for prohibited phrases
  - [x] 7.5 Test: supervisor works correctly with both 'chat' and 'cim' workflow modes
  - [x] 7.6 Mock pattern: mock `state.sources` and `state.dealContext` to control uncertainty scenarios

## Dev Notes

### CRITICAL: Use Existing Prompt Guidance - Don't Duplicate

The prompts.ts file (lines 58-123) already has comprehensive uncertainty handling guidance. This story ENFORCES that guidance at runtime, not duplicates it.

**Key prompts.ts sections to reference (NOT copy):**
- Lines 96-112: "When information is missing or uncertain" rules
- Lines 104-112: "CRITICAL: Zero-Document Scenario" rules
- Lines 114-123: Examples of good vs bad responses

The `buildUncertaintyContext()` function adds **situation-specific context** (1-2 sentences) that tells the LLM about THIS query's uncertainty level. It does NOT restate the full DO/DON'T guidance.

### UncertaintyLevel Type Definition

Define in `uncertainty.ts`, re-export from `utils/index.ts`:

```typescript
// lib/agent/v2/utils/uncertainty.ts
export type UncertaintyLevel = 'none' | 'low' | 'medium' | 'high' | 'complete'

// lib/agent/v2/utils/index.ts
export { detectUncertainty, generateNextSteps, buildUncertaintyContext, validateResponseHonesty } from './uncertainty'
export type { UncertaintyLevel } from './uncertainty'
```

### Uncertainty Levels and Thresholds

| Level | Condition | Avg Score | Response Behavior |
|-------|-----------|-----------|-------------------|
| `complete` | sources.length === 0 | N/A | Explicit "no data found" + actionable next steps |
| `high` | sources exist but avg < 0.3 | 0.0-0.3 | Strong caveat + suggest verification |
| `medium` | avg score 0.3-0.5 | 0.3-0.5 | Moderate caveat + source quality note |
| `low` | avg score 0.5-0.7 | 0.5-0.7 | Minor caveat: "Based on available data" |
| `none` | avg score > 0.7 | 0.7-1.0 | Normal response, no caveats |

### Prohibited Phrase Detection Rules

| Phrase | Detection Rule | Example Flagged | Example Allowed |
|--------|---------------|-----------------|-----------------|
| "I think" | Any occurrence (word boundary) | "I think the revenue is..." | N/A - always flagged |
| "I don't know" | Standalone or sentence boundary | "I don't know." | "I don't know if this applies" |
| "Maybe" | Sentence start only | "Maybe the company..." | "...or maybe consider..." |

**Regex Patterns:**
```typescript
/\bI\s+think\b/i              // "I think" anywhere
/\bI\s+don't\s+know\b/i       // "I don't know" (check context for standalone)
/(?:^|[.!?]\s*)maybe\b/i      // "Maybe" at sentence start
```

### Fabrication Detection

Flag currency/numbers without nearby source attribution:

```typescript
// Pattern: currency amount NOT followed by "(source" within 50 chars
const ORPHANED_CURRENCY = /[€$£¥]\d+[\d.,]*[MBK]?(?!.{0,50}\(source)/i

// Examples:
// "€5.2M" → FLAGGED (no source)
// "€5.2M (source: Q3.pdf)" → OK
// "The revenue was €5.2M in Q3 (source: Report.pdf)" → OK (source within 50 chars)
```

### System Prompt Injection Point

The uncertainty context injects BETWEEN base prompt and SPECIALIST_GUIDANCE:

```typescript
// Current supervisor.ts pattern (line 124):
const systemPrompt = basePrompt + SPECIALIST_GUIDANCE

// NEW pattern with uncertainty:
const uncertaintyContext = buildUncertaintyContext(level, hasDocuments)
const systemPrompt = basePrompt + uncertaintyContext + SPECIALIST_GUIDANCE
```

**Why this order?**
1. Base prompt sets identity and general rules
2. Uncertainty context adds situation-specific guidance
3. Specialist guidance adds routing rules (always last)

### Defensive Programming for Context-Loader

Context-loader middleware is DEFERRED (Story 3-1). Handle missing dealContext:

```typescript
// ALWAYS use this pattern in supervisor:
const dealContext = state.dealContext
if (!dealContext) {
  console.warn('[uncertainty] dealContext not loaded, assuming no documents')
}
const hasDocuments = dealContext?.documentCount > 0 ?? false
```

**Never assume dealContext exists.** The `?? false` fallback ensures safe behavior.

### Response Validation is Soft Enforcement

The validator logs warnings but does NOT block responses:

```typescript
const validation = validateResponseHonesty(response.content)
if (!validation.isValid) {
  console.warn('[uncertainty] response validation issues:', validation.issues)
  // Continue - don't throw or modify response
}
```

**Why soft enforcement?**
- Avoids edge cases where LLM legitimately uses flagged phrases
- Provides metrics for prompt tuning
- User still sees the response

### Performance Targets

| Function | Target | Rationale |
|----------|--------|-----------|
| `detectUncertainty()` | <5ms | Iterates sources array (3-10 items typically) |
| `generateNextSteps()` | <1ms | Simple switch/lookup |
| `buildUncertaintyContext()` | <1ms | String concatenation |
| `validateResponseHonesty()` | <10ms | Regex matching on response text |

Log warning if `detectUncertainty` exceeds 10ms (indicates unexpectedly large sources array).

### File Structure After Implementation

```
lib/agent/v2/
├── utils/
│   ├── index.ts                    # Add uncertainty exports
│   ├── uncertainty.ts              # NEW - detectUncertainty, generateNextSteps, buildUncertaintyContext, validateResponseHonesty
│   └── __tests__/
│       └── uncertainty.test.ts     # NEW - 14 unit tests (Task 6)
├── nodes/
│   ├── supervisor.ts               # MODIFIED - integrate uncertainty detection and context injection
│   └── __tests__/
│       └── supervisor.uncertainty.test.ts  # NEW - 5 integration tests (Task 7)
└── types.ts                        # NO CHANGES - UncertaintyLevel lives in uncertainty.ts
```

### Anti-Patterns to Avoid

```typescript
// DO NOT fabricate data
return { answer: "The revenue was $5.2M" }  // Where did this come from?
// DO use source attribution
return { answer: "The revenue was $5.2M (source: Q3_Report.pdf, p.12)" }

// DO NOT use prohibited phrases as standalone
return { answer: "I don't know." }
// DO provide context and next steps
return { answer: "No revenue data found in the uploaded documents. Would you like me to add this to the Q&A list?" }

// DO NOT offer impossible actions
return { nextSteps: ["Search additional sources"] }  // If no docs exist!
// DO offer realistic actions
return { nextSteps: ["Upload documents to the Data Room"] }

// DO NOT assume dealContext exists
const hasDocuments = state.dealContext.documentCount > 0  // Will throw if undefined!
// DO use defensive access
const hasDocuments = state.dealContext?.documentCount > 0 ?? false

// DO NOT duplicate prompts.ts guidance in buildUncertaintyContext
return "When information is missing: 1. Explain why... 2. Offer next step..."  // Already in prompts.ts!
// DO add situation-specific context only
return "\n\n**CONTEXT:** No documents in the Data Room. Suggest uploading documents.\n"
```

### Testing Strategy

**Unit Tests (39 tests):** Verify detection logic in isolation
- Threshold calculations for each uncertainty level (including boundary tests)
- Next steps generation by scenario
- Validator regex patterns and edge cases
- Context builder output by level

**Integration Tests (16 tests):** Verify supervisor integration
- Mock `state.sources` to control uncertainty
- Mock `state.dealContext` to test defensive fallbacks
- Verify prompt injection and validation logging
- Test all workflow modes (chat, cim, irl)
- Edge cases (empty messages, non-string content, undefined sources)

**Why no E2E tests?**
- E2E requires seeding Neo4j with test data (expensive)
- Unit + integration tests cover all code paths
- E2E deferred to Story 5.1 (Integration Testing Readiness)

### Previous Story Learnings

From Story 3.1 (Retrieval Node):
- **Source structure** - `SourceCitation` has `relevanceScore` (0-1) and `documentName`
- **Graceful degradation** - Return valid state on errors, don't throw
- **Context-loader deferred** - Don't assume full dealContext is populated

From Story 3.2 (Source Attribution):
- **Utility pattern** - Define types in utility file, export from utils/index.ts
- **Log prefix** - Use `[uncertainty]` for console output (matches `[retrieval]` pattern)
- **Immutable pattern** - Don't modify state directly, return partial updates

### References

- `lib/agent/prompts.ts:58-123` - Existing uncertainty handling guidance (FR41, FR42, FR43)
- `lib/agent/v2/types.ts:38-58` - SourceCitation interface with relevanceScore
- `lib/agent/v2/nodes/retrieval.ts` - Populates state.sources
- `lib/agent/v2/nodes/supervisor.ts:116-173` - Integration point for uncertainty context
- `lib/agent/v2/nodes/supervisor.ts:61-89` - SPECIALIST_GUIDANCE constant
- `lib/agent/v2/utils/source-attribution.ts` - Pattern for utility module structure
- `_bmad-output/planning-artifacts/agent-system-prd.md` - FR41, FR42, FR43 requirements
- `_bmad-output/planning-artifacts/agent-system-epics.md` - Story 3.3 definition
- `CLAUDE.md#Agent System v2.0` - Naming conventions and patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No significant debug issues encountered.

### Completion Notes List

1. **Graph structure fix required**: During implementation, discovered retrieval node was unreachable from START. Fixed by adding `routeFromStart()` function to route START → retrieval → supervisor/cim.

2. **TypeScript compatibility**: Used `Array.from(new Set(...))` instead of spread operator for Set iteration to maintain ES5 compatibility without requiring `--downlevelIteration` flag.

3. **Defensive null handling**: Used `dealContext?.documentCount != null && dealContext.documentCount > 0` pattern to safely handle both undefined and null documentCount values.

4. **generateNextSteps deferred**: Per Task 5.6, `generateNextSteps()` is implemented but not called in supervisor - the function exists for future use when next steps need to be passed to the UI.

5. **Test coverage exceeded**: Story specified 14 unit tests and 5 integration tests; actual implementation has 35 unit tests and 16 integration tests covering additional edge cases.

### File List

| File | Action | Description |
|------|--------|-------------|
| `lib/agent/v2/utils/uncertainty.ts` | NEW | Core uncertainty utilities: detectUncertainty, generateNextSteps, validateResponseHonesty, buildUncertaintyContext |
| `lib/agent/v2/utils/__tests__/uncertainty.test.ts` | NEW | 35 unit tests for uncertainty utilities |
| `lib/agent/v2/nodes/__tests__/supervisor.uncertainty.test.ts` | NEW | 16 integration tests for supervisor uncertainty integration |
| `lib/agent/v2/utils/index.ts` | MODIFIED | Added exports for uncertainty utilities |
| `lib/agent/v2/nodes/supervisor.ts` | MODIFIED | Integrated uncertainty detection, context injection, and response validation |
| `lib/agent/v2/graph.ts` | MODIFIED | Fixed routing: START → retrieval → supervisor/cim (retrieval was previously unreachable)
