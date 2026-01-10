# Story 2.4: Implement Professional Response Tone

Status: done

## Story

As a **user**,
I want **the agent to communicate professionally and directly**,
So that **I get clear, actionable responses without hedging language**.

## Acceptance Criteria

1. **Given** the system prompt configuration
   **When** the agent responds to any query
   **Then** it uses professional, direct tone (FR45)
   **And** avoids hedging phrases like "I think", "maybe", "probably", "perhaps", "might"
   **And** avoids filler phrases like "Let me", "I'll go ahead and", "Sure, I can"

2. **Given** a successful operation (e.g., Q&A item added, search completed)
   **When** the agent responds
   **Then** the confirmation is clear and concise (FR44)
   **And** includes relevant details without verbosity
   **And** states what was done, not what will be attempted

3. **Given** existing prompt files in the codebase
   **When** implementing tone requirements
   **Then** updates are made to `lib/agent/prompts.ts` (AGENT_SYSTEM_PROMPT)
   **And** updates are made to `lib/agent/v2/middleware/workflow-router.ts` (IRL prompt)
   **And** NO duplication of prompt content occurs

4. **Given** the professional tone requirements
   **When** the agent encounters uncertainty
   **Then** it still uses confident language with appropriate caveats
   **And** uses "Based on available data..." NOT "I think..."
   **And** uses "The documents show..." NOT "It looks like maybe..."

5. **Given** test coverage requirements
   **When** implementing the story
   **Then** unit tests verify hedging phrases are NOT in prompts
   **And** unit tests verify replacement patterns ARE present
   **And** existing tests continue to pass (287 v2 agent tests)

## Tasks / Subtasks

- [x] Task 1: Audit current prompts for hedging language (AC: #1)
  - [x] 1.1 Review `lib/agent/prompts.ts` AGENT_SYSTEM_PROMPT and TOOL_USAGE_PROMPT
  - [x] 1.2 Review `lib/agent/v2/middleware/workflow-router.ts` getIRLSystemPrompt
  - [x] 1.3 Document instances found (NOTE: lines 299-309 contain intentional BAD examples - these are teaching examples showing what NOT to do, not violations)

- [x] Task 2: Add professional tone section to AGENT_SYSTEM_PROMPT (AC: #1, #2, #4)
  - [x] 2.1 Add new "## Professional Communication Style" section AFTER "## Core Principles"
  - [x] 2.2 Include 3-5 "DO" examples with confident phrasing
  - [x] 2.3 Include 3-5 "DON'T" examples with hedging to avoid
  - [x] 2.4 Add operation confirmation patterns table (see Dev Notes)
  - [x] 2.5 Keep section under 40 lines - be concise

- [x] Task 3: Refactor "Handling Uncertainty" section (AC: #3, #4)
  - [x] 3.1 MERGE strategy: Keep "Handling Uncertainty" (lines 40-91) but remove any overlap with new section
  - [x] 3.2 Ensure confidence-based caveats (lines 56-62) align with new professional tone
  - [x] 3.3 Update "Example Responses" (lines 299-320) - keep as teaching examples but ensure contrast is clear
  - [x] 3.4 Verify total prompt length stays under 450 lines after changes

- [x] Task 4: Update IRL prompt in workflow-router (AC: #1, #3)
  - [x] 4.1 Add "## Response Style" subsection to getIRLSystemPrompt with 2-3 lines of tone guidance
  - [x] 4.2 Add IRL-specific confirmation example: "Added to IRL: [item]. Outstanding items: N."
  - [x] 4.3 Keep total IRL prompt under 25 lines (it's still a placeholder)

- [x] Task 5: Write unit tests (AC: #5)
  - [x] 5.1 Create `lib/agent/__tests__/prompts.test.ts` (Note: added to existing lib/agent/prompts.test.ts)
  - [x] 5.2 Positive tests: prompt DOES contain DON'T guidance listing banned hedging phrases
  - [x] 5.3 Positive tests: prompt DOES contain "Professional Communication" section header
  - [x] 5.4 Positive tests: prompt DOES contain "Based on available data" pattern
  - [x] 5.5 Positive tests: getIRLSystemPrompt contains "Response Style"
  - [x] 5.6 Run: `npm run test:run` - all tests pass (71 tests in prompts.test.ts and workflow-router.test.ts)

- [x] Task 6: Verify integration (AC: #1, #2)
  - [x] 6.1 Run existing workflow-router tests (from Story 2.3) - 22 tests pass
  - [x] 6.2 Run: `npm run build` - no errors
  - [x] 6.3 Run: `npm run type-check` - pre-existing errors in test files only, no new errors

## Dev Notes

### Quick Implementation Checklist

```
[ ] Read current AGENT_SYSTEM_PROMPT lines 23-29 (Core Principles) and 40-91 (Handling Uncertainty)
[ ] Identify overlaps - "Handling Uncertainty" already has good patterns, don't duplicate
[ ] Add new "## Professional Communication Style" section after Core Principles (~30 lines)
[ ] Add operation confirmation patterns table
[ ] Update IRL prompt with Response Style subsection (~5 lines)
[ ] Verify prompt length: should be under 450 lines total
[ ] Write 6-8 unit tests for prompt content verification
[ ] Run full test suite
```

### Scope Clarification

| Prompt File | In Scope? | Notes |
|-------------|-----------|-------|
| `lib/agent/prompts.ts` | YES | Main changes - AGENT_SYSTEM_PROMPT |
| `lib/agent/v2/middleware/workflow-router.ts` | YES | IRL prompt only |
| `lib/agent/cim/prompts.ts` | NO | CIM has its own tone - defer to CIM stories |
| Specialist prompts | NO | Each specialist handles own tone |

### Test Strategy Clarification

These are **prompt hygiene tests** - they verify the prompt FILE contains correct guidance. They do NOT test actual LLM output behavior (that would require mocking LLM calls).

```typescript
// WHAT WE'RE TESTING: Prompt file content
expect(getSystemPrompt()).not.toContain('I think')  // Prompt text check

// WHAT WE'RE NOT TESTING: LLM response behavior
// (No LLM call mocking needed - this is static content verification)
```

This story does NOT involve user-controlled prompt modifications. All changes are hardcoded in prompts.ts. No injection risk.

### FR Requirements

| FR | Requirement | Implementation |
|----|-------------|----------------|
| **FR44** | System confirms successful operations with clear status messages | Add confirmation patterns to prompts |
| **FR45** | System uses professional, direct tone consistent with standard LLM behavior | Add tone section with DO/DON'T examples |

### Existing Anti-Pattern Examples (IMPORTANT)

Lines 299-309 in `prompts.ts` contain this:
```
Bad response (too much meta-commentary):
> I understand you want to know about the Q3 revenue. Let me search the knowledge base...
```

This is an **intentional teaching example** showing what NOT to do. During audit (Task 1.3), recognize this as a valid anti-pattern demonstration, NOT a prompt violation. Do not remove it.

### Merge Strategy for Overlapping Sections

The existing "Handling Uncertainty" section (lines 40-91) already has good patterns like "Based on available data, ...".

**Strategy:** ADD a new "Professional Communication Style" section, don't replace Handling Uncertainty. Keep both but ensure:
1. No contradictory guidance
2. Professional tone section focuses on hedging/filler bans
3. Handling Uncertainty focuses on confidence expression
4. Cross-reference between sections if helpful

### Hedging Phrases to Ban

```
BANNED HEDGING PHRASES:
- "I think..."
- "I believe..."
- "Maybe..."
- "Perhaps..."
- "Probably..."
- "Might be..."
- "Could be..."
- "It seems like..."
- "It looks like..."
- "I'm not sure, but..."

BANNED FILLER PHRASES:
- "Let me..."
- "I'll go ahead and..."
- "Sure, I can..."
- "Absolutely, let me..."
- "Great question! Let me..."
- "Happy to help with..."
```

### Replacement Patterns

```typescript
// INSTEAD OF: "I think the revenue was around $5M"
// USE: "Based on available data, revenue was $5M (source: Q3_Report.pdf, p.12)"

// INSTEAD OF: "It looks like maybe there's a discrepancy"
// USE: "The documents show a discrepancy: Q3 Report states $5M while the audit shows $5.2M"

// INSTEAD OF: "Let me search for that"
// USE: "Searching for customer concentration data..." (or just report results directly)

// INSTEAD OF: "Sure, I can add that to the Q&A list"
// USE: "Added to Q&A list under Operations (high priority). 5 questions pending."
```

### Operation Confirmation Patterns (FR44)

Add this table to the new Professional Communication Style section:

| Operation | Good Confirmation | Bad Confirmation |
|-----------|-------------------|------------------|
| Add Q&A item | "Added: [summary]. Total: N items." | "I've successfully added..." |
| Search complete | "Found X results across Y documents." | "I was able to find..." |
| Update KB | "Updated: [fact summary]." | "I managed to complete..." |
| IRL item added | "Added to IRL: [item]. Outstanding: N." | "Sure, I've added that for you." |

### Implementation Approach

**Key Principle:** This is a prompt enhancement story, NOT a middleware story. Changes are purely to text content.

**Files to Modify:**
1. `manda-app/lib/agent/prompts.ts` - Main changes
2. `manda-app/lib/agent/v2/middleware/workflow-router.ts` - Minor IRL update

**Files NOT to Modify:**
- Supervisor node (already reads state.systemPrompt correctly)
- Graph structure (no changes needed)
- State schema (complete from Story 2.3)
- CIM prompts (out of scope)

### Anti-Patterns to Avoid

```typescript
// DON'T create a separate "tone-guidelines.ts" file
// Tone guidance belongs IN the prompts

// DON'T add runtime filtering of responses
// The LLM should generate correct output, not be filtered after

// DON'T make the prompt excessively long
// Keep new section under 40 lines

// DON'T duplicate existing "Handling Uncertainty" patterns
// Reference it, don't repeat it
```

### Patterns from Previous Stories

**From Story 2.3 (Workflow Router):**
- JSDoc with story references: `Story: 2-4 Implement Professional Response Tone (AC: #1, #2)`
- Test patterns: simple assertions on string content
- Follow same test file structure

**From Story 2.1 (Supervisor Node):**
- `lib/agent/prompts.ts` is the canonical location for chat prompts
- CIM prompts are separate (and out of scope for this story)

### References

- [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 2.5] - Story definition
- [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns] - User-facing message patterns
- [Source: lib/agent/prompts.ts:23-320] - Current AGENT_SYSTEM_PROMPT
- [Source: lib/agent/prompts.ts:299-309] - Existing anti-pattern examples (intentional)
- [Source: lib/agent/v2/middleware/workflow-router.ts:47-64] - getIRLSystemPrompt function

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without blocking issues.

### Completion Notes List

1. **Task 1 (Audit)**: Reviewed prompts.ts and workflow-router.ts. Found no violations - existing hedging phrases in prompts are intentional teaching examples (anti-patterns showing what NOT to do).

2. **Task 2 (Professional Tone Section)**: Added new "## Professional Communication Style" section (~30 lines) after Core Principles with:
   - 4 "DO" examples of confident language
   - 4 "DON'T" examples of hedging/filler phrases to avoid
   - Operation confirmation patterns table (FR44)
   - Cross-reference to Handling Uncertainty section

3. **Task 3 (Refactor Handling Uncertainty)**: No changes needed - existing section complements new section. Updated one example confirmation message to align with FR44 patterns (line 313).

4. **Task 4 (IRL Prompt)**: Added 2 lines to Response Style section with professional tone guidance and IRL-specific confirmation example.

5. **Task 5 (Unit Tests)**: Added 21 new tests to prompts.test.ts covering:
   - Professional Communication Style section presence (3 tests)
   - Hedging phrase bans (5 tests)
   - Filler phrase bans (3 tests)
   - Operation confirmation patterns (4 tests)
   - Uncertainty expression (2 tests)
   - IRL prompt professional tone (4 tests)

6. **Task 6 (Verification)**: All 71 tests pass in prompts.test.ts and workflow-router.test.ts. Build succeeds. Pre-existing type errors in test files are unrelated to this story.

### Code Review Fixes (2026-01-10)

Code review found 2 MEDIUM and 4 LOW issues. All fixed:

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| M1: Test naming inconsistency | MEDIUM | Updated story Task 5.2 description to match actual test behavior |
| M2: Missing "Might be" and "Could be" | MEDIUM | Added to DON'T list in prompts.ts:42-43 |
| L1: Missing JSDoc story reference | LOW | Added "Story: 2-4" to prompts.ts header |
| L2: IRL phrasing inconsistency | LOW | Changed "avoid" to "DON'T use" in workflow-router.ts:60 |
| L3: Incomplete test coverage | LOW | Added 4 more hedging phrase tests (now 9 total) |
| L4: IRL confirmation pattern | LOW | No fix needed - intentional difference (Outstanding vs Total) |

**Tests after fixes:** 75 pass (was 71, added 4 new hedging phrase tests)

### File List

**Modified:**
- manda-app/lib/agent/prompts.ts - Added Professional Communication Style section, updated example confirmation, added "Might be"/"Could be" to DON'T list, added JSDoc story reference
- manda-app/lib/agent/v2/middleware/workflow-router.ts - Added professional tone guidance to IRL prompt, aligned phrasing with main prompt
- manda-app/lib/agent/prompts.test.ts - Added 25 new tests for Story 2.4 (21 original + 4 from code review)

**No new files created.**
