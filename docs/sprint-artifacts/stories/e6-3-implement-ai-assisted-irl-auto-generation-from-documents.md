# Story 6.3: Implement AI-Assisted IRL Auto-Generation from Documents

Status: ready-for-dev

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

- [ ] **Task 1: Create `generate_irl_suggestions` agent tool** (AC: 1, 2, 4, 5)
  - [ ] Create `lib/agent/tools/irl-tools.ts` with new tool definition
  - [ ] Define `GenerateIRLSuggestionsInputSchema` in `lib/agent/schemas.ts`
  - [ ] Implement input parsing: dealId, currentIRLId (optional), dealType
  - [ ] Create structured output type: `IRLSuggestion[]` with category, name, priority, rationale
  - [ ] Write unit tests for schema validation (5+ tests)

- [ ] **Task 2: Implement deal context gathering** (AC: 4, 5)
  - [ ] Fetch current IRL items from `irls` + `irl_items` tables (or sections JSONB)
  - [ ] Fetch uploaded documents list from `documents` table for the deal
  - [ ] Fetch deal metadata (deal_type, industry) from `deals` table
  - [ ] Summarize current state: items already in IRL, document types uploaded
  - [ ] Write tests for context gathering functions (6+ tests)

- [ ] **Task 3: Implement gap analysis prompt** (AC: 5)
  - [ ] Create prompt template in `lib/agent/prompts/irl-suggestions.ts`
  - [ ] Include: deal type, current IRL items, uploaded document list
  - [ ] Instruct LLM to identify missing categories and items
  - [ ] Return structured JSON output with suggestions array
  - [ ] Test prompt generation with different deal contexts (5+ tests)

- [ ] **Task 4: Implement IRL template comparison** (AC: 4)
  - [ ] Load relevant IRL template based on deal type
  - [ ] Compare template items against current IRL items
  - [ ] Identify template items not present in user's IRL
  - [ ] Weight suggestions by template priority
  - [ ] Write tests for template comparison logic (5+ tests)

- [ ] **Task 5: Implement `add_to_irl` agent tool** (AC: 3)
  - [ ] Create tool to add a single IRL item via API
  - [ ] Define `AddToIRLInputSchema` with: irlId, category, itemName, priority, description
  - [ ] Call `POST /api/projects/[id]/irls/[irlId]/items` to add item
  - [ ] Return confirmation message with added item details
  - [ ] Write unit tests (6+ tests)

- [ ] **Task 6: Update `workflow-tools.ts` exports** (AC: 1, 3)
  - [ ] Export `generateIRLSuggestionsTool` from `workflow-tools.ts`
  - [ ] Export `addToIRLTool` from `workflow-tools.ts`
  - [ ] Update `all-tools.ts` to include new tools (11 → 13 tools)
  - [ ] Update tool count validation and categories
  - [ ] Write tests verifying tool registration (3+ tests)

- [ ] **Task 7: Enhance system prompt for IRL context** (AC: 1, 2)
  - [ ] Update `lib/agent/prompts.ts` with IRL-specific guidance
  - [ ] Add examples of IRL suggestion queries user might ask
  - [ ] Define expected response format for suggestions
  - [ ] Ensure P2/P3 compliant output (structured, sourced, relevant)

- [ ] **Task 8: Create IRL API client functions** (AC: 3, 5)
  - [ ] Create `lib/api/irls.ts` if not exists
  - [ ] Implement `getIRLItems(irlId)` - fetches all items for an IRL
  - [ ] Implement `addIRLItem(irlId, item)` - adds single item
  - [ ] Implement `getProjectDocuments(projectId)` - fetches document list
  - [ ] Write API client tests (8+ tests)

- [ ] **Task 9: Write integration tests** (AC: 1-5)
  - [ ] Test: "What else should I request?" → returns suggestions
  - [ ] Test: Suggestions match deal type (Tech M&A gets tech-specific items)
  - [ ] Test: Suggestions consider uploaded documents (don't suggest what's already provided)
  - [ ] Test: "Add that to my IRL" → item added to database
  - [ ] Test: Error handling for missing IRL, invalid deal, etc.

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-03 | Story drafted from tech spec E6.8 and epics.md | SM Agent |
| 2025-12-03 | Story context generated, status changed to ready-for-dev | Context Workflow |
