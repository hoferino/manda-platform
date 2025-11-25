# Manda UX Design Specification

_Created on 2025-11-19 by Max_
_Last Updated: 2025-11-24_
_Version: 1.1 (Added Financial Model Integration and live preview features)_
_Generated through collaborative UX design discussion_

---

## Executive Summary

Manda is a conversational knowledge synthesizer for M&A intelligence—a platform combining data room organization with AI-powered analysis. This UX specification defines the user experience foundation for building a professional, efficient interface that M&A analysts will use daily.

**Core UX Principles:**
- **Analyst-Centric:** User stays in control, system provides intelligence
- **Professional & Efficient:** Banking-grade quality, information-dense where needed
- **Progressive Disclosure:** Complexity revealed as needed, not overwhelming
- **Bi-directional Intelligence:** System proactively surfaces insights while responding to queries
- **Source Transparency:** Every finding traceable to source documents

**Target Platform:** Web application (desktop primary, tablet support)
- **Tech Stack:** Next.js 14 + React + Tailwind CSS + shadcn/ui
- **Design System:** shadcn/ui (customizable components with Tailwind)

---

## 1. Application Structure

### 1.1 Navigation Hierarchy

```
Projects Overview (Landing)
  └─ Select Project Instance
     └─ Project Workspace
        ├─ Dashboard
        ├─ Data Room
        ├─ Knowledge Explorer ⭐
        ├─ Chat
        └─ Deliverables
```

**Key Architectural Decision:** Projects are isolated instances. Each project has its own:
- Documents (data room)
- Knowledge base (findings, insights, contradictions)
- Conversation history
- Deliverables (IRL, Q&A, CIM)
- Processing queue

### 1.2 Top-Level Navigation Pattern

**Projects Overview → Project Workspace → Core Areas**

Users always know:
1. Which project they're in (top bar shows project name)
2. How to switch projects (← Projects back button)
3. Where they are within the project (sidebar navigation)

---

## 2. Design System Foundation

### 2.1 Design System Choice

**Selected:** shadcn/ui + Tailwind CSS

**Rationale:**
- **Component Quality:** Accessible, well-designed React components
- **Customization:** Full control over styling with Tailwind
- **Modern Stack:** Aligns with Next.js 14 + React architecture
- **Professional Aesthetic:** Clean, minimal design appropriate for banking context
- **Active Development:** Well-maintained, growing ecosystem

**Components Provided:**
- Buttons, forms, inputs, selects
- Tables, data tables with sorting/filtering
- Cards, tabs, dialogs, modals
- Navigation (sidebar, breadcrumbs)
- Toast notifications, alerts
- Accordion, collapse components

**Custom Components Needed:**
- Knowledge graph visualization
- Document bucket cards
- IRL checklist panel
- Confidence score indicators
- Cross-domain insight cards
- LangGraph interrupt UI patterns

### 2.2 Visual Foundation

**Color Strategy:**
- **Professional & Trustworthy:** Blues and grays as foundation
- **Semantic Colors:**
  - Success: Green (validated findings, completed tasks)
  - Warning: Orange (pending items, moderate confidence)
  - Error: Red (contradictions, rejected findings)
  - Info: Blue (system notifications, insights)
- **Confidence Indicators:** Color-coded or badge-based
- **Source Attribution:** Subtle highlighting for clickable sources

**Typography:**
- **Headings:** Clear hierarchy (h1-h6)
- **Body Text:** Readable at professional density
- **Monospace:** For source citations, document paths, technical details

**Spacing System:**
- **Base:** 4px or 8px grid
- **Density:** Information-dense tables/lists, spacious cards for focus areas
- **Responsive:** Adapts to screen size without losing functionality

**Visual Style:**
- **Minimal:** Clean, distraction-free
- **Professional:** Banking/enterprise aesthetic
- **Functional:** Form follows function, no decoration for decoration's sake
- **Subtle Elevation:** Cards and panels use subtle shadows, not dramatic depth

---

## 3. Projects Overview (Landing Screen)

### 3.1 Purpose

Portfolio view of all projects. Users select a project to enter its isolated workspace.

### 3.2 Layout Options

**Primary View: Card Grid (Default)**

**Card Elements:**
- Project name + company logo/icon
- Status badge (Active, On Hold, Completed, Archived)
- Progress indicators:
  - Documents: 45/60 (75%)
  - Analysis: 78% complete
  - Deliverables: IRL complete, Q&A draft, CIM pending
- Last activity timestamp
- Recent proactive alert preview (if any)
- Quick stats bar (findings, insights, contradictions)

**Alternative View: Table**
- Columns: Name, Company, Status, Progress, Last Activity, Actions
- Sortable, filterable
- Compact, information-dense
- Good for power users managing many projects

**View Toggle:** Top-right corner (Card Grid ↔ Table)

### 3.3 Actions

- **+ New Project** button (prominent, top-right)
- **Search Projects** (search bar)
- **Filter by Status** (Active, On Hold, Completed, Archived)
- **Sort** (by name, date, progress, activity)
- **Per-Project Actions:**
  - Open (primary action)
  - Archive
  - Duplicate (copy structure for similar project)
  - Export
  - Delete (with confirmation)

### 3.4 Empty State

**First-time user:**
- Welcome message
- "Create Your First Project" guided wizard
- Sample project option (demo data to explore features)

---

## 4. Project Workspace

### 4.1 Top Navigation Bar

```
┌──────────────────────────────────────────────────────────────┐
│ ← Projects | 📁 Acme Corp Acquisition | [Active ▼] | 🔔 3 | 👤│
└──────────────────────────────────────────────────────────────┘
```

**Elements:**
- **← Projects:** Back to overview
- **Project Name:** Current context (always visible)
- **Status Dropdown:** Active / On Hold / Completed / Archived
- **Processing Indicator:** Spinner if background analysis running
- **Notifications Bell:** Proactive insights count (click to see panel)
- **User Menu:** Settings, profile, logout

### 4.2 Sidebar Navigation

```
📊 Dashboard
📁 Data Room
🔍 Knowledge Explorer ⭐
💬 Chat
📄 Deliverables
⚙️ Project Settings
```

**Active State:** Clear visual indication of current section
**Collapsed Mode:** Icons only (for more screen space)
**Badge Indicators:** Unread insights, pending validations, processing status

---

## 5. Core Interface Areas

### 5.1 Dashboard

**Purpose:** Project overview, status at-a-glance, recent activity

**Key Elements:**

**Summary Cards (Top Row):**
- **Documents:** 45 uploaded, 12 processing, 3 failed
- **Findings:** 342 extracted, 287 validated, 55 pending review
- **Insights:** 23 cross-domain patterns detected
- **Deliverables:** IRL complete, Q&A in progress, CIM draft ready

**Recent Proactive Insights Panel:**
- System-initiated alerts (e.g., "Margin compression detected")
- Priority ranked
- Click to explore in Knowledge Explorer
- Mark as important / review later / dismiss

**Recent Activity Timeline:**
- Document uploads
- Analysis completions
- Conversation highlights
- Deliverable updates

**Quick Actions:**
- Upload documents
- Start Q&A session
- Generate CIM section
- Review pending validations

**Processing Queue Status:**
- Documents in queue
- Current analysis job
- Estimated completion (if applicable)

### 5.2 Data Room

**Purpose:** Document upload, organization, and IRL tracking

**Dual Display Modes:**

#### Mode 1: Folder Structure (Traditional)

**Layout:**
- Hierarchical tree view (left panel)
- Document list (main panel)
- Document preview (right panel, optional)

**Features:**
- Create folders
- Drag-and-drop files/folders
- Rename, tag, organize
- Upload progress indicators
- Processing status per document
- Document metadata (size, type, upload date, processed date)

**Actions:**
- Upload (drag-drop or button)
- View/preview
- Download
- Delete
- Move to folder
- Tag/categorize

#### Mode 2: Buckets View (Category-Based) ⭐

**Inspiration:** Screenshot provided (Document Management UI with category cards)

**Layout:**

**Left/Main Area: Category Bucket Cards**

Each bucket card shows:
- **Header:** Category name (e.g., "Financial Documents")
- **Progress Bar:** 6/8 documents (75%)
- **Status Badge:** "in progress" / "completed" / "not started"
- **Nested Item List:** Expandable sub-categories
  - Annual Reports (2 files)
  - Projections & Analysis (2 files)
  - Tax Returns (1 file)
  - Banking & Debt (1 file)
  - Insurance Documentation (PDF, pending upload)
- **Per-Item Actions:**
  - Upload button
  - View uploaded files
  - Mark complete/incomplete
  - Link to IRL item

**Right Panel: Document Checklist**

**Overall Progress:** 15/19 documents (79%)

**Hierarchical Checklist:**
- Mirrors IRL structure
- Status indicators:
  - ✓ Uploaded (green checkmark)
  - ⏱ Pending (orange clock)
  - ○ Not started (empty circle)
- File type icons (PDF, XLSX, DOCX)
- Quick actions: Upload, view, manage
- Expand/collapse categories

**Bucket Categories (Pre-defined, based on IRL template):**
- Financial Documents
- Legal Documents
- Operational Documents
- Market & Strategy
- Technology & IP
- HR & Organization
- Custom Categories (user-defined)

**IRL Integration:**
- Each bucket item can link to IRL request
- Progress auto-updates as documents uploaded
- System suggests mappings (user confirms)
- Checklist syncs with IRL status

**Mode Toggle:** Top-right (Folder Structure ↔ Buckets)
**User Preference:** Saved per project

#### Upload Flow

1. **Drag-and-drop** or **click to upload**
2. **File uploaded** to Google Cloud Storage
3. **Processing queued** (background worker)
4. **Status updates** in real-time (WebSocket)
5. **Notification** when complete: "Financial statements analyzed. 12 findings extracted."

#### Financial Model Integration (MVP Feature)

**Purpose:** Extract and analyze financial data from Excel models

**Upload Flow:**
1. User uploads Excel file (.xlsx) containing financial model
2. System detects financial model patterns (revenue projections, EBITDA, cash flow, balance sheet)
3. **Processing notification:** "Analyzing financial model structure..."
4. **Extraction results:** "Extracted 24 key metrics, 15 assumptions, 8 formula dependencies"

**UX Components:**

**Financial Model Card (in Data Room):**
- **Header:** File name + "Financial Model" badge
- **Preview Stats:**
  - Time period coverage (e.g., "2021-2026")
  - Key metrics count (24 metrics)
  - Assumptions identified (15)
  - Formula dependencies mapped (8)
- **Actions:**
  - View metrics dashboard
  - Explore assumptions
  - Query financial data
  - Link to findings

**Financial Metrics Dashboard (Modal or dedicated view):**

**Layout:**
- **Time Series Chart:** Revenue, EBITDA, Cash Flow over projection period
- **Metrics Table:**
  | Metric | 2023A | 2024E | 2025E | 2026E | CAGR |
  |--------|-------|-------|-------|-------|------|
  | Revenue | $50M | $65M | $82M | $98M | 25% |
  | EBITDA | $12M | $16M | $21M | $27M | 31% |

- **Assumptions Panel:**
  - Revenue growth rate: 30% → 20% → 15%
  - Gross margin: 75% steady state
  - OpEx as % revenue: 45% → 40%

**Query Integration:**
- Chat can answer: "What was Q3 2023 EBITDA?"
- Knowledge Explorer shows financial metrics as findings
- Cross-validation alerts: "EBITDA mismatch: Excel shows $12M, CIM states $14M (confidence: high)"

**Visual Indicators:**
- 📊 Icon for financial model files
- Different badge color for financial documents
- Metric sparklines in search results

### 5.3 Knowledge Explorer ⭐ (ANALYSIS WORKSPACE)

**Purpose:** Analyst's primary workspace for reviewing, validating, and exploring extracted intelligence

**This is the missing critical interface identified in our discussion.**

**Layout: Multi-Panel Interface**

#### Main View Tabs:

**1. Findings Browser**

**Display Mode Options:**
- **Table View** (dense, scannable)
  - Columns: Finding, Source, Domain, Confidence, Status, Actions
  - Sortable, filterable
  - Infinite scroll or pagination
- **Card View** (visual, spacious)
  - Finding cards with preview
  - Source attribution visible
  - Confidence badge
  - Inline actions

**Filters:**
- **By Document:** Show findings from specific file
- **By Domain:** Financial, Operational, Market, Legal, etc.
- **By Confidence:** High (>80%), Medium (60-80%), Low (<60%)
- **By Status:** Validated, Pending, Rejected
- **By Date:** When extracted

**Finding Card/Row Elements:**
- **Finding Text:** The extracted information
- **Source Attribution:** Document name, page/section/cell reference (clickable)
- **Confidence Score:** Visual indicator (badge, color, percentage)
- **Domain Tag:** Financial, Operational, etc.
- **Validation Actions:**
  - ✓ Confirm (validate as correct)
  - ✗ Reject (mark as incorrect)
  - ✏️ Edit (modify finding text)
  - 💬 Comment (add analyst note)

**Inline Validation Workflow:**
- User clicks ✓ → Finding marked validated (green checkmark), confidence boost
- User clicks ✗ → Finding marked rejected, moved to rejected list
- User clicks ✏️ → Inline editor opens, user corrects, saves
- System learns from corrections (learning loop for Phase 3)

**2. Cross-Domain Insights Panel**

**Purpose:** Surface detected patterns across multiple domains

**Insight Card Elements:**
- **Pattern Name:** "Margin Compression: Financial × Operational"
- **Confidence Score:** 75% (visual badge)
- **Description:** "Q2-Q3 COGS up 15% while revenue up 8%, operational metrics stagnant"
- **Supporting Findings:** List of source findings (clickable to drill down)
- **Source Attribution:** All contributing documents
- **Actions:**
  - 🌟 Mark as Important
  - 📋 Review Later
  - ✗ Dismiss
  - 🔍 Explore (drill down into detail view)

**Explore Detail View:**
- Full pattern explanation
- All supporting findings with sources
- Timeline view (if temporal pattern)
- Suggested questions for seller
- Add to Q&A list (one-click)
- Add to CIM (flag for inclusion)

**Filters:**
- By pattern type (Financial × Operational, Growth × Quality, etc.)
- By confidence
- By priority (important / review later / all)
- By status (unreviewed / reviewed / dismissed)

**3. Contradictions View**

**Purpose:** Surface conflicting information across documents

**Layout:** Side-by-side comparison

**Contradiction Card:**
- **Finding A:** "Q3 Revenue: $5.2M" (Source: Financial Statements, Sheet P&L, Cell B15)
- **vs**
- **Finding B:** "Q3 Revenue: $4.8M" (Source: Management Report, Page 3)
- **Confidence:** A: 95%, B: 72%
- **Resolution Actions:**
  - Accept A (mark B as incorrect)
  - Accept B (mark A as incorrect)
  - Investigate Further (flag for analyst review)
  - Add Note (explain discrepancy)

**Contradiction Status:**
- Unresolved (needs attention)
- Resolved (analyst made decision)
- Noted (discrepancy explained)

**4. Gap Analysis**

**Purpose:** Identify missing information

**Categories:**
- **IRL Items Not Addressed:** Which requested documents not received
- **Information Gaps in Knowledge Base:** Missing data points
- **Incomplete Analysis Areas:** Domains with sparse findings

**Gap Card:**
- **Category:** "Financial Projections"
- **Missing:** "5-year revenue forecast not found in any document"
- **Priority:** High / Medium / Low
- **Actions:**
  - Add to IRL (request from seller)
  - Mark as not applicable
  - Add manual finding (analyst provides)

**5. Knowledge Graph Visualization (Phase 2)**

**Purpose:** Visual relationship map

**Elements:**
- **Nodes:** Findings, Documents, Insights
- **Edges:** Relationships (extracted from, contradicts, supports, pattern detected)
- **Interactions:**
  - Click node to drill down
  - Zoom, pan
  - Filter by domain, confidence
  - Highlight paths (e.g., all findings from Document X)

**Use Cases:**
- Trace insight back to source documents
- See contradiction relationships
- Understand cross-domain connections
- Identify information clusters

### 5.4 Chat (Conversational Assistant)

**Purpose:** Natural language interface for queries, Q&A co-creation, guided workflows

**Layout:**

**Left Panel (Optional, collapsible):**
- Conversation history (by date)
- Quick actions
- Suggested prompts

**Main Chat Area:**
- Messages (user + system)
- LangGraph interrupt UI (human-in-the-loop)
- Source citations inline
- Code blocks, tables formatted

**Input Area:**
- Text input with autocomplete
- Attach document (for context)
- Voice input (future)
- Suggested follow-ups

**Message Types:**

**User Message:**
- Standard text
- Can reference findings, documents, insights

**System Response:**
- **Query Response:** Answer with sources
  - "Q3 revenues were $5.2M (source: financial_statements.xlsx, sheet 'P&L', cell B15, confidence: 95%)"
- **Proactive Alert:** System-initiated
  - "I just analyzed Q3 financials and detected margin compression. Revenue increased 8% while COGS increased 15%. Want to explore?"
- **LangGraph Interrupt:** Human-in-the-loop checkpoint
  - "I've generated 15 Q&A suggestions based on the knowledge base. Review and approve?"
  - [Shows Q&A draft with approve/reject/edit options]

**Conversation Context:**
- Persistent across sessions
- Can reference previous exchanges
- "As we discussed yesterday..."

**Quick Actions (Buttons in Chat):**
- "Generate Q&A draft"
- "Find contradictions about [topic]"
- "Summarize financial findings"
- "Create CIM executive summary"

### 5.5 Deliverables Studio

**Purpose:** Create and manage IRL, Q&A lists, and CIM

**Tab Navigation:**

#### Tab 1: IRL (Information Request List)

**Layout:**

**Template Selection:**
- Choose template (Tech M&A, Industrial, Pharma, Custom)
- Preview template structure
- Customize categories and items

**IRL Builder:**
- **Category Sections:** Financial, Legal, Operational, etc.
- **Per-Category:**
  - Add/remove items
  - Mark priority (high, medium, low)
  - Set expected delivery date
  - Add notes/instructions
- **Export:** PDF, Word, Excel

**Status Tracking:**
- Link to Data Room (which docs fulfill which items)
- Progress indicators
- Missing items highlighted
- Follow-up reminders

#### Tab 2: Q&A List

**Purpose:** Collaborative question and answer development

**Layout:**

**Left Panel: Question Categories**
- Financial
- Operational
- Market
- Legal
- Technology
- Custom categories

**Main Panel: Q&A Editor**

**Question List:**
- Sortable, filterable
- Status: Draft, Answered, Reviewed, Approved

**Per Question:**
- Question text (editable)
- Answer draft (AI-generated or manual)
- Source citations (auto-linked)
- Confidence indicator
- Status workflow: Draft → Reviewed → Approved

**LangGraph Workflow (Human-in-the-Loop):**

1. **User:** "Generate Q&A suggestions"
2. **System:** Analyzes knowledge base, generates 15 questions
3. **Interrupt:** Shows draft Q&A list with approve/reject/edit for each
4. **User:** Approves 10, edits 3, rejects 2
5. **System:** Generates draft answers for approved questions
6. **Interrupt:** Shows answers with sources
7. **User:** Reviews, edits, finalizes
8. **System:** Locks approved Q&A items

**Collaborative Refinement:**
- Edit questions/answers inline
- Add manual questions
- Merge similar questions
- Reorder for logical flow
- Add notes/comments

**Export:** PDF, Word, Excel

#### Tab 3: CIM (Confidential Information Memorandum)

**Purpose:** AI-assisted CIM generation and editing

**Layout:**

**Left Sidebar: CIM Sections**
- Executive Summary
- Company Overview
- Market Analysis
- Financial Performance
- Growth Opportunities
- Risk Factors
- Appendices

**Main Panel: Section Editor**

**Per Section:**
- **Generate Button:** "Generate [Section] from knowledge base"
- **AI-Generated Draft:** System creates narrative
- **Source Footnotes:** Inline citations to findings
- **Edit Mode:** Rich text editor
- **Version History:** Track changes
- **Comments:** Collaborative feedback

**Generation Workflow:**

1. **User:** Clicks "Generate Executive Summary"
2. **System:** Queries knowledge base for key findings
3. **LangGraph Workflow:**
   - Generates draft narrative
   - Includes source citations
   - Shows preview to user
4. **Interrupt:** "Here's the draft executive summary. Review and approve?"
5. **User:** Edits, approves, or regenerates
6. **System:** Saves section

**CIM Template:**
- Multiple templates (Tech M&A, Industrial, etc.)
- User can create custom templates
- Section ordering (drag-and-drop)
- Custom sections

**Export:**
- Word (.docx) with formatting
- PDF
- Include/exclude source citations

**Version Control:**
- Save drafts
- Compare versions
- Restore previous versions

#### Live Preview Capability (MVP Feature)

**Purpose:** Visual preview of CIM content, slide layouts, and styling before final export

**Live Preview Panel (Toggle):**

**Layout:**
- **Split View:** Editor (left) + Live Preview (right)
- **Toggle Button:** "Show Preview" / "Hide Preview" in editor toolbar
- **Preview Modes:**
  - Document view (continuous scroll, Word-like)
  - Slide view (paginated, PowerPoint-like)
  - Print preview (PDF layout)

**Visual Concept Preview:**

When generating sections like "Company Overview" or "Market Analysis":
1. **AI generates content** with suggested visual concepts
2. **Live preview shows:**
   - Formatted text with selected typography
   - Placeholder visuals (charts, diagrams, images) with labels
   - Slide layout options (title + content, 2-column, image-heavy, etc.)
3. **User can toggle layouts:** Click alternate layout thumbnails
4. **Real-time updates:** Edits reflect immediately in preview

**Slide Layout Options:**

**Layout Templates (Visual thumbnails in sidebar):**
- **Title Slide:** Large heading, subtitle, logo placement
- **Executive Summary:** 3-column key points with icons
- **Financial Overview:** Chart + bullet points (2-column)
- **Market Analysis:** Full-width chart + caption
- **Risk Factors:** Icon grid with descriptions
- **Custom:** User-defined layouts

**Per-Section Preview:**
- Shows section heading styled
- Body text formatted (fonts, spacing, alignment)
- Visual elements positioned (charts, tables, diagrams)
- Page breaks indicated
- Footer/header preview

**Interactive Preview Controls:**
- **Zoom:** 50% / 75% / 100% / 125% / Fit width
- **Navigate:** Previous/Next section buttons
- **Layout switcher:** Dropdown to change section layout
- **Style:** Apply visual style template (professional blue, modern minimal, bold corporate)

**Style Template Preview:**

**Visual Style Options (thumbnails):**
1. **Professional Blue:** Blues/grays, conservative, banking-appropriate
2. **Modern Minimal:** Clean whites, subtle accents, lots of whitespace
3. **Bold Corporate:** High contrast, strong brand colors, impactful

**Preview shows:**
- Color scheme applied to headings, accents, charts
- Typography hierarchy visible
- Visual weight and spacing
- Overall aesthetic feel

**Export with Preview Confidence:**
- What you see in preview = what exports to Word/PDF
- No surprises in final output
- Iterate quickly on visual presentation

**Benefits:**
- Analysts see exactly what CIM will look like
- Catch formatting issues before export
- Try multiple visual approaches quickly
- Confidence in final deliverable appearance

---

## 6. Core User Journeys

### 6.1 Journey: New Project Setup → First Insight

**Flow:**

1. **Landing:** User on Projects Overview
2. **Action:** Click "+ New Project"
3. **Wizard:**
   - Step 1: Project basics (name, company, industry)
   - Step 2: Project type (Tech M&A / Industrial / Pharma / Custom)
   - Step 3: IRL template selection (auto-suggested)
4. **Redirect:** Project Dashboard (first visit)
5. **Onboarding Checklist:**
   - ✓ Project created
   - ○ Upload first documents
   - ○ Review IRL checklist
6. **Action:** User uploads 3 financial documents (drag-drop to Data Room)
7. **Background:** System processes documents
8. **Notification:** "3 documents processed. 45 findings extracted."
9. **User:** Navigates to Knowledge Explorer
10. **Explore:** Reviews findings, validates 20, rejects 2
11. **Alert:** "Detected pattern: Margin compression (confidence: 75%)"
12. **User:** Clicks "Explore" on insight
13. **Detail View:** Sees cross-domain pattern with sources
14. **Action:** Marks as important, adds to Q&A list

**Key UX Moments:**
- Smooth project creation (3 steps, clear progress)
- Immediate value (documents → findings in minutes)
- Proactive intelligence (system surfaces insight without asking)
- Easy exploration (one-click drill-down)
- Actionable (add to Q&A from insight detail)

### 6.2 Journey: IRL → Documents → Analysis → Q&A

**Flow:**

1. **Start:** User in Deliverables > IRL tab
2. **Action:** Creates IRL from Tech M&A template
3. **Customize:** Adds custom items, sets priorities
4. **Export:** Sends to seller
5. **Receive:** Seller provides documents
6. **Upload:** User uploads to Data Room (Buckets mode)
7. **Mapping:** System suggests IRL item mappings, user confirms
8. **Progress:** Checklist panel shows 15/19 items complete
9. **Background:** System processes new documents
10. **Alert:** "New contradictions detected in revenue figures"
11. **Navigate:** User goes to Knowledge Explorer > Contradictions
12. **Review:** Side-by-side comparison of conflicting findings
13. **Resolve:** User marks correct finding, adds note
14. **Q&A:** Navigate to Deliverables > Q&A
15. **Generate:** Click "Generate Q&A suggestions"
16. **LangGraph Interrupt:** System shows 12 draft questions
17. **Review:** User approves 8, edits 2, rejects 2
18. **Draft Answers:** System generates answers with sources
19. **Finalize:** User reviews, edits, approves
20. **Export:** PDF Q&A list for client

### 6.3 Journey: Chat for Quick Query → Deep Exploration

**Flow:**

1. **Context:** User working on financial analysis
2. **Action:** Opens Chat
3. **Query:** "What was EBITDA growth from Q2 to Q3?"
4. **Response:**
   - "EBITDA grew 12% from Q2 ($2.1M) to Q3 ($2.35M)"
   - "Source: financial_statements.xlsx, P&L sheet, rows 45-48"
   - "Confidence: 92%"
5. **Follow-up:** "Were there any one-time items in Q3?"
6. **Response:** "Yes, Q3 included a $150K gain on asset sale (line item 62)"
7. **User:** "Show me all non-recurring items across all quarters"
8. **System:** Generates table with sources
9. **Action:** User clicks "Explore in Knowledge Explorer"
10. **Navigate:** Redirects to Knowledge Explorer with filter applied
11. **Deep Dive:** User reviews all findings related to non-recurring items
12. **Action:** Adds finding to Q&A list: "What were the one-time items in each quarter?"

**Key UX Moments:**
- Fast query response (2-3 seconds)
- Source transparency (always cited)
- Conversational refinement (follow-up questions)
- Seamless transition (chat → explorer)
- Action integration (add to Q&A from chat)

---

## 7. UX Pattern Decisions

### 7.1 Button Hierarchy

**Primary Actions:**
- Style: Filled button, primary color
- Usage: Main action on screen (Upload, Generate, Save, Approve)

**Secondary Actions:**
- Style: Outlined button
- Usage: Alternative actions (Cancel, Review Later, Edit)

**Tertiary Actions:**
- Style: Ghost button (text only)
- Usage: Less important actions (Dismiss, View Details)

**Destructive Actions:**
- Style: Filled button, red/error color
- Usage: Delete, reject, remove (with confirmation)

### 7.2 Feedback Patterns

**Success:**
- Pattern: Toast notification (green, top-right)
- Duration: 3-5 seconds auto-dismiss
- Example: "Document uploaded successfully"

**Error:**
- Pattern: Toast notification (red, top-right) + inline error
- Duration: Manual dismiss or 10 seconds
- Example: "Upload failed: File size too large"

**Warning:**
- Pattern: Inline alert or banner
- Duration: Persistent until resolved
- Example: "Low confidence (45%) - review recommended"

**Info:**
- Pattern: Toast or inline message
- Duration: 5 seconds auto-dismiss
- Example: "Analysis complete. 12 findings extracted."

**Loading:**
- Pattern: Spinner or skeleton UI
- Duration: While processing
- Example: Document upload progress bar

### 7.3 Form Patterns

**Label Position:** Above input field

**Required Fields:** Asterisk (*) next to label

**Validation Timing:**
- On blur for individual fields
- On submit for full form

**Error Display:** Inline below field (red text)

**Help Text:** Caption below field (gray text) or tooltip (i icon)

### 7.4 Modal Patterns

**Size Variants:**
- Small: Confirmations, simple forms
- Medium: Complex forms, detail views
- Large: Full editing interfaces
- Full-screen: CIM editor, document preview

**Dismiss Behavior:**
- Click outside: No (prevents accidental loss)
- Escape key: Yes (with unsaved changes warning)
- Explicit close: X button or Cancel button

**Focus Management:** Auto-focus first input field

**Stacking:** Maximum 2 modals (avoid modal within modal)

### 7.5 Navigation Patterns

**Active State:**
- Sidebar: Bold text + colored background
- Tabs: Underline + bold text

**Breadcrumbs:**
- Usage: When applicable (Projects > Acme Corp > Knowledge Explorer)
- Clickable to navigate back

**Back Button Behavior:**
- ← Projects: Returns to overview
- Browser back: Works within project, not across projects (prevents accidental exit)

**Deep Linking:** Supported (shareable URLs for findings, insights)

### 7.6 Empty State Patterns

**First Use:**
- Guidance: "Upload your first documents to get started"
- Primary action: Upload button
- Secondary: Sample project link

**No Results:**
- Helpful message: "No findings match your filters"
- Action: Clear filters or try different search

**Cleared Content:**
- Message: "All findings validated"
- Undo option: If recent bulk action

### 7.7 Confirmation Patterns

**Delete:**
- Always confirm (modal)
- Show what will be deleted
- Require explicit confirmation

**Destructive Actions:**
- Confirm (modal or inline)
- Clear consequences
- No undo if irreversible

**Leave Unsaved:**
- Warn on navigation
- Offer: Save, Don't Save, Cancel

### 7.8 Notification Patterns

**Placement:** Top-right corner

**Duration:**
- Success: 3-5 seconds auto-dismiss
- Error: Manual dismiss or 10 seconds
- Info: 5 seconds auto-dismiss
- Critical: Manual dismiss only

**Stacking:** Show up to 3, queue others

**Priority Levels:**
- Critical: Red, requires action
- Important: Orange, attention needed
- Info: Blue, informational

### 7.9 Search Patterns

**Trigger:** Type to search (instant)

**Results Display:** Dropdown or inline results

**Filters:** Available alongside search

**No Results:** Suggestions or message

### 7.10 Date/Time Patterns

**Format:**
- Relative: "2 hours ago" (recent)
- Absolute: "Nov 19, 2025 3:42 PM" (older)

**Timezone:** User local time (default)

**Pickers:** Calendar dropdown for date selection

---

## 8. Responsive Design Strategy

### 8.1 Breakpoint Strategy

**Desktop (Primary):**
- Min width: 1280px
- Layout: Full sidebar, multi-column, all features visible

**Tablet:**
- Range: 768px - 1279px
- Layout: Collapsible sidebar (icons only), responsive columns
- Adaptations: Tables become cards, multi-column → single column

**Mobile (Future Phase):**
- Max width: 767px
- Layout: Bottom navigation, single column, simplified views
- Note: Mobile primarily for notifications/quick checks, not full analysis

### 8.2 Adaptation Patterns

**Navigation:**
- Desktop: Full sidebar
- Tablet: Icon-only sidebar (expandable)
- Mobile: Bottom nav or hamburger menu

**Tables:**
- Desktop: Full table with all columns
- Tablet: Hide less critical columns, horizontal scroll
- Mobile: Card view (each row becomes card)

**Modals:**
- Desktop: Centered modal
- Tablet: Larger modal (more screen coverage)
- Mobile: Full-screen modal

**Forms:**
- Desktop: Multi-column if appropriate
- Tablet: Single column
- Mobile: Single column, larger touch targets

---

## 9. Accessibility Strategy

### 9.1 Compliance Target

**WCAG 2.1 Level AA**

**Rationale:**
- Standard for professional web applications
- Legal requirement for many contexts (government, education, public sites)
- Ensures usability for people with disabilities

### 9.2 Key Requirements

**Color Contrast:**
- Text vs background: 4.5:1 minimum (normal text)
- Large text: 3:1 minimum (18pt+ or 14pt+ bold)
- UI components: 3:1 minimum

**Keyboard Navigation:**
- All interactive elements accessible via keyboard
- Logical tab order
- Visible focus indicators (outline or highlight)
- Skip to main content link

**ARIA Labels:**
- Meaningful labels for screen readers
- Button purposes clear ("Upload document" not just "Upload")
- Form labels properly associated
- Status messages announced

**Alt Text:**
- Descriptive text for all meaningful images
- Decorative images: empty alt ("")
- Charts/graphs: Text description of data

**Form Labels:**
- Every input has associated label
- Error messages descriptive and helpful
- Required fields clearly indicated

**Error Identification:**
- Errors clearly identified (not just color)
- Descriptive error messages
- Suggestions for fixing

**Touch Target Size:**
- Minimum 44x44px for mobile
- Adequate spacing between targets

### 9.3 Testing Strategy

**Automated:**
- Lighthouse (Chrome DevTools)
- axe DevTools (browser extension)
- Run on every major feature

**Manual:**
- Keyboard-only navigation testing
- Screen reader testing (NVDA, JAWS, or VoiceOver)
- Color blindness simulation
- Zoom testing (200% zoom)

---

## 10. Component Library Strategy

### 10.1 shadcn/ui Components (Built-in)

**Used As-Is:**
- Button, Input, Select, Checkbox, Radio
- Card, Badge, Label
- Tabs, Accordion
- Dialog, Modal, Popover
- Toast, Alert
- Table (basic)
- Form elements

### 10.2 Custom Components

**1. Knowledge Explorer Components:**

**Finding Card**
- Purpose: Display extracted finding with source
- Anatomy:
  - Finding text (primary)
  - Source attribution (link, clickable)
  - Confidence badge (visual indicator)
  - Domain tag (category)
  - Validation actions (✓✗✏️)
- States: Default, hover, validated, rejected, editing
- Variants: Compact (table row), expanded (card)

**Insight Card**
- Purpose: Display cross-domain pattern
- Anatomy:
  - Pattern name (header)
  - Confidence score (badge)
  - Description (summary)
  - Supporting findings (expandable list)
  - Source attribution (documents)
  - Actions (important, review, dismiss, explore)
- States: Default, hover, important, dismissed
- Variants: Summary (list view), detailed (expanded)

**Contradiction Card**
- Purpose: Side-by-side comparison of conflicting findings
- Anatomy:
  - Finding A (left)
  - vs separator (center)
  - Finding B (right)
  - Confidence scores
  - Source attribution
  - Resolution actions
- States: Unresolved, resolved, noted

**2. Data Room Components:**

**Bucket Card**
- Purpose: Category-based document organization
- Anatomy:
  - Header (category name)
  - Progress bar (visual)
  - Status badge (in progress, completed)
  - Nested item list (expandable)
  - Per-item upload actions
- States: Not started, in progress, completed
- Variants: Collapsed, expanded

**Document Checklist Panel**
- Purpose: IRL tracking and progress
- Anatomy:
  - Overall progress (15/19, 79%)
  - Hierarchical list (categories + items)
  - Status indicators (✓⏱○)
  - File type icons
  - Quick actions (upload, view)
- States: Expanded, collapsed
- Behavior: Syncs with bucket cards

**3. Chat Components:**

**LangGraph Interrupt UI**
- Purpose: Human-in-the-loop checkpoint
- Anatomy:
  - Prompt message (what system needs)
  - Preview content (draft Q&A, CIM section)
  - Approval controls (approve all, approve selected, reject, edit)
  - Progress indicator (optional)
- States: Waiting for input, processing
- Variants: Q&A review, CIM review, custom workflow

**Message with Sources**
- Purpose: Chat response with citations
- Anatomy:
  - Message text
  - Inline source citations (clickable)
  - Confidence indicator (if applicable)
  - Follow-up suggestions
- States: Default, hover (shows source preview)

**4. Shared Components:**

**Confidence Badge**
- Purpose: Visual confidence indicator
- Variants:
  - Percentage: "75%" with color
  - Stars: ★★★☆☆ (3/5)
  - Color badge: High (green), Medium (yellow), Low (red)
- Decision: Use color + percentage for clarity

**Source Citation Link**
- Purpose: Clickable reference to source document
- Anatomy:
  - Document name
  - Page/section/cell reference
  - Click action: Opens document at location
- States: Default, hover, active

**Progress Indicator**
- Purpose: Show completion status
- Variants:
  - Progress bar (0-100%)
  - Fraction (15/19)
  - Percentage (79%)
- Usage: Buckets, checklists, dashboard

---

## 11. Design Direction

### 11.1 Chosen Direction

**Professional & Efficient (Bloomberg-inspired)**

**Characteristics:**
- **Information Density:** High where needed (tables, lists), spacious for focus areas (cards, detail views)
- **Visual Hierarchy:** Clear, bold headers, structured layouts
- **Layout:** Multi-panel interfaces for complex workflows
- **Navigation:** Persistent sidebar, always visible context
- **Color Usage:** Purposeful (status, confidence), not decorative
- **Typography:** Clear, readable, professional

**Rationale:**
- **Banking Context:** Professional aesthetic expected by M&A analysts
- **Power Users:** Dense information appropriate for experts
- **Efficiency:** Quick scanning, minimal clicks to action
- **Trust:** Clean, serious design builds confidence

### 11.2 Layout Patterns

**Dashboard:** Card-based (summary cards + panels)

**Data Room (Buckets):** Card grid (left) + checklist panel (right)

**Data Room (Folders):** Tree view (left) + list (center) + preview (right, optional)

**Knowledge Explorer:**
- Findings: Table or card list (main) + filters (top/sidebar)
- Insights: Card list with expandable details
- Contradictions: Side-by-side comparison cards

**Chat:** Conversation list (main) + history sidebar (left, collapsible)

**Deliverables:** Tabs (top) + editor (main) + sections sidebar (left)

### 11.3 Interaction Style

**Inline Actions:** Primary (less clicks)

**Modals:** For complex edits or confirmations

**Tooltips:** For help/context (not primary information)

**Hover States:** Reveal actions, preview information

**Keyboard Shortcuts:** Power user support

---

## 12. Implementation Guidance

### 12.1 Phasing Recommendations

**Phase 1 (MVP):**
- Projects Overview + Project Workspace structure
- Data Room (Buckets mode only)
- Knowledge Explorer (Findings Browser + basic insights)
- Chat (query/response, no LangGraph interrupts yet)
- Deliverables (IRL + Q&A, basic CIM)

**Phase 2 (Enhancement):**
- Data Room (Folder Structure mode)
- Knowledge Explorer (Contradictions + Gap Analysis)
- LangGraph interrupt UI patterns
- Advanced CIM editor
- Cross-domain insights (full)

**Phase 3 (Intelligence):**
- Knowledge Graph Visualization
- Proactive insights (system-initiated)
- Learning loop (confidence calibration)
- Advanced pattern detection

### 12.2 Design System Setup

**shadcn/ui Installation:**
1. Install shadcn/ui with Tailwind
2. Configure theme (colors, typography, spacing)
3. Install needed components
4. Customize as needed (CSS variables)

**Custom Components:**
1. Build in `components/manda/` folder
2. Use shadcn/ui primitives as base
3. Document props and usage
4. Create Storybook stories (optional)

### 12.3 Responsive Implementation

**Mobile-First vs Desktop-First:**
- **Desktop-First** for Manda (primary use case)
- Use Tailwind responsive modifiers (md:, lg:, xl:)
- Test at 1280px, 1024px, 768px breakpoints

**Testing:**
- Chrome DevTools responsive mode
- Real tablet testing (iPad)
- Real desktop testing (various screen sizes)

---

## 13. Key Decisions Summary

### ✅ Confirmed UX Decisions

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Design System** | shadcn/ui + Tailwind | Customizable, modern, professional components |
| **Visual Style** | Professional & Efficient (Bloomberg-inspired) | Appropriate for banking context, power users |
| **Navigation Model** | Projects → Project Workspace → Core Areas | Clear context, data isolation |
| **Data Room Modes** | Dual (Folders + Buckets) | Flexibility for different workflows |
| **Knowledge Explorer** | Multi-panel analysis workspace | Core differentiator, analyst's primary workspace |
| **Confidence Display** | Color badge + percentage | Clear, scannable, trustworthy |
| **IRL Integration** | Built into Data Room (Buckets mode) | Seamless workflow, no context switching |
| **Responsive Strategy** | Desktop-first, tablet support | Primary use case on desktop |
| **Accessibility Target** | WCAG 2.1 Level AA | Professional standard |

### 📋 Open UX Questions

1. **Knowledge Graph Visualization:** Which library? (D3.js, Cytoscape.js, vis.js, custom)
2. **Table Density:** Default compact or spacious? (user preference?)
3. **Project Switcher:** Dropdown in top bar vs only "← Projects" button?
4. **Multi-Project Tabs:** Allow multiple project tabs open? Or single-instance only?
5. **CIM Editor:** Full rich text (Tiptap, ProseMirror) or simpler markdown?

---

## 14. Next Steps

### For Design Phase:
1. Create detailed wireframes for each core screen
2. Build interactive prototype (Figma or code)
3. User testing with M&A analysts
4. Refine based on feedback

### For Development Phase:
1. Set up Next.js + shadcn/ui
2. Implement core navigation structure
3. Build Projects Overview
4. Build Project Workspace shell
5. Implement each core area iteratively
6. Develop custom components (Finding Card, Insight Card, etc.)
7. Integrate with backend APIs
8. Responsive testing and refinement
9. Accessibility audit and fixes

---

## Appendix

### Related Documents

- Product Requirements: [manda-prd.md](./manda-prd.md)
- Architecture: [manda-architecture.md](./manda-architecture.md)
- Brainstorming: [brainstorming-session-results-2025-11-19.md](./brainstorming-session-results-2025-11-19.md)

### Reference Inspirations

**Bloomberg Terminal:** Information density, professional aesthetic, multi-panel layouts
**Notion:** Clean navigation, customizable views, inline actions
**Linear:** Modern design, keyboard shortcuts, efficient workflows
**Document Management Screenshot:** Bucket cards, checklist integration, progress tracking

---

_This UX Design Specification was created through collaborative design discussion, capturing key structural and interaction decisions for the Manda M&A Intelligence Platform. All decisions documented with rationale for future reference and implementation guidance._

**Version:** 1.0
**Date:** 2025-11-19
**Status:** Complete - Ready for Epic/Story Creation
