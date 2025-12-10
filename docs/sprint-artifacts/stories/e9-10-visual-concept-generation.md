# Story 9.10: Visual Concept Generation

Status: done

## Story

As a **M&A analyst**,
I want **the agent to generate detailed visual blueprints for each slide after I approve the content**,
so that **designers have clear specifications for layout, charts, and visual elements that support the narrative without ambiguity**.

## Acceptance Criteria

1. **AC #1: Visual Concept Trigger** - After slide content is approved (status = 'approved'), the agent proactively proposes a visual concept for that slide (Observe agent behavior after content approval)
2. **AC #2: Visual Blueprint Components** - Visual blueprint includes: layout_type recommendation, chart_recommendations with type/data_description/purpose, image_suggestions, and designer notes (Inspect visual_concept object in slide data)
3. **AC #3: Narrative Rationale** - Agent explains WHY specific visuals support the buyer persona narrative (e.g., "A bar chart comparing LTV vs CAC will resonate with your financial buyer's focus on unit economics") (Check agent response for rationale)
4. **AC #4: Alternative Requests** - User can request alternative visual concepts (e.g., "try a different layout", "use a pie chart instead") and agent regenerates with new recommendations (Modify request, verify regeneration)
5. **AC #5: Visual Spec Persistence** - Approved visual concept is stored in slide.visual_concept field and persists across sessions (DB check, resume session)
6. **AC #6: Preview Updates** - Preview panel renders slide based on visual spec (layout_type drives component arrangement, chart components show visual representation) (Visual inspection of preview)

## Tasks / Subtasks

- [x] Task 1: Implement Visual Concept Generation Agent Flow (AC: #1, #3)
  - [x] 1.1: Create `generateVisualConceptTool` in `lib/agent/cim/tools/cim-tools.ts` that generates visual blueprints based on slide content and buyer persona
  - [x] 1.2: Add visual concept generation prompts to `lib/agent/cim/prompts.ts` with buyer persona context and narrative rationale requirements
  - [x] 1.3: Update agent workflow to detect approved slides without visual_concept and trigger generation
  - [x] 1.4: Ensure rationale is included in agent response explaining WHY visuals support the narrative

- [x] Task 2: Implement Visual Concept Tool Schema and Validation (AC: #2, #5)
  - [x] 2.1: Enhance `setVisualConceptTool` input schema to include all blueprint components (layout_type, chart_recommendations, image_suggestions, notes)
  - [x] 2.2: Add validation for chart_recommendations array structure (type, data_description, purpose required)
  - [x] 2.3: Ensure visual_concept is properly persisted to slide.visual_concept in database
  - [x] 2.4: Add unit tests for visual concept schema validation

- [x] Task 3: Implement Alternative Visual Concept Requests (AC: #4)
  - [x] 3.1: Add `regenerateVisualConceptTool` or extend existing tool to support modification requests
  - [x] 3.2: Parse user modification requests ("different layout", "use pie chart", "more data-focused")
  - [x] 3.3: Generate new visual concept incorporating user feedback while maintaining narrative alignment
  - [x] 3.4: Test alternative request → regeneration flow

- [x] Task 4: Update Preview Panel for Visual Concept Rendering (AC: #6)
  - [x] 4.1: Update `SlidePreview.tsx` to read slide.visual_concept.layout_type and adjust component arrangement
  - [x] 4.2: Enhance chart component rendering to display chart_recommendations with badges
  - [x] 4.3: Add visual indicators for image_suggestions in preview (placeholder with suggested description)
  - [x] 4.4: Test preview renders correctly based on different visual_concept configurations

- [x] Task 5: Write Tests (AC: #1-#6)
  - [x] 5.1: Unit tests for generateVisualConceptTool structure (10 new tests in tools.test.ts)
  - [x] 5.2: Unit tests for visual concept schema validation
  - [x] 5.3: Component tests for preview rendering with visual specs (18 new tests in SlidePreview.test.tsx)
  - [x] 5.4: Layout badge and chart recommendations tests
  - [x] 5.5: Visual concept indicator and reactive update tests

## Dev Notes

### Architecture Alignment

This story builds on E9.7 (Slide Content Creation) and E9.9 (Click-to-Reference). The visual concept generation occurs AFTER content approval, creating a two-step workflow: content first, then visuals.

**Data Flow:**
```
User approves slide content (E9.7)
    ↓
approveSlideContentTool sets slide.status = 'approved'
    ↓
Agent detects approved slide without visual_concept
    ↓
Agent calls generateVisualConceptTool
    ↓
Tool analyzes slide components + buyer persona
    ↓
Tool returns visual blueprint with rationale
    ↓
Agent presents visual concept to user
    ↓
User approves OR requests modification
    ↓
setVisualConceptTool persists to slide.visual_concept
    ↓
Preview panel re-renders with visual specs
```

### Visual Concept Schema

The existing `VisualConcept` type in `lib/types/cim.ts` provides the foundation:

```typescript
export interface VisualConcept {
  layout_type: LayoutType  // 'title_slide' | 'content' | 'two_column' | 'chart_focus' | 'image_focus'
  chart_recommendations?: ChartRecommendation[]
  image_suggestions?: string[]
  notes: string  // Designer guidance
}

export interface ChartRecommendation {
  type: ChartType  // 'bar' | 'line' | 'pie' | 'area' | 'table'
  data_description: string  // What data the chart visualizes
  purpose: string  // Why this chart supports the narrative
}
```

### Agent Prompt Strategy

The visual concept generation prompt should:
1. Analyze slide content (title, bullets, data points)
2. Reference buyer persona priorities and concerns
3. Consider narrative flow from prior slides
4. Recommend layout based on content type
5. Suggest charts that best represent the data
6. Explain WHY each visual choice supports the narrative

**Example Agent Response:**
```
Based on your slide content about unit economics, I recommend:

**Layout:** Chart Focus
- Primary visual: Bar chart comparing LTV ($1.3M) vs CAC ($80K)
- This layout emphasizes the 16:1 ratio which is your strongest metric

**Why this works for your financial buyer:**
- Financial buyers prioritize unit economics and payback periods
- A bar chart with stark height difference visually reinforces the competitive advantage
- The 16:1 ratio tells a compelling story at a glance

**Additional suggestions:**
- Add a trend line overlay showing LTV/CAC improvement over time
- Include benchmark comparison (industry avg 3:1) to highlight outperformance

Would you like me to try a different layout, or shall we lock this visual concept?
```

### Key Components to Modify

| Component | Path | Changes |
|-----------|------|---------|
| CIM Tools | `lib/agent/cim/tools/cim-tools.ts` | Add generateVisualConceptTool, enhance setVisualConceptTool |
| CIM Prompts | `lib/agent/cim/prompts.ts` | Add visual concept generation prompts |
| CIM Workflow | `lib/agent/cim/workflow.ts` | Add visual concept phase handling |
| ComponentRenderer | `components/cim-builder/PreviewPanel/ComponentRenderer.tsx` | Add layout-aware rendering |
| SlidePreview | `components/cim-builder/PreviewPanel/SlidePreview.tsx` | Pass visual_concept to components |

### Existing Tool Reference

The `setVisualConceptTool` already exists (lines 931-1011 in cim-tools.ts) but needs enhancement:
- Current: Basic schema for layout_type, chartRecommendations, imageSuggestions, notes
- Needed: Add generation logic, buyer persona context, rationale output

### Preview Rendering Strategy

The wireframe preview should visualize the visual_concept:

| layout_type | Preview Behavior |
|-------------|------------------|
| `title_slide` | Large centered title, minimal content |
| `content` | Standard left-aligned text with bullets |
| `two_column` | Split layout with content on both sides |
| `chart_focus` | Chart takes 60%+ of slide area |
| `image_focus` | Image placeholder dominant |

Chart recommendations render as wireframe charts (from E9.8):
- Bar chart: shows actual bars
- Pie chart: shows segments
- Line chart: shows line with points

### Learnings from Previous Story

**From Story e9-9-click-to-reference-in-chat (Status: done)**

- **Reference Utils Pattern**: Created reusable utilities in `lib/cim/reference-utils.ts` - follow this pattern for visual concept utilities
- **Agent Context Enrichment**: `prepareComponentContext()` in executor.ts enriches agent context - apply similar approach for visual concept generation context
- **Test Coverage**: 50 new tests added (29 for reference-utils, 21 for CIMChatInput) - maintain similar comprehensive coverage
- **Build Verification**: Always verify TypeScript type-check and full test suite pass

**Key Files from E9.9 to Reference:**
- [reference-utils.ts](manda-app/lib/cim/reference-utils.ts) - Pattern for utility functions
- [executor.ts](manda-app/lib/agent/cim/executor.ts) - Context preparation patterns
- [CIMChatInput.tsx](manda-app/components/cim-builder/ConversationPanel/CIMChatInput.tsx) - UI component patterns

[Source: stories/e9-9-click-to-reference-in-chat.md#Dev-Agent-Record]

### Project Structure Notes

- New visual concept utilities go in `lib/agent/cim/utils/visual-concept.ts`
- Tests follow `__tests__/` mirror structure
- Preview enhancements in existing `components/cim-builder/PreviewPanel/` files

### Testing Strategy

**Unit Tests (Vitest):**
- generateVisualConceptTool produces valid visual blueprint
- Visual concept schema validation (all required fields)
- Chart recommendation structure validation
- Layout type → preview arrangement mapping

**Integration Tests:**
- Content approval triggers visual concept generation
- Alternative request regenerates visual concept
- Visual concept persists in database
- Resume loads visual concept correctly

**Component Tests:**
- Preview renders layout_type correctly
- Chart components use chart_recommendations
- Image placeholders show suggestions

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E9.md#E9.10-Visual-Concept-Generation] - Acceptance criteria AC-9.10.1 through AC-9.10.6
- [Source: docs/epics.md#E9.10] - Story definition (6 points)
- [Source: docs/sprint-artifacts/epics/epic-E9.md#E9.10] - Detailed story spec
- [Source: lib/types/cim.ts#L147-L152] - VisualConcept interface
- [Source: lib/agent/cim/tools/cim-tools.ts#L931-L1011] - Existing setVisualConceptTool
- [Source: components/cim-builder/PreviewPanel/ComponentRenderer.tsx] - Wireframe component rendering
- [Source: stories/e9-9-click-to-reference-in-chat.md] - Previous story patterns

## Dev Agent Record

### Context Reference

- [e9-10-visual-concept-generation.context.xml](e9-10-visual-concept-generation.context.xml) - Generated 2025-12-11

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debugging issues encountered

### Completion Notes List

1. **generateVisualConceptTool** - New tool that analyzes slide content and buyer persona to generate visual blueprints including layout_type recommendations, chart_recommendations with type/data_description/purpose, and image_suggestions. Includes detailed narrative rationale explaining WHY each visual choice supports the buyer persona.

2. **regenerateVisualConceptTool** - New tool that allows users to request alternative visual concepts by specifying preferences like "use pie chart", "different layout", or "more data-focused". Parses natural language preferences and generates updated blueprints.

3. **Visual Concept Prompts** - Enhanced PHASE_PROMPTS.visual_concepts with comprehensive instructions for:
   - Automatic visual concept generation after content approval
   - Visual blueprint component requirements (AC #2)
   - Narrative rationale requirements (AC #3)
   - Alternative request handling (AC #4)
   - Approval and persistence flow (AC #5)

4. **SlidePreview Enhancements** - Updated preview panel to render visual concepts:
   - LayoutBadge component shows layout type with icon
   - ChartRecommendations component displays chart types with tooltips
   - Image suggestions displayed as italic text with icon
   - Visual concept indicator in footer ("Visual ✓")
   - Blue border when visual_concept is set
   - data-layout-type attribute for testing
   - Layout-specific content classes (grid for two_column)

5. **Test Coverage** - Added comprehensive tests:
   - 10 new E9.10 tool tests in tools.test.ts
   - 18 new visual concept rendering tests in SlidePreview.test.tsx
   - All 2475 tests pass

### File List

| File | Changes |
|------|---------|
| `lib/agent/cim/tools/cim-tools.ts` | Added generateVisualConceptTool (~200 lines), regenerateVisualConceptTool (~180 lines), updated exports |
| `lib/agent/cim/tools/index.ts` | Added exports for generateVisualConceptTool, regenerateVisualConceptTool |
| `lib/agent/cim/prompts.ts` | Enhanced PHASE_PROMPTS.visual_concepts (~110 lines), updated CIM_TOOL_USAGE_PROMPT, updated getPhaseIntroduction |
| `components/cim-builder/PreviewPanel/SlidePreview.tsx` | Added LayoutBadge, ChartRecommendations components, visual concept rendering (~100 lines) |
| `__tests__/lib/agent/cim/tools.test.ts` | Added E9.10 tool tests (10 new tests), updated tool count assertions |
| `__tests__/components/cim-builder/SlidePreview.test.tsx` | Added visual concept rendering tests (18 new tests) |

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-10 | Story drafted from tech spec E9 and epic definition | SM Agent (Claude Opus 4.5) |
| 2025-12-11 | Story context generated, status → ready-for-dev | Story Context Workflow (Claude Opus 4.5) |
| 2025-12-11 | All tasks completed, status → done. Implemented generateVisualConceptTool, regenerateVisualConceptTool, enhanced visual_concepts phase prompts, updated SlidePreview for visual concept rendering. 28 new tests added. Build and all 2475 tests pass. | Dev Agent (Claude Opus 4.5) |
