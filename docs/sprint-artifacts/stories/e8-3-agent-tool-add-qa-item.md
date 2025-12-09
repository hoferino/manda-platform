# Story 8.3: Agent Tool - add_qa_item()

Status: done

## Story

As an analyst,
I want to add Q&A items through chat,
so that I can quickly capture questions during document analysis without switching to the Q&A management UI.

## Acceptance Criteria

1. **AC1:** Agent can call `add_qa_item()` tool with valid parameters (question, category, priority, sourceFindingId)
2. **AC2:** Invalid category or priority values return a clear error message and no item is created
3. **AC3:** When `sourceFindingId` is provided, the Q&A item is correctly linked to the source finding
4. **AC4:** Tool returns lightweight confirmation message including item ID and category (e.g., "Added Q&A item #42 to Financials (High priority)")
5. **AC5:** Tool uses the new `qa_items` table (not the old `qa_lists` table)
6. **AC6:** Tool validates question length (minimum 10 characters)

## Tasks / Subtasks

- [x] **Task 1: Create AddQAItemInput Schema** (AC: #1, #2, #6) ✅
  - [x] 1.1 Add `AddQAItemInputSchema` to `lib/agent/schemas.ts` using existing `QACategorySchema` and `QAPrioritySchema` from `lib/types/qa.ts`
  - [x] 1.2 Include validation: question (min 10, max 2000 chars), category (enum), priority (enum, default medium), sourceFindingId (optional uuid)
  - [x] 1.3 Export `AddQAItemInput` type
  - [x] 1.4 Write unit tests for schema validation (valid input, invalid category, short question)

- [x] **Task 2: Create qa-tools.ts with add_qa_item Tool** (AC: #1, #3, #4, #5) ✅
  - [x] 2.1 Create `lib/agent/tools/qa-tools.ts` file
  - [x] 2.2 Import `createQAItem` from `lib/services/qa.ts`
  - [x] 2.3 Import `AddQAItemInputSchema` from `../schemas`
  - [x] 2.4 Implement `addQAItemTool` using LangChain `tool()` function
  - [x] 2.5 Authenticate user via Supabase and extract dealId from context
  - [x] 2.6 Call `createQAItem` service with mapped input
  - [x] 2.7 Return lightweight response with item ID, category, and priority
  - [x] 2.8 Handle errors using `handleToolError` from utils

- [x] **Task 3: Validate Source Finding Link** (AC: #3) ✅
  - [x] 3.1 When `sourceFindingId` is provided, verify the finding exists via Supabase query
  - [x] 3.2 If finding doesn't exist, return error message without creating Q&A item
  - [x] 3.3 Pass `sourceFindingId` to `createQAItem` service

- [x] **Task 4: Register Tool in all-tools.ts** (AC: #1) ✅
  - [x] 4.1 Import `addQAItemTool` from `./qa-tools`
  - [x] 4.2 Add to `allChatTools` array in workflow tools section
  - [x] 4.3 Added new `TOOL_CATEGORIES.qa` category for add_qa_item
  - [x] 4.4 Update tool count constant to 17 and validation

- [x] **Task 5: Update index.ts Barrel Export** (AC: #1) ✅
  - [x] 5.1 Export `addQAItemTool` and `qaTools` from `./qa-tools`
  - [x] 5.2 Update module documentation comments

- [x] **Task 6: Deprecate Old addToQATool** (AC: #5) ✅
  - [x] 6.1 Add deprecation notice to existing `addToQATool` in `workflow-tools.ts`
  - [x] 6.2 Keep old tool for backward compatibility
  - [x] 6.3 Add comment referencing E8.3 for cleanup

- [x] **Task 7: Write Unit Tests** (AC: all) ✅
  - [x] 7.1 Create `lib/agent/tools/qa-tools.test.ts` (22 tests)
  - [x] 7.2 Test schema validation with all valid parameters
  - [x] 7.3 Test schema validation with optional sourceFindingId
  - [x] 7.4 Test invalid category returns error
  - [x] 7.5 Test invalid priority returns error
  - [x] 7.6 Test question too short returns error
  - [x] 7.7 Test tool registration in allChatTools
  - [x] 7.8 Test tool name and description
  - [x] 7.9 Test tool count validation

- [x] **Task 8: Integration Test** (AC: all) ✅
  - [x] 8.1 Verify tool appears in agent tool list (22 tests pass)
  - [x] 8.2 Tool registration verified via TOOL_CATEGORIES.qa
  - [x] 8.3 Tool count validation passes (17 tools)

- [x] **Task 9: Verify Build and Types** (AC: all) ✅
  - [x] 9.1 Run `npm run type-check` - no errors in new files
  - [x] 9.2 Run `npm run test:run` - 22 tests pass
  - [x] 9.3 Pre-existing type errors in other test files (not related to this story)

## Dev Notes

### Architecture Patterns and Constraints

- **Tool Pattern:** Follow existing tool patterns in `lib/agent/tools/*.ts` (E5.2, E6.3, E7.1)
- **Service Layer:** Use `createQAItem` from `lib/services/qa.ts` (E8.1) - DO NOT interact with database directly
- **Schemas:** Zod schemas in `lib/agent/schemas.ts` with LLM-friendly error messages
- **Authentication:** Use `createClient()` from `@/lib/supabase/server` for server-side auth
- **Response Format:** Use `formatToolResponse()` and `handleToolError()` from `./utils`

[Source: docs/manda-architecture.md#Agent-Layer]

### Key Difference from Old addToQATool

The existing `addToQATool` in `workflow-tools.ts` uses:
- Old `qa_lists` table (wrong schema)
- Expects `answer` field (AI-generated answers)
- Different field mapping

The new `add_qa_item` tool uses:
- New `qa_items` table from E8.1 migration
- No answer field (questions for client)
- `sourceFindingId` linking to findings table
- Status derived from `dateAnswered` (NULL = pending)

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Key-Architectural-Decisions]

### Tool Response Format

Keep responses lightweight for context efficiency:
```
"Added Q&A item #{id} to {category} ({priority} priority)"
```

Example: `"Added Q&A item #a1b2c3d4 to Financials (High priority)"`

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#AC-8.3.4]

### Schema Requirements

From tech spec Pydantic models (translate to Zod):
```typescript
// lib/agent/schemas.ts
export const AddQAItemInputSchema = z.object({
  question: z.string()
    .min(10, 'Question must be at least 10 characters')
    .describe('Question for client to answer'),
  category: QACategorySchema.describe('Question category'),
  priority: QAPrioritySchema.default('medium').describe('Priority level'),
  sourceFindingId: z.string().uuid().optional()
    .describe('ID of related finding that triggered this question'),
})
```

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Pydantic-Models]

### Project Structure Notes

New files:
- `manda-app/lib/agent/tools/qa-tools.ts` - New Q&A agent tools module

Modified files:
- `manda-app/lib/agent/schemas.ts` - Add `AddQAItemInputSchema`
- `manda-app/lib/agent/tools/all-tools.ts` - Register new tool
- `manda-app/lib/agent/tools/index.ts` - Export new tool
- `manda-app/lib/agent/tools/workflow-tools.ts` - Deprecate old tool

Reuse from E8.1:
- `lib/types/qa.ts` - Use `QACategorySchema`, `QAPrioritySchema`, `CreateQAItemInput`
- `lib/services/qa.ts` - Use `createQAItem` function

### Learnings from Previous Story

**From Story e8-2-qa-management-ui (Status: done)**

- **Q&A Service Ready**: `createQAItem()` function at `lib/services/qa.ts` handles database operations
- **Types Available**: `QACategory`, `QAPriority`, `CreateQAItemInput` at `lib/types/qa.ts`
- **Validation Schemas**: `QACategorySchema`, `QAPrioritySchema` already defined with enum values
- **Category Values**: 'Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR'
- **Priority Values**: 'high', 'medium', 'low'
- **Service Interface**: `createQAItem(supabase, dealId, input, userId)` returns `QAItem`

**From Story e8-1-data-model-and-crud-api (Status: done)**

- **Database Table**: `qa_items` table with RLS policies applied (migration 00038)
- **Supabase Types**: Regenerated, no `as any` workarounds needed
- **Optimistic Locking**: Not relevant for tool (new items only)

**Existing Tool Patterns to Follow:**

From `lib/agent/tools/irl-tools.ts` (E6.3):
```typescript
export const addToIRLTool = tool(
  async (input) => {
    try {
      // 1. Auth check
      // 2. Validate input references (IRL exists)
      // 3. Call service function
      // 4. Return formatted response
    } catch (err) {
      return handleToolError(err, 'add_to_irl')
    }
  },
  {
    name: 'add_to_irl',
    description: `...`,
    schema: AddToIRLInputSchema,
  }
)
```

[Source: manda-app/lib/agent/tools/irl-tools.ts]

### Context Extraction for dealId

The tool needs `dealId` from conversation context. Pattern from existing tools:
- Check if dealId is passed in input (explicit)
- Or extract from conversation metadata (current project context)
- Current implementation passes dealId explicitly in input schema

For this story, require `dealId` in input schema like `add_to_qa` does:
```typescript
dealId: z.string().uuid().describe('Project/deal ID')
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#E8.3] - Acceptance criteria AC-8.3.1 through AC-8.3.4
- [Source: docs/epics.md#Story-E8.3] - Story definition and gherkin scenarios
- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Pydantic-Models] - Input/output models
- [Source: manda-app/lib/agent/tools/all-tools.ts] - Tool registration pattern
- [Source: manda-app/lib/agent/tools/irl-tools.ts] - Reference implementation pattern
- [Source: manda-app/lib/services/qa.ts] - Service layer to use
- [Source: manda-app/lib/types/qa.ts] - Type definitions and schemas
- [Source: manda-app/lib/agent/tools/workflow-tools.ts] - Old tool to deprecate

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e8-3-agent-tool-add-qa-item.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with 22 passing tests

### Completion Notes List

1. **Schema Implementation**: Added `AddQAItemInputSchema` to `lib/agent/schemas.ts` with validation for question length (10-2000 chars), category (Financials, Legal, Operations, Market, Technology, HR), priority (high, medium, low with default medium), and optional sourceFindingId (UUID).

2. **Tool Implementation**: Created `lib/agent/tools/qa-tools.ts` with `addQAItemTool` that:
   - Authenticates users via Supabase
   - Validates project exists and user has access
   - Validates sourceFindingId if provided (AC #3)
   - Calls `createQAItem` service from E8.1
   - Returns success with itemId, category, priority, and linked finding status

3. **Tool Registration**: Registered in `all-tools.ts` as the 17th tool, added new `TOOL_CATEGORIES.qa` category, updated barrel exports in `index.ts`.

4. **Deprecation**: Added @deprecated JSDoc to old `addToQATool` in `workflow-tools.ts` with reference to new tool.

5. **Test Results**: 22 unit tests pass covering schema validation, tool registration, and tool count validation.

6. **Pre-existing Issues**: Type errors exist in other test files (`__tests__/` directory) but are not related to this story's implementation.

### File List

**New Files:**
- `manda-app/lib/agent/tools/qa-tools.ts` - New Q&A agent tools module
- `manda-app/lib/agent/tools/qa-tools.test.ts` - Unit tests (22 tests)

**Modified Files:**
- `manda-app/lib/agent/schemas.ts` - Added `AddQAItemInputSchema` and type export
- `manda-app/lib/agent/tools/all-tools.ts` - Registered tool, added qa category, updated count to 17
- `manda-app/lib/agent/tools/index.ts` - Added barrel exports for qa-tools
- `manda-app/lib/agent/tools/workflow-tools.ts` - Added deprecation notice to old addToQATool

## Change Log

| Date | Author | Change Description |
|------|--------|-------------------|
| 2025-12-09 | SM Agent | Initial story creation from Epic 8 tech spec and epics.md |
| 2025-12-09 | Dev Agent (Claude Opus 4.5) | Implementation complete - add_qa_item tool, schema, tests (22 passing) |