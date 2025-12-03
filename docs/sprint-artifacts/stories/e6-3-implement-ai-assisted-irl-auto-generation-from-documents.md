# Story 6.3: Implement AI-Assisted IRL Auto-Generation from Documents

Status: done

> **Note:** This corresponds to original E6.8 (AI-Assisted IRL Generation) from the initial epic breakdown. Stories renumbered after E6.1 consolidated template library + selection UI. See [docs/epics.md](../../../epics.md) for mapping.

## Story

As an **M&A analyst**,
I want **the AI to suggest IRL items based on the deal type and uploaded documents**,
so that **I don't miss important items to request during due diligence**.

## Acceptance Criteria

1. **AC1:** "What else should I request?" in chat triggers AI-generated IRL suggestions based on current deal context
2. **AC2:** Suggestions include category, item name, priority (high/medium/low), and rationale explaining why the item is recommended
3. **AC3:** "Add that to my IRL" or similar command adds the suggested item to the user's active IRL
4. **AC4:** Suggestions are tailored to deal type (Tech M&A, Industrial, Pharma, Financial Services)
5. **AC5:** Gap analysis considers uploaded documents - suggestions reflect what's missing based on what has been provided

## Tasks / Subtasks

- [x] **Task 1: Create `generate_irl_suggestions` agent tool** (AC: 1, 2, 4, 5)
  - [x] Create `lib/agent/tools/irl-tools.ts` with new tool definition
  - [x] Define `GenerateIRLSuggestionsInputSchema` in `lib/agent/schemas.ts`
  - [x] Implement input parsing: dealId, currentIRLId (optional), dealType
  - [x] Create structured output type: `IRLSuggestion[]` with category, name, priority, rationale
  - [x] Write unit tests for schema validation (5+ tests)

- [x] **Task 2: Implement deal context gathering** (AC: 4, 5)
  - [x] Fetch current IRL items from `irls` + `irl_items` tables
  - [x] Fetch uploaded documents list from `documents` table for the deal
  - [x] Fetch deal metadata (irl_template, industry) from `deals` table
  - [x] Summarize current state: items already in IRL, document types uploaded
  - [x] Write tests for context gathering functions (6+ tests)

- [x] **Task 3: Implement gap analysis prompt** (AC: 5)
  - [x] Create prompt inline in irl-tools.ts with buildSuggestionPrompt()
  - [x] Include: deal type, current IRL items, uploaded document list
  - [x] Instruct LLM to identify missing categories and items
  - [x] Return structured JSON output with suggestions array
  - [x] Test prompt generation with different deal contexts (5+ tests)

- [x] **Task 4: Implement IRL template comparison** (AC: 4)
  - [x] Load relevant IRL template based on deal type
  - [x] Compare template items against current IRL items (findMissingTemplateItems)
  - [x] Identify template items not present in user's IRL
  - [x] Weight suggestions by template priority
  - [x] Write tests for template comparison logic (5+ tests)

- [x] **Task 5: Implement `add_to_irl` agent tool** (AC: 3)
  - [x] Create tool to add a single IRL item via API
  - [x] Define `AddToIRLInputSchema` with: irlId, category, itemName, priority, description
  - [x] Call createIRLItem service to add item
  - [x] Return confirmation message with added item details
  - [x] Write unit tests (6+ tests)

- [x] **Task 6: Update `workflow-tools.ts` exports** (AC: 1, 3)
  - [x] Export `generateIRLSuggestionsTool` from `workflow-tools.ts`
  - [x] Export `addToIRLTool` from `workflow-tools.ts`
  - [x] Update `all-tools.ts` to include new tools (11 → 13 tools)
  - [x] Update tool count validation and categories
  - [x] Write tests verifying tool registration (3+ tests)

- [x] **Task 7: Enhance system prompt for IRL context** (AC: 1, 2)
  - [x] Update `lib/agent/prompts.ts` with IRL-specific guidance
  - [x] Add examples of IRL suggestion queries user might ask
  - [x] Define expected response format for suggestions
  - [x] Ensure P2/P3 compliant output (structured, sourced, relevant)

- [x] **Task 8: Create IRL API client functions** (AC: 3, 5)
  - [x] Extended `lib/api/irl.ts` with E6.3 functions
  - [x] Implement `getIRLSuggestions(projectId, irlId, dealType)`
  - [x] Implement `addSuggestionToIRL(projectId, irlId, suggestion)`
  - [x] Implement `addMultipleSuggestionsToIRL(projectId, irlId, suggestions)`
  - [x] Write API client tests (8+ tests)

- [x] **Task 9: Write integration tests** (AC: 1-5)
  - [x] Test: Schema validation for GenerateIRLSuggestionsInput
  - [x] Test: Schema validation for AddToIRLInput
  - [x] Test: Tool count is now 13 (updated from 11)
  - [x] Test: IRL tools registered in workflow category
  - [x] Test: Suggestions API endpoint validation

## Dev Notes

### Architecture Patterns and Constraints

This story extends the existing LangChain agent tool architecture from E5.2. The pattern follows:

**Tool Structure:**
- All tools defined using `@langchain/core/tools` `tool()` function
- Input validation via Zod schemas in `lib/agent/schemas.ts`
- Response formatting via `formatToolResponse()` from `lib/agent/tools/utils.ts`
- Error handling via `handleToolError()` utility

**LLM Integration:**
- Use existing `createLLMClient()` from `lib/llm/client.ts` for suggestion generation
- Follow the prompt template pattern from `suggest_questions` tool
- Structured output with JSON parsing for reliable extraction

**Database Schema Considerations:**
The existing `irls` table uses `sections` JSONB column for items (per E6.1 adaptation). E6.2 may migrate to `irl_items` table. This story should:
1. Check if `irl_items` table exists (E6.2 completion)
2. If yes: use normalized table queries
3. If no: fall back to JSONB parsing from `irls.sections`

This flexibility ensures the tool works regardless of E6.2 implementation timing.

### Project Structure Notes

```
manda-app/
├── lib/
│   ├── agent/
│   │   ├── tools/
│   │   │   ├── irl-tools.ts         # NEW: IRL suggestion/add tools
│   │   │   ├── workflow-tools.ts    # MODIFY: Export new tools
│   │   │   └── all-tools.ts         # MODIFY: Register new tools
│   │   ├── schemas.ts               # MODIFY: Add IRL schemas
│   │   └── prompts/
│   │       └── irl-suggestions.ts   # NEW: IRL suggestion prompts
│   ├── api/
│   │   └── irls.ts                  # NEW: IRL API client
│   └── services/
│       └── irl-templates.ts         # EXISTS: Template loading (reuse)
└── __tests__/
    ├── lib/agent/tools/
    │   └── irl-tools.test.ts        # NEW: Tool tests
    └── lib/api/
        └── irls.test.ts             # NEW: API client tests
```

### Testing Standards

Following established patterns from E5:
- **Unit tests**: Mock Supabase client, LLM calls, test tool logic
- **Integration tests**: Use MSW for API mocking, test full flow
- **Evaluation tests**: Manual verification with real LLM (tagged @slow)

Test file locations:
- `__tests__/lib/agent/tools/irl-tools.test.ts`
- `__tests__/lib/api/irls.test.ts`
- `__tests__/integration/irl-suggestions.test.ts`

### UI Integration (Not in Scope)

This story implements **backend tools only**. The chat interface already supports tool invocation via SSE streaming (E5.3). No UI changes required - suggestions appear as agent responses in the existing chat interface.

Future consideration (E6.7 or later): Add IRL sidebar in chat for visual suggestion acceptance.

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#E6.8] - Authoritative acceptance criteria (tech spec uses original numbering)
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#Services and Modules] - Module locations
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#APIs and Interfaces] - API endpoint specifications
- [Source: docs/epics.md#Story E6.3] - Epic story details (updated numbering)
- [Source: manda-app/lib/agent/tools/workflow-tools.ts] - Existing `create_irl` stub to replace
- [Source: manda-app/lib/agent/tools/all-tools.ts] - Tool registration pattern
- [Source: docs/agent-behavior-spec.md] - P2/P3 agent behavior guidelines for responses

### Learnings from Previous Story

**From Story e6-2-implement-irl-creation-and-editing (Status: in-progress)**

E6.2 is in progress at time of drafting. Key considerations:

- **Schema Decision Pending**: E6.2 will determine whether to use `irl_items` table or continue with `irls.sections` JSONB. This story's context gathering must handle both.
- **Database Migrations**: If E6.2 applies migrations 00026-00029, regenerate Supabase types before starting this story.
- **IRL Service Layer**: If E6.2 creates `lib/services/irls.ts`, reuse those functions for item fetching.
- **Component Patterns**: IRLBuilder from E6.2 may provide patterns for item creation if needed.

**From Story e6-1-build-irl-builder-ui-with-template-selection (Status: done)**

- **Template Service**: `lib/services/irl-templates.ts` provides template loading with caching - reuse for template comparison
- **Type Definitions**: `lib/types/irl.ts` has `IRLTemplate`, `IRLTemplateItem` types to reference
- **API Patterns**: `/api/projects/[id]/irls/` routes established for IRL operations
- **Schema Adaptation**: Existing `irls` table uses `name` (not `title`), `sections` JSONB for items

**Key Files from E6.1 to Reuse:**
- `lib/types/irl.ts` - Type definitions
- `lib/services/irl-templates.ts` - Template loading
- `packages/shared/templates/irls/*.json` - Template files for comparison

[Source: stories/e6-1-build-irl-builder-ui-with-template-selection.md#Dev-Agent-Record]
[Source: stories/e6-2-implement-irl-creation-and-editing.md#Learnings from Previous Story]

## Dev Agent Record

### Context Reference

- [e6-3-implement-ai-assisted-irl-auto-generation-from-documents.context.xml](e6-3-implement-ai-assisted-irl-auto-generation-from-documents.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with no blocking issues.

### Completion Notes List

**Implementation Summary:**
- Added 2 new agent tools: `generate_irl_suggestions` and `add_to_irl` (tools 12 and 13)
- Tool count increased from 11 to 13
- All tools follow existing patterns from E5.2 implementation
- Templates from E6.1 reused for comparison logic
- LLM-based gap analysis with template fallback
- 60 new tests across 3 test files, all 1544 total tests pass

**Key Design Decisions:**
1. Used inline prompt in irl-tools.ts rather than separate prompts file for simplicity
2. Implemented hybrid approach: LLM suggestions with template-based fallback
3. Used existing IRL services from E6.2 rather than duplicating logic
4. Deal type mapped from `irl_template` column (not `deal_type` which doesn't exist)

**Acceptance Criteria Verification:**
- AC1 ✅: "What else should I request?" triggers generate_irl_suggestions tool
- AC2 ✅: Suggestions include category, itemName, priority, and rationale
- AC3 ✅: add_to_irl tool adds items to IRL via createIRLItem service
- AC4 ✅: Deal type mapping supports Tech M&A, Industrial, Pharma, Financial
- AC5 ✅: Document list analyzed, IRL items compared against suggestions

### File List

**New Files:**
- `lib/agent/tools/irl-tools.ts` - IRL suggestion and add tools (500+ lines)
- `app/api/projects/[id]/irls/suggestions/route.ts` - Suggestions API endpoint
- `__tests__/lib/agent/irl-tools.test.ts` - Tool schema and integration tests (40+ tests)
- `__tests__/api/irls/suggestions.test.ts` - API endpoint tests

**Modified Files:**
- `lib/agent/schemas.ts` - Added GenerateIRLSuggestionsInputSchema, AddToIRLInputSchema, IRLSuggestionSchema
- `lib/agent/tools/workflow-tools.ts` - Re-exports new IRL tools
- `lib/agent/tools/all-tools.ts` - Tool count 11→13, updated TOOL_CATEGORIES
- `lib/agent/prompts.ts` - Added IRL-specific tool guidance (tools 12, 13)
- `lib/api/irl.ts` - Added E6.3 client functions (getIRLSuggestions, addSuggestionToIRL, etc.)
- `__tests__/llm/agent-tools.test.ts` - Updated expected tool count to 13

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-03 | Story drafted from tech spec E6.8 and epics.md | SM Agent |
| 2025-12-03 | Story context generated, status changed to ready-for-dev | Context Workflow |
| 2025-12-03 | Implementation complete - all 9 tasks done, 1544 tests passing | Dev Agent (Opus 4.5) |
