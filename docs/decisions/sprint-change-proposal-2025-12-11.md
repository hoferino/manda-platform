# Sprint Change Proposal: IRL Feature UX Pivot

**Date:** 2025-12-11
**Triggered By:** UAT testing feedback - IRL feature doesn't match product vision
**PM:** Max
**Analyst:** Murat (Test Architect)
**Mode:** Incremental Review
**Status:** Approved for Implementation

---

## 1. Issue Summary

### Problem Statement

During manual testing of the IRL feature (Epic E6), the following UX misalignments were identified:

1. **IRL is incorrectly placed in Deliverables tab** - Users don't create multiple IRLs; IRL is created once during project setup
2. **Multi-IRL creation flow is unnecessary** - Only need ONE IRL per project
3. **Filter button is non-functional** - Exists in checklist but doesn't work (needs done/not-done filtering)
4. **Missing CRUD operations in checklist** - No way to add/remove sections or items from IRL checklist in Data Room
5. **Folder coupling confusion** - IRL checklist should be decoupled from folder structure for flexibility

### Context

The issue was discovered on 2025-12-11 during UAT testing after implementing BUG-001 (folder generation fix). User navigated to Deliverables tab and noticed the IRL creation UI doesn't align with actual workflow.

### Evidence

- UX Spec (line 320): "With IRL Template: If user selects an IRL template during project creation, folders are auto-generated"
- UX Spec (line 791): "Step 2: Data Room setup (IRL template, empty project, or upload custom)" - IRL selection happens in wizard
- Current implementation: Deliverables > IRL tab has "Create New IRL" section with template cards (redundant)
- Epic E6.4-AC7: "Filter toggle to show only unfulfilled items" - accepted but not implemented

---

## 2. Impact Analysis

### Epic Impact

**Epic E6: IRL Management & Auto-Generation**

- **E6.1 (IRL Template Library)** - ✅ Keep (used in project creation wizard)
- **E6.2 (Template Selection UI)** - ⚠️ **Move** from Deliverables to Project Wizard only
- **E6.3 (IRL Builder)** - ⚠️ **Remove** from Deliverables, enhance Checklist instead
- **E6.4 (IRL Fulfillment Tracking)** - ⚠️ **Major Enhancement** - add CRUD + filter
- **E6.5 (Folder Management)** - ✅ Keep (no changes)
- **E6.6 (IRL Export)** - ⚠️ **Move** from Deliverables to Checklist
- **E6.7 (IRL Progress Visualization)** - ✅ Keep (already in checklist)

### Story Impact

| Story | Current Status | Impact | Action Required |
|-------|---------------|--------|-----------------|
| E6.1 | ✅ Complete | None | No changes - template library works |
| E6.2 | ✅ Complete | Medium | Remove Deliverables UI, keep wizard integration |
| E6.3 | ✅ Complete | High | Remove IRL Builder from Deliverables entirely |
| E6.4 | 🔧 Partial | **Critical** | Add filter, add section, add item, remove buttons |
| E6.5 | ✅ Complete | None | Folder management stays as-is |
| E6.6 | ✅ Complete | Medium | Move export from Deliverables to Checklist |
| E6.7 | ✅ Complete | Low | Progress bar already working |

### Artifact Conflicts

**UX Design Specification (docs/ux-design-specification.md)**
- Section 5.5 "Deliverables Studio" - Update to remove IRL tab or replace with Q&A only
- Section 5.2 "Data Room - IRL Checklist Panel" - Update to include CRUD operations

**Epic E6 Technical Spec (docs/sprint-artifacts/tech-spec-epic-E6.md)**
- Section "Component Structure" - Remove `IRLBuilder.tsx` from Deliverables path
- Section "APIs and Interfaces" - Add new CRUD endpoints for checklist management
- Section "Workflows and Sequencing" - Update IRL creation flow to reference wizard only

**PRD (docs/manda-prd.md)**
- FR-IRL-001 (IRL Creation) - Clarify single IRL per project model
- FR-IRL-002 (IRL Management) - Update to reflect checklist-based CRUD

### Technical Impact

**Code Changes:**
- Remove components: `IRLTemplateCard.tsx`, `IRLTemplateModal.tsx`, `IRLBuilder.tsx` from Deliverables
- Enhance components: `IRLChecklist.tsx`, `IRLChecklistSection.tsx`, `IRLChecklistItem.tsx`
- Add API routes:
  - `POST /api/projects/[id]/irls/[irlId]/sections`
  - `POST /api/projects/[id]/irls/[irlId]/sections/[sectionId]/items`
  - `DELETE /api/projects/[id]/irls/[irlId]/items/[itemId]`
  - `DELETE /api/projects/[id]/irls/[irlId]/sections/[sectionId]`
  - `GET /api/projects/[id]/irls/[irlId]/export`

**Database Changes:**
- None required - existing `irls`, `irl_items` schema supports this

**Infrastructure:**
- No deployment changes needed

---

## 3. Recommended Approach

### Path Forward: **Direct Adjustment**

**Rationale:**
- Core functionality (IRL creation, folder generation) already works
- Issue is UX placement and missing interactions, not fundamental architecture
- Can be resolved by refactoring UI components and adding CRUD endpoints
- No rollback or scope reduction needed

**Effort Estimate:**
- **Story Points:** 5 (medium complexity)
- **Developer Time:** 2-3 days
- **Risk:** Low (additive changes, no breaking changes)

**Timeline Impact:**
- Minimal - can be completed within current sprint
- Does not block other epics

---

## 4. Detailed Change Proposals

### Change #1: Remove IRL Creation from Deliverables Tab ✅ APPROVED

**Artifact:** UX Design Specification + Epic E6 Stories

**OLD:**
```
### 5.5 Deliverables Studio

Tab 1: IRL (Information Request List)

Template Selection:
- Choose template (Tech M&A, Industrial, Pharma, Custom)
- Preview template structure
- Customize categories and items

IRL Builder:
- Category Sections: Financial, Legal, Operational, etc.
- Per-Category: Add/remove items, mark priority
```

**NEW:**
```
### 5.5 Deliverables Studio

Tab 1: Q&A Management (formerly IRL)

- Manage Q&A lists for seller
- Add/edit/remove questions
- Track responses
- Export to Word/PDF

Note: IRL is now managed exclusively in Data Room checklist sidebar.
IRL template selection happens during project creation wizard (Step 2).
```

**Implementation:**
- Remove routes: `/projects/[id]/deliverables` IRL tab
- Remove components: `IRLTemplateCard.tsx`, `IRLTemplateModal.tsx`, `IRLBuilder.tsx` from Deliverables
- Keep wizard integration: Project creation Step 2 still uses templates
- Update navigation: Remove "IRL" from Deliverables tab menu

---

### Change #2: Enhance IRL Checklist with CRUD Operations ✅ APPROVED

**Artifact:** UX Design Specification + Epic E6.4

**OLD:**
```
Right Panel: Document Checklist

Hierarchical Checklist:
- Mirrors IRL structure
- Status indicators (✓⏱○)
- Expand/collapse categories
```

**NEW:**
```
Right Panel: IRL Checklist

Header:
- Progress: 15/19 items (79%)
- Filter Toggle: [All Items] / [Not Done Only]
- Export Button: Export to Excel/CSV

Hierarchical Checklist:
- Expandable sections (categories)
- Status indicators: ✓ Done / ○ Not Done
- Per-Section Actions:
  - Add Item (+)
  - Remove Section (trash icon)
  - Collapse/Expand (chevron)
- Per-Item Actions:
  - Toggle checkbox (mark done/not done)
  - Remove Item (trash icon on hover)
  - Edit item name (inline edit)

Actions:
- Add Section button (bottom of list)
- Simple text input (no folder linking)
- No document upload integration
```

**Wireframe:**
```
┌───────────────────────────────────────┐
│ IRL CHECKLIST                         │
├───────────────────────────────────────┤
│ Progress: 15/19 (79%) ▓▓▓▓▓░░░        │
│                                       │
│ [All Items ▼] [Export ▼]              │
│ Filter: ○ All  ● Not Done Only       │
├───────────────────────────────────────┤
│                                       │
│ ▼ Financial (5/8)                     │
│   ☑ Balance sheet 2021-2024           │
│   ☑ P&L statements 2021-2024          │
│   ☑ Cash flow statements              │
│   ☐ Tax returns (hover: 🗑️)           │
│   ☐ Audit reports (hover: 🗑️)         │
│   ☐ Debt schedule                     │
│   ☐ Cap table                         │
│   ☐ Revenue breakdown                │
│   [+ Add Item]                        │
│                                       │
│ ▶ Legal (3/5) [🗑️]                    │
│                                       │
│ ▶ Technical (4/4) [🗑️]                │
│                                       │
│ [+ Add Section]                       │
└───────────────────────────────────────┘
```

**Implementation:**

**Component Changes:**
- `IRLChecklist.tsx`:
  - Add filter toggle state
  - Add export button handler
  - Add "Add Section" button
  - Implement filter logic (show/hide checked items)

- `IRLChecklistSection.tsx`:
  - Add "Add Item" button
  - Add "Remove Section" button (trash icon)
  - Handle expand/collapse state

- `IRLChecklistItem.tsx`:
  - Add inline edit mode
  - Add "Remove Item" button (trash icon on hover)
  - Handle checkbox toggle

**New API Endpoints:**
```typescript
// Add section
POST /api/projects/[id]/irls/[irlId]/sections
Request: { name: string }
Response: { id: string, name: string, sortOrder: number }

// Add item to section
POST /api/projects/[id]/irls/[irlId]/sections/[sectionId]/items
Request: { name: string, description?: string, priority?: string }
Response: IRLItem

// Remove item
DELETE /api/projects/[id]/irls/[irlId]/items/[itemId]
Response: { success: boolean }

// Remove section (only if empty)
DELETE /api/projects/[id]/irls/[irlId]/sections/[sectionId]
Response: { success: boolean } | { error: "Section not empty" }

// Export checklist
GET /api/projects/[id]/irls/[irlId]/export?format=excel|csv
Response: File blob
```

**Database Schema (No Changes Required):**
- Existing `irl_items` table supports category field
- Use `category` as section name
- Sort order already exists

---

### Change #3: Update Acceptance Criteria

**Epic E6.4 Updated ACs:**

| AC# | OLD | NEW |
|-----|-----|-----|
| AC7 | Filter toggle to show only unfulfilled items | ✅ Filter toggle: All Items / Not Done Only (functional) |
| AC8 | *(new)* | Can add new section via "Add Section" button |
| AC9 | *(new)* | Can add item to section via "Add Item" button |
| AC10 | *(new)* | Can remove item via trash icon (hover state) |
| AC11 | *(new)* | Can remove section via trash icon (only if empty) |
| AC12 | *(new)* | Can edit item name via inline edit |
| AC13 | *(new)* | Can export checklist to Excel/CSV |

---

## 5. Implementation Handoff

### Change Scope Classification: **Minor**

**Justification:**
- UI refactoring (remove Deliverables IRL tab)
- Additive changes (enhance checklist with CRUD)
- No data migrations required
- No breaking API changes
- Low risk, high value

### Handoff: Development Team

**Deliverables:**
1. Updated UX Design Specification (docs/ux-design-specification.md)
2. Updated Epic E6 Technical Spec (docs/sprint-artifacts/tech-spec-epic-E6.md)
3. Updated Epic E6.4 Acceptance Criteria
4. This Sprint Change Proposal

**Implementation Tasks:**

**Task 1: Remove IRL from Deliverables** (1 day)
- Remove Deliverables > IRL tab route
- Remove components: `IRLTemplateCard`, `IRLTemplateModal`, `IRLBuilder`
- Update navigation menu
- Update tests

**Task 2: Enhance IRL Checklist** (2 days)
- Add filter toggle UI + logic
- Add "Add Section" button + modal/inline input
- Add "Add Item" button (per section)
- Add "Remove" buttons (sections + items)
- Add inline edit for items
- Add export button + dropdown
- Implement API endpoints
- Update tests

**Task 3: Update Documentation** (0.5 days)
- Update UX spec
- Update tech spec
- Update PRD (if needed)
- Update acceptance criteria

### Success Criteria

✅ **Definition of Done:**
1. Deliverables tab no longer has IRL creation UI
2. IRL checklist has functional filter toggle (All / Not Done)
3. Users can add sections via "Add Section" button
4. Users can add items via "Add Item" button (per section)
5. Users can remove items via trash icon
6. Users can remove empty sections via trash icon
7. Users can edit item names inline
8. Users can export checklist to Excel/CSV
9. All existing IRL functionality still works (project creation wizard, folder generation)
10. All tests pass

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Removing Deliverables IRL breaks existing flows | Low | Medium | Audit all IRL references, ensure wizard flow still works |
| CRUD endpoints introduce data corruption | Low | High | Add validation, transaction safety, comprehensive tests |
| Export generation fails for large IRLs | Medium | Low | Add timeout handling, background job if needed |
| Filter logic breaks progress calculation | Low | Medium | Separate filter (UI) from progress (data) logic |

---

## 7. Testing Strategy

### Manual Test Cases

**T1: IRL Creation (Regression)**
- Create new project via wizard
- Select IRL template in Step 2
- Verify folders generated
- Verify checklist populated in Data Room

**T2: Filter Toggle**
- Navigate to Data Room > IRL Checklist
- Click "Not Done Only" filter
- Verify only unchecked items visible
- Verify progress bar unchanged

**T3: Add Section**
- Click "Add Section" button
- Enter section name "New Category"
- Verify section appears in checklist
- Verify section is collapsible

**T4: Add Item**
- Expand "Financial" section
- Click "Add Item" button
- Enter item name "Revenue forecast"
- Verify item appears unchecked

**T5: Remove Item**
- Hover over item
- Click trash icon
- Confirm deletion
- Verify item removed, progress updated

**T6: Remove Section**
- Attempt to remove non-empty section
- Verify error: "Remove all items first"
- Remove all items
- Remove section
- Verify section deleted

**T7: Export Checklist**
- Click "Export" dropdown
- Select "Excel"
- Verify download starts
- Verify Excel file contains all sections/items

### Automated Tests

**Unit Tests:**
- Filter logic (show all vs. not done)
- CRUD API endpoints
- Export service (Excel/CSV generation)

**Integration Tests:**
- POST /sections → verify DB record
- DELETE /items → verify cascade/constraints
- GET /export → verify file format

**E2E Tests:**
- Full IRL workflow (wizard → checklist → CRUD → export)

---

## 8. Workflow Completion Summary

**Issue Addressed:** IRL feature UX misalignment (multi-IRL creation, missing checklist CRUD)

**Change Scope:** Minor - UI refactoring + additive enhancements

**Artifacts Modified:**
- UX Design Specification
- Epic E6 Technical Spec
- Epic E6.4 Acceptance Criteria

**Routed To:** Development Team (direct implementation)

**Next Steps:**
1. Developer reviews this proposal
2. Implements Task 1 (remove Deliverables IRL)
3. Implements Task 2 (enhance checklist)
4. Updates documentation
5. Runs test suite
6. Deploys to UAT for validation

---

**✅ Correct Course workflow complete, Max!**

Generated: 2025-12-11
Analyst: Murat (Master Test Architect)
Status: Ready for Implementation
