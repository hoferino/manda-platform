# Figma AI Prompts - Manda Platform Prototype

**Purpose:** Generate clickable prototype screens for user testing
**Fictional Company:** TechFlow GmbH (Munich B2B SaaS, €12.4M ARR, sell-side M&A)
**Created:** 2025-12-01

---

## Screen 1: Projects Overview

**Prompt:**
```
Design a modern SaaS dashboard showing a list of M&A deal projects.

Header: "Manda" logo on left, user avatar with dropdown on right.

Main content:
- Page title "Projects" with subtitle "Your active deals"
- Search bar and filter buttons (Status, Type, Date) in a row
- "New Project" primary button on the right

Project list as cards in a grid (2 columns):
Each card shows:
- Company name (e.g., "TechFlow GmbH")
- Deal type badge (e.g., "Sell-side")
- Status badge with color (Active = green, Due Diligence = blue)
- Progress bar showing completion percentage
- Document count and findings count as small metrics
- Last updated timestamp
- Team avatar stack (2-3 small circles)

Show 4 project cards with realistic M&A deal names.

Style: Clean, professional, dark sidebar with white content area. Use subtle shadows on cards. Color scheme: Navy blue primary, white backgrounds, green/blue/orange for status badges.
```

---

## Screen 2: Project Dashboard

**Prompt:**
```
Design a project dashboard for an M&A due diligence platform.

Left sidebar (dark navy, 240px):
- "Manda" logo at top
- Navigation items with icons: Dashboard (active/highlighted), Data Room, Knowledge Explorer, Chat, CIM Builder, Deliverables
- User profile at bottom

Top bar:
- Breadcrumb: "Projects / TechFlow GmbH"
- Project status badge "Active"
- Team avatars on right

Main content (white background) with dashboard widgets:

Row 1 (3 cards):
- "Documents" - Large number "47" with "12 processing" subtext and mini progress bar
- "Findings" - Large number "234" with breakdown "156 validated, 23 pending"
- "Gaps" - Large number "8" with "3 high priority" in orange

Row 2 (2 cards):
- "Recent Activity" - List of 5 items with timestamps: "New finding extracted", "Document uploaded", "Contradiction detected", etc.
- "Processing Status" - Vertical progress showing pipeline stages: Upload ✓, Parsing ✓, Embedding ●, Analysis ○

Row 3 (full width):
- "Key Findings by Domain" - Horizontal bar chart showing: Financial (45), Operational (38), Legal (29), Market (22), Technical (15)

Style: Clean dashboard layout with card-based widgets, subtle shadows, consistent spacing. Status colors: green for complete, blue for in-progress, gray for pending, orange for warnings.
```

---

## Screen 3: Data Room

**Prompt:**
```
Design a document management interface for M&A data rooms.

Left sidebar: Same navigation as dashboard, "Data Room" highlighted.

Top bar:
- Breadcrumb: "Projects / TechFlow GmbH / Data Room"
- View toggle buttons: "Folders" (active) | "Buckets"
- "Upload" primary button with upload icon

Left panel (30% width):
- Folder tree structure with expand/collapse arrows:
  - Financial Documents (12)
    - Annual Reports
    - Tax Records
  - Legal (8)
  - Operations (15)
  - HR & Team (6)

Main content (70% width):
- Current folder path as breadcrumb: "Financial Documents / Annual Reports"
- Grid of document cards (3 columns):

Each document card shows:
- File type icon (PDF, Excel, Word)
- Filename truncated
- File size and upload date
- Processing status badge (Processed ✓, Processing ●, Pending ○)
- 3-dot menu for actions

Show 6 document cards with realistic M&A filenames like "Financial_Statements_2023.xlsx", "Share_Purchase_Agreement.pdf"

Bottom area:
- Drag-and-drop upload zone with dashed border: "Drag files here or click to upload"

Style: File manager aesthetic, clear visual hierarchy, processing status prominently shown with colored badges.
```

---

## Screen 4: Knowledge Explorer

**Prompt:**
```
Design a findings explorer interface for M&A due diligence.

Left sidebar: Same navigation, "Knowledge Explorer" highlighted.

Top section:
- Tab navigation: "Findings" (active) | "Contradictions" (3) | "Gap Analysis" (8)
- Search bar with placeholder "Search findings semantically..."
- Filter row: Domain dropdown, Confidence slider, Status pills (All, Pending, Validated, Rejected)
- View toggle: Table icon | Card icon (table active)
- "Export" dropdown button

Main content - Data table:
Headers: Checkbox | Finding | Domain | Confidence | Source | Status | Actions

5 rows of findings:
1. ☐ | "Revenue reached €12.4M in FY2023, representing 34% YoY growth" | Financial | 94% (green) | Financials_2023.xlsx | Validated ✓ | •••
2. ☐ | "Customer churn rate is approximately 5% annually" | Operational | 78% (yellow) | Management_Deck.pdf | Pending | •••
3. ☐ | "Top 3 customers represent 31% of total revenue" | Financial | 91% (green) | Customer_List.xlsx | Validated ✓ | •••
4. ☐ | "85 full-time employees across 3 offices" | HR | 96% (green) | Team_Roster.xlsx | Validated ✓ | •••
5. ☐ | "Series A funding of €5M raised in 2020" | Financial | 88% (green) | Cap_Table.pdf | Pending | •••

Pagination: "Showing 1-20 of 234 findings" with page controls

Right side panel (slide-out, 35% width):
- Finding detail view header with "Finding Detail" title
- Full finding text
- Source attribution with clickable document link
- Confidence score with reasoning expandable
- Validation history timeline
- Action buttons: Validate, Reject, Edit

Style: Clean data table with alternating row colors, confidence shown as colored badges, clear action affordances.
```

---

## Screen 5: Global Chat Drawer

**Prompt:**
```
Design a full-width bottom drawer chat interface overlaying a dashboard.

Background: Dimmed dashboard visible behind (opacity 50%)

Chat drawer (slides up from bottom, 60% of screen height):

Header bar:
- "Assistant" title with AI icon
- Minimize button (chevron down)
- Close X button

Chat area (scrollable):
Message 1 (User, right-aligned):
- "What was TechFlow's revenue in 2023?"
- Light blue bubble, timestamp below

Message 2 (Assistant, left-aligned):
- AI avatar icon
- White bubble with:
  "TechFlow's revenue in 2023 was €12.4M, up 34% from €9.3M in 2022.

  📎 Source: Financial_Statements_2023.xlsx, Sheet 'P&L', Row 5"
- Source shown as clickable chip/link

Message 3 (User):
- "Are there any contract risks I should know about?"

Message 4 (Assistant):
- "I found 3 potential contract risks:

  ⚠️ HIGH: Customer 'AutoCorp AG' has termination clause allowing exit with 30-day notice
  📎 AutoCorp_MSA_2022.pdf, Section 8.2

  ⚠️ MEDIUM: 2 enterprise contracts expire within 60 days of projected close
  📎 Contract_Summary.xlsx

  ⚠️ LOW: Non-compete with former CTO expires March 2024
  📎 Employment_Agreements/CTO_Termination.pdf

  Want me to add these to the Q&A list?"

Input area at bottom:
- Text field with placeholder "Ask about your documents..."
- Attachment icon button
- Send button (arrow icon)

Style: Modern chat UI, clear message bubbles, source citations as subtle chips, risk levels color-coded (red/orange/yellow). Drawer has rounded top corners and subtle shadow.
```

---

## Screen 6: CIM Builder (Three-Panel)

**Prompt:**
```
Design a three-panel CIM (Confidential Information Memorandum) builder interface.

Top bar (full width):
- "CIM Builder - Company Overview" title
- Phase progress indicator: 14 small dots, first 4 filled (navy), dot 4 highlighted with ring, remaining empty
- "Phase 4 of 14" text label
- "Save" and "Export" buttons on right

Left panel (25% width) - Sources:
- Panel header: "Sources" with document icon
- List of document cards (compact):
  - 📊 Financials_2023.xlsx (selected state with blue border)
  - 📄 Company_Profile.pdf
  - 📄 Market_Analysis.pdf
  - 📊 Customer_Metrics.xlsx
  - 📄 Team_Bios.pdf
- Each card shows filename and small file type icon
- "+ Add Source" button at bottom
- Subtle separator line
- "View Document" link at very bottom

Center panel (50% width) - Conversation:
- Chat-style interface
- Message from AI:
  "Let's build Slide 1: Company History

  Based on your sources, I see three content approaches:

  A) TIMELINE APPROACH
  • 2018: Founded in Munich by ex-SAP engineers
  • 2020: Series A (€5M from Index Ventures)
  • 2023: Reached €12.4M ARR
  📎 Using: Founding_Docs.pdf

  B) PROBLEM-SOLUTION FRAMING
  • The Problem: Enterprise workflows in silos
  • The Insight: API-first approach
  • The Result: 200+ customers automated
  📎 Using: Product_Overview.pdf

  C) CREDIBILITY-FIRST
  • Team: 40 years combined experience
  • Backing: €13M from tier-1 VCs
  • Traction: €12.4M ARR, 85% margin
  📎 Using: Team_Bios.pdf

  Which approach for Slide 1?"

- User message: "Let's go with A, the timeline shows our journey well."

- Input field at bottom with placeholder "Type your response..."

Right panel (25% width) - Preview:
- Panel header: "Slide Preview"
- Slide frame (4:3 aspect ratio, light gray background):
  - Wireframe/skeleton of timeline slide:
    - "Our Journey" title placeholder (rectangle)
    - Horizontal timeline with 5 dots connected by line
    - Labels below: 2018, 2019, 2020, 2022, 2023
    - Small text placeholders above each dot
    - Simple rocket icon sketch at end of timeline
  - Slide number: "Slide 1 of 12"

- Navigation: "← Previous | Next →" below slide

- Context section below:
  - "Buyer: Strategic"
  - "Thesis: Growth Story - 34% CAGR"

- Quick action buttons: [Undo] [History] [Balance Check]

Style: Clean three-panel layout with clear visual separation. Preview shows wireframe/skeleton style - boxes and lines representing layout, not polished graphics. Use subtle borders between panels. Navy and white color scheme.
```

---

## Screen 7: Document Viewer Overlay

**Prompt:**
```
Design a slide-out document viewer overlay panel.

Background: CIM Builder interface visible but dimmed (50% opacity)

Overlay panel (slides in from right, 50% of screen width):
- Header bar:
  - Document icon and filename: "Financials_2023.xlsx"
  - Tab switcher: "Preview" | "Details"
  - Close X button

- Document preview area:
  - Spreadsheet view showing Excel-like grid
  - Sheet tabs at bottom: "P&L" (active) | "Balance Sheet" | "Cash Flow"
  - Sample data visible:
    - Row headers: Revenue, COGS, Gross Profit, Operating Expenses, EBITDA
    - Column headers: 2021, 2022, 2023
    - Sample values: €7.2M, €9.3M, €12.4M (highlighted row)
  - Yellow highlight on the cell being referenced (€12.4M for 2023)

- Bottom section:
  - "Referenced in conversation" label
  - Mini quote: "Revenue in 2023 was €12.4M..."
  - "Jump to chat" link button

- Action buttons at bottom:
  - "Download" secondary button
  - "Open in Data Room" link

Style: Clean document preview, spreadsheet has light gridlines, referenced cell highlighted in yellow. Panel has subtle shadow on left edge. Smooth slide-in animation implied.
```

---

## Screen 8: CIM Builder - Visual Blueprint Phase

**Prompt:**
```
Design the CIM Builder showing the visual blueprint approval step.

Same three-panel layout as Screen 6, but with updated content:

Top bar:
- Phase progress: 4 dots filled, showing "Phase 4 of 14"
- Subtext: "Visual Concept Approval"

Center panel - Conversation:
- Previous messages collapsed/scrolled up
- Current AI message:
  "Content approved! Here's the visual concept for Slide 1:

  ═══════════════════════════════════════
  SLIDE 1: VISUAL BLUEPRINT
  ═══════════════════════════════════════

  TYPE: Horizontal Timeline Infographic

  LAYOUT:
  • Title 'Our Journey' - Top left, 32pt, navy
  • Company logo - Top right, 15% width
  • Timeline - Center, horizontal line with 5 milestone dots
  • Milestone labels below line, descriptions above

  ELEMENT POSITIONING:
  • 2018 'Founded' - First dot, gold highlight
  • 2020 'Series A' - Third dot
  • 2023 '€12.4M ARR' - Fifth dot, emphasized larger

  VISUAL:
  • Rocket icon following timeline trajectory
  • Motion trail effect showing growth momentum
  • Color: Navy (#1a365d) + Gold (#d69e2e)

  ═══════════════════════════════════════

  Approve this visual concept?"

- User message: "Can you make the €12.4M milestone stand out more?"

- AI response: "Updated! The 2023 milestone now has:
  • Larger dot (2x size)
  • Gold callout box with 'ARR' label
  • Annotation: 'Profitable unit economics achieved'

  Preview updated on the right →"

Right panel - Preview:
- Updated skeleton slide showing:
  - Timeline with 5 dots
  - Last dot (2023) noticeably larger
  - Callout box above it with "€12.4M ARR"
  - Small annotation text below
  - Rocket icon at end
  - All shown as wireframe/sketch style

- Below preview:
  - Green checkmark: "Content ✓ Approved"
  - Orange dot: "Visual ● Pending approval"
  - [Approve Visual] primary button

Style: Same clean three-panel layout. Blueprint specifications shown in monospace/code-like formatting. Preview updates to reflect the changes discussed.
```

---

## Mock Conversation Content

### Global Chat - Scenario 1: Fact Retrieval
```
👤 User: What was TechFlow's revenue in 2023?

🤖 Assistant: TechFlow's revenue in 2023 was €12.4M, up 34% from €9.3M in 2022.

📎 Source: Financial_Statements_2023.xlsx, Sheet 'P&L', Row 5
```

### Global Chat - Scenario 2: Financial Deep Dive
```
👤 User: Break down the revenue by customer segment

🤖 Assistant: TechFlow's 2023 revenue breaks down as follows:

• Enterprise (€7.2M / 58%) - 12 customers, avg €600K
• Mid-Market (€4.1M / 33%) - 45 customers, avg €91K
• SMB (€1.1M / 9%) - 200+ customers, avg €5.5K

Notable: Enterprise concentration risk - top 3 customers represent 31% of total revenue.

📎 Sources:
- Revenue_Breakdown_2023.xlsx, Sheet 'By Segment'
- Customer_List.xlsx, Sheet 'Enterprise'
```

### Global Chat - Scenario 3: Due Diligence Check
```
👤 User: Are there any contract risks I should know about?

🤖 Assistant: I found 3 potential contract risks:

⚠️ HIGH: Customer "AutoCorp AG" has termination clause allowing exit with 30-day notice (unusual - standard is 90)
📎 AutoCorp_MSA_2022.pdf, Section 8.2

⚠️ MEDIUM: 2 enterprise contracts expire within 60 days of projected close date
📎 Contract_Summary.xlsx, Row 8, 14

⚠️ LOW: Non-compete with former CTO expires March 2024
📎 Employment_Agreements/CTO_Termination.pdf, Clause 12

Want me to add these to the Q&A list for management?
```

### Global Chat - Scenario 4: Contradiction Discovery
```
👤 User: What's the customer churn rate?

🤖 Assistant: I found conflicting information on churn:

• Management Presentation states: 5% annual churn
  📎 Management_Deck.pptx, Slide 18

• Calculated from Customer List: 8.2% annual churn
  📎 Customer_List.xlsx (15 of 183 customers lost in 2023)

This discrepancy of 3.2 percentage points is significant.

Possible explanations:
- Different calculation methodologies (logo vs revenue churn)
- Different time periods
- Presentation may exclude certain customer segments

🚩 I've flagged this as a contradiction. Would you like me to add a clarifying question to the Q&A list?
```

### Global Chat - Scenario 5: Gap Identification
```
👤 User: Do we have everything for the tech due diligence?

🤖 Assistant: Based on your IRL checklist, I found 4 gaps in Technical documentation:

❌ Missing: System Architecture Diagram
❌ Missing: Security Audit Report (last 12 months)
❌ Missing: Disaster Recovery Plan
⚠️ Partial: API Documentation (v1 only, current is v3)

✅ Complete: Source code access, Tech stack overview, Infrastructure costs, Team org chart

Want me to add these to the IRL request list?
```

### Global Chat - Scenario 6: Synthesis Request
```
👤 User: How does TechFlow compare to the market comps?

🤖 Assistant: Based on the comparable companies analysis:

TechFlow vs. Peer Median:
┌─────────────┬──────────┬─────────┬─────────┐
│ Metric      │ TechFlow │ Median  │ Delta   │
├─────────────┼──────────┼─────────┼─────────┤
│ Rev Growth  │ 34%      │ 28%     │ +6pp ✓  │
│ Gross Margin│ 85%      │ 78%     │ +7pp ✓  │
│ NRR         │ 127%     │ 115%    │ +12pp ✓ │
│ Rule of 40  │ 42       │ 38      │ +4 ✓    │
│ CAC Payback │ 18mo     │ 14mo    │ +4mo ⚠️ │
└─────────────┴──────────┴─────────┴─────────┘

TechFlow outperforms on growth metrics but has longer CAC payback, suggesting higher customer acquisition costs typical for DACH enterprise sales.

📎 Sources: Comparable_Analysis.xlsx, Financials_2023.xlsx
```

### Global Chat - Scenario 7: General Exploration
```
👤 User: Summarize the company for me

🤖 Assistant: TechFlow GmbH - Company Summary

OVERVIEW
Munich-based B2B SaaS company specializing in workflow automation for mid-market enterprises. Founded 2018 by ex-SAP engineers.

KEY METRICS (2023)
• Revenue: €12.4M (+34% YoY)
• Gross Margin: 85%
• Net Revenue Retention: 127%
• Employees: 85 across 3 offices
• Customers: 200+ (12 enterprise, 45 mid-market)

STRENGTHS
✓ Strong growth with improving unit economics
✓ High NRR indicates product stickiness
✓ Experienced technical team

WATCH ITEMS
⚠️ Customer concentration (top 3 = 31%)
⚠️ Churn rate discrepancy (5% vs 8.2%)
⚠️ CAC payback above peer median

📎 Sources: Multiple documents analyzed
```

---

### CIM Builder - Phase 1: Buyer Context
```
🤖 Agent: Welcome to CIM Builder! Let's create a compelling Company Overview for TechFlow GmbH.

First, tell me about your buyer. Are they:

A) Strategic Buyer - Looking for growth, synergies, market position
B) Financial Buyer - Focused on returns, cash flow, exit potential
C) Let me describe them...

👤 Analyst: A - Strategic buyer. They're a large enterprise software company looking to expand into workflow automation.

🤖 Agent: Perfect. A strategic acquirer in enterprise software.

What's their primary motivation?
- Market entry (new vertical)
- Technology acquisition (build vs buy)
- Customer base expansion
- Competitive defense

This helps me tailor the narrative to what matters most to them.

👤 Analyst: Technology acquisition - they want our workflow engine.

🤖 Agent: Got it. Strategic buyer, technology-focused acquisition. They'll want to see:
• Technical differentiation and IP
• Integration potential
• Team capabilities
• Scalability of the platform

I'll emphasize these throughout the CIM. Ready for Phase 2: Investment Thesis?
```

### CIM Builder - Phase 2: Investment Thesis
```
🤖 Agent: Based on your Strategic Buyer profile and TechFlow's knowledge base, I see three strong investment thesis angles:

A) GROWTH STORY
"TechFlow delivers 34% YoY growth with clear path to €50M ARR"
Hook: Market leader in fastest-growing segment
📎 Sources: Financials_2023.xlsx, Market_Analysis.pdf

B) PLATFORM VALUE
"127% NRR proves sticky product with expansion potential"
Hook: Land-and-expand model reduces CAC over time
📎 Sources: Customer_Metrics.xlsx, Cohort_Analysis.xlsx

C) TEAM & IP PLAY
"85 engineers + proprietary workflow engine = hard to replicate"
Hook: Acqui-hire plus technology moat
📎 Sources: Team_Roster.xlsx, Tech_Architecture.pdf

Which angle resonates most? Or should we combine elements?

👤 Analyst: C makes most sense for a tech-focused buyer, but include the growth metrics from A as proof.

🤖 Agent: Excellent choice. Here's your investment thesis:

═══════════════════════════════════════════════════
INVESTMENT THESIS: TechFlow GmbH

ASSET: Proprietary workflow engine + 85-person engineering team
TIMING: Proven at €12.4M ARR, ready to scale with larger distribution
OPPORTUNITY: Technology moat validated by 127% NRR and 34% growth
═══════════════════════════════════════════════════

Does this capture the story you want to tell?

👤 Analyst: Yes, approved.

🤖 Agent: Thesis locked. Moving to Phase 3: Narrative Outline...
```

### CIM Builder - Phase 3: Narrative Outline
```
🤖 Agent: Now let's structure the narrative. For a tech-focused strategic buyer, I recommend this flow:

NARRATIVE ARC
─────────────
1. HOOK: Company History (founding vision, technical origins)
   Why: Establishes engineering DNA from day one

2. CREDIBILITY: Management Team (technical leadership)
   Why: Shows the talent they're acquiring

3. VALUE: Technology & Product (the workflow engine)
   Why: Core asset - this is what they're buying

4. PROOF: Business Model + Metrics (growth, NRR, margins)
   Why: Validates the technology works in market

5. SCALE: Geographic Footprint + Customers
   Why: Shows expansion readiness

6. VISION: Product Roadmap
   Why: Shows where the technology is headed

Would you like to:
- Approve this structure
- Reorder sections
- Add/remove sections
- See alternative structures

👤 Analyst: Move Technology & Product to position 2, right after History. I want to hit them with the tech early.

🤖 Agent: Smart move - lead with strength. Updated structure:

1. Company History → 2. Technology & Product → 3. Management Team → 4. Business Model → 5. Footprint & Customers → 6. Roadmap

Approved?

👤 Analyst: Yes, let's build it.

🤖 Agent: Structure locked. Moving to Phase 4: Building Slides...
```

---

## Usage Tips for Figma AI

1. **Generate one screen at a time** - Figma AI works better with focused prompts

2. **Iterate** - If something's not right, refine with follow-up prompts like "Make the sidebar darker" or "Add more spacing between cards"

3. **Component consistency** - After generating the first screen with sidebar, reference it: "Use the same sidebar navigation style as the previous screen"

4. **Copy content exactly** - For the mock conversations, you may need to manually paste the text after generating the layout

5. **Skeleton previews** - For the CIM slide previews, emphasize "wireframe style" and "boxes and lines" to avoid polished graphics

6. **Connect screens** - After generating all screens, use Figma's prototyping mode to link them into a clickable flow

---

## Prototype Flow (Click Paths)

```
Projects Overview
    └─→ Click project card → Dashboard
        ├─→ Sidebar: Data Room → Data Room screen
        ├─→ Sidebar: Knowledge Explorer → Knowledge Explorer screen
        ├─→ Sidebar: Chat → Global Chat Drawer (overlay)
        ├─→ Sidebar: CIM Builder → CIM Builder screen
        │       ├─→ Click source document → Document Viewer Overlay
        │       └─→ Approve content → Visual Blueprint Phase
        └─→ Sidebar: Deliverables → (placeholder)
```
