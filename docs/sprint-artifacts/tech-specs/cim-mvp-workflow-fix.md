# CIM MVP Workflow Fix - Technical Specification

**Created:** 2026-01-12
**Branch:** `cim-mvp-workflow-fix`
**Status:** Ready for Implementation

---

## Problem Statement

The current CIM MVP implementation lacks a structured workflow. The agent has phase-based instructions but no clear progression through the CIM creation process. Users can get lost, context gets forgotten, and there's no systematic approach to building slides.

**Current Issues:**
- `CIMPhase` type (11 phases like `executive_summary`, `company_overview`) is CIM section-focused, not workflow-focused
- No concept of: buyer persona → hero concept → investment thesis → outline → sections → content → visual
- Slides are created too early (without structured content-first approach)
- No state tracking for "where are we in the workflow"
- User can get lost mid-conversation with no way to resume

---

## Intended Flow (User's Vision)

The workflow is a **linear checklist** that the agent works through collaboratively with the user:

```
1. Welcome           → Knowledge pre-loaded, agent greets user
2. Buyer Persona     → Who are we selling to? (strategic, financial, etc.)
3. Hero Concept      → What's the story hook? (3 options → user picks/refines)
4. Investment Thesis → 3-part foundation (Asset, Timing, Opportunity)
5. Outline           → Structure of CIM (user-defined sections, NOT predetermined)
6. Build Sections    → For each section in outline:
   ├─ Content Development → What goes in this section?
   └─ For each slide:
      ├─ Slide Content  → Detailed content
      ├─ Visual Design  → Layout/wireframe
      └─ User Approval
   └─ Section Complete
7. Done              → All sections complete → Export
```

### Key Principles

- **User can detour anytime** - Ask questions, explore tangents
- **Agent saves all useful context continuously** - Nothing is lost
- **Agent always knows where we are in the checklist** - Can resume exactly where left off
- **Checklist metaphor** - Like a to-do list that tracks progress through workflow

---

## Design Decisions

### 1. Workflow State Storage

**Decision: Store in LangGraph state + sync to database**

**Rationale:**
- LangGraph state (via PostgresSaver checkpointer) already persists conversation
- Add `workflowProgress` to the state schema for checklist tracking
- Sync critical state to CIM database record for UI access (outline, slides)

```typescript
interface WorkflowProgress {
  currentStage: WorkflowStage  // Where we are in the main checklist
  completedStages: WorkflowStage[]  // What's done

  // For section-building phase
  currentSectionId?: string  // Which section we're working on
  currentSlideId?: string  // Which slide we're working on
  sectionProgress: Record<string, SectionProgress>  // Per-section tracking
}

type WorkflowStage =
  | 'welcome'
  | 'buyer_persona'
  | 'hero_concept'
  | 'investment_thesis'
  | 'outline'
  | 'building_sections'
  | 'complete'

interface SectionProgress {
  sectionId: string
  status: 'pending' | 'content_development' | 'building_slides' | 'complete'
  slides: SlideProgress[]
}

interface SlideProgress {
  slideId: string
  contentApproved: boolean
  visualApproved: boolean
}
```

### 2. Section/Slide ID Generation

**Decision: Generate section IDs when outline is approved, slide IDs when slide content is created**

**Rationale:**
- Outline approval is the moment we know the structure
- Section IDs needed immediately for: section divider slides, UI tree, progress tracking
- Slide IDs should wait until we actually define the slide (user might change their mind about how many slides per section)

**Flow:**
1. User approves outline → Generate section IDs + section divider slide IDs
2. Agent and user define "we need 3 slides for this section" → Generate those slide IDs
3. This allows flexibility - user can add/remove slides during content development

### 3. Wireframe Component Generation

**Decision: LLM generates structured JSON, UI renders it**

The LLM CAN generate layouts dynamically, but we need a contract between LLM output and UI rendering.

**Approach:**
- Define a **comprehensive layout schema** that covers professional CIM presentations
- LLM is instructed to produce JSON matching this schema
- UI has renderers for each layout type and component type
- LLM is responsible for ensuring the layout makes logical sense (e.g., not putting 10 components in a quadrant)

#### Layout Types

```typescript
type LayoutType =
  // Basic layouts
  | 'full'                    // Single component fills slide
  | 'title-only'              // Section divider - just headline
  | 'title-content'           // Title at top, content below

  // Split layouts
  | 'split-horizontal'        // Left/right 50-50
  | 'split-horizontal-weighted' // Left/right with weight (e.g., 60-40)
  | 'split-vertical'          // Top/bottom

  // Grid layouts
  | 'quadrant'                // 2x2 grid
  | 'thirds-horizontal'       // 3 columns
  | 'thirds-vertical'         // 3 rows
  | 'six-grid'                // 2x3 or 3x2 grid

  // Complex layouts
  | 'sidebar-left'            // Narrow left, wide right
  | 'sidebar-right'           // Wide left, narrow right
  | 'hero-with-details'       // Large focal point + supporting elements
  | 'comparison'              // Side-by-side comparison structure
  | 'pyramid'                 // Hierarchical pyramid layout
  | 'hub-spoke'               // Central element with surrounding elements
```

#### Component Types (Comprehensive)

```typescript
type ComponentType =
  // Text components
  | 'title'                   // Main slide title
  | 'subtitle'                // Secondary title
  | 'heading'                 // Section heading within slide
  | 'text'                    // Paragraph text
  | 'bullet_list'             // Bulleted list
  | 'numbered_list'           // Numbered/ordered list
  | 'quote'                   // Pull quote or testimonial

  // Data visualization - Charts
  | 'bar_chart'               // Vertical bars
  | 'horizontal_bar_chart'    // Horizontal bars
  | 'stacked_bar_chart'       // Stacked bars
  | 'line_chart'              // Line/trend chart
  | 'area_chart'              // Filled area chart
  | 'pie_chart'               // Pie/donut chart
  | 'waterfall_chart'         // Waterfall (bridge) chart
  | 'combo_chart'             // Bar + line combo
  | 'scatter_plot'            // Scatter/bubble chart

  // Data visualization - Other
  | 'table'                   // Data table
  | 'comparison_table'        // Feature comparison matrix
  | 'metric'                  // Single big number with label
  | 'metric_group'            // Multiple metrics together
  | 'gauge'                   // Gauge/speedometer
  | 'progress_bar'            // Progress indicator
  | 'sparkline'               // Mini inline chart

  // Process & Flow
  | 'timeline'                // Horizontal or vertical timeline
  | 'milestone_timeline'      // Timeline with milestone markers
  | 'flowchart'               // Process flow diagram
  | 'funnel'                  // Funnel diagram (sales, conversion)
  | 'pipeline'                // Pipeline stages
  | 'process_steps'           // Step 1 → Step 2 → Step 3
  | 'cycle'                   // Circular process diagram
  | 'gantt_chart'             // Project timeline/Gantt

  // Organizational
  | 'org_chart'               // Organizational hierarchy
  | 'team_grid'               // Team photos/bios grid
  | 'hierarchy'               // Generic hierarchy diagram

  // Comparison & Analysis
  | 'swot'                    // SWOT analysis grid
  | 'matrix'                  // 2x2 matrix (BCG, etc.)
  | 'venn'                    // Venn diagram
  | 'versus'                  // A vs B comparison
  | 'pros_cons'               // Pros and cons columns
  | 'feature_comparison'      // Feature checkmark matrix

  // Geographic
  | 'map'                     // Geographic map with markers
  | 'location_list'           // List of locations with details

  // Visual elements
  | 'image'                   // Image/photo
  | 'image_placeholder'       // Placeholder for image
  | 'logo_grid'               // Customer/partner logos
  | 'icon_grid'               // Icons with labels
  | 'screenshot'              // Product screenshot
  | 'diagram'                 // Custom diagram

  // Callouts & Highlights
  | 'callout'                 // Callout box with text
  | 'callout_group'           // Multiple callouts
  | 'stat_highlight'          // Highlighted statistic
  | 'key_takeaway'            // Key insight box
  | 'annotation'              // Arrow/line with text pointing to something

  // Financial specific
  | 'financial_table'         // P&L, Balance Sheet format
  | 'revenue_breakdown'       // Revenue by segment/region
  | 'unit_economics'          // CAC, LTV, etc. visualization
  | 'growth_trajectory'       // Growth chart with projections
  | 'valuation_summary'       // Valuation metrics display
```

#### Component Schema

```typescript
interface SlideComponent {
  id: string
  type: ComponentType
  content: ComponentContent  // Type-specific content
  position?: {
    region: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'full'
    weight?: number  // For weighted layouts (e.g., 60 for 60%)
  }
  style?: {
    emphasis?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    alignment?: 'left' | 'center' | 'right'
  }
  icon?: string  // Icon name (optional, for callouts etc.)
  label?: string  // Optional label/caption
}

// Content types vary by component
type ComponentContent =
  | string                           // For text, title, quote
  | string[]                         // For bullet_list, numbered_list
  | MetricContent                    // For metric, stat_highlight
  | TableContent                     // For table, comparison_table, financial_table
  | ChartContent                     // For all chart types
  | TimelineContent                  // For timeline, milestone_timeline
  | TeamContent                      // For team_grid, org_chart
  | ComparisonContent                // For versus, pros_cons, feature_comparison
  | ProcessContent                   // For flowchart, process_steps, funnel
  | MapContent                       // For map, location_list
  | ImageContent                     // For image, logo_grid, screenshot
```

#### LLM Responsibility

The LLM must ensure:
1. **Layout coherence** - Components fit logically in the chosen layout
2. **Visual balance** - Not overcrowding regions
3. **Hierarchy** - Most important info is visually prominent
4. **Readability** - Appropriate amount of content per slide
5. **Story flow** - Visual supports the narrative

The prompt will instruct the LLM to think about these factors before generating the layout JSON.

### 4. Visual Layout Specification (MVP)

**Decision: Comprehensive but practical**

For MVP, we implement:
- All layout types listed above
- Core component types (can stub out rarely-used ones)
- Clear rendering for wireframe preview

**The wireframe preview shows:**
- Layout structure (boxes for regions)
- Component type labels
- Actual content where available
- Placeholder indicators where content is pending

**Example LLM output for a Unit Economics slide:**

```json
{
  "title": "Unit Economics - Strong LTV:CAC Ratio",
  "layoutType": "hero-with-details",
  "components": [
    {
      "id": "hero-metric",
      "type": "metric",
      "content": { "value": "16:1", "label": "LTV:CAC Ratio", "comparison": "vs 3:1 industry avg" },
      "position": { "region": "center" },
      "style": { "emphasis": "primary", "size": "xl" }
    },
    {
      "id": "cac-detail",
      "type": "callout",
      "content": "$80K CAC with 6-month sales cycle",
      "position": { "region": "top-left" },
      "icon": "dollar-sign",
      "style": { "emphasis": "secondary", "size": "sm" }
    },
    {
      "id": "ltv-detail",
      "type": "callout",
      "content": "$1.3M LTV with 4+ year lifetime",
      "position": { "region": "top-right" },
      "icon": "trending-up",
      "style": { "emphasis": "success", "size": "sm" }
    },
    {
      "id": "payback",
      "type": "callout",
      "content": "~3 month payback period",
      "position": { "region": "bottom-left" },
      "icon": "clock",
      "style": { "emphasis": "secondary", "size": "sm" }
    },
    {
      "id": "nrr",
      "type": "callout",
      "content": "120% Net Revenue Retention",
      "position": { "region": "bottom-right" },
      "icon": "refresh-cw",
      "style": { "emphasis": "success", "size": "sm" }
    }
  ]
}
```

### 5. Section Divider Slides

**Decision: Auto-generate all section dividers when outline is approved**

When user approves outline:
1. For each section, create a "divider slide" with just the section title
2. These appear immediately in the preview
3. User sees the structure taking shape
4. As we build each section, slides get inserted after the divider

---

## Implementation Plan

### Phase 1: State Schema Updates

**Files to modify:**
- `manda-app/lib/agent/cim-mvp/state.ts`

**Changes:**
1. Add `WorkflowProgress` interface and related types
2. Add `workflowProgress` to `CIMMVPState` annotation
3. Add `buyerPersona` to state (type, motivations, concerns)
4. Add `heroContext` to state (selected hero, investment thesis)
5. Add `outline` to state (sections with IDs)
6. Update `SlideUpdate` to include `layoutType` and `regions`

### Phase 2: New Tools

**Files to modify:**
- `manda-app/lib/agent/cim-mvp/tools.ts`

**New tools:**
1. `advance_workflow` - Move to next stage in checklist
2. `save_buyer_persona` - Store buyer type and context
3. `save_hero_concept` - Store selected hero and investment thesis
4. `create_outline` - Create CIM structure with section IDs
5. `update_outline` - Modify outline (add/remove/reorder sections)
6. `start_section` - Begin working on a section
7. `create_slide_visual` - Create slide with layout (replaces/enhances `update_slide`)

**Remove/modify:**
- `navigate_phase` - Replace with `advance_workflow` and section navigation
- `update_slide` - Enhance to support visual layouts

### Phase 3: Prompt Restructuring

**Files to modify:**
- `manda-app/lib/agent/cim-mvp/prompts.ts`

**Changes:**
1. Replace phase-based instructions with workflow-stage instructions
2. Each stage has clear:
   - Goal (what we're trying to accomplish)
   - Questions to ask
   - Tools to use
   - Exit criteria (when to move to next stage)
3. Add "context awareness" - always show where we are in the checklist
4. Add detour handling - how to handle tangents and return

### Phase 4: Graph Flow Updates

**Files to modify:**
- `manda-app/lib/agent/cim-mvp/graph.ts`

**Changes:**
1. Update `postToolNode` to handle new tools
2. Add workflow state updates when tools are called
3. Ensure outline and slide updates emit proper events for UI

### Phase 5: UI Updates

**Files to modify:**
- `manda-app/components/cim-builder/CIMBuilderPage.tsx`
- `manda-app/components/cim-builder/SourcesPanel/SourcesPanel.tsx` (CIM Structure section)
- `manda-app/components/cim-builder/PreviewPanel/PreviewPanel.tsx`

**Changes:**

1. **CIM Structure Panel:**
   - Display outline as tree (Section > Slides)
   - Update when outline changes
   - Show progress indicators per section

2. **Preview Panel:**
   - Add horizontal scrollable slide thumbnails at top
   - Slide detail view with wireframe rendering below
   - Component renderers for each layout type

3. **State handling:**
   - Handle `outline_created` events
   - Handle `section_dividers_created` events
   - Handle enhanced `slide_update` events with visual layouts

### Phase 6: API Route Updates

**Files to modify:**
- `manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts`

**Changes:**
1. Emit new event types: `outline_created`, `workflow_progress`
2. Sync outline to CIM database record
3. Sync workflow progress for persistence

---

## Verification Plan

### Manual Testing

1. **Full workflow walkthrough:**
   - Create new CIM
   - Go through buyer persona → hero → thesis → outline → build sections
   - Verify state persists across page refreshes
   - Verify can resume where left off

2. **Detour handling:**
   - Mid-workflow, ask random questions
   - Verify agent saves useful info
   - Verify agent can return to workflow

3. **Outline changes:**
   - After outline approved, request changes
   - Verify UI updates
   - Verify section dividers update

4. **Visual design:**
   - Create slides with different layouts
   - Verify preview renders correctly
   - Verify can iterate on visual design

### Automated Tests

1. Unit tests for new tools
2. Unit tests for state reducers
3. Integration test for workflow progression

---

## Files Summary

### Must Modify:
| File | Purpose |
|------|---------|
| `manda-app/lib/agent/cim-mvp/state.ts` | State schema |
| `manda-app/lib/agent/cim-mvp/tools.ts` | New tools |
| `manda-app/lib/agent/cim-mvp/prompts.ts` | Workflow prompts |
| `manda-app/lib/agent/cim-mvp/graph.ts` | Graph updates |
| `manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts` | API events |
| `manda-app/components/cim-builder/PreviewPanel/PreviewPanel.tsx` | Visual rendering |
| `manda-app/components/cim-builder/SourcesPanel/SourcesPanel.tsx` | Outline tree |

### May Need Updates:
| File | Purpose |
|------|---------|
| `manda-app/lib/hooks/useCIMMVPChat.ts` | Handle new events |
| `manda-app/components/cim-builder/CIMBuilderPage.tsx` | Wire up new state |

---

## Reference: CIM Workflow Document

The detailed workflow guidance for the agent is defined in:
- `cim-workflow/cim-workflow.md`

This document contains:
- Phase-by-phase instructions
- Conversational guidelines
- Visual concept specifications
- Output quality standards
