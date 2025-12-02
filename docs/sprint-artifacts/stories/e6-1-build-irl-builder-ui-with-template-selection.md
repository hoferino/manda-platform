# Story 6.1: Build IRL Builder UI with Template Selection

Status: drafted

## Story

As an **M&A analyst**,
I want **to create an Information Request List (IRL) by selecting from pre-built templates or starting with a blank slate**,
so that **I can quickly set up a structured document request list tailored to my deal type without manual data entry**.

## Acceptance Criteria

1. **AC1:** Templates for Tech M&A, Industrial, Pharma, Financial Services exist as JSON files in `/packages/shared/templates/irls/`
2. **AC2:** Each template has categories with 5-10 items per category, including name, description, and priority
3. **AC3:** Template structure follows schema: `{ id, name, description, dealType, categories[].items[] }`
4. **AC4:** API endpoint `GET /api/projects/[id]/irls/templates` returns all available templates
5. **AC5:** Adding a new JSON file to templates folder automatically makes it available via API (no code changes required)
6. **AC6:** Template cards display name, description, and total item count
7. **AC7:** Preview modal shows full template structure (categories, items, priorities)
8. **AC8:** "Use This Template" action creates a new IRL with all template items pre-populated
9. **AC9:** "Custom (Blank)" option creates an empty IRL for manual entry
10. **AC10:** UI is responsive and works on tablet and desktop viewports

## Tasks / Subtasks

- [ ] **Task 1: Create IRL type definitions** (AC: 3)
  - [ ] Create `lib/types/irl.ts` with interfaces: `IRLTemplate`, `IRLTemplateCategory`, `IRLTemplateItem`, `IRL`, `IRLItem`, `IRLProgress`
  - [ ] Add Zod validation schemas for API input/output
  - [ ] Export types from barrel file

- [ ] **Task 2: Create IRL template JSON files** (AC: 1, 2, 3)
  - [ ] Create `packages/shared/templates/irls/` directory
  - [ ] Create `tech-ma.json` - Tech M&A IRL template (categories: Financial, Legal, Technical, Operational, Commercial)
  - [ ] Create `industrial.json` - Industrial IRL template (categories: Financial, Legal, Operations, Environmental, Safety)
  - [ ] Create `pharma.json` - Pharma IRL template (categories: Financial, Legal, Regulatory, R&D, Manufacturing)
  - [ ] Create `financial-services.json` - Financial Services IRL template (categories: Financial, Legal, Compliance, Risk, Operations)
  - [ ] Ensure each template has 5-10 items per category with name, description, priority

- [ ] **Task 3: Implement IRL template service** (AC: 4, 5)
  - [ ] Create `lib/services/irl-templates.ts`
  - [ ] Implement `listTemplates()` - reads all JSON files from templates directory
  - [ ] Implement `getTemplate(templateId)` - loads specific template by ID
  - [ ] Add file system scanning for dynamic template discovery
  - [ ] Write unit tests for template loading

- [ ] **Task 4: Create templates API endpoint** (AC: 4, 5)
  - [ ] Create `app/api/projects/[id]/irls/templates/route.ts`
  - [ ] Implement `GET` handler returning all templates
  - [ ] Implement `GET /[templateId]` for single template preview
  - [ ] Add error handling for missing templates
  - [ ] Write API route tests

- [ ] **Task 5: Create IRLTemplateCard component** (AC: 6)
  - [ ] Create `components/irl/IRLTemplateCard.tsx`
  - [ ] Display template name, description, item count
  - [ ] Add deal type badge (Tech M&A, Industrial, etc.)
  - [ ] Implement hover state and click handler
  - [ ] Write component tests

- [ ] **Task 6: Create IRLTemplateModal component** (AC: 7)
  - [ ] Create `components/irl/IRLTemplateModal.tsx`
  - [ ] Display full template structure with collapsible categories
  - [ ] Show item details (name, description, priority indicator)
  - [ ] Add "Use This Template" and "Cancel" buttons
  - [ ] Implement keyboard dismiss (Escape)
  - [ ] Write component tests

- [ ] **Task 7: Create IRL creation API endpoint** (AC: 8, 9)
  - [ ] Create `app/api/projects/[id]/irls/route.ts`
  - [ ] Implement `POST` handler with body `{ templateId?, title }`
  - [ ] If `templateId` provided: load template and copy items to `irl_items` table
  - [ ] If no `templateId`: create empty IRL
  - [ ] Return created IRL with items
  - [ ] Write API route tests

- [ ] **Task 8: Create template selection page/section** (AC: 6, 8, 9, 10)
  - [ ] Create IRL tab in Deliverables section (`app/projects/[id]/deliverables/page.tsx` or new route)
  - [ ] Implement template grid with IRLTemplateCard components
  - [ ] Add "Custom (Blank)" card option
  - [ ] Handle template selection → modal → creation flow
  - [ ] Add loading states and error handling
  - [ ] Implement responsive grid (1 col mobile, 2 tablet, 3 desktop)

- [ ] **Task 9: Write integration tests** (AC: 1-10)
  - [ ] Test template file discovery
  - [ ] Test API endpoints end-to-end
  - [ ] Test template selection → IRL creation flow
  - [ ] Test responsive layout breakpoints

## Dev Notes

### Architecture Patterns and Constraints

This story establishes the foundation for IRL management in Epic 6. The architecture follows the established patterns from previous epics:

- **Type definitions** follow the pattern established in `lib/types/` (findings.ts, chat.ts) with Zod schemas for runtime validation
- **API routes** follow Next.js 15 App Router conventions at `/api/projects/[id]/irls/`
- **Components** go in `components/irl/` following the established directory structure (components/chat/, components/knowledge-explorer/)
- **Service layer** abstracts data access in `lib/services/` (similar to findings.ts, embeddings.ts)

**Template Storage Decision:**
Templates are stored as static JSON files rather than database records because:
1. Templates are version-controlled with codebase
2. No need for runtime template editing in MVP
3. Simpler deployment - no migration required for new templates
4. Can be extended to database storage in Phase 2 if needed

**Database Schema:**
The `irls` and `irl_items` tables are defined in tech spec but NOT yet migrated. This story does NOT create migrations - it prepares the service layer to use them. E6.2 (IRL Creation and Editing) will apply the migrations.

**Note:** For this story, the IRL creation will save to database AFTER migrations are applied in E6.2. In the meantime, the template selection UI can be built and tested with mock data.

### Project Structure Notes

Based on unified project structure and existing patterns:

```
manda-app/
├── lib/
│   ├── types/irl.ts          # NEW: IRL type definitions
│   └── services/
│       └── irl-templates.ts  # NEW: Template loading service
├── components/irl/
│   ├── IRLTemplateCard.tsx   # NEW: Template card component
│   └── IRLTemplateModal.tsx  # NEW: Template preview modal
├── app/
│   ├── projects/[id]/deliverables/
│   │   └── page.tsx          # EXTEND: Add IRL tab
│   └── api/projects/[id]/irls/
│       └── templates/route.ts # NEW: Templates API
└── packages/shared/templates/irls/
    ├── tech-ma.json          # NEW: Tech M&A template
    ├── industrial.json       # NEW: Industrial template
    ├── pharma.json           # NEW: Pharma template
    └── financial-services.json # NEW: Financial Services template
```

### Testing Standards

Following the testing strategy from tech debt sprint and Epic 5:
- **Unit tests** for service functions using Vitest
- **Component tests** with React Testing Library
- **API route tests** with MSW or direct route handler testing
- Use existing Supabase mock utilities from `__tests__/utils/supabase-mock.ts`

Test file locations:
- `__tests__/lib/services/irl-templates.test.ts`
- `__tests__/components/irl/IRLTemplateCard.test.tsx`
- `__tests__/components/irl/IRLTemplateModal.test.tsx`
- `__tests__/api/irls/templates.test.ts`

### UI Component Patterns

Use existing shadcn/ui components:
- `Card` for template cards
- `Dialog` for preview modal
- `Badge` for deal type and priority indicators
- `Button` for actions
- `Skeleton` for loading states

Responsive grid using Tailwind:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#E6.1] - Authoritative acceptance criteria
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#Data Models and Contracts] - TypeScript type definitions
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#Component Structure] - File locations
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#APIs and Interfaces] - API endpoint specifications
- [Source: docs/manda-architecture.md#Data Room Folder Architecture] - IRL architecture context
- [Source: docs/sprint-artifacts/retrospectives/epic-E5-retrospective.md#Epic 6 Implications] - Prerequisites and patterns from E5

### First Story in Epic Context

This is the first story in Epic 6. Key context from Epic 5 retrospective:

**Prerequisites identified (from E5 retrospective):**
- P1: folders table migration (handled in E6.4)
- P2: irl_items table migration (handled in E6.2)
- P3: GCS folder creation utility (handled in E6.4)
- P4: Regenerate Supabase types after migrations

**This story does NOT require:**
- Database migrations (templates are JSON files)
- GCS integration (that's E6.4)
- irl_items table (IRL creation API can be stubbed or wait for E6.2)

**Component reuse from Epic 5:**
- Dialog/Modal patterns from DocumentPreviewModal
- Badge component styling
- Loading state patterns

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-02 | Story drafted from tech spec E6.1 | SM Agent |
