# Epic Technical Specification: IRL Management & Auto-Generation

Date: 2025-12-02
Author: Max
Epic ID: E6
Status: Draft

> **Story Consolidation Note (2025-12-02):** During E6.1 implementation, stories were consolidated from 8 to 7:
> - E6.1 now combines "Create IRL Template Library" (original E6.1) + "Build IRL Template Selection UI" (original E6.2)
> - Sprint-status.yaml and epics.md use the new numbering
> - This tech spec retains original E6.1-E6.8 section headers for reference

---

## Overview

Epic 6 implements the Information Request List (IRL) management workflow for the Manda M&A Platform. This epic enables analysts to create, customize, and track IRLs - the structured lists of documents and information requested from target companies during M&A due diligence.

The key innovation is the **auto-generation of real GCS folders** from uploaded IRL Excel files, creating a ready-to-use Data Room structure. Combined with **manual fulfillment tracking** via an expandable checklist, this gives analysts complete control over document organization while maintaining clear visibility into what's still needed.

This epic delivers on PRD functional requirements FR-IRL-001 through FR-IRL-005, establishing the foundation for the deal workflow that connects document requests to the Data Room infrastructure built in Epic 2.

## Objectives and Scope

### In-Scope

1. **IRL Template Library** - Pre-built templates for Tech M&A, Industrial, Pharma, Financial Services deals
2. **IRL Template Selection UI** - Interface to browse, preview, and select templates
3. **IRL Builder** - Full CRUD for IRL categories and items with drag-and-drop reordering
4. **Manual Status Tracking** - Expandable checklist in Data Room sidebar for manual item completion
5. **Folder Management** - Add, rename, delete folders after initial IRL-based generation
6. **IRL Export** - PDF and Word export of IRL documents
7. **Auto-Folder Generation** - Parse IRL Excel and create real GCS folders + PostgreSQL records
8. **AI-Assisted IRL Suggestions** - Agent tool to suggest missing IRL items based on deal context

### Out-of-Scope

- **Automatic checkbox updates** - No auto-linking between folder uploads and IRL checkboxes (users restructure freely)
- **IRL sharing/collaboration** - Multi-user IRL editing deferred to Phase 2
- **Version control for IRLs** - IRL history tracking deferred
- **External IRL sync** - Integration with external deal management systems deferred
- **IRL analytics dashboard** - Aggregate IRL completion metrics deferred to Phase 2

## System Architecture Alignment

### Architecture Components Referenced

| Component | Role in E6 | Reference |
|-----------|------------|-----------|
| **PostgreSQL (Supabase)** | Stores `irls`, `irl_items`, `folders` tables | Data Layer |
| **Google Cloud Storage** | Real folder paths created for Data Room | File Storage |
| **Next.js 15 Frontend** | IRL Builder UI, Template Selection, Checklist | Frontend Layer |
| **FastAPI Backend** | IRL Excel parsing, export generation | API Gateway |
| **LangChain Agent** | `generate_irl_suggestions` tool | Agent Layer |

### Key Architecture Decisions

1. **Real GCS Folders** - Documents uploaded to folders are stored at `{deal_id}/data-room/{folder.gcs_path}/{filename}` in GCS (not virtual folders)
2. **Manual-Only Tracking** - IRL checklist is independent of folder structure; users manually check items (FR-IRL-002)
3. **PostgreSQL folders table** - Hierarchical folder structure with `parent_id` references and `gcs_path` for each folder
4. **Template Files** - IRL templates stored as JSON in `/packages/shared/templates/irls/`
5. **xlsx Package** - Excel parsing for IRL upload using established xlsx library

## Detailed Design

### Services and Modules

| Module | Responsibility | Location |
|--------|---------------|----------|
| **IRL Template Service** | Load, list, and retrieve IRL templates | `lib/services/irl-templates.ts` |
| **IRL Service** | CRUD operations for IRLs and items | `lib/services/irls.ts` |
| **IRL Parser** | Parse Excel files to extract IRL structure | `lib/services/irl-parser.ts` |
| **Folder Service** | Manage folder hierarchy in PostgreSQL | `lib/services/folders.ts` |
| **GCS Folder Utility** | Create/rename/delete GCS folder prefixes | `lib/storage/gcs-folders.ts` |
| **IRL Export Service** | Generate PDF/Word exports | `lib/services/irl-export.ts` |
| **IRL Suggestions Tool** | Agent tool for AI-assisted IRL generation | `lib/agent/tools/irl-tools.ts` |

### Component Structure

```
manda-app/
├── lib/
│   ├── services/
│   │   ├── irl-templates.ts      # Template loading (E6.1)
│   │   ├── irls.ts               # IRL CRUD (E6.3)
│   │   ├── irl-parser.ts         # Excel parsing (E6.7)
│   │   └── irl-export.ts         # PDF/Word export (E6.6)
│   ├── storage/
│   │   └── gcs-folders.ts        # GCS folder operations (E6.5, E6.7)
│   ├── agent/tools/
│   │   └── irl-tools.ts          # AI suggestions (E6.8)
│   └── types/
│       └── irl.ts                # IRL type definitions
├── components/
│   ├── irl/
│   │   ├── IRLTemplateCard.tsx   # Template preview card (E6.2)
│   │   ├── IRLTemplateModal.tsx  # Template preview modal (E6.2)
│   │   ├── IRLBuilder.tsx        # Main builder component (E6.3)
│   │   ├── IRLCategory.tsx       # Collapsible category (E6.3)
│   │   ├── IRLItem.tsx           # Item row with edit (E6.3)
│   │   ├── IRLChecklist.tsx      # Sidebar checklist (E6.4)
│   │   ├── IRLChecklistItem.tsx  # Checklist item (E6.4)
│   │   └── IRLExportDropdown.tsx # Export options (E6.6)
│   └── data-room/
│       ├── FolderTree.tsx        # Extended for add/rename/delete (E6.5)
│       └── FolderContextMenu.tsx # Right-click menu (E6.5)
└── app/
    ├── projects/[id]/
    │   └── deliverables/
    │       └── page.tsx          # IRL tab (E6.2, E6.3)
    └── api/projects/[id]/
        ├── irls/
        │   ├── route.ts          # IRL CRUD
        │   ├── [irlId]/
        │   │   ├── route.ts      # Single IRL
        │   │   ├── items/route.ts
        │   │   └── export/route.ts
        │   └── templates/route.ts
        └── folders/
            ├── route.ts          # Folder CRUD
            └── [folderId]/route.ts
```

### Data Models and Contracts

#### PostgreSQL Schema (New Tables)

```sql
-- Migration: 00026_create_folders_table.sql
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gcs_path TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_folder_path UNIQUE (deal_id, gcs_path)
);

CREATE INDEX idx_folders_deal ON folders(deal_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);

-- RLS Policy
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view folders for their deals" ON folders
  FOR SELECT USING (
    deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage folders for their deals" ON folders
  FOR ALL USING (
    deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
  );
```

```sql
-- Migration: 00027_create_irls_table.sql
CREATE TABLE irls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  template_type TEXT,
  source_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_irls_deal ON irls(deal_id);

-- RLS Policy
ALTER TABLE irls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view irls for their deals" ON irls
  FOR SELECT USING (
    deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage irls for their deals" ON irls
  FOR ALL USING (
    deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
  );
```

```sql
-- Migration: 00028_create_irl_items_table.sql
CREATE TABLE irl_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  irl_id UUID REFERENCES irls(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  fulfilled BOOLEAN DEFAULT false,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_irl_items_irl ON irl_items(irl_id);
CREATE INDEX idx_irl_items_fulfilled ON irl_items(fulfilled);

-- RLS Policy
ALTER TABLE irl_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view irl_items for their irls" ON irl_items
  FOR SELECT USING (
    irl_id IN (SELECT id FROM irls WHERE deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid()))
  );

CREATE POLICY "Users can manage irl_items for their irls" ON irl_items
  FOR ALL USING (
    irl_id IN (SELECT id FROM irls WHERE deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid()))
  );
```

```sql
-- Migration: 00029_add_folder_id_to_documents.sql
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
```

#### TypeScript Types

```typescript
// lib/types/irl.ts
export interface IRLTemplate {
  id: string;
  name: string;
  description: string;
  dealType: 'tech_ma' | 'industrial' | 'pharma' | 'financial' | 'custom';
  categories: IRLTemplateCategory[];
}

export interface IRLTemplateCategory {
  name: string;
  items: IRLTemplateItem[];
}

export interface IRLTemplateItem {
  name: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface IRL {
  id: string;
  dealId: string;
  title: string;
  templateType?: string;
  sourceFileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IRLItem {
  id: string;
  irlId: string;
  category: string;
  subcategory?: string;
  itemName: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  fulfilled: boolean;
  notes?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  dealId: string;
  parentId?: string;
  name: string;
  gcsPath: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  children?: Folder[];
}

export interface IRLProgress {
  total: number;
  fulfilled: number;
  unfulfilled: number;
  percentComplete: number;
}
```

### APIs and Interfaces

#### IRL API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/api/projects/[id]/irls/templates` | List available templates | - | `IRLTemplate[]` |
| GET | `/api/projects/[id]/irls/templates/[templateId]` | Get template details | - | `IRLTemplate` |
| POST | `/api/projects/[id]/irls` | Create IRL from template or blank | `{ templateId?, title }` | `IRL` |
| GET | `/api/projects/[id]/irls` | List IRLs for project | - | `IRL[]` |
| GET | `/api/projects/[id]/irls/[irlId]` | Get IRL with items | - | `IRL & { items: IRLItem[] }` |
| PUT | `/api/projects/[id]/irls/[irlId]` | Update IRL | `Partial<IRL>` | `IRL` |
| DELETE | `/api/projects/[id]/irls/[irlId]` | Delete IRL | - | `{ success: boolean }` |
| POST | `/api/projects/[id]/irls/[irlId]/items` | Add item | `IRLItem` | `IRLItem` |
| PUT | `/api/projects/[id]/irls/[irlId]/items/[itemId]` | Update item | `Partial<IRLItem>` | `IRLItem` |
| DELETE | `/api/projects/[id]/irls/[irlId]/items/[itemId]` | Delete item | - | `{ success: boolean }` |
| PATCH | `/api/projects/[id]/irls/[irlId]/items/[itemId]/fulfilled` | Toggle item fulfilled | `{ fulfilled: boolean }` | `IRLItem` |
| POST | `/api/projects/[id]/irls/[irlId]/reorder` | Reorder items | `{ items: { id, sortOrder }[] }` | `{ success: boolean }` |
| POST | `/api/projects/[id]/irls/[irlId]/export` | Export IRL | `{ format: 'pdf' \| 'word' }` | File blob |
| POST | `/api/projects/[id]/irls/upload` | Upload Excel IRL | FormData (file) | `IRL & { folders: Folder[] }` |
| GET | `/api/projects/[id]/irls/[irlId]/progress` | Get progress stats | - | `IRLProgress` |

#### Folder API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/api/projects/[id]/folders` | Get folder tree | - | `Folder[]` (nested) |
| POST | `/api/projects/[id]/folders` | Create folder | `{ parentId?, name }` | `Folder` |
| PUT | `/api/projects/[id]/folders/[folderId]` | Rename folder | `{ name }` | `Folder` |
| DELETE | `/api/projects/[id]/folders/[folderId]` | Delete folder | - | `{ success: boolean }` |
| POST | `/api/projects/[id]/folders/[folderId]/move` | Move folder | `{ newParentId }` | `Folder` |

### Workflows and Sequencing

#### IRL Creation from Template

```
User navigates to Deliverables > IRL tab
  ↓
User clicks "Create IRL"
  ↓
Template selection UI shows available templates
  ↓
User previews template (optional)
  ↓
User selects template or "Custom (Blank)"
  ↓
POST /api/projects/[id]/irls { templateId, title }
  ↓
Backend creates IRL record
  ↓
Backend copies template items to irl_items
  ↓
IRL Builder opens with pre-populated items
  ↓
User customizes (add/edit/remove/reorder)
  ↓
User clicks "Save"
  ↓
PUT /api/projects/[id]/irls/[irlId]
```

#### IRL Excel Upload with Folder Generation

```
User uploads IRL Excel file (during project creation or IRL tab)
  ↓
POST /api/projects/[id]/irls/upload (FormData with file)
  ↓
Backend: Parse Excel with xlsx package
  ↓
Extract categories and subcategories from sheet structure
  ↓
Sanitize folder names (lowercase, hyphens, no special chars)
  ↓
BEGIN TRANSACTION
  ↓
Create IRL record in irls table
  ↓
Create irl_items records for each extracted item
  ↓
Create folders records with parent_id hierarchy
  ↓
For each folder: Create GCS prefix (PUT object with trailing /)
  ↓
COMMIT TRANSACTION
  ↓
Return IRL with nested folders structure
  ↓
Frontend: Redirect to Data Room showing new folders
```

#### Manual Fulfillment Tracking Flow

```
User views Data Room
  ↓
Sidebar shows IRL Checklist (collapsed by default)
  ↓
User expands category section
  ↓
User clicks item checkbox
  ↓
PATCH /api/projects/[id]/irls/[irlId]/items/[itemId]/fulfilled
  ↓
Checkbox toggles: unfulfilled ↔ fulfilled
  ↓
Progress bar updates (X/Y fulfilled)
  ↓
(Note: Document uploads do NOT trigger checkbox changes)
```

#### Folder Management Flow

```
User right-clicks folder in Data Room tree
  ↓
Context menu shows: Add Subfolder, Rename, Delete
  ↓
[Add Subfolder]
  POST /api/projects/[id]/folders { parentId, name }
  Create GCS prefix
  Update folder tree UI
  ↓
[Rename]
  PUT /api/projects/[id]/folders/[folderId] { name }
  (GCS path unchanged - only display name changes)
  Update folder tree UI
  ↓
[Delete]
  Check if folder has documents
  If not empty: Show warning "Move or delete documents first"
  If empty: DELETE /api/projects/[id]/folders/[folderId]
  Remove GCS prefix
  Update folder tree UI
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Template list load | < 500ms | Templates are static files, should load instantly |
| IRL Builder render | < 1s | Even with 100+ items, UI should remain responsive |
| Excel parsing | < 5s for 500-row IRL | Reasonable for complex IRL files |
| Folder tree load | < 1s | Nested query with caching |
| Checkbox toggle | < 200ms | Single field update, immediate feedback |
| Drag-and-drop reorder | < 300ms | Optimistic UI update |
| Export generation | < 10s for PDF, < 15s for Word | Large IRLs may take longer |

**Implementation Notes:**
- Use React Query with staleTime for template caching
- Optimistic updates for checkbox changes with rollback on error
- Virtual scrolling if IRL exceeds 100 items
- Background export with progress indicator for large IRLs

### Security

| Requirement | Implementation | PRD Reference |
|-------------|----------------|---------------|
| Data isolation | RLS on folders, irls, irl_items tables | NFR-SEC-001 |
| Deal-level access | All queries filter by deal_id owned by user | NFR-SEC-002 |
| File upload validation | Validate Excel format before processing | NFR-DATA-001 |
| GCS signed URLs | Folder operations use signed URLs with 15min expiry | NFR-SEC-004 |
| Export security | Exported files include deal metadata for audit | NFR-SEC-004 |

**RLS Policy Pattern:**
```sql
-- All E6 tables follow this pattern
deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
```

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| Transactional folder creation | All-or-nothing: IRL + items + folders in single transaction |
| GCS rollback | On transaction failure, cleanup any created GCS prefixes |
| Partial failure recovery | If folder creation fails mid-way, rollback entire operation |
| Export retry | Export endpoint returns 202 Accepted with job ID for large exports |
| Graceful degradation | If GCS unavailable, allow IRL management without folder sync |

### Observability

| Signal | Implementation |
|--------|----------------|
| IRL created | Log: `irl.created { dealId, templateType, itemCount }` |
| IRL uploaded | Log: `irl.uploaded { dealId, fileName, categories, items, folders }` |
| Folder created | Log: `folder.created { dealId, folderId, gcsPath }` |
| Fulfilled toggled | Log: `irl_item.fulfilled_changed { itemId, fulfilled }` |
| Export generated | Log: `irl.exported { irlId, format, duration }` |
| Errors | Log with correlation ID: `irl.error { operation, error, context }` |

**Metrics to Track:**
- IRL completion rate by deal type
- Average items per IRL
- Most common missing categories
- Export format preferences

## Dependencies and Integrations

### New Package Dependencies

| Package | Version | Purpose | Story |
|---------|---------|---------|-------|
| `xlsx` | ^0.18.5 | Excel parsing for IRL upload | E6.7 |
| `pdfmake` | ^0.2.x | PDF export generation | E6.6 |
| `docx` | ^8.x | Word export generation | E6.6 |

### Existing Dependencies Used

| Package | Purpose |
|---------|---------|
| `@google-cloud/storage` | GCS folder creation/deletion |
| `@tanstack/react-virtual` | Virtual scrolling for large IRLs |
| `@dnd-kit/core` | Drag-and-drop reordering |
| `lucide-react` | Status icons, folder icons |
| `zustand` | IRL builder state management |

### Internal Service Dependencies

| Service | Dependency | E6 Usage |
|---------|------------|----------|
| Supabase | Database + Auth | IRLs, items, folders storage |
| GCS | File storage | Folder prefix management |
| LangChain Agent | `create_irl` tool | AI-assisted suggestions (E6.8) |

### Integration Points

| System | Integration | Direction |
|--------|-------------|-----------|
| Data Room (E2) | Folder display uses E6 folders table | E6 → E2 |
| Document Upload (E2) | Documents link to folder_id | E6 → E2 |
| Agent Chat (E5) | `generate_irl_suggestions` tool | E5 ↔ E6 |
| Project Creation | IRL upload during wizard | Wizard → E6 |

## Acceptance Criteria (Authoritative)

### E6.1: Create IRL Template Library

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Templates for Tech M&A, Industrial, Pharma, Financial Services exist as JSON files | Yes |
| AC2 | Each template has categories with 5-10 items per category | Yes |
| AC3 | Template structure includes: name, description, dealType, categories[].items[] | Yes |
| AC4 | API endpoint GET /templates returns all available templates | Yes |
| AC5 | Adding new JSON file to templates folder makes it available via API | Yes |

### E6.2: Build IRL Template Selection UI

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Template cards display name, description, item count | Yes |
| AC2 | Preview modal shows full template structure | Yes |
| AC3 | "Use This Template" creates IRL with template items | Yes |
| AC4 | "Custom (Blank)" option creates empty IRL | Yes |
| AC5 | UI is responsive on tablet and desktop | Yes |

### E6.3: Implement IRL Builder (Add/Edit/Remove Items)

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Can add new categories | Yes |
| AC2 | Can add items within categories | Yes |
| AC3 | Can edit item name, description, priority | Yes |
| AC4 | Can delete items and categories | Yes |
| AC5 | Can drag-and-drop to reorder items | Yes |
| AC6 | Save persists all changes to database | Yes |
| AC7 | Cancel discards unsaved changes | Yes |

### E6.4: Implement IRL Fulfillment Tracking (Manual Checklist)

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Expandable checklist visible in Data Room sidebar | Yes |
| AC2 | Simple checkbox for each item (unchecked = unfulfilled, checked = fulfilled) | Yes |
| AC3 | Clicking checkbox toggles fulfilled state | Yes |
| AC4 | Progress bar shows X/Y items fulfilled (Z%) | Yes |
| AC5 | Document uploads do NOT auto-update checkboxes | Yes |
| AC6 | Category sections are collapsible | Yes |
| AC7 | Filter toggle to show only unfulfilled items | Yes |

### E6.5: Implement Folder Management (Add/Rename/Delete)

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Can add subfolder via context menu or button | Yes |
| AC2 | Can rename folder via inline edit | Yes |
| AC3 | Can delete empty folder | Yes |
| AC4 | Non-empty folder deletion blocked with warning | Yes |
| AC5 | Nested folder hierarchy displays correctly | Yes |
| AC6 | Folders table updated on each operation | Yes |
| AC7 | GCS prefixes created/deleted appropriately | Yes |

### E6.6: Export IRL to PDF/Word

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Export dropdown offers PDF and Word options | Yes |
| AC2 | PDF export includes all categories and items | Yes |
| AC3 | Word export is editable and maintains formatting | Yes |
| AC4 | Export includes priority indicators | Yes |
| AC5 | Export includes project name and date header | Yes |
| AC6 | Item notes included in export | Yes |

### E6.7: Auto-Generate Folder Structure from IRL Upload

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Excel file upload triggers parsing | Yes |
| AC2 | Categories extracted from Excel structure | Yes |
| AC3 | Folders created in both PostgreSQL and GCS | Yes |
| AC4 | Folder names sanitized (lowercase, hyphens) | Yes |
| AC5 | Documents uploaded to folders stored at correct GCS path | Yes |
| AC6 | Malformed Excel file returns clear error | Yes |
| AC7 | Transaction rollback on partial failure | Yes |

### E6.8: AI-Assisted IRL Generation

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | "What else should I request?" triggers suggestions | Yes |
| AC2 | Suggestions include category and priority | Yes |
| AC3 | "Add that to my IRL" adds suggested item | Yes |
| AC4 | Suggestions tailored to deal type | Yes |
| AC5 | Gap analysis considers uploaded documents | Yes |

## Traceability Mapping

| AC | Spec Section | Component/API | Test Type |
|----|--------------|---------------|-----------|
| E6.1-AC1 | Data Models | `packages/shared/templates/irls/*.json` | Unit |
| E6.1-AC4 | APIs | `GET /api/projects/[id]/irls/templates` | Integration |
| E6.2-AC1 | Services | `IRLTemplateCard.tsx` | Component |
| E6.2-AC2 | Services | `IRLTemplateModal.tsx` | Component |
| E6.3-AC1-5 | Workflows | `IRLBuilder.tsx`, `IRLCategory.tsx` | Component |
| E6.3-AC6 | APIs | `PUT /api/projects/[id]/irls/[irlId]` | Integration |
| E6.4-AC1 | Services | `IRLChecklist.tsx` | Component |
| E6.4-AC3 | APIs | `PATCH /items/[itemId]/status` | Integration |
| E6.4-AC5 | Workflows | Manual tracking flow | E2E |
| E6.5-AC1-3 | Services | `FolderTree.tsx`, `FolderContextMenu.tsx` | Component |
| E6.5-AC6 | Data Models | `folders` table operations | Integration |
| E6.5-AC7 | Services | `gcs-folders.ts` | Integration |
| E6.6-AC1-6 | Services | `irl-export.ts` | Unit/Integration |
| E6.7-AC1-5 | Workflows | `irl-parser.ts`, upload flow | Integration |
| E6.7-AC7 | Reliability | Transaction rollback | Integration |
| E6.8-AC1-5 | Services | `irl-tools.ts`, agent integration | Integration |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Excel format variability** - IRLs from different sources have different structures | Medium | Implement flexible parser with heuristics; allow manual correction after upload |
| **GCS prefix race conditions** - Concurrent folder creation may conflict | Low | Use unique GCS paths with deal_id prefix; transaction isolation |
| **Large IRL performance** - IRLs with 500+ items may cause UI lag | Medium | Virtual scrolling, pagination, lazy loading of categories |
| **Export generation time** - Large IRLs with complex formatting may timeout | Low | Background job with polling for status; show progress |

### Assumptions

| Assumption | Impact if Wrong |
|------------|-----------------|
| Users will primarily upload Excel IRLs (not PDF/Word) | Need to add additional parsers |
| IRLs typically have 50-200 items | Performance optimization thresholds may need adjustment |
| Manual status tracking is acceptable (no auto-linking) | Users may request auto-detection of document-to-IRL mapping |
| 4 deal-type templates are sufficient for MVP | May need more specialized templates quickly |
| GCS folder creation is fast enough for inline use | May need async folder creation with progress |

### Open Questions

| Question | Decision Needed By | Proposed Answer |
|----------|-------------------|-----------------|
| Should folder rename update GCS path or just display name? | E6.5 implementation | Display name only - GCS paths are immutable to preserve document links |
| Should IRL export include status column? | E6.6 implementation | Yes, with visual indicators for print |
| How to handle duplicate category names in uploaded Excel? | E6.7 implementation | Append numeric suffix (e.g., "Financial (2)") |
| Should AI suggestions consider external data sources? | E6.8 implementation | MVP: No, just uploaded docs and deal type |

## Test Strategy Summary

### Unit Tests

| Module | Test Focus | Coverage Target |
|--------|------------|-----------------|
| `irl-templates.ts` | Template loading, validation | 90% |
| `irls.ts` | CRUD operations, validation | 85% |
| `irl-parser.ts` | Excel parsing, category extraction, sanitization | 90% |
| `irl-export.ts` | PDF/Word generation, formatting | 80% |
| `gcs-folders.ts` | Folder create/delete operations | 85% |
| `irl-tools.ts` | Suggestion generation, context handling | 80% |

### Component Tests

| Component | Test Cases |
|-----------|------------|
| `IRLTemplateCard` | Render, click handling, responsive layout |
| `IRLBuilder` | Add/edit/delete items, drag-drop reorder, save/cancel |
| `IRLChecklist` | Status toggle, progress calculation, expand/collapse |
| `FolderTree` | Nested display, context menu, add/rename/delete actions |
| `IRLExportDropdown` | Format selection, loading state, download trigger |

### Integration Tests

| Flow | Test Cases |
|------|------------|
| IRL Creation | Template selection → Builder → Save → Verify in DB |
| IRL Upload | Excel upload → Parse → Folders created → Verify GCS paths |
| Status Tracking | Update status → Verify DB → Verify progress calculation |
| Folder Management | Add → Rename → Delete → Verify DB + GCS sync |
| Export | Generate PDF → Verify content → Generate Word → Verify editable |

### E2E Tests (Playwright)

| Scenario | Steps |
|----------|-------|
| Create IRL from template | Navigate to Deliverables → Select template → Customize → Save |
| Upload Excel IRL | Upload file → Verify folders in Data Room → Upload document → Verify GCS path |
| Manual status tracking | Open checklist → Toggle items → Verify progress updates |
| Folder management | Add folder → Rename → Delete empty → Verify non-empty blocked |

### Test Data

- Sample Excel IRL files in `__tests__/fixtures/`
  - `standard-irl.xlsx` - Typical Tech M&A IRL
  - `large-irl.xlsx` - 200+ items for performance testing
  - `malformed-irl.xlsx` - Missing headers, invalid format
- Mock template files for unit tests
- Supabase mock utilities from E5 (`__tests__/utils/supabase-mock.ts`)
