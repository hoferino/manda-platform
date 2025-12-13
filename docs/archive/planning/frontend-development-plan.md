# Manda Frontend Development Plan
## Visual Development Tools → Production Integration

**Document Status:** Final
**Created:** 2025-11-19
**Owner:** Max

---

## Executive Summary

This plan outlines a hybrid approach using **Lovable.dev** for rapid screen prototyping and **v0.dev** for component generation, then integrating into Manda's Next.js 14 production codebase. This strategy accelerates development by 3-4 weeks while maintaining code quality.

**Timeline:** 4 weeks to production-ready frontend
**Tools:** Lovable.dev, v0.dev, NextLovable converter, shadcn/ui
**Output:** Next.js 14 app integrated with FastAPI backend

---

## Tool Selection Strategy

### 🎨 **Lovable.dev - Use For:**
- ✅ **Full screen layouts** (Projects Overview, Data Room, Knowledge Explorer)
- ✅ **Multi-panel interfaces** (Data Room with buckets + checklist)
- ✅ **Complex navigation** (sidebar, top bar, workspace shell)
- ✅ **Table/card view toggles** (Findings Browser, Projects grid)
- ✅ **Form flows** (Project creation wizard, IRL builder)

**Why:** Lovable excels at generating complete, working screens with proper routing and state management.

### 🚀 **v0.dev - Use For:**
- ✅ **Individual components** (Finding Card, Insight Card, Confidence Badge)
- ✅ **shadcn/ui customizations** (custom DataTable, custom Dialog)
- ✅ **Complex widgets** (Processing Queue panel, Gap Analysis cards)
- ✅ **Interactive elements** (Drag-and-drop reordering, inline editors)
- ✅ **Chart/visualization components** (Progress bars, status indicators)

**Why:** v0.dev generates Next.js 14 + shadcn/ui components directly, no conversion needed.

### 🛠️ **Manual Coding - Use For:**
- ✅ **Backend integration** (FastAPI API calls, WebSocket connections)
- ✅ **LangGraph workflows** (Q&A co-creation, CIM generation with interrupts)
- ✅ **Real-time features** (Document processing status, live updates)
- ✅ **Agent tool calling** (8 core tools, conversation state management)
- ✅ **Complex business logic** (IRL-document linking, contradiction detection)

**Why:** These require deep integration with your Python backend and custom architecture.

---

## Phase-by-Phase Implementation Plan

---

## 📅 **PHASE 1: Visual Prototyping (Week 1)**
**Goal:** Generate working UI prototypes for validation
**Tool:** Lovable.dev
**Deliverable:** 6 working screens in Lovable

### Day 1-2: Core Navigation & Projects

#### Task 1.1: Projects Overview Screen
**Tool:** Lovable.dev

**Prompt for Lovable:**
```
Create a project portfolio dashboard called "Projects Overview" with these features:

LAYOUT:
- Top bar: Logo left, "Projects" title center, user menu right
- Main content area with view toggle (card grid ↔ table view)
- "+ New Project" button top-right

CARD GRID VIEW (default):
- Responsive grid (3 columns desktop, 2 tablet, 1 mobile)
- Each project card shows:
  * Company name (large, bold)
  * Project name (subtitle)
  * Status badge (Active/On Hold/Complete) - green/yellow/gray
  * Progress section with 2 progress bars:
    - Documents: X/Y uploaded (percentage bar)
    - Analysis: X/Y complete (percentage bar)
  * Last activity: "Updated 2 hours ago"
  * Hover: subtle shadow and "Open" button appears

TABLE VIEW (alternative):
- Sortable table with columns: Company, Project Name, Status, Documents, Analysis, Last Activity
- Click column headers to sort
- Row hover shows action menu (Open, Archive, Delete)

EMPTY STATE:
- Illustration placeholder
- "Create Your First Project" heading
- "Get started analyzing M&A deals" subtitle
- "Create Project" button

TECH STACK:
- React + Tailwind CSS
- shadcn/ui components (Card, Badge, Button, Table)
- Responsive design
```

**Expected Output:** Working project overview with both views, routing ready for Next.js conversion.

---

#### Task 1.2: Project Creation Wizard
**Tool:** Lovable.dev

**Prompt for Lovable:**
```
Create a 3-step project creation wizard in a modal dialog:

STEP 1: Project Basics
- Form fields:
  * Project Name (required)
  * Company Name (required)
  * Industry (dropdown: Tech, Industrial, Pharma, Financial Services, Other)
- Progress indicator: "Step 1 of 3"
- "Next" button (disabled until required fields filled)

STEP 2: Project Type
- Radio card selection:
  * Tech M&A (icon + description)
  * Industrial M&A (icon + description)
  * Pharma/Biotech (icon + description)
  * Financial Services (icon + description)
  * Custom (blank slate)
- Each card shows recommended IRL template preview on hover
- "Back" and "Next" buttons

STEP 3: Confirmation
- Summary of selections
- "Project will be created with:" heading
- List showing: Name, Company, Industry, Type, IRL Template
- "Back" and "Create Project" buttons
- Create button has loading state with spinner

MODAL BEHAVIOR:
- Click outside or X button shows "Discard changes?" confirmation
- On create success: close modal, redirect to project dashboard
- Smooth transitions between steps

TECH STACK:
- React + Tailwind
- Multi-step form with state management
- Form validation
```

**Expected Output:** Working wizard flow, ready to connect to API endpoint.

---

### Day 3-4: Data Room Interface

#### Task 1.3: Data Room - Buckets View
**Tool:** Lovable.dev (this is the MOST IMPORTANT screen)

**Prompt for Lovable:**
```
Create a Data Room interface with dual-panel layout (reference uploaded screenshot):

LEFT PANEL (70% width): Category Bucket Cards
- 6 category cards in 2-column grid:
  * Financial Documents
  * Legal Documents
  * Operational Documents
  * Market & Strategy
  * Technology & IP
  * HR & Organization

Each bucket card structure:
- HEADER:
  * Category name (bold, large)
  * Status badge ("in progress", "completed", "not started") - yellow/green/gray
- PROGRESS BAR:
  * Visual bar showing completion (e.g., 6/8 = 75%)
  * Text: "6 of 8 documents" below bar
- NESTED ITEM LIST (expandable):
  * Click card to expand/collapse
  * Show nested sub-items with checkboxes:
    ✓ Uploaded (green check)
    ⏱ Pending (clock icon)
    ○ Not started (empty circle)
  * Each item shows file type icon (PDF, XLSX, DOCX)
  * Upload button per item

RIGHT PANEL (30% width): IRL Checklist
- HEADER:
  * "Document Checklist" title
  * Overall progress: "15/19 items (79%)" with progress bar
- HIERARCHICAL LIST:
  * Collapsible categories matching left panel
  * Each item shows:
    - Status icon (✓⏱○)
    - Item name
    - File type expected
    - Quick upload button (icon)
- COLLAPSIBLE:
  * Collapse button to hide right panel
  * Icon-only mode when collapsed

TOP BAR:
- View toggle: Folders ↔ Buckets (icon buttons)
- Upload button (drag-drop zone trigger)
- Search documents input

INTERACTIONS:
- Click bucket card to expand nested list
- Progress bars animate on load
- Status badges change color based on completion
- Upload buttons trigger file picker

TECH STACK:
- React + Tailwind CSS
- Collapsible panels
- Progress indicators
- File upload triggers (UI only, no backend)
```

**Expected Output:** Complete Data Room buckets view matching your screenshot.

---

#### Task 1.4: Data Room - Folder View
**Tool:** Lovable.dev

**Prompt for Lovable:**
```
Create an alternative folder structure view for the Data Room:

LEFT SIDEBAR (25% width): Folder Tree
- Hierarchical folder tree with expand/collapse arrows
- Root folders with nested subfolders
- Selected folder highlighted in blue
- Right-click context menu: New Folder, Rename, Delete
- Drag-and-drop visual indicators

MAIN AREA (75% width): Document List
- Table view showing documents in selected folder:
  * Icon (file type)
  * Name (editable inline)
  * Size (MB)
  * Type (PDF/XLSX/DOCX)
  * Upload Date
  * Processing Status (queued/parsing/analyzing/complete with spinner)
  * Actions menu (⋮)
- Drag-and-drop documents between folders
- Multi-select with checkboxes
- Empty folder state: "No documents yet. Drag files here or click Upload."

TOP TOOLBAR:
- Breadcrumb navigation (Home > Folder1 > Subfolder2)
- "New Folder" button
- "Upload Files" button
- View toggle: List ↔ Grid
- Sort dropdown (Name, Date, Size, Type)

ACTIONS MENU (per document):
- View
- Download
- Rename
- Move to folder
- Delete
- Version history

TECH STACK:
- React + Tailwind
- Tree view component
- Drag-and-drop (react-dnd or similar)
- Context menus
```

**Expected Output:** Folder-based document organization interface.

---

### Day 5-6: Knowledge Explorer & Chat

#### Task 1.5: Knowledge Explorer - Findings Browser
**Tool:** Lovable.dev

**Prompt for Lovable:**
```
Create a Knowledge Explorer interface with findings table and filters:

LEFT SIDEBAR (20% width): Filters Panel
- DOCUMENT FILTER:
  * Multi-select dropdown of uploaded documents
  * "All Documents" default
- DOMAIN FILTER:
  * Checkboxes: Financial, Legal, Operational, Market, Technology, HR
  * "All Domains" toggle
- CONFIDENCE FILTER:
  * Slider range: 0-100%
  * Preset buttons: High (>80%), Medium (60-80%), Low (<60%)
- STATUS FILTER:
  * Radio buttons: All, Validated, Pending Review, Rejected
- "Reset Filters" button at bottom

MAIN AREA (80% width): Findings Browser
- TAB NAVIGATION:
  * Findings Browser (active)
  * Insights
  * Contradictions
  * Gap Analysis

- VIEW TOGGLE (top-right):
  * Table ↔ Card view toggle buttons

TABLE VIEW:
- Columns: Finding, Source, Domain, Confidence, Status, Actions
- Sortable columns (click header)
- Row actions:
  * ✓ Confirm (green button)
  * ✗ Reject (red button)
  * ✏️ Edit (inline editor)
- Pagination: 50 items per page
- Row hover shows full finding text in tooltip

CARD VIEW (alternative):
- 2-3 column grid
- Each card shows:
  * Finding text (main content)
  * Source citation (clickable link, small text)
  * Confidence badge (green/yellow/red with %)
  * Domain tag (pill/badge)
  * Action buttons (✓✗✏️)
- Pagination with infinite scroll option

TOP TOOLBAR:
- Search input: "Search findings..." (semantic search)
- "Export" button (CSV/Excel dropdown)
- Filter count indicator: "15 filters applied"

EMPTY STATE:
- "No findings match your filters"
- "Try adjusting your search criteria"
- "Reset Filters" button

TECH STACK:
- React + Tailwind
- shadcn/ui Table and Card components
- Filter state management
- Pagination logic
```

**Expected Output:** Complete findings browser with table/card views and comprehensive filtering.

---

#### Task 1.6: Chat Interface
**Tool:** Lovable.dev

**Prompt for Lovable:**
```
Create a chat interface for conversational AI assistant:

LEFT SIDEBAR (25% width): Conversation History
- List of past conversations:
  * Conversation title (auto-generated from first message)
  * Date/time
  * Message preview (first 50 chars)
  * Active conversation highlighted
- "+ New Conversation" button at top
- Search conversations input
- Collapsible (icon-only mode)

MAIN CHAT AREA (75% width): Message Thread
- MESSAGE LIST (scrollable, auto-scroll to bottom):
  * User messages: right-aligned, blue background
  * Assistant messages: left-aligned, gray background
  * Each message shows:
    - Avatar (user icon or AI icon)
    - Message text
    - Timestamp
    - Source citations (for assistant messages) as clickable pills
  * Loading indicator for streaming responses
  * "Searching knowledge base..." indicator during tool calls

- INPUT AREA (bottom, sticky):
  * Textarea (auto-expanding, max 5 rows)
  * Placeholder: "Ask about your M&A deal..."
  * Send button (icon)
  * Keyboard shortcut hint: "⌘ + Enter to send"
  * Character counter

QUICK ACTIONS (below input):
- Pill buttons for common actions:
  * "📊 Summarize Findings"
  * "⚠️ Find Contradictions"
  * "📝 Generate Q&A"
  * "📄 Create CIM Section"
- Buttons disabled when not applicable (no documents uploaded)
- Tooltip on hover explaining why disabled

SUGGESTED FOLLOW-UPS (after assistant response):
- 2-3 suggested questions appear as clickable pills
- Click to populate input field
- "Or ask your own question..." hint

STREAMING ANIMATION:
- Token-by-token text appearance
- Cursor blink at end of streaming text
- "Claude is typing..." indicator

TECH STACK:
- React + Tailwind
- Message state management
- Auto-scroll behavior
- Textarea auto-expand
- Streaming simulation (for prototype)
```

**Expected Output:** Full-featured chat interface ready for Claude integration.

---

### Day 7: Export & Convert

#### Task 1.7: Export from Lovable
**Steps:**
1. In Lovable dashboard, connect to GitHub:
   - Settings → GitHub Integration
   - Authorize Lovable to create repository
   - Repository name: `manda-frontend-prototype`

2. Commit all screens to GitHub:
   - Lovable auto-commits on each save
   - Verify all 6 screens are in repository

3. Clone repository locally:
```bash
cd ~/projects
git clone https://github.com/your-org/manda-frontend-prototype
cd manda-frontend-prototype
```

**Expected Output:** Git repository with complete React/Vite prototype.

---

#### Task 1.8: Convert to Next.js 14
**Tool:** NextLovable.com or ViteToNext.AI

**Option A: NextLovable (Recommended)**
```bash
# Visit https://nextlovable.com/
# Upload your Lovable repository or provide GitHub URL
# Download converted Next.js project

# Expected conversion results:
# - React Router → Next.js App Router
# - /projects → app/projects/page.tsx
# - /projects/:id/data-room → app/projects/[id]/data-room/page.tsx
# - Layout components preserved
# - Tailwind config migrated
# - shadcn/ui components installed
```

**Option B: ViteToNext.AI**
```bash
# Visit ViteToNext.AI
# Upload Vite project
# Configure options:
#   - Target: Next.js 15 (compatible with 14)
#   - App Router: Yes
#   - Tailwind: Preserve existing config
#   - TypeScript: Enable
# Download converted project
```

**Post-Conversion Steps:**
```bash
# Extract converted project
cd ~/projects/manda-nextjs-converted

# Install dependencies
npm install

# Verify conversion
npm run dev
# Visit http://localhost:3000
# Test all 6 screens

# Check file structure:
# app/
#   layout.tsx                    (root layout)
#   page.tsx                      (landing/projects overview)
#   projects/
#     [id]/
#       layout.tsx                (project workspace shell)
#       dashboard/page.tsx
#       data-room/page.tsx
#       knowledge-explorer/page.tsx
#       chat/page.tsx
#       deliverables/page.tsx
# components/                     (shared components)
# lib/                            (utilities)
```

**Expected Output:** Working Next.js 14 app with all screens converted.

---

## 📅 **PHASE 2: Component Generation (Week 2)**
**Goal:** Generate custom components using v0.dev
**Tool:** v0.dev (Vercel)
**Deliverable:** 15+ production-ready components

### Day 8-9: Data Visualization Components

#### Task 2.1: Finding Card Component
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a FindingCard component for displaying extracted M&A intelligence findings.

COMPONENT REQUIREMENTS:
- Props:
  * finding: { id, text, source, domain, confidence, status }
  * onValidate: () => void
  * onReject: () => void
  * onEdit: () => void

LAYOUT:
- Card with border (gray-200), padding, hover shadow
- Top section:
  * Finding text (main content, text-base, line-clamp-3)
  * "Read more" link if truncated
- Middle section:
  * Source citation (clickable link, text-sm, text-gray-600)
  * Format: "document.xlsx, Sheet 'P&L', Cell B15"
- Bottom section (flex row):
  * Left: Domain tag (badge/pill, colored by domain)
  * Center: Confidence badge (green >80%, yellow 60-80%, red <60%)
  * Right: Action buttons (✓✗✏️)

STATES:
- Default, Hover, Validated (green border), Rejected (red border, opacity 50%)

VARIANTS:
- Compact (for lists)
- Expanded (for detail view)

TECH:
- Next.js 14 + TypeScript
- shadcn/ui Card, Badge, Button
- Tailwind CSS
```

**Expected Output:** Reusable FindingCard.tsx component.

---

#### Task 2.2: Confidence Badge Component
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a ConfidenceBadge component for displaying AI confidence scores.

PROPS:
- confidence: number (0-100)
- reasoning?: string (optional tooltip content)
- size?: 'sm' | 'md' | 'lg'

VISUAL:
- Badge with percentage text
- Color coding:
  * Green (bg-green-100, text-green-800) for >80%
  * Yellow (bg-yellow-100, text-yellow-800) for 60-80%
  * Red (bg-red-100, text-red-800) for <60%
- Icon: ● (circle) matching color
- Format: "● 95%" or "● High (95%)"

TOOLTIP (if reasoning provided):
- Hover shows tooltip with reasoning
- Max width 300px
- Explain confidence factors

VARIANTS:
- Numeric only: "95%"
- Label + Numeric: "High (95%)"
- Icon + Label: "● High Confidence"

TECH:
- shadcn/ui Badge + Tooltip
- Tailwind color classes
- TypeScript
```

**Expected Output:** ConfidenceBadge.tsx component.

---

#### Task 2.3: Source Citation Link Component
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a SourceCitation component for clickable document source links.

PROPS:
- source: {
    documentName: string
    location: string (e.g., "Sheet 'P&L', Cell B15" or "Page 12, Section 3.2")
    documentId: string
  }
- onClick: (documentId, location) => void

VISUAL:
- Inline link style (text-blue-600, underline on hover)
- Format: "document_name.xlsx, Sheet 'P&L', Cell B15"
- Monospace font for location (font-mono)
- Small file type icon before document name

INTERACTIONS:
- Click opens document viewer modal at exact location
- Hover shows full path tooltip (if truncated)
- Copy button (on hover) to copy citation

VARIANTS:
- Inline (in paragraph text)
- Standalone (in card footer)
- Compact (document name only)

TECH:
- Next.js Link component
- shadcn/ui Button (for copy)
- File type icons (lucide-react)
```

**Expected Output:** SourceCitation.tsx component.

---

### Day 10-11: Interactive Components

#### Task 2.4: Processing Queue Panel
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a ProcessingQueuePanel component showing background document processing status.

PROPS:
- jobs: Array<{
    id: string
    documentName: string
    status: 'queued' | 'parsing' | 'analyzing' | 'complete' | 'failed'
    progress?: number (0-100)
    timeInQueue: string (e.g., "2 min")
    retryCount?: number
  }>
- onCancel: (jobId) => void
- onRetry: (jobId) => void

LAYOUT:
- Panel with header: "Processing Queue (3 active)"
- List of job items, each showing:
  * Document name + file icon
  * Status indicator (spinner for active, ✓ for complete, ✗ for failed)
  * Progress bar (if in progress)
  * Time in queue
  * Action buttons (Cancel for queued, Retry for failed)

STATUS INDICATORS:
- Queued: clock icon, gray
- Parsing: spinner + "Parsing document..."
- Analyzing: spinner + "Analyzing content..."
- Complete: green checkmark, fades out after 2 seconds
- Failed: red X + error message + "Retry" button

REAL-TIME UPDATES:
- Animate progress bars smoothly
- Jobs auto-remove when complete
- Show retry count if applicable: "Attempt 2/3"

EMPTY STATE:
- "No documents processing"
- "Upload documents to see them here"

TECH:
- shadcn/ui Card, Progress, Button
- Animated spinner (lucide-react Loader2)
- Auto-remove animation
```

**Expected Output:** ProcessingQueuePanel.tsx component.

---

#### Task 2.5: Inline Editor Component
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create an InlineEditor component for editing findings inline in tables.

PROPS:
- value: string
- onSave: (newValue: string) => void
- onCancel: () => void
- multiline?: boolean
- maxLength?: number

BEHAVIOR:
- Click ✏️ Edit button → text becomes editable
- Textarea appears with current value
- Save (✓) and Cancel (✗) buttons appear
- Enter to save (Cmd+Enter if multiline)
- Escape to cancel
- Click outside to save (with confirmation if changed)

VISUAL:
- Textarea auto-expands with content
- Character counter if maxLength provided
- Validation error if empty
- Save button disabled until changed
- Loading state during save

VARIANTS:
- Single line (input)
- Multiline (textarea)
- Rich text (future enhancement)

TECH:
- shadcn/ui Textarea, Button
- Auto-resize textarea
- Keyboard shortcuts
```

**Expected Output:** InlineEditor.tsx component.

---

#### Task 2.6: Drag-and-Drop Upload Zone
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a FileUploadZone component for drag-and-drop file uploads.

PROPS:
- onFilesSelected: (files: File[]) => void
- acceptedTypes?: string[] (default: ['.xlsx', '.pdf', '.docx'])
- maxSize?: number (default: 100MB)
- multiple?: boolean (default: true)

VISUAL:
- Dashed border rectangle
- Default state:
  * Upload cloud icon (large)
  * "Drag files here or click to browse"
  * Supported types list: "Excel, PDF, Word (max 100MB)"
- Drag over state:
  * Border changes to blue
  * Background slight blue tint
  * "Drop files here"
- Uploading state:
  * Progress bars for each file
  * File names with status icons
  * "X of Y files uploaded"

VALIDATION:
- Reject unsupported file types (show error toast)
- Reject oversized files (show error toast)
- Show which files were rejected and why

INTERACTIONS:
- Click to open file picker
- Drag files over to highlight
- Drop to upload
- Multiple files supported
- Preview thumbnails (optional)

TECH:
- react-dropzone or native drag-drop
- shadcn/ui Progress, Alert
- File validation
```

**Expected Output:** FileUploadZone.tsx component.

---

### Day 12-14: Form & Layout Components

#### Task 2.7: Multi-Step Form Component
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a MultiStepForm component for wizards (IRL builder, Project creation).

PROPS:
- steps: Array<{
    id: string
    title: string
    description?: string
    component: ReactNode
    validate?: () => boolean
  }>
- onComplete: (data: any) => void
- onCancel: () => void

FEATURES:
- Progress indicator (step 1/3, 2/3, 3/3)
- Step titles with checkmarks for completed
- Current step highlighted
- Next/Back navigation
- Validation before advancing
- Data persists across steps
- Cancel confirmation dialog

VISUAL:
- Horizontal progress bar with step numbers
- Step content area (card)
- Button footer (Back, Cancel, Next/Complete)
- Next button disabled if validation fails
- Complete button on final step

BEHAVIOR:
- URL updates with step number (?step=2)
- Can jump to completed steps by clicking
- Data saved to local state
- Unsaved changes warning on cancel

TECH:
- React state management
- shadcn/ui Button, Progress, Dialog
- Form validation
```

**Expected Output:** MultiStepForm.tsx component.

---

#### Task 2.8: Sidebar Navigation Component
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a ProjectSidebar navigation component for project workspace.

PROPS:
- projectId: string
- activeSection: string
- sections: Array<{
    id: string
    label: string
    icon: ReactNode
    badge?: number (notification count)
  }>

LAYOUT:
- Vertical sidebar (250px width, collapsible to 60px)
- Section items:
  * Icon + Label (full width)
  * Active section highlighted (blue background)
  * Badge (notification count) on right if present
  * Hover effect
- Collapse button at bottom
- When collapsed: show icons only, tooltip on hover

SECTIONS (default):
- Dashboard (LayoutDashboard icon)
- Data Room (FolderOpen icon) - badge if documents processing
- Knowledge Explorer (Brain icon) - badge if new contradictions
- Chat (MessageSquare icon) - badge if unread messages
- Deliverables (FileText icon)

STATES:
- Expanded (default)
- Collapsed (icons only)
- Active section
- Hover effects

RESPONSIVE:
- Auto-collapse on mobile (<768px)
- Overlay on mobile when expanded

TECH:
- Next.js Link components
- lucide-react icons
- shadcn/ui Badge, Button
- Tailwind transitions
```

**Expected Output:** ProjectSidebar.tsx component.

---

#### Task 2.9: Data Table with Actions
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create a reusable DataTableWithActions component (enhanced shadcn/ui table).

PROPS:
- columns: ColumnDef[] (TanStack Table format)
- data: any[]
- onRowAction?: (action: string, row: any) => void
- rowActions?: Array<{ label: string, icon?: ReactNode, onClick: (row) => void }>
- pagination?: { pageSize: number, currentPage: number, totalPages: number }
- sorting?: boolean
- filtering?: boolean

FEATURES:
- Sortable columns (click header)
- Filter inputs per column (text search, select, date range)
- Row selection (checkboxes)
- Bulk actions (when rows selected)
- Row actions menu (⋮ icon)
- Pagination controls
- Rows per page selector
- Loading skeleton state
- Empty state

VISUAL:
- Clean table with hover rows
- Action menu appears on row hover
- Selected rows highlighted
- Sticky header on scroll
- Responsive (cards on mobile)

TECH:
- @tanstack/react-table
- shadcn/ui Table, DropdownMenu, Checkbox
- Virtual scrolling for large datasets (optional)
```

**Expected Output:** DataTableWithActions.tsx component.

---

#### Task 2.10: Modal Dialog Patterns
**Tool:** v0.dev

**Prompt for v0.dev:**
```
Create reusable modal dialog patterns for common use cases.

COMPONENTS:
1. ConfirmDialog - Simple yes/no confirmation
2. FormDialog - Dialog with form and validation
3. ViewDialog - Read-only content viewer
4. DocumentViewer - Preview documents (PDF, Excel, Word)

ConfirmDialog PROPS:
- title: string
- description: string
- confirmLabel?: string (default: "Confirm")
- cancelLabel?: string (default: "Cancel")
- variant?: 'default' | 'destructive'
- onConfirm: () => void
- onCancel: () => void

FormDialog PROPS:
- title: string
- fields: FormFieldConfig[]
- onSubmit: (data) => void
- onCancel: () => void
- submitLabel?: string
- isLoading?: boolean

DocumentViewer PROPS:
- documentUrl: string
- documentType: 'pdf' | 'excel' | 'word'
- highlightLocation?: string (e.g., "B15" or "Page 12")
- onClose: () => void

FEATURES:
- Click outside to close (with unsaved changes warning)
- Escape key to close
- Keyboard navigation (Tab, Enter)
- Focus trap within dialog
- Smooth animations
- Responsive sizing

TECH:
- shadcn/ui Dialog, Form
- react-hook-form for FormDialog
- PDF viewer library (react-pdf)
- Excel viewer (optional: embedded iframe or custom renderer)
```

**Expected Output:** 4 dialog pattern components.

---

## 📅 **PHASE 3: Integration with Manda Backend (Week 3)**
**Goal:** Connect Next.js frontend to FastAPI backend
**Tool:** Manual coding in VSCode
**Deliverable:** Fully integrated application

### Day 15-16: Project Structure & Configuration

#### Task 3.1: Integrate into Manda Monorepo
```bash
# Navigate to Manda project root
cd ~/projects/manda

# Copy converted Next.js app into monorepo
cp -r ~/projects/manda-nextjs-converted/* apps/web/

# Update directory structure
mkdir -p apps/web/{app,components,lib,hooks,types}

# Install dependencies
cd apps/web
npm install

# Add shadcn/ui (if not already added during conversion)
npx shadcn-ui@latest init
# Select: Next.js, TypeScript, Tailwind, App Router

# Install additional shadcn components
npx shadcn-ui@latest add button card table badge dialog \
  dropdown-menu form input label select textarea \
  alert progress skeleton toast tabs
```

**File Structure:**
```
apps/web/
├── app/
│   ├── layout.tsx                 (root layout)
│   ├── page.tsx                   (projects overview)
│   ├── login/page.tsx             (auth)
│   ├── projects/
│   │   └── [id]/
│   │       ├── layout.tsx         (project shell)
│   │       ├── dashboard/page.tsx
│   │       ├── data-room/page.tsx
│   │       ├── knowledge-explorer/page.tsx
│   │       ├── chat/page.tsx
│   │       └── deliverables/page.tsx
├── components/
│   ├── ui/                        (shadcn components)
│   ├── features/                  (v0 generated components)
│   │   ├── FindingCard.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   ├── ProcessingQueuePanel.tsx
│   │   └── ...
│   └── layouts/
│       ├── ProjectSidebar.tsx
│       └── TopNavBar.tsx
├── lib/
│   ├── api/                       (API client)
│   │   ├── client.ts              (axios/fetch wrapper)
│   │   ├── endpoints.ts           (API routes)
│   │   └── types.ts               (API types)
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── websocket/
│   │   └── client.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useWebSocket.ts
│   ├── useDocuments.ts
│   └── useFindings.ts
├── types/
│   ├── project.ts
│   ├── document.ts
│   ├── finding.ts
│   └── conversation.ts
└── public/
```

---

#### Task 3.2: Configure Environment Variables
```bash
# Create .env.local
cat > apps/web/.env.local <<EOF
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# FastAPI Backend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF
```

**Update next.config.js:**
```javascript
// apps/web/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // Proxy to FastAPI
      },
    ];
  },
};

module.exports = nextConfig;
```

---

#### Task 3.3: Create API Client
**File:** `apps/web/lib/api/client.ts`

```typescript
import axios from 'axios';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**File:** `apps/web/lib/api/endpoints.ts`

```typescript
import { apiClient } from './client';
import type { Project, Document, Finding, Conversation } from '@/types';

// Projects
export const projectsApi = {
  list: () => apiClient.get<Project[]>('/api/projects'),
  get: (id: string) => apiClient.get<Project>(`/api/projects/${id}`),
  create: (data: Partial<Project>) => apiClient.post<Project>('/api/projects', data),
  update: (id: string, data: Partial<Project>) => apiClient.patch<Project>(`/api/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/projects/${id}`),
};

// Documents
export const documentsApi = {
  list: (projectId: string) => apiClient.get<Document[]>(`/api/projects/${projectId}/documents`),
  upload: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<Document>(`/api/projects/${projectId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (documentId: string) => apiClient.delete(`/api/documents/${documentId}`),
  getProcessingStatus: (documentId: string) => apiClient.get(`/api/documents/${documentId}/status`),
};

// Findings
export const findingsApi = {
  list: (projectId: string, filters?: any) =>
    apiClient.get<Finding[]>(`/api/projects/${projectId}/findings`, { params: filters }),
  search: (projectId: string, query: string) =>
    apiClient.post<Finding[]>(`/api/projects/${projectId}/findings/search`, { query }),
  validate: (findingId: string) => apiClient.post(`/api/findings/${findingId}/validate`),
  reject: (findingId: string) => apiClient.post(`/api/findings/${findingId}/reject`),
  update: (findingId: string, data: Partial<Finding>) =>
    apiClient.patch(`/api/findings/${findingId}`, data),
};

// Chat / Conversations
export const chatApi = {
  listConversations: (projectId: string) =>
    apiClient.get<Conversation[]>(`/api/projects/${projectId}/conversations`),
  getConversation: (conversationId: string) =>
    apiClient.get<Conversation>(`/api/conversations/${conversationId}`),
  sendMessage: (conversationId: string, message: string) =>
    apiClient.post(`/api/conversations/${conversationId}/messages`, { message }),
};
```

---

### Day 17-18: Real-time Features

#### Task 3.4: WebSocket Integration for Document Processing
**File:** `apps/web/lib/websocket/client.ts`

```typescript
import { useEffect, useState } from 'react';

export type DocumentStatus = 'queued' | 'parsing' | 'parsed' | 'analyzing' | 'complete' | 'failed';

interface ProcessingUpdate {
  documentId: string;
  status: DocumentStatus;
  progress?: number;
  error?: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export function useDocumentProcessing(projectId: string) {
  const [updates, setUpdates] = useState<Map<string, ProcessingUpdate>>(new Map());
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket(`${WS_URL}/projects/${projectId}/processing`);

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const update: ProcessingUpdate = JSON.parse(event.data);
      setUpdates((prev) => new Map(prev).set(update.documentId, update));
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      // Implement reconnection logic
      setTimeout(() => {
        // Reconnect
      }, 5000);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [projectId]);

  return { updates, ws };
}
```

**Usage in Component:**
```typescript
// apps/web/app/projects/[id]/data-room/page.tsx
'use client';

import { useDocumentProcessing } from '@/lib/websocket/client';
import { ProcessingQueuePanel } from '@/components/features/ProcessingQueuePanel';

export default function DataRoomPage({ params }: { params: { id: string } }) {
  const { updates } = useDocumentProcessing(params.id);

  return (
    <div>
      <ProcessingQueuePanel jobs={Array.from(updates.values())} />
      {/* Rest of Data Room UI */}
    </div>
  );
}
```

---

#### Task 3.5: Supabase Realtime for Live Updates
**File:** `apps/web/hooks/useRealtimeFindings.ts`

```typescript
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Finding } from '@/types';

export function useRealtimeFindings(projectId: string) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Initial fetch
    const fetchFindings = async () => {
      const { data } = await supabase
        .from('findings')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (data) setFindings(data);
    };

    fetchFindings();

    // Subscribe to changes
    const channel = supabase
      .channel(`project-${projectId}-findings`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'findings',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setFindings((prev) => [payload.new as Finding, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setFindings((prev) =>
              prev.map((f) => (f.id === payload.new.id ? payload.new as Finding : f))
            );
          } else if (payload.eventType === 'DELETE') {
            setFindings((prev) => prev.filter((f) => f.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return findings;
}
```

---

### Day 19-20: Authentication & Data Fetching

#### Task 3.6: Implement Supabase Auth
**File:** `apps/web/app/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      router.push('/projects');
    }

    setLoading(false);
  };

  const handleMagicLink = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/projects`,
      },
    });

    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for the magic link!');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6">Sign in to Manda</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleMagicLink}
            disabled={loading || !email}
          >
            Send Magic Link
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

**File:** `apps/web/middleware.ts` (Auth middleware)

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Redirect to login if not authenticated
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to projects if authenticated and on login page
  if (session && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

#### Task 3.7: Create Custom Hooks for Data Fetching
**File:** `apps/web/hooks/useProjects.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/endpoints';
import type { Project } from '@/types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectsApi.list();
      return response.data;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const response = await projectsApi.get(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const response = await projectsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
```

**File:** `apps/web/hooks/useDocuments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/endpoints';

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: ['documents', projectId],
    queryFn: async () => {
      const response = await documentsApi.list(projectId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const response = await documentsApi.upload(projectId, file);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    },
  });
}
```

**File:** `apps/web/hooks/useFindings.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { findingsApi } from '@/lib/api/endpoints';

export function useFindings(projectId: string, filters?: any) {
  return useQuery({
    queryKey: ['findings', projectId, filters],
    queryFn: async () => {
      const response = await findingsApi.list(projectId, filters);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useValidateFinding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (findingId: string) => {
      await findingsApi.validate(findingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['findings'] });
    },
  });
}
```

---

#### Task 3.8: Update Lovable Screens with Real Data

**Example: Projects Overview Page**
```typescript
// apps/web/app/projects/page.tsx
'use client';

import { useProjects } from '@/hooks/useProjects';
import { ProjectCard } from '@/components/features/ProjectCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 p-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <Button onClick={() => {/* Open create modal */}}>
          + New Project
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}
```

---

### Day 21: Testing & Polish

#### Task 3.9: Add Error Boundaries and Loading States
**File:** `apps/web/app/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

**File:** `apps/web/app/loading.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

---

## 📅 **PHASE 4: Advanced Features (Week 4)**
**Goal:** Implement complex backend-dependent features
**Tool:** Manual coding
**Deliverable:** Production-ready application

### Day 22-23: Chat Interface with Claude

#### Task 4.1: Implement Streaming Chat Responses
**File:** `apps/web/app/projects/[id]/chat/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useChat } from 'ai/react'; // Vercel AI SDK
import { ChatMessage } from '@/components/features/ChatMessage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ChatPage({ params }: { params: { id: string } }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `/api/projects/${params.id}/chat`,
    streamMode: 'text',
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && <div className="text-gray-500">Claude is thinking...</div>}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your M&A deal..."
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**API Route:** `apps/web/app/api/projects/[id]/chat/route.ts`

```typescript
import { StreamingTextResponse } from 'ai';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { messages } = await req.json();

  // Call your FastAPI backend which uses Claude
  const response = await fetch(`${process.env.API_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: params.id,
      messages,
    }),
  });

  // Stream the response from FastAPI to the client
  return new StreamingTextResponse(response.body);
}
```

---

#### Task 4.2: Implement Tool Call Indicators
**File:** `apps/web/components/features/ChatMessage.tsx`

```typescript
import { ConfidenceBadge } from './ConfidenceBadge';
import { SourceCitation } from './SourceCitation';

interface ToolCall {
  name: string;
  status: 'running' | 'complete' | 'error';
  result?: any;
}

export function ChatMessage({ message }: { message: any }) {
  const toolCalls = message.toolCalls || [];

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] rounded-lg p-4 ${
        message.role === 'user'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100'
      }`}>
        {/* Tool Call Indicators */}
        {toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {toolCalls.map((tool: ToolCall, i: number) => (
              <div key={i} className="text-sm flex items-center gap-2">
                {tool.status === 'running' && '⏳'}
                {tool.status === 'complete' && '✓'}
                {tool.status === 'error' && '✗'}
                <span>
                  {tool.name === 'query_knowledge_base' && 'Searching knowledge base...'}
                  {tool.name === 'detect_contradictions' && 'Checking for contradictions...'}
                  {/* Add other tool names */}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Message Content */}
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Source Citations (for assistant messages) */}
        {message.role === 'assistant' && message.sources && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-1">Sources:</div>
            {message.sources.map((source: any, i: number) => (
              <SourceCitation key={i} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Day 24-25: LangGraph Workflow Integration

#### Task 4.3: Q&A Co-Creation Workflow UI
**File:** `apps/web/components/features/QAWorkflowDialog.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface WorkflowState {
  stage: 'draft_generated' | 'user_feedback' | 'revision' | 'complete';
  draftQA: Array<{ question: string; answer: string }>;
  userFeedback?: string;
  finalQA?: Array<{ question: string; answer: string }>;
}

export function QAWorkflowDialog({
  projectId,
  onComplete
}: {
  projectId: string;
  onComplete: (qa: any[]) => void;
}) {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  // Start workflow
  const startWorkflow = async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/workflows/qa/start`, {
      method: 'POST',
    });
    const data = await response.json();
    setState(data);
    setLoading(false);
  };

  // Submit feedback (LangGraph interrupt)
  const submitFeedback = async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/workflows/qa/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    });
    const data = await response.json();
    setState(data);
    setFeedback('');
    setLoading(false);
  };

  // Approve and complete
  const approve = async () => {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/workflows/qa/approve`, {
      method: 'POST',
    });
    const data = await response.json();
    onComplete(data.finalQA);
    setLoading(false);
  };

  if (!state) {
    return (
      <Dialog>
        <h2>Generate Q&A List</h2>
        <p>AI will analyze your knowledge base and draft a comprehensive Q&A list.</p>
        <Button onClick={startWorkflow} disabled={loading}>
          {loading ? 'Generating...' : 'Start Generation'}
        </Button>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <h2>Q&A Draft Review</h2>

      {/* Draft Q&A List */}
      <div className="space-y-4 mb-6">
        {state.draftQA.map((item, i) => (
          <div key={i} className="border rounded p-3">
            <div className="font-semibold mb-1">Q: {item.question}</div>
            <div className="text-sm text-gray-600">A: {item.answer}</div>
          </div>
        ))}
      </div>

      {/* Feedback Form (LangGraph Interrupt UI) */}
      {state.stage === 'draft_generated' && (
        <>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide feedback on the draft Q&A list. What should be changed, added, or removed?"
            rows={4}
          />

          <div className="flex gap-2 mt-4">
            <Button onClick={submitFeedback} disabled={loading || !feedback.trim()}>
              Submit Feedback
            </Button>
            <Button variant="outline" onClick={approve} disabled={loading}>
              Approve & Save
            </Button>
          </div>
        </>
      )}

      {/* Revision Stage */}
      {state.stage === 'revision' && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p>Revising Q&A list based on your feedback...</p>
        </div>
      )}

      {/* Complete Stage */}
      {state.stage === 'complete' && (
        <div className="text-center text-green-600">
          ✓ Q&A list saved successfully!
        </div>
      )}
    </Dialog>
  );
}
```

---

### Day 26-27: Document Processing & Real-time Updates

#### Task 4.4: Document Upload with Progress Tracking
**File:** `apps/web/components/features/DocumentUploadZone.tsx`

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUploadDocument } from '@/hooks/useDocuments';
import { useDocumentProcessing } from '@/lib/websocket/client';
import { Progress } from '@/components/ui/progress';

export function DocumentUploadZone({ projectId }: { projectId: string }) {
  const [uploads, setUploads] = useState<Map<string, number>>(new Map());
  const uploadMutation = useUploadDocument(projectId);
  const { updates } = useDocumentProcessing(projectId);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      // Track upload progress
      setUploads((prev) => new Map(prev).set(file.name, 0));

      try {
        await uploadMutation.mutateAsync(file);

        // Upload complete, now processing starts
        setUploads((prev) => {
          const next = new Map(prev);
          next.delete(file.name);
          return next;
        });
      } catch (error) {
        console.error('Upload failed:', error);
        setUploads((prev) => {
          const next = new Map(prev);
          next.delete(file.name);
          return next;
        });
      }
    }
  }, [projectId, uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="text-4xl">📁</div>
          {isDragActive ? (
            <p>Drop files here...</p>
          ) : (
            <>
              <p className="text-lg font-medium">Drag files here or click to browse</p>
              <p className="text-sm text-gray-500">
                Excel, PDF, Word (max 100MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.size > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Uploading...</h3>
          {Array.from(uploads.entries()).map(([filename, progress]) => (
            <div key={filename} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{filename}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ))}
        </div>
      )}

      {/* Processing Status (from WebSocket) */}
      {updates.size > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Processing...</h3>
          {Array.from(updates.values()).map((update) => (
            <div key={update.documentId} className="flex items-center gap-2 text-sm">
              {update.status === 'parsing' && '⏳ Parsing...'}
              {update.status === 'analyzing' && '🧠 Analyzing...'}
              {update.status === 'complete' && '✓ Complete'}
              {update.status === 'failed' && '✗ Failed'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Day 28: Final Testing & Deployment Prep

#### Task 4.5: End-to-End Testing
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom

# Run tests
npm test

# E2E tests with Playwright (optional)
npm install --save-dev @playwright/test
npx playwright install
npx playwright test
```

**Example Test:** `apps/web/__tests__/ProjectCard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { ProjectCard } from '@/components/features/ProjectCard';

describe('ProjectCard', () => {
  const mockProject = {
    id: '1',
    name: 'Test Project',
    company: 'Acme Inc',
    status: 'active',
    documentsCount: 10,
    documentsTotal: 15,
    analysisCount: 8,
    analysisTotal: 10,
    updatedAt: new Date().toISOString(),
  };

  it('renders project information correctly', () => {
    render(<ProjectCard project={mockProject} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
    expect(screen.getByText('10/15 uploaded')).toBeInTheDocument();
  });
});
```

---

#### Task 4.6: Build & Deploy
```bash
# Build production bundle
cd apps/web
npm run build

# Test production build locally
npm run start

# Deploy to Vercel (recommended for Next.js)
vercel --prod

# Or deploy to your own infrastructure
# Docker container, AWS, GCP, etc.
```

**Dockerfile (if self-hosting):**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📊 **Summary: Tools & Responsibilities Matrix**

| Feature/Component | Tool | Rationale |
|-------------------|------|-----------|
| **Projects Overview Screen** | Lovable | Full screen layout with complex state |
| **Data Room Buckets View** | Lovable | Multi-panel interface, perfect for Lovable |
| **Knowledge Explorer** | Lovable | Complex table/card views with filters |
| **Chat Interface Shell** | Lovable | Screen layout and navigation |
| **Finding Card** | v0.dev | Custom component with shadcn/ui |
| **Confidence Badge** | v0.dev | Reusable widget, Next.js compatible |
| **Processing Queue Panel** | v0.dev | Complex real-time component |
| **Multi-Step Form** | v0.dev | Reusable wizard pattern |
| **FastAPI Integration** | Manual | Backend API calls and auth |
| **WebSocket Real-time** | Manual | Document processing status |
| **LangGraph Workflows** | Manual | Q&A/CIM generation with interrupts |
| **Claude Tool Calling** | Manual | 8 core tools, conversation state |
| **Supabase Auth** | Manual | Authentication and RLS |

---

## ✅ **Deliverables Checklist**

### Week 1: Prototyping
- [ ] 6 working screens in Lovable (Projects, Data Room, Explorer, Chat, etc.)
- [ ] GitHub export of Lovable project
- [ ] Next.js 14 conversion complete

### Week 2: Components
- [ ] 15+ v0.dev components generated
- [ ] All components integrated into Next.js app
- [ ] shadcn/ui fully configured

### Week 3: Backend Integration
- [ ] API client configured for FastAPI
- [ ] Supabase Auth implemented
- [ ] WebSocket real-time updates working
- [ ] Custom hooks for data fetching

### Week 4: Advanced Features
- [ ] Chat with Claude streaming
- [ ] LangGraph workflow UIs (Q&A, CIM)
- [ ] Document upload with processing status
- [ ] End-to-end testing complete

---

## 🚀 **Next Steps After Completion**

1. **User Testing:**
   - Gather feedback from M&A analysts
   - Iterate on UX based on real usage

2. **Performance Optimization:**
   - Implement code splitting
   - Optimize bundle size
   - Add caching strategies

3. **Monitoring & Analytics:**
   - Add error tracking (Sentry)
   - Add analytics (Posthog, Mixpanel)
   - Monitor API performance

4. **Documentation:**
   - Component Storybook
   - API documentation
   - User guide

---

**This plan gives you a clear, actionable roadmap to build Manda's frontend using visual tools strategically while maintaining production quality and proper integration with your FastAPI backend.**
