# Story 8.5: Finding → Q&A Quick-Add

Status: ready-for-dev

## Story

As an analyst,
I want to quickly add inconsistency findings to my Q&A list,
so that I can ask the client to clarify contradictions directly from the Knowledge Explorer.

## Acceptance Criteria

1. **AC1:** Inconsistency findings in the Knowledge Explorer (both FindingCard and FindingsTable) display an "Add to Q&A" button
2. **AC2:** Clicking "Add to Q&A" opens a modal with a pre-drafted question based on the finding text and context
3. **AC3:** The modal pre-selects the Q&A category based on the finding's domain (financial→Financials, legal→Legal, operational→Operations, market→Market, technical→Technology)
4. **AC4:** The user can edit the question, select a different category, and set priority before submitting
5. **AC5:** Submitting the modal calls `createQAItem()` API with `sourceFindingId` set to the finding ID
6. **AC6:** After successful creation, the finding card/row shows a "Q&A exists" indicator with a link to view the Q&A item
7. **AC7:** If a Q&A item already exists for this finding (checked via `sourceFindingId`), show "Q&A item exists" indicator instead of "Add to Q&A" button

## Tasks / Subtasks

- [ ] **Task 1: Create Domain-to-Category Mapping Utility** (AC: #3)
  - [ ] 1.1 Create `lib/utils/finding-qa-mapping.ts` with `mapDomainToQACategory()` function
  - [ ] 1.2 Map: financial→Financials, operational→Operations, market→Market, legal→Legal, technical→Technology
  - [ ] 1.3 Default to 'Operations' for null/unknown domains
  - [ ] 1.4 Write unit tests for mapping function

- [ ] **Task 2: Create Question Drafting Utility** (AC: #2)
  - [ ] 2.1 Create `generateQuestionFromFinding()` function in same utility file
  - [ ] 2.2 Draft question based on finding text, e.g., "Can you clarify the following finding: {finding.text}?"
  - [ ] 2.3 For contradiction-type findings, use specific phrasing: "We found a potential inconsistency: {text}. Can you provide clarification or additional documentation?"
  - [ ] 2.4 Truncate very long finding text (>500 chars) with "..." for the question draft
  - [ ] 2.5 Write unit tests for question generation

- [ ] **Task 3: Create AddToQAModal Component** (AC: #2, #3, #4)
  - [ ] 3.1 Create `components/knowledge-explorer/findings/AddToQAModal.tsx`
  - [ ] 3.2 Accept `finding` and `onClose`, `onSuccess` props
  - [ ] 3.3 Pre-populate question field using `generateQuestionFromFinding()`
  - [ ] 3.4 Pre-select category using `mapDomainToQACategory()`
  - [ ] 3.5 Add priority dropdown (default: medium)
  - [ ] 3.6 Add editable textarea for question with 10-2000 char validation
  - [ ] 3.7 Add submit button with loading state
  - [ ] 3.8 Call `createQAItem()` API on submit with sourceFindingId
  - [ ] 3.9 Show success toast on completion
  - [ ] 3.10 Write component tests (render, pre-population, validation, submit)

- [ ] **Task 4: Create QAExistsIndicator Component** (AC: #6, #7)
  - [ ] 4.1 Create `components/knowledge-explorer/findings/QAExistsIndicator.tsx`
  - [ ] 4.2 Accept `qaItemId` prop, display as badge with link icon
  - [ ] 4.3 On click, navigate to Q&A page with `?itemId={qaItemId}` query param
  - [ ] 4.4 Use Tooltip to show "View Q&A item" on hover
  - [ ] 4.5 Style: purple/violet badge matching Q&A color theme
  - [ ] 4.6 Write component tests

- [ ] **Task 5: Add API to Check Q&A Existence for Finding** (AC: #7)
  - [ ] 5.1 Add GET `/api/projects/[id]/qa/by-finding/[findingId]` endpoint
  - [ ] 5.2 Return `{ exists: boolean, qaItemId?: string }` response
  - [ ] 5.3 Query qa_items table with `source_finding_id = findingId`
  - [ ] 5.4 Add `getQAItemByFindingId()` function to `lib/api/qa.ts`
  - [ ] 5.5 Write API route tests

- [ ] **Task 6: Integrate "Add to Q&A" Button into FindingCard** (AC: #1, #6, #7)
  - [ ] 6.1 Add `qaItemId?: string | null` prop to FindingCard for existing Q&A link
  - [ ] 6.2 Add `onAddToQA?: (finding: Finding) => void` prop
  - [ ] 6.3 In footer actions, show "Add to Q&A" button (MessageSquarePlus icon) when no qaItemId
  - [ ] 6.4 Show QAExistsIndicator when qaItemId is present
  - [ ] 6.5 Add Tooltip "Add to Q&A" on the button
  - [ ] 6.6 Update FindingCard tests

- [ ] **Task 7: Integrate "Add to Q&A" Button into FindingsTable** (AC: #1, #6, #7)
  - [ ] 7.1 Add Q&A column to FindingsTable after Actions column
  - [ ] 7.2 Show "Add" button or QAExistsIndicator based on qa_item_id from data
  - [ ] 7.3 Handle button click to open AddToQAModal
  - [ ] 7.4 Update FindingsTable tests

- [ ] **Task 8: Update FindingsBrowser to Manage Q&A State** (AC: #5, #6)
  - [ ] 8.1 Add state for modal visibility and selected finding
  - [ ] 8.2 Pass `onAddToQA` callback to FindingCard and FindingsTable
  - [ ] 8.3 Render AddToQAModal when open
  - [ ] 8.4 On successful Q&A creation, update the finding's qaItemId in local state
  - [ ] 8.5 Fetch Q&A existence data alongside findings (join or separate query)

- [ ] **Task 9: Batch Q&A Existence Check API** (AC: #7)
  - [ ] 9.1 Add POST `/api/projects/[id]/qa/check-findings` endpoint
  - [ ] 9.2 Accept `{ findingIds: string[] }` body
  - [ ] 9.3 Return `{ results: Record<string, string | null> }` mapping findingId → qaItemId
  - [ ] 9.4 Update `lib/api/qa.ts` with `checkQAExistenceForFindings()` function
  - [ ] 9.5 Call this API when loading findings in FindingsBrowser

- [ ] **Task 10: Write Integration and E2E Tests** (AC: all)
  - [ ] 10.1 Write integration test: Finding with no Q&A shows "Add to Q&A" button
  - [ ] 10.2 Write integration test: Clicking button opens modal with pre-drafted question
  - [ ] 10.3 Write integration test: Submitting creates Q&A item with sourceFindingId
  - [ ] 10.4 Write integration test: Finding with existing Q&A shows indicator
  - [ ] 10.5 Create E2E test scenario in Playwright

- [ ] **Task 11: Verify Build and Types** (AC: all)
  - [ ] 11.1 Run `npm run type-check` - no errors
  - [ ] 11.2 Run unit tests for new components and utilities
  - [ ] 11.3 Run build to ensure no compilation errors

## Dev Notes

### Architecture Patterns and Constraints

- **Component Location:** New components go in `components/knowledge-explorer/findings/` to match existing patterns (FindingCard, FindingActions, etc.)
- **API Pattern:** Follow existing Next.js API routes pattern in `app/api/projects/[id]/qa/`
- **Service Layer:** Use `createQAItem()` from `lib/api/qa.ts` - do not interact with database directly from components
- **Modal Pattern:** Use Dialog component from shadcn/ui following existing modal patterns (AddFindingModal in GapActions)

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#E8.5-Finding-to-Q&A-Quick-Add]

### Domain to Q&A Category Mapping

| Finding Domain | Q&A Category |
|---------------|--------------|
| financial | Financials |
| operational | Operations |
| market | Market |
| legal | Legal |
| technical | Technology |
| null/unknown | Operations (default) |

Note: Finding domains are lowercase (`financial`, `operational`), Q&A categories are PascalCase (`Financials`, `Operations`). The mapping utility must handle this transformation.

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#TypeScript-Types]

### Question Drafting Guidelines

From E8.4 learnings, questions should be:
- **Specific:** Reference the finding text directly
- **Professional:** Formal client-facing language
- **Actionable:** Ask for clarification or documentation

Template patterns:
- Standard: "Can you provide clarification on the following: {finding.text}?"
- Contradiction: "We found a potential inconsistency regarding {topic}. Can you provide additional documentation or clarification?"
- Metric gap: "Can you provide documentation supporting {finding.text}?"

[Source: docs/sprint-artifacts/stories/e8-4-conversational-qa-flow.md#Question-Drafting-Guidelines]

### Project Structure Notes

**New Files:**
- `manda-app/lib/utils/finding-qa-mapping.ts` - Domain-to-category mapping and question drafting
- `manda-app/lib/utils/finding-qa-mapping.test.ts` - Unit tests
- `manda-app/components/knowledge-explorer/findings/AddToQAModal.tsx` - Modal component
- `manda-app/components/knowledge-explorer/findings/QAExistsIndicator.tsx` - Badge/link component
- `manda-app/__tests__/components/knowledge-explorer/findings/AddToQAModal.test.tsx` - Component tests
- `manda-app/__tests__/components/knowledge-explorer/findings/QAExistsIndicator.test.tsx` - Component tests
- `manda-app/app/api/projects/[id]/qa/by-finding/[findingId]/route.ts` - Single finding Q&A check
- `manda-app/app/api/projects/[id]/qa/check-findings/route.ts` - Batch Q&A existence check

**Modified Files:**
- `manda-app/components/knowledge-explorer/findings/FindingCard.tsx` - Add Q&A button/indicator
- `manda-app/components/knowledge-explorer/findings/FindingsTable.tsx` - Add Q&A column
- `manda-app/components/knowledge-explorer/findings/FindingsBrowser.tsx` - Manage modal state
- `manda-app/lib/api/qa.ts` - Add new API functions
- `manda-app/__tests__/components/knowledge-explorer/findings/FindingCard.test.tsx` - Update tests

[Source: docs/sprint-artifacts/tech-spec-epic-E8.md#Services-and-Modules]

### Learnings from Previous Story

**From Story e8-4-conversational-qa-flow (Status: done)**

- **Q&A Category Inference:** `inferQACategoryFromQuery()` utility exists in `lib/agent/utils/qa-category.ts` with 100+ keyword mappings. Can be referenced for domain mapping patterns but domain→category mapping is simpler (direct enum mapping).
- **Question Drafting:** `draftQAQuestion()` utility exists in `lib/agent/utils/qa-question.ts` for agent use. The FindingCard use case is simpler (converting existing finding text to a question).
- **createQAItem API:** Available at `POST /api/projects/[id]/qa` with `sourceFindingId` optional field. Validation ensures question is 10-2000 chars.
- **Tool Count:** Agent now has 17 tools including `add_qa_item` registered in `TOOL_CATEGORIES.qa`.

**New Services/Patterns Available:**
- `lib/services/qa.ts` - Full Q&A CRUD service
- `lib/api/qa.ts` - Client-side API functions including `createQAItem()`
- `lib/types/qa.ts` - QAItem, QACategory types and validation schemas
- `QA_CATEGORY_CONFIG` - Display configuration for category badges

[Source: docs/sprint-artifacts/stories/e8-4-conversational-qa-flow.md#Completion-Notes]

### UI Considerations

- **Button Placement:** In FindingCard footer alongside existing actions (validate, reject, edit)
- **Icon:** Use `MessageSquarePlus` from lucide-react for "Add to Q&A" action
- **Badge Style:** QAExistsIndicator should use purple/violet tones to match Q&A theme (distinct from green=validated, red=rejected, blue=domain)
- **Modal Size:** Use `sm` dialog variant for AddToQAModal - focused form with minimal fields
- **Loading State:** Show spinner on submit button, disable form during submission
- **Success Feedback:** Toast notification "Added to Q&A list" with link to Q&A page

[Source: docs/manda-architecture.md#Frontend-Component-Library]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E8.md#E8.5] - Acceptance criteria AC-8.5.1 through AC-8.5.5
- [Source: docs/epics.md#Story-E8.5] - Story definition and gherkin scenarios
- [Source: manda-app/components/knowledge-explorer/findings/FindingCard.tsx] - Current card implementation
- [Source: manda-app/components/knowledge-explorer/findings/FindingActions.tsx] - Action button patterns
- [Source: manda-app/lib/types/qa.ts] - Q&A types and category definitions
- [Source: manda-app/lib/api/qa.ts] - Existing Q&A API functions
- [Source: docs/sprint-artifacts/stories/e8-4-conversational-qa-flow.md] - Previous story context

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Change Description |
|------|--------|-------------------|
| 2025-12-09 | SM Agent | Initial story creation from Epic 8 tech spec and epics.md |
