# Notion AI Setup Prompts - Manda Platform Knowledge Base

This document contains ready-to-use prompts for Notion AI to create each component of the Manda Platform knowledge base. Execute these prompts in order, as later prompts reference databases created earlier.

---

## Setup Order

1. **Core Databases** (create these first - they're referenced by others)
   - Epics Database
   - Stories Database
   - Features Catalog Database

2. **Tracking Databases** (depend on core databases)
   - Bugs Database
   - Tech Debt Database
   - Retrospectives Database

3. **Ideas & Tasks Databases** (the innovation system)
   - Ideas Database (parent ideas/concepts)
   - Tasks Database (actionable work items with subtasks)
   - Feature Requests Database
   - Enhancement Ideas Database
   - Research Topics Database
   - Technical Decisions Database

4. **Pages** (use linked database views from above)
   - **Hub** (MAIN LANDING PAGE - create first!)
   - Home Dashboard
   - Product Section
   - Engineering Section
   - Ideas Hub
   - Development Tracking
   - Documentation Section

---

## PHASE 1: CORE DATABASES

---

### Prompt 1.1: Create Epics Database

```
Create a full-page database called "Epics" for tracking major development phases.

DATABASE PROPERTIES:
- Name (Title): Epic name
- ID (Text): Epic identifier like "E1", "E2", "E8"
- Status (Select): Options with colors:
  • Backlog (gray)
  • Contexted (blue)
  • In Progress (yellow)
  • Done (green)
- Started (Date): When development began
- Completed (Date): When all stories finished
- Description (Text): What this epic delivers
- Key Deliverables (Text): Major outputs and components built
- Tech Spec URL (URL): Link to technical specification document
- Story Count (Number): Total stories in this epic
- Progress (Number, percent format): Completion percentage

VIEWS TO CREATE:

1. "Roadmap" (Timeline view):
   - Show Started → Completed as duration
   - Group by Status
   - Color by Status
   - This is the DEFAULT view

2. "Kanban" (Board view):
   - Group by Status
   - Show: Name, Progress, Story Count
   - Card preview: medium

3. "All Epics" (Table view):
   - Show all properties
   - Sort by ID ascending

4. "Active" (Gallery view):
   - Filter: Status = "In Progress" OR Status = "Contexted"
   - Card size: medium
   - Show: Name, Description, Progress
   - Card preview shows Description

INITIAL DATA (create these entries):
1. E1 - Project Foundation | Done | 2025-11-24 to 2025-11-25 | 9 stories | 100%
   Deliverables: Next.js 15, Supabase Auth, PostgreSQL schema, Neo4j, pg-boss

2. E2 - Document Ingestion | Done | 2025-11-25 to 2025-11-26 | 8 stories | 100%
   Deliverables: GCS integration, Data Room UI, folder/bucket views

3. E3 - Intelligent Processing | Done | 2025-11-26 to 2025-11-28 | 9 stories | 100%
   Deliverables: FastAPI backend, Docling parser, Gemini analysis, embeddings

4. E4 - Knowledge Workflow | Done | 2025-11-28 to 2025-11-30 | 13 stories | 100%
   Deliverables: Knowledge Explorer, semantic search, contradictions, gaps

5. E5 - Conversational Assistant | Done | 2025-12-01 to 2025-12-02 | 8/9 stories | 89%
   Deliverables: LangChain agent, chat UI, SSE streaming, source citations

6. E6 - IRL Management | Done | 2025-12-02 to 2025-12-03 | 7 stories | 100%
   Deliverables: IRL templates, AI suggestions, folder generation, export

7. E7 - Learning Loop | Done | 2025-12-07 to 2025-12-08 | 6 stories | 100%
   Deliverables: Corrections, validation feedback, audit trail, confidence thresholds

8. E8 - Q&A Workflow | Contexted | Started 2025-12-09 | 7 stories | 0%
   Deliverables: Q&A item management, Excel export/import, agent tools

9. E9 - CIM Creation | Backlog | 9 stories | 0%
   Deliverables: 14-phase CIM workflow, buyer personas, visual precision

VISUAL STYLING:
- Use a timeline cover image showing a development roadmap
- Add icon: 🎯 (target)
```

---

### Prompt 1.2: Create Stories Database

```
Create a full-page database called "Stories" for tracking individual user stories within epics.

DATABASE PROPERTIES:
- Title (Title): Story title
- ID (Text): Identifier like "E1.1", "E3.5", "E7.2"
- Epic (Relation): Link to Epics database ← CREATE THIS RELATION
- Status (Select): Options with colors:
  • Backlog (gray)
  • Drafted (light blue)
  • Ready (blue)
  • In Progress (yellow)
  • Review (orange)
  • Done (green)
  • Deferred (red)
- Priority (Select): Critical (red), High (orange), Medium (yellow), Low (gray)
- Started (Date)
- Completed (Date)
- Reviewed (Date): Code review date
- Deliverables (Text): What was built
- Notes (Text): Implementation details
- Jira ID (Text): External tracking reference

VIEWS TO CREATE:

1. "By Epic" (Table view) - DEFAULT:
   - Group by Epic relation
   - Sort by ID within groups
   - Show: ID, Title, Status, Priority, Completed

2. "Kanban" (Board view):
   - Group by Status
   - Sub-group by Epic
   - Card size: small
   - Show: ID, Title, Epic

3. "Active Sprint" (Table view):
   - Filter: Status = "In Progress" OR Status = "Review" OR Status = "Ready"
   - Sort by Priority (Critical first)
   - Show: ID, Title, Epic, Status, Priority

4. "Completed" (Calendar view):
   - Date property: Completed
   - Filter: Status = "Done"
   - Good for seeing delivery velocity

5. "Backlog" (List view):
   - Filter: Status = "Backlog" OR Status = "Drafted"
   - Group by Epic
   - Compact display

SAMPLE DATA (create 3-4 stories per epic, example):
- E1.1 | Set up Next.js 15 project | E1 | Done | 2025-11-24
- E1.2 | Configure Supabase Auth | E1 | Done | 2025-11-24
- E5.2 | Implement LangChain agent with 11 tools | E5 | Done | 2025-12-01
- E8.1 | Data model and CRUD API | E8 | Drafted | Ready for dev

After creating, go back to Epics database and:
1. Add "Stories" relation property pointing to this database
2. Add "Story Count" rollup: Count of Stories relation
3. Add "Completed Stories" rollup: Count where Status = Done
4. Add "Progress" formula: Completed Stories / Story Count * 100

VISUAL STYLING:
- Icon: 📋 (clipboard)
- Use color coding extensively in Status column
```

---

### Prompt 1.3: Create Features Catalog Database

```
Create a full-page database called "Features Catalog" to document all platform capabilities.

DATABASE PROPERTIES:
- Name (Title): Feature name
- Epic (Relation): Link to Epics database
- Status (Select):
  • Backlog (gray)
  • In Progress (yellow)
  • Shipped (green)
  • Deprecated (red)
- Category (Select):
  • Core (purple) - fundamental platform capabilities
  • Chat (blue) - conversational AI features
  • Data Room (cyan) - document management
  • Knowledge (green) - findings and analysis
  • Deliverables (orange) - IRL, Q&A, CIM outputs
  • Learning (pink) - feedback and improvement
- Priority (Select): Critical, High, Medium, Low
- Description (Text): What this feature does
- User Value (Text): Business value for analysts
- Technical Notes (Text): Implementation approach
- Related Features (Relation): Self-relation to Features Catalog
- Release Date (Date): When shipped
- Cover (Files & media): Feature screenshot or diagram

VIEWS TO CREATE:

1. "Gallery" (Gallery view) - DEFAULT:
   - Card preview: Cover image
   - Card size: medium
   - Show: Name, Category, Status
   - Filter: Status != "Deprecated"
   - Group by Category
   - This creates a beautiful visual catalog!

2. "By Category" (Board view):
   - Group by Category
   - Show: Name, Status, Priority
   - Card preview: small

3. "Roadmap" (Table view):
   - Group by Status
   - Sort by Priority
   - Show: Name, Epic, Category, Release Date

4. "Shipped Features" (Gallery view):
   - Filter: Status = "Shipped"
   - Card size: large
   - Show: Name, Description (preview), Release Date
   - Great for showcasing what's been built

5. "Dependencies" (Table view):
   - Show: Name, Related Features, Epic
   - For understanding feature connections

INITIAL FEATURES (create with descriptions):

1. "Conversational Knowledge Base"
   - Category: Chat | Status: Shipped | Priority: Critical | Epic: E5
   - Description: Chat interface backed by semantic search (RAG). Multi-turn conversations with source citations and confidence indicators.
   - User Value: Ask natural language questions about documents. Get synthesized answers with clickable sources.
   - Technical: LangChain + LangGraph, 13 agent tools, SSE streaming

2. "Intelligent Document Processing"
   - Category: Core | Status: Shipped | Priority: Critical | Epic: E3
   - Description: Automated extraction using Docling parser and Gemini models. OCR, table extraction, formula preservation.
   - User Value: Documents analyzed automatically on upload. Financial metrics extracted without manual work.
   - Technical: Docling, tiered Gemini 2.5, 5-stage pipeline

3. "Knowledge Explorer"
   - Category: Knowledge | Status: Shipped | Priority: High | Epic: E4
   - Description: Browse, validate, and manage extracted findings. Semantic search, card/table views, contradiction detection.
   - User Value: Review all AI-extracted facts. Validate or reject findings. See contradictions and gaps.
   - Technical: pgvector HNSW, Neo4j relationships, virtual scrolling

4. "IRL Management"
   - Category: Deliverables | Status: Shipped | Priority: High | Epic: E6
   - Description: Template-based Information Request Lists with AI suggestions and folder auto-generation.
   - User Value: Start with industry templates, get AI suggestions, auto-create folder structure.
   - Technical: 4 YAML templates, 2 agent tools, PDF/Word export

5. "Learning Loop System"
   - Category: Learning | Status: Shipped | Priority: High | Epic: E7
   - Description: Continuous improvement through analyst feedback. Corrections, confidence adjustment, audit trails.
   - User Value: System learns from corrections, improving accuracy over time.
   - Technical: Append-only audit tables, feature flags, few-shot enhancement

6. "Data Room"
   - Category: Data Room | Status: Shipped | Priority: Critical | Epic: E2
   - Description: Secure document storage with folder/bucket views. Drag-drop upload with real-time processing status.
   - User Value: Familiar folder organization with automatic processing status.
   - Technical: GCS signed URLs, Supabase Realtime, Zustand

7. "Q&A Workflow"
   - Category: Deliverables | Status: Backlog | Priority: High | Epic: E8
   - Description: Generate questions for client, track answers, Excel round-trip for external collaboration.
   - User Value: Transform knowledge gaps into client questions. Export to Excel, import answers.
   - Technical: 7 new agent tools, optimistic locking, pattern matching

8. "Contradiction Detection"
   - Category: Knowledge | Status: Shipped | Priority: Medium | Epic: E4
   - Description: Automatic detection of conflicting information across documents using Neo4j and LLM analysis.
   - User Value: Flag when revenue is $5M in one doc but $4.8M in another.
   - Technical: Gemini 2.5 Pro, Neo4j CONTRADICTS relationships, 70% threshold

9. "Audit Trail"
   - Category: Learning | Status: Shipped | Priority: Medium | Epic: E7
   - Description: Complete tracking of all corrections, validations, and edits. CSV/JSON export.
   - User Value: Compliance trail for all knowledge base changes.
   - Technical: Append-only tables, RLS prevents UPDATE/DELETE

VISUAL STYLING:
- Icon: ✨ (sparkles)
- Gallery view should be visually striking - encourage adding cover images
- Use category colors consistently
```

---

## PHASE 2: TRACKING DATABASES

---

### Prompt 2.1: Create Bugs Database

```
Create a full-page database called "Bugs" for issue tracking.

DATABASE PROPERTIES:
- Title (Title): Bug description
- ID (Text): Identifier like "BUG-001"
- Status (Select):
  • Open (red)
  • In Progress (yellow)
  • Fixed (green)
  • Won't Fix (gray)
  • Duplicate (light gray)
- Severity (Select):
  • Critical (dark red) - system down, data loss
  • High (red) - major feature broken
  • Medium (orange) - feature impaired
  • Low (yellow) - minor issue
- Priority (Select): P0 (red), P1 (orange), P2 (yellow), P3 (gray)
- Feature (Relation): Link to Features Catalog database
- Epic (Relation): Link to Epics database
- Story (Relation): Link to Stories database
- Reported Date (Date)
- Fixed Date (Date)
- Reporter (Text): Who found it
- Assignee (Text): Who's fixing it
- Description (Text): Full bug details
- Steps to Reproduce (Text)
- Expected Behavior (Text)
- Actual Behavior (Text)
- Root Cause (Text): Why it happened
- Fix Description (Text): How it was fixed
- Environment (Select): Development, Staging, Production

VIEWS TO CREATE:

1. "Triage" (Board view) - DEFAULT:
   - Group by Status
   - Sort by Priority within groups
   - Show: Title, Severity, Feature
   - Card color by Severity
   - Great for bug triage meetings!

2. "By Severity" (Board view):
   - Group by Severity
   - Filter: Status = "Open" OR Status = "In Progress"
   - Show: Title, Status, Feature

3. "Open Bugs" (Table view):
   - Filter: Status = "Open"
   - Sort by Priority, then Severity
   - Show: ID, Title, Severity, Priority, Feature, Reported Date

4. "My Bugs" (Table view):
   - Filter: Assignee = current user (or leave as template)
   - Sort by Priority
   - Show: ID, Title, Status, Severity

5. "Recently Fixed" (List view):
   - Filter: Status = "Fixed"
   - Sort by Fixed Date descending
   - Show: Title, Fix Description, Fixed Date

6. "By Feature" (Table view):
   - Group by Feature relation
   - Great for seeing which features are buggy

BUG TEMPLATE (create as a template):
Title: [Component] - Brief description
---
**Environment**: Development / Staging / Production
**Browser**: Chrome / Safari / Firefox (version)

**Steps to Reproduce**:
1. Navigate to...
2. Click on...
3. Enter...

**Expected**: What should happen
**Actual**: What happens instead

**Console Errors**: (paste any JS errors)
**Screenshots**: (attach)

VISUAL STYLING:
- Icon: 🐛 (bug)
- Use red tones for severity/status colors
- Card preview should show Severity badge prominently
```

---

### Prompt 2.2: Create Tech Debt Database

```
Create a full-page database called "Tech Debt" for tracking technical improvements.

DATABASE PROPERTIES:
- Title (Title): What needs to be done
- ID (Text): Identifier like "TD-001"
- Status (Select):
  • Open (red)
  • In Progress (yellow)
  • Resolved (green)
  • Deferred (blue)
  • Won't Fix (gray)
- Priority (Select): Critical, High, Medium, Low
- Category (Select):
  • Code Quality (purple) - refactoring, patterns
  • Testing (blue) - missing tests, coverage
  • Documentation (cyan) - missing docs
  • Performance (green) - speed, efficiency
  • Security (red) - vulnerabilities
  • Infrastructure (orange) - DevOps, CI/CD
- Source (Select):
  • Retrospective
  • Code Review
  • Bug Investigation
  • Security Audit
  • Performance Testing
- Epic (Relation): Link to Epics database
- Story (Relation): Link to Stories database
- Created Date (Date)
- Resolved Date (Date)
- Effort (Select): XS (1h), S (2-4h), M (1d), L (2-3d), XL (1w+)
- Description (Text): Full details
- Impact (Text): What happens if we don't fix this
- Resolution (Text): How it was fixed
- Defer Reason (Text): Why we're deferring (if applicable)

VIEWS TO CREATE:

1. "Priority Matrix" (Board view) - DEFAULT:
   - Group by Priority
   - Filter: Status = "Open" OR Status = "In Progress"
   - Card color by Category
   - Show: Title, Effort, Source

2. "By Category" (Board view):
   - Group by Category
   - Show: Title, Priority, Effort, Status

3. "Backlog" (Table view):
   - Filter: Status = "Open"
   - Sort by Priority, then Effort
   - Show: ID, Title, Priority, Category, Effort, Source

4. "Quick Wins" (Table view):
   - Filter: Effort = "XS" OR Effort = "S"
   - Filter: Status = "Open"
   - Sort by Priority
   - Great for finding easy improvements!

5. "From Retrospectives" (List view):
   - Filter: Source = "Retrospective"
   - Group by Epic
   - Shows patterns in what we're learning

6. "Deferred" (Table view):
   - Filter: Status = "Deferred"
   - Show: Title, Priority, Defer Reason, Epic

INITIAL DATA:
1. TD-001 | Add E2E tests for Data Room | Resolved | Testing | Epic 2 Retrospective
   Resolution: Created Playwright test suite with 15 tests

2. TD-002 | Add rate limiting on document endpoints | Deferred | Security | Epic 2 Retrospective
   Defer Reason: Could block power users. Revisit before production.

3. TD-003 | Test sharding / parallel execution | Resolved | Testing | Epic 3 Retrospective
   Resolution: Implemented 3-way CI sharding (41s → ~3s/shard)

4. TD-004 | Shared Supabase test utilities | Resolved | Testing | Epic 3 Retrospective
   Resolution: Created __tests__/utils/supabase-mock.ts

5. TD-005 | E7.6 Unit Tests | Open | Medium | Testing | Epic 7 Retrospective
   Description: Add tests for correction propagation and review queue

VISUAL STYLING:
- Icon: 🔧 (wrench)
- Priority Matrix view is key - make it visually clear what's urgent
```

---

### Prompt 2.3: Create Retrospectives Database

```
Create a full-page database called "Retrospectives" for capturing lessons learned.

DATABASE PROPERTIES:
- Title (Title): Retrospective name (e.g., "Epic 5 Retrospective")
- Epic (Relation): Link to Epics database
- Date (Date): When conducted
- Duration (Text): How long the epic took (e.g., "2 days")
- Stories Completed (Number): Count of finished stories
- Tests Added (Number): New test count
- What Went Well (Text): Positives to continue
- What Could Be Better (Text): Areas for improvement
- Action Items (Text): Concrete next steps
- Key Metrics (Text): Duration, coverage, velocity
- Tech Debt Created (Relation): Link to Tech Debt database

VIEWS TO CREATE:

1. "Timeline" (List view) - DEFAULT:
   - Sort by Date descending
   - Show: Title, Epic, Duration, Stories Completed
   - Expanded preview showing What Went Well

2. "By Epic" (Gallery view):
   - Card size: medium
   - Show: Title, Date, Key Metrics
   - One card per epic retro
   - Card cover from page content

3. "Learnings" (Table view):
   - Show: Title, What Went Well, What Could Be Better
   - Great for finding patterns across retros

4. "Action Tracking" (Table view):
   - Show: Title, Action Items, Tech Debt Created
   - For following up on commitments

INITIAL DATA:
Create retrospective entries for E1-E7 with key learnings:

1. Epic 1 Retrospective | 2025-11-25 | 2 days | 9 stories
   - Well: Fast foundation, clean architecture decisions
   - Better: Could have set up more testing infrastructure
   - Actions: Establish test patterns early

2. Epic 5 Retrospective | 2025-12-02 | 2 days | 8 stories
   - Well: Prerequisites investment paid off, fastest epic
   - Better: E5.3 unit test coverage thin
   - Actions: Neo4j write integration fixed

3. Epic 7 Retrospective | 2025-12-08 | 2 days | 6 stories
   - Well: Source validation flow prevents KB contamination
   - Better: E7.6 tests deferred
   - Actions: Review queue ready for E8/E9

VISUAL STYLING:
- Icon: 🔄 (cycle arrows)
- Gallery view should feel like a timeline of learnings
```

---

## PHASE 3: IDEAS DATABASES

---

### Prompt 3.0a: Create Ideas Database

```
Create a full-page database called "Ideas" for capturing concepts, improvements, and project ideas.

DATABASE PROPERTIES:
- Title (Title): Idea name
- ID (Text): Identifier like "IDEA-001"
- Status (Select):
  • Captured (gray) - just recorded
  • Exploring (blue) - being developed
  • Active (yellow) - has tasks in progress
  • Completed (green) - all tasks done
  • Parked (light gray) - on hold
  • Rejected (red) - won't pursue
- Type (Select):
  • Feature (purple) - new capability
  • Improvement (blue) - enhance existing
  • Experiment (cyan) - try something new
  • Research (green) - investigate
  • Process (orange) - workflow change
- Priority (Select): Critical, High, Medium, Low
- Project/Feature (Relation): Link to Features Catalog ← relates ideas to features
- Expected Impact (Select): High, Medium, Low
- Effort Estimate (Select): XS (1h), S (2-4h), M (1d), L (2-3d), XL (1w+)
- Owner (Text): Who's championing this idea
- Created Date (Date)
- Target Date (Date): Optional deadline
- Description (Text): Full idea details
- Success Criteria (Text): How we'll know it worked
- Notes (Text): Additional context, links, etc.

VIEWS TO CREATE:

1. "Idea Board" (Board view) - DEFAULT:
   - Group by Status
   - Sort by Priority within groups
   - Show: Title, Type, Priority, Owner
   - Card color by Type
   - Drag ideas through the pipeline!

2. "By Type" (Board view):
   - Group by Type
   - Filter: Status NOT in (Rejected, Parked)
   - Show: Title, Status, Priority

3. "Active Ideas" (Gallery view):
   - Filter: Status = "Active" OR Status = "Exploring"
   - Card size: medium
   - Show: Title, Description preview, Owner
   - Great for seeing what's being worked on

4. "Priority Matrix" (Table view):
   - Sort by Priority, then Expected Impact
   - Show: Title, Type, Status, Priority, Impact, Effort
   - Good for prioritization discussions

5. "My Ideas" (Table view):
   - Filter: Owner = current user (customize per user)
   - Sort by Status, then Created Date
   - Personal idea tracker

6. "By Project" (Table view):
   - Group by Project/Feature relation
   - Shows ideas organized by feature area

VISUAL STYLING:
- Icon: 💭 (thought bubble)
- Board view is the main interface - make it prominent
- Use Type colors consistently
```

---

### Prompt 3.0b: Create Tasks Database

```
Create a full-page database called "Tasks" for actionable work items with subtasks and progress tracking.

DATABASE PROPERTIES:
- Title (Title): Task name
- ID (Text): Identifier like "TASK-001"
- Status (Select):
  • To Do (gray)
  • In Progress (yellow)
  • Blocked (red)
  • Review (orange)
  • Done (green)
- Priority (Select): Critical, High, Medium, Low
- Parent Idea (Relation): Link to Ideas database ← connects task to idea
- Project/Feature (Relation): Link to Features Catalog ← attribute to projects
- Assignee (Text): Who's doing this
- Due Date (Date)
- Started Date (Date)
- Completed Date (Date)
- Time Estimate (Select): 15m, 30m, 1h, 2h, 4h, 1d, 2d, 1w
- Time Spent (Text): Actual time taken
- Progress (Number, percent format): 0-100% completion
- Description (Text): Task details
- Subtasks (Text): Checklist format, e.g.:
  - [ ] Subtask 1
  - [ ] Subtask 2
  - [x] Subtask 3 (completed)
- Blockers (Text): What's preventing progress
- Notes (Text): Updates, links, context

VIEWS TO CREATE:

1. "Task Board" (Board view) - DEFAULT:
   - Group by Status
   - Sort by Priority, then Due Date
   - Show: Title, Priority, Assignee, Progress
   - Card color by Priority
   - Kanban for daily work!

2. "My Tasks" (Table view):
   - Filter: Assignee = current user
   - Sort by Due Date
   - Show: Title, Status, Priority, Due Date, Progress
   - Personal task list

3. "By Idea" (Table view):
   - Group by Parent Idea relation
   - Sort by Status
   - Show: Title, Status, Assignee, Progress
   - See all tasks for each idea

4. "By Project" (Board view):
   - Group by Project/Feature relation
   - Show: Title, Status, Progress
   - Project-centric view

5. "Due This Week" (Calendar view):
   - Date property: Due Date
   - Filter: Status NOT in (Done)
   - Weekly calendar view

6. "Progress Tracker" (Table view):
   - Show: Title, Parent Idea, Progress, Status
   - Include progress bar visualization
   - Sort by Progress descending

7. "Blocked" (List view):
   - Filter: Status = "Blocked"
   - Show: Title, Blockers, Assignee
   - For standup meetings

TASK TEMPLATE (create as database template):
Title: [Action verb] + [Object]
---
**Description**: What needs to be done

**Subtasks**:
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

**Acceptance Criteria**:
- Criteria 1
- Criteria 2

**Notes**: Context, links, references

VISUAL STYLING:
- Icon: ✅ (checkmark)
- Progress column should show percentage bar
- Board view is primary - drag tasks to update status
- Use Due Date coloring (overdue = red)
```

---

### Prompt 3.0c: Create Ideas Hub Page

```
Create a page called "Ideas Hub" as the central hub for ideas and tasks.

PAGE STRUCTURE:

1. HEADER:
   - Icon: 🚀
   - Title: "Ideas Hub"
   - Description: "Capture ideas, track progress, and turn concepts into reality"

2. QUICK CAPTURE CALLOUT:
   - Callout (blue):
   "💡 Have an idea? Click '+ New' in the Ideas Board below to capture it!"

3. IDEAS PIPELINE:
   - Heading: "💭 Ideas Pipeline"
   - Linked database: Ideas
   - View: Board (grouped by Status)
   - Full width
   - Shows flow from Captured → Completed

4. TWO COLUMN LAYOUT:

   Left Column - "📊 Active Tasks":
   - Linked database: Tasks
   - View: Board (grouped by Status)
   - Filter: Status NOT in (Done)
   - Compact card view

   Right Column - "📈 Progress Summary":
   - Callout with quick stats (manually updated):
     • Active Ideas: X
     • Tasks In Progress: Y
     • Tasks Completed This Week: Z

5. MY WORK SECTION:
   - Heading: "👤 My Tasks"
   - Linked database: Tasks
   - View: Table (My Tasks view)
   - Limit to 10 items
   - Personal quick access

6. PRIORITIZATION MATRIX:
   - Heading: "⚖️ Idea Prioritization"
   - Linked database: Ideas
   - View: Table (Priority Matrix view)
   - Filter: Status = "Captured" OR Status = "Exploring"
   - For prioritization discussions

7. BY PROJECT SECTION:
   - Heading: "📁 Ideas by Project"
   - Linked database: Ideas
   - View: Table (By Project view)
   - Collapsed groups by default

8. RECENT COMPLETIONS:
   - Heading: "✅ Recently Completed"
   - Linked database: Tasks
   - View: List
   - Filter: Status = "Done"
   - Sort by Completed Date descending
   - Limit to 5 items

VISUAL STYLING:
- Board views are the main interaction point
- Keep it action-oriented with quick capture
- Progress tracking should be visible at a glance
```

---

### Prompt 3.0d: Configure Ideas ↔ Tasks Relationship

```
Configure the bidirectional relationship between Ideas and Tasks databases:

1. In the IDEAS database:
   - The "Tasks" relation should already exist from the Tasks database
   - If not, add relation property "Tasks" linking to Tasks database
   - Add rollup property "Task Count": Count of Tasks relation
   - Add rollup property "Tasks Completed": Count of Tasks where Status = Done
   - Add rollup property "Task Progress": Average of Tasks.Progress (shows overall completion %)
   - Add formula property "Completion Rate": Tasks Completed / Task Count * 100

2. In the TASKS database:
   - Ensure "Parent Idea" relation links to Ideas database
   - This should be a two-way relation
   - The reverse property in Ideas is called "Tasks"

3. Update Ideas views:
   - Add "Task Count" and "Task Progress" to the "Active Ideas" gallery card preview
   - Add "Completion Rate" to the "Priority Matrix" table view

4. Verify the relations work:
   - Create a test idea
   - Create 2-3 tasks linked to that idea
   - Verify Task Count rollup shows correct number
   - Mark one task as Done and verify Tasks Completed updates
   - Check that Task Progress shows the average

RELATION SUMMARY:
- Ideas.Tasks → Tasks (one-to-many, reverse: "Parent Idea")
- Tasks.Parent Idea → Ideas (many-to-one)
- Tasks.Project/Feature → Features Catalog (many-to-one)
- Ideas.Project/Feature → Features Catalog (many-to-one)
```

---

### Prompt 3.1: Create Feature Requests Database

```
Create a full-page database called "Feature Requests" for capturing user and team ideas.

DATABASE PROPERTIES:
- Title (Title): Request title
- ID (Text): Like "FR-001"
- Status (Select):
  • New (blue) - just submitted
  • Under Review (yellow) - being evaluated
  • Planned (green) - accepted, scheduled
  • Backlog (gray) - accepted, not scheduled
  • Won't Do (red) - rejected
- Priority (Select): Critical, High, Medium, Low
- Category (Select): Chat, Data Room, Knowledge, Deliverables, UX, Performance, Integration
- Requester (Text): Who asked for this
- Created Date (Date)
- Description (Text): What the user wants
- User Value (Text): Why this matters
- Potential Solution (Text): Ideas for implementation
- Related Features (Relation): Link to Features Catalog
- Planned Epic (Relation): Link to Epics (if scheduled)
- Votes (Number): Interest count - use for prioritization!

VIEWS TO CREATE:

1. "Inbox" (Board view) - DEFAULT:
   - Group by Status
   - Sort by Votes descending within groups
   - Show: Title, Category, Votes
   - Card preview: medium

2. "Top Voted" (Table view):
   - Sort by Votes descending
   - Show: Title, Category, Status, Votes, User Value
   - Great for prioritization discussions!

3. "By Category" (Board view):
   - Group by Category
   - Filter: Status != "Won't Do"
   - Show: Title, Status, Votes

4. "Planned" (List view):
   - Filter: Status = "Planned"
   - Group by Planned Epic
   - Shows what's coming in each epic

5. "Gallery" (Gallery view):
   - Filter: Status = "Planned" OR Status = "Under Review"
   - Card size: small
   - Show: Title, User Value preview
   - Good for stakeholder presentations

INITIAL REQUESTS:
1. FR-001 | Chat Export (Markdown/PDF/Word) | Planned | Chat | Medium
   - Votes: 8
   - Description: Export conversations for sharing with team
   - User Value: Share insights with senior bankers
   - Epic: E5 (deferred as E5.8)

2. FR-002 | Multi-Deal Dashboard | New | UX | High
   - Votes: 12
   - Description: Status across multiple deals in one view
   - User Value: Associates managing 3-5 deals need unified view

3. FR-003 | Document Comparison View | New | Knowledge | High
   - Votes: 10
   - Description: Side-by-side diff of document versions
   - User Value: See what changed in updated financials

4. FR-004 | Real-time Collaboration | New | UX | High
   - Votes: 15
   - Description: Multiple users on same deal, see activity
   - User Value: Deal teams need to work together

VISUAL STYLING:
- Icon: 💡 (lightbulb)
- Make Votes column prominent - it drives prioritization
- Top Voted view is key for roadmap planning
```

---

### Prompt 3.2: Create Enhancement Ideas Database

```
Create a full-page database called "Enhancement Ideas" for internal optimization ideas.

DATABASE PROPERTIES:
- Title (Title): Enhancement title
- ID (Text): Like "EN-001"
- Status (Select):
  • Idea (gray) - just captured
  • Researching (blue) - being investigated
  • Validated (green) - confirmed valuable
  • Planned (purple) - scheduled
  • Implemented (dark green) - shipped
- Category (Select):
  • Performance (green) - speed, efficiency
  • UX (blue) - user experience
  • AI Quality (purple) - model improvements
  • Developer Experience (orange) - DX, tooling
  • Cost Optimization (yellow)
- Impact (Select): High, Medium, Low
- Effort (Select): XS, S, M, L, XL
- Description (Text): What to improve
- Current State (Text): How it works now
- Proposed State (Text): How it should work
- Success Metrics (Text): How to measure improvement
- Related Features (Relation): Link to Features Catalog

VIEWS TO CREATE:

1. "Impact/Effort Matrix" (Board view) - DEFAULT:
   - Group by Impact
   - Secondary sort by Effort
   - Show: Title, Effort, Category
   - Cards colored by Category
   - This is THE view for prioritization!

2. "Quick Wins" (Table view):
   - Filter: Impact = "High" AND (Effort = "XS" OR Effort = "S")
   - Sort by Impact
   - High impact, low effort = do first!

3. "By Category" (Board view):
   - Group by Category
   - Show: Title, Impact, Effort, Status

4. "Pipeline" (Board view):
   - Group by Status
   - Shows flow from Idea → Implemented

INITIAL ENHANCEMENTS:
1. EN-001 | Streaming Token Batching | Idea | Performance | Medium Impact | S Effort
   - Current: Each token triggers React re-render
   - Proposed: Buffer tokens every 50ms for smoother rendering
   - Metrics: Reduce paint events by 80%

2. EN-002 | Finding Deduplication | Idea | AI Quality | High Impact | M Effort
   - Current: Same fact from multiple docs creates duplicates
   - Proposed: Check semantic similarity before creating finding
   - Metrics: Reduce duplicate findings by 50%

3. EN-003 | Keyboard Navigation | Idea | UX | Medium Impact | M Effort
   - Current: Mouse-only navigation in tables
   - Proposed: Arrow keys, j/k, Enter to open
   - Metrics: 30% keyboard usage after 1 week

VISUAL STYLING:
- Icon: 📈 (chart)
- Impact/Effort Matrix is the star view - make it clear
- Use distinct colors for each category
```

---

### Prompt 3.3: Create Research Topics Database

```
Create a full-page database called "Research Topics" for technical investigations.

DATABASE PROPERTIES:
- Title (Title): Research question
- Status (Select):
  • Proposed (gray)
  • In Progress (yellow)
  • Completed (green)
  • Abandoned (red)
- Category (Select): AI/ML, Infrastructure, UX, Integration, Security
- Owner (Text): Who's researching
- Started (Date)
- Completed (Date)
- Question (Text): What we're trying to learn
- Findings (Text): What we discovered
- Recommendations (Text): Suggested actions
- Related Features (Relation): Link to Features Catalog
- Related Enhancements (Relation): Link to Enhancement Ideas

VIEWS TO CREATE:

1. "Research Board" (Board view) - DEFAULT:
   - Group by Status
   - Show: Title, Category, Owner
   - Card color by Category

2. "Active Research" (List view):
   - Filter: Status = "In Progress"
   - Show: Title, Question, Owner, Started

3. "Knowledge Base" (Gallery view):
   - Filter: Status = "Completed"
   - Card size: large
   - Show: Title, Findings preview, Recommendations preview
   - This is where learnings live!

4. "By Category" (Table view):
   - Group by Category
   - Show: Title, Status, Question

INITIAL RESEARCH:
1. "Fine-Tuning vs. Few-Shot for M&A Domain" | Completed | AI/ML
   - Question: Should we fine-tune models or use few-shot prompting?
   - Findings: Few-shot with 5-10 examples achieves 85%+ accuracy. Fine-tuning needs 1000+ examples we don't have.
   - Recommendations: Use few-shot for MVP, collect corrections as future training data.

2. "Vector DB Scaling Strategy" | Proposed | Infrastructure
   - Question: When does pgvector become a bottleneck?
   - Related: Finding Deduplication enhancement

3. "Document Versioning Detection" | Proposed | AI/ML
   - Question: Can we auto-detect updated versions of documents?
   - Related: Document Comparison feature request

VISUAL STYLING:
- Icon: 🔬 (microscope)
- Gallery view of completed research is the knowledge base
```

---

### Prompt 3.4: Create Technical Decisions Database

```
Create a full-page database called "Technical Decisions" for architecture decision records (ADRs).

DATABASE PROPERTIES:
- Decision (Title): Decision title
- Date (Date): When decided
- Status (Select):
  • Proposed (yellow)
  • Accepted (green)
  • Superseded (gray)
  • Deprecated (red)
- Category (Select):
  • Infrastructure (orange)
  • Database (blue)
  • AI/ML (purple)
  • Frontend (cyan)
  • API (green)
  • Security (red)
- Context (Text): Why this decision was needed
- Options Considered (Text): Alternatives evaluated
- Decision (Text): What was chosen and why
- Consequences (Text): Trade-offs and implications
- Superseded By (Relation): Self-relation to Technical Decisions
- Related Features (Relation): Link to Features Catalog

VIEWS TO CREATE:

1. "Timeline" (Table view) - DEFAULT:
   - Sort by Date descending
   - Show: Decision, Date, Category, Status
   - Current decisions first

2. "By Category" (Board view):
   - Group by Category
   - Show: Decision, Date, Status
   - Good for seeing all DB decisions together

3. "Active Decisions" (List view):
   - Filter: Status = "Accepted"
   - Group by Category
   - The current architecture

4. "Decision History" (Table view):
   - Show all including superseded
   - Shows evolution of thinking

INITIAL DECISIONS:
1. "FastAPI Python Backend" | 2025-11-26 | Accepted | Infrastructure
   - Context: Need backend for Docling, LLM, job queue
   - Options: Node.js+subprocess, FastAPI, Serverless
   - Decision: FastAPI for native Docling/LangChain integration
   - Consequences: +Native ML integration, -Need Python skills

2. "pgvector for Vector Search" | 2025-11-26 | Accepted | Database
   - Context: Need vector similarity for RAG
   - Options: Pinecone, Weaviate, pgvector
   - Decision: pgvector with HNSW for MVP simplicity
   - Consequences: +Single database, -2000-dim limit

3. "Google Cloud Storage" | 2025-11-25 | Accepted | Infrastructure
   - Context: Need secure document storage
   - Options: Supabase Storage, S3, GCS
   - Decision: GCS for native Gemini integration
   - Consequences: +Direct Gemini analysis, -Another cloud provider

4. "Tiered Gemini Models" | 2025-11-27 | Accepted | AI/ML
   - Context: LLM cost optimization
   - Decision: Flash (extraction), Pro (analysis), Flash-Lite (batch)
   - Consequences: +Cost optimized, -Routing complexity

5. "LangGraph for Agent" | 2025-12-01 | Accepted | AI/ML
   - Context: Chat agent needs tool calling, memory
   - Decision: LangGraph 1.0 with createReactAgent
   - Consequences: +Production-ready, -LangChain coupling

6. "Append-Only Audit Tables" | 2025-12-07 | Accepted | Database
   - Context: Learning loop compliance needs
   - Decision: No UPDATE/DELETE on audit tables
   - Consequences: +Complete audit trail, -Storage growth

VISUAL STYLING:
- Icon: ⚖️ (scales)
- Timeline view shows decision evolution
- Use page content for full ADR format
```

---

## PHASE 4: PAGES WITH LINKED DATABASES

---

### Prompt 4.0: Create Knowledge Base Hub (MAIN LANDING PAGE)

```
Create a page called "Hub" as the central landing page and navigation hub for the entire Manda Platform knowledge base. This should be the FIRST page users see - a beautifully designed overview with quick access to all major sections.

PAGE STRUCTURE:

1. HERO SECTION:
   - Icon: 🧠 (brain)
   - Title: "Manda Knowledge Base"
   - Large cover image: Use a professional gradient or abstract pattern representing intelligence/knowledge
   - Callout block (gradient blue/purple background):
     "Welcome to the Manda Platform Knowledge Base - your central hub for tracking development, features, ideas, and documentation. Navigate to any section below."

2. STATUS BANNER:
   - Inline database or callout showing:
     • Current Phase: "Phase 1 MVP"
     • Active Epic: "E8 - Q&A Workflow"
     • Epics Complete: "7 of 9"
     • Status indicator: 🟢 Development Active
   - Keep this compact, single row

3. MAIN SECTIONS - Gallery Layout (use 2x3 or 3x2 grid of linked cards):
   Create 6 prominent navigation cards using callouts or linked page previews:

   Row 1:
   📊 **Home Dashboard**
   "Sprint overview, bugs, recent activity"
   → Links to: Home page

   📦 **Product**
   "Vision, features catalog, personas"
   → Links to: Product page

   ⚙️ **Engineering**
   "Architecture, APIs, infrastructure"
   → Links to: Engineering page

   Row 2:
   🚀 **Ideas Hub**
   "Ideas pipeline and task tracking"
   → Links to: Ideas Hub page

   📋 **Development**
   "Epics, stories, sprints"
   → Links to: Development Tracking page

   📚 **Documentation**
   "User guides, developer docs"
   → Links to: Documentation page

4. QUICK ACCESS - Databases Section:
   Heading: "📁 Jump to Database"

   Create a 4-column layout with icon links:

   Column 1 - Core:
   🎯 Epics
   📋 Stories
   ✨ Features

   Column 2 - Tracking:
   🐛 Bugs
   🔧 Tech Debt
   🔄 Retrospectives

   Column 3 - Ideas:
   💭 Ideas
   ✅ Tasks
   💡 Feature Requests

   Column 4 - Research:
   📈 Enhancements
   🔬 Research
   ⚖️ Decisions

5. CURRENT SPRINT SNAPSHOT:
   Heading: "🎯 Active Sprint"
   - Linked database: Stories
   - View: Kanban (small cards)
   - Filter: Status IN (Ready, In Progress, Review)
   - Limit: Show only current sprint items
   - Compact view, no full database link shown

6. EPIC ROADMAP PREVIEW:
   Heading: "🗺️ Epic Roadmap"
   - Linked database: Epics
   - View: Timeline
   - Show: All epics with Started → Completed dates
   - Compact, gives quick sense of progress

7. RECENT UPDATES (Two Columns):

   Left: "✅ Recently Completed"
   - Linked database: Stories
   - View: List
   - Filter: Status = Done
   - Sort: Completed DESC
   - Limit: 5 items

   Right: "💡 Latest Ideas"
   - Linked database: Ideas
   - View: List
   - Filter: Status IN (Captured, Exploring)
   - Sort: Created Date DESC
   - Limit: 5 items

8. SETUP PROGRESS (Collapsible Toggle):
   ▶ "📝 Knowledge Base Setup Checklist"

   When expanded, show:
   - [x] Phase 1: Core Databases (Epics, Stories, Features)
   - [x] Phase 2: Tracking (Bugs, Tech Debt, Retrospectives)
   - [x] Phase 3: Ideas System (Ideas, Tasks, Requests, Research, Decisions)
   - [x] Phase 4: Main Pages (Hub, Home, Product, Engineering, Ideas Hub, Docs)
   - [ ] Phase 5: Configure all database relations
   - [ ] Phase 6: Add initial data and templates

9. FOOTER:
   Divider
   Three columns:

   Left: "Manda Platform v1.0"
   Center: Links to key docs (PRD, Architecture, Tech Spec)
   Right: "Last updated: [date]"

VISUAL STYLING:
- Cover: Use a sleek, professional cover image (gradient, abstract tech pattern)
- Icon: 🧠 (brain) to represent knowledge/intelligence
- Use consistent spacing between sections
- Main section cards should have:
  • Colored emoji icons
  • Bold titles
  • Short 1-line descriptions
  • Hover effects if possible (Notion handles this)
- Keep database views compact - users should see the big picture
- Use dividers between major sections
- Gallery cards should feel clickable and inviting

MAKE THIS PAGE THE DEFAULT/HOME:
- Set this page as the workspace home or sidebar favorite
- All other pages should have a "← Back to Hub" link at the top
```

---

### Prompt 4.1: Create Home Dashboard

```
Create a page called "Home" as the main dashboard for the Manda Platform knowledge base.

PAGE STRUCTURE:

1. HEADER SECTION:
   - Large heading: "Manda - M&A Intelligence Platform"
   - Subheading: "A persistent knowledge synthesizer combining conversational AI with data room capabilities"
   - Callout box with current phase: "Phase 1 Implementation - Epics 1-7 Complete, Epic 8 In Progress"

2. QUICK NAVIGATION (use Notion columns - 5 columns):
   Column 1: Button/link "Features" → Features Catalog Gallery view
   Column 2: Button/link "Current Sprint" → Stories Active Sprint view
   Column 3: Button/link "Bugs" → Bugs Triage view
   Column 4: Button/link "Tech Debt" → Tech Debt Priority Matrix view
   Column 5: Button/link "Decisions" → Technical Decisions Timeline view

3. ACTIVE SPRINT SECTION:
   - Heading: "🎯 Current Sprint"
   - Linked database: Stories database
   - View: "Active Sprint" (filter: In Progress, Review, Ready)
   - Properties shown: ID, Title, Epic, Status, Priority

4. EPIC PROGRESS SECTION:
   - Heading: "📊 Epic Progress"
   - Linked database: Epics database
   - View: "Roadmap" (Timeline view)
   - Shows Started → Completed timeline

5. TWO COLUMN SECTION:

   Left Column - "🐛 Open Bugs":
   - Linked database: Bugs
   - View: Table, filtered to Status = Open
   - Sort by Priority
   - Show only: ID, Title, Severity, Priority
   - Limit to 5 items

   Right Column - "🔧 Tech Debt":
   - Linked database: Tech Debt
   - View: Table, filtered to Status = Open
   - Sort by Priority
   - Show only: ID, Title, Priority, Effort
   - Limit to 5 items

6. RECENT ACTIVITY SECTION:
   - Heading: "📅 Recent Completions"
   - Linked database: Stories
   - View: Table, filtered to Status = Done, sorted by Completed descending
   - Show: Title, Epic, Completed
   - Limit to 5 items

7. FOOTER:
   - Divider
   - Links to: Documentation, Architecture, PRD
   - Text: "Last updated: [date]"

VISUAL STYLING:
- Use a cover image that represents M&A/finance/technology
- Icon: 🏠 (house)
- Use dividers between sections
- Keep linked database views compact (toggle off full database link)
```

---

### Prompt 4.2: Create Product Section

```
Create a page called "Product" as a hub for product-related content.

PAGE STRUCTURE:

1. HEADER:
   - Page icon: 📦
   - Title: "Product"
   - Description: "Vision, features, and user personas for Manda Platform"

2. VISION CALLOUT:
   - Callout block (purple):
   "Manda is a comprehensive M&A intelligence platform combining conversational AI with data room capabilities. Background processing builds a persistent knowledge base that a conversational agent queries."

3. STRATEGIC GOALS (Toggle list):
   ▶ Reduce Due Diligence Time
     - Automate document analysis and extraction
   ▶ Improve Accuracy
     - AI-powered contradiction detection and source validation
   ▶ Enable Collaboration
     - Shared knowledge base with audit trails
   ▶ Accelerate Deliverables
     - Auto-generate IRLs, Q&A lists, and CIM sections

4. FEATURES SECTION:
   - Heading: "✨ Features Catalog"
   - Linked database: Features Catalog
   - View: Gallery (grouped by Category)
   - This is the star of the page!
   - Full width, medium card size
   - Shows the visual catalog of all features

5. SUB-PAGES (create as child pages):

   a. "Vision & Strategy":
      - Detailed vision statement
      - Market opportunity
      - Competitive positioning
      - Success metrics

   b. "User Personas":
      - Investment Banking Analyst persona
      - M&A Associate persona
      - Include: Goals, Pain Points, How Manda Helps

6. FEATURE ROADMAP:
   - Heading: "🗺️ Feature Roadmap"
   - Linked database: Features Catalog
   - View: Table, grouped by Status
   - Show: Name, Epic, Category, Priority
   - Filter out Deprecated

VISUAL STYLING:
- Gallery view is the centerpiece - make it prominent
- Use category colors consistently
- Add cover images to feature pages for gallery cards
```

---

### Prompt 4.3: Create Engineering Section

```
Create a page called "Engineering" as a hub for technical documentation.

PAGE STRUCTURE:

1. HEADER:
   - Icon: ⚙️
   - Title: "Engineering"
   - Description: "Architecture, decisions, API reference, and infrastructure"

2. ARCHITECTURE OVERVIEW (Embed or link):
   - Heading: "🏗️ System Architecture"
   - Code block with ASCII diagram:

   ```
   Frontend (Next.js 15)
        ↓
   API Layer (LangGraph Agent - 13 Tools)
        ↓
   Backend (FastAPI Python)
        ↓
   ┌────────────┬────────────┬────────────┐
   │ PostgreSQL │   Neo4j    │    GCS     │
   │ + pgvector │  Graph DB  │  Storage   │
   └────────────┴────────────┴────────────┘
   ```

3. TECH STACK TABLE:
   | Layer | Technology | Purpose |
   |-------|------------|---------|
   | Frontend | Next.js 15 + React 19 | UI |
   | Backend | FastAPI (Python 3.11+) | Processing |
   | AI Agent | LangChain + LangGraph | Chat |
   | Database | PostgreSQL (Supabase) | Data |
   | Vector | pgvector 0.8+ | Semantic search |
   | Graph | Neo4j 2025.01 | Relationships |

4. TECHNICAL DECISIONS:
   - Heading: "⚖️ Key Decisions"
   - Linked database: Technical Decisions
   - View: Timeline (sorted by date desc)
   - Filter: Status = Accepted
   - Show: Decision, Category, Date

5. SUB-PAGES (create as child pages):

   a. "API Reference":
      - Organized by domain (Auth, Projects, Documents, Chat, Findings, IRLs)
      - Code blocks with endpoint signatures

   b. "Database Schema":
      - Core tables with SQL definitions
      - Entity relationship descriptions

   c. "Infrastructure":
      - Deployment architecture
      - CI/CD pipeline
      - Environment variables

6. RESEARCH TOPICS:
   - Heading: "🔬 Active Research"
   - Linked database: Research Topics
   - View: Board (grouped by Status)
   - Filter: Status != Abandoned

VISUAL STYLING:
- Use code blocks for technical content
- Technical Decisions timeline is key
- Research board shows what's being investigated
```

---

### Prompt 4.4: Create Development Tracking Section

```
Create a page called "Development Tracking" as the sprint/project management hub.

PAGE STRUCTURE:

1. HEADER:
   - Icon: 📋
   - Title: "Development Tracking"
   - Description: "Epics, stories, bugs, and tech debt"

2. EPIC ROADMAP:
   - Heading: "🎯 Epic Roadmap"
   - Linked database: Epics
   - View: Timeline
   - Full width
   - Shows the full development timeline

3. TWO COLUMN LAYOUT:

   Left Column - "Current Sprint":
   - Linked database: Stories
   - View: Kanban (grouped by Status)
   - Filter: Status NOT in (Backlog, Done, Deferred)

   Right Column - "Sprint Stats":
   - Callout with metrics:
     • Active Epic: E8 - Q&A Workflow
     • Stories In Progress: X
     • Stories Done This Week: Y

4. BUG TRIAGE:
   - Heading: "🐛 Bug Triage"
   - Linked database: Bugs
   - View: Board (grouped by Status)
   - Compact view for triage meetings

5. TECH DEBT:
   - Heading: "🔧 Tech Debt"
   - Linked database: Tech Debt
   - View: Board (grouped by Priority)
   - Filter: Status = Open

6. COMPLETED WORK:
   - Heading: "✅ Recently Completed"
   - Linked database: Stories
   - View: Calendar (by Completed date)
   - Filter: Status = Done
   - Shows delivery cadence

7. SUB-PAGES:
   a. "Sprint Planning" - template for planning sessions
   b. "Retrospectives" - linked database of Retrospectives

VISUAL STYLING:
- Timeline view is the hero
- Kanban boards for active work
- Calendar shows delivery rhythm
```

---

### Prompt 4.5: Create Improvement Ideas Section

```
Create a page called "Improvement Ideas" as the innovation hub.

PAGE STRUCTURE:

1. HEADER:
   - Icon: 💡
   - Title: "Improvement Ideas"
   - Description: "Feature requests, enhancements, and research topics"

2. TOP VOTED REQUESTS:
   - Heading: "🔥 Top Requested Features"
   - Linked database: Feature Requests
   - View: Table, sorted by Votes descending
   - Show: Title, Category, Status, Votes
   - Limit to 10 items
   - This drives prioritization!

3. FEATURE REQUESTS:
   - Heading: "📥 Feature Requests"
   - Linked database: Feature Requests
   - View: Board (grouped by Status)
   - Full width
   - Shows pipeline from New → Planned

4. ENHANCEMENT MATRIX:
   - Heading: "📈 Enhancement Ideas"
   - Linked database: Enhancement Ideas
   - View: Board (grouped by Impact)
   - Show: Title, Effort, Category
   - Impact/Effort matrix is key!

5. RESEARCH:
   - Heading: "🔬 Research Topics"
   - Linked database: Research Topics
   - View: Gallery (filter: Completed)
   - Shows knowledge base of completed research

6. QUICK WINS CALLOUT:
   - Callout (green):
   "Looking for quick wins? Check Enhancement Ideas filtered by High Impact + Small Effort"
   - Link to Enhancement Ideas filtered view

VISUAL STYLING:
- Top Voted table is prominent
- Board views show pipeline flow
- Gallery of research for reference
```

---

### Prompt 4.6: Create Documentation Section

```
Create a page called "Documentation" as the docs hub.

PAGE STRUCTURE:

1. HEADER:
   - Icon: 📚
   - Title: "Documentation"
   - Description: "User guides, developer guides, and deployment documentation"

2. GETTING STARTED CALLOUT:
   - Callout (blue):
   "New to Manda? Start with the User Guide below."

3. USER GUIDES:
   - Heading: "👤 User Guides"
   - Toggle list with guides:

   ▶ Getting Started
     1. Create Account (email or Google OAuth)
     2. Create Project
     3. Upload Documents
     4. Wait for Processing
     5. Ask Questions in Chat
     6. Review Findings in Knowledge Explorer

   ▶ Data Room Guide
     - Folder vs Bucket views
     - Upload and processing

   ▶ Chat Guide
     - Natural language queries
     - Source citations
     - Quick actions

   ▶ IRL Guide
     - Templates
     - AI suggestions
     - Progress tracking

4. DEVELOPER GUIDES:
   - Heading: "👨‍💻 Developer Guides"
   - Sub-pages:

   a. "Local Development Setup"
      - Clone, install, configure
      - Start frontend, backend, databases

   b. "Testing Guide"
      - Unit tests (Vitest)
      - E2E tests (Playwright)
      - Backend tests (pytest)

   c. "Adding Agent Tools"
      - Tool definition pattern
      - Schema, implementation, tests

   d. "Database Migrations"
      - Creating migrations
      - Applying migrations
      - Type regeneration

5. DEPLOYMENT:
   - Heading: "🚀 Deployment"
   - Development environment
   - CI/CD pipeline description
   - Production architecture (planned)

VISUAL STYLING:
- Toggle lists keep content organized
- Code blocks for commands
- Clean, documentation-style layout
```

---

## FINAL SETUP: Configure Relations

After creating all databases, configure these cross-database relations:

```
Run this prompt in each database to set up relations:

"Configure the following relations in the [DATABASE NAME] database:

1. Add relation property '[PROPERTY NAME]' linking to '[TARGET DATABASE]'
2. Set relation type to [one-way / two-way]
3. If two-way, the reverse property in [TARGET DATABASE] should be called '[REVERSE NAME]'

Relations to configure:
- Features.Epic → Epics (two-way, reverse: "Features")
- Features.Stories → Stories (two-way, reverse: "Implements Feature")
- Features.Related Features → Features (two-way, reverse: same)
- Stories.Epic → Epics (two-way, reverse: "Stories")
- Stories.Bugs → Bugs (two-way, reverse: "Story")
- Stories.Tech Debt → Tech Debt (two-way, reverse: "Story")
- Bugs.Feature → Features (two-way, reverse: "Bugs")
- Bugs.Epic → Epics (one-way)
- Tech Debt.Epic → Epics (one-way)
- Tech Debt.Story → Stories (one-way)
- Retrospectives.Epic → Epics (two-way, reverse: "Retrospective")
- Retrospectives.Tech Debt Created → Tech Debt (one-way)
- Feature Requests.Related Features → Features (one-way)
- Feature Requests.Planned Epic → Epics (one-way)
- Enhancement Ideas.Related Features → Features (one-way)
- Research Topics.Related Features → Features (one-way)
- Research Topics.Related Enhancements → Enhancement Ideas (one-way)
- Technical Decisions.Superseded By → Technical Decisions (two-way)
- Technical Decisions.Related Features → Features (one-way)

After configuring relations, add these rollup properties to Epics:
- Story Count: Count of Stories relation
- Completed Stories: Count of Stories where Status = Done
- Bug Count: Count of Features.Bugs (via Features relation)
- Feature Count: Count of Features relation"
```

---

## View Recommendations Summary

| Database | Default View | Best For |
|----------|--------------|----------|
| Epics | Timeline | Roadmap visualization |
| Stories | By Epic (Table) | Sprint planning |
| Features | Gallery | Showcasing capabilities |
| Bugs | Triage (Board) | Bug triage meetings |
| Tech Debt | Priority Matrix (Board) | Prioritization |
| Retrospectives | Timeline (List) | Learning history |
| **Ideas** | Idea Board (Board) | Idea pipeline tracking |
| **Tasks** | Task Board (Board) | Daily work management |
| Feature Requests | Inbox (Board) | Request triage |
| Enhancement Ideas | Impact/Effort Matrix | Quick win identification |
| Research Topics | Research Board | Active research |
| Technical Decisions | Timeline | Decision history |

---

## Color Scheme Recommendations

Use consistent colors across databases:

**Status Colors:**
- Backlog/Open: Gray
- In Progress/Active: Yellow
- Review/Under Review: Orange
- Done/Shipped/Resolved: Green
- Deferred/Won't Do: Red/Blue

**Priority Colors:**
- Critical/P0: Dark Red
- High/P1: Red/Orange
- Medium/P2: Yellow
- Low/P3: Gray

**Category Colors (Features):**
- Core: Purple
- Chat: Blue
- Data Room: Cyan
- Knowledge: Green
- Deliverables: Orange
- Learning: Pink