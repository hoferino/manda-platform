# Story 2: New Tools Implementation

**File:** `manda-app/lib/agent/cim-mvp/tools.ts`
**Completion Promise:** `TOOLS_COMPLETE`
**Max Iterations:** 20

---

## Overview

Create new LangChain tools for the workflow-based CIM agent. These tools allow the agent to advance through workflow stages, save context, manage the outline, and create slides with layouts.

## Dependencies

- Story 1 (State Schema) must be complete

## Tasks

- [ ] 2.1 Create `advance_workflow` tool
  - Input: targetStage (WorkflowStage), reason (string)
  - Validates transition is allowed (can only go forward or stay)
  - Returns: success, previousStage, currentStage

- [ ] 2.2 Create `save_buyer_persona` tool
  - Input: type (string), motivations (string[]), concerns (string[])
  - Returns: buyerPersona object for state merge

- [ ] 2.3 Create `save_hero_concept` tool
  - Input: selectedHero (string), asset (string), timing (string), opportunity (string)
  - Returns: heroContext object for state merge

- [ ] 2.4 Create `create_outline` tool
  - Input: sections (array of { title, description })
  - Auto-generates section IDs (uuid or nanoid)
  - Returns: cimOutline object, sectionDividerSlides array

- [ ] 2.5 Create `update_outline` tool
  - Input: action ('add' | 'remove' | 'reorder' | 'update'), sectionId?, section?, newOrder?
  - Returns: updated cimOutline object

- [ ] 2.6 Create `start_section` tool
  - Input: sectionId (string)
  - Initializes section progress
  - Returns: currentSectionId, sectionProgress update

- [ ] 2.7 Enhance `update_slide` tool
  - Add layoutType parameter (LayoutType)
  - Update components to use new SlideComponent interface with position, style
  - Keep backward compatibility with existing calls

- [ ] 2.8 Remove `navigate_phase` tool (replaced by advance_workflow)

- [ ] 2.9 Update `cimMVPTools` array export with new tools

- [ ] 2.10 Run `npm run type-check` - must pass with no errors

## Tool Schemas

### advance_workflow
```typescript
const advanceWorkflowTool = tool(
  async ({ targetStage, reason }) => {
    // Return object that postToolNode will process
    return JSON.stringify({
      advancedWorkflow: true,
      targetStage,
      reason
    })
  },
  {
    name: 'advance_workflow',
    description: 'Move to the next stage in the CIM workflow. Use when current stage objectives are complete.',
    schema: z.object({
      targetStage: z.enum(['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline', 'building_sections', 'complete']),
      reason: z.string().describe('Why we are advancing to this stage')
    })
  }
)
```

### save_buyer_persona
```typescript
const saveBuyerPersonaTool = tool(
  async ({ type, motivations, concerns }) => {
    return JSON.stringify({
      buyerPersona: { type, motivations, concerns }
    })
  },
  {
    name: 'save_buyer_persona',
    description: 'Save the buyer persona context. Call after discussing buyer type with user.',
    schema: z.object({
      type: z.string().describe('Buyer type: strategic, financial, public_company, competitor, or mixed'),
      motivations: z.array(z.string()).describe('Primary motivations for acquisition'),
      concerns: z.array(z.string()).describe('Key concerns to address proactively')
    })
  }
)
```

### create_outline
```typescript
const createOutlineTool = tool(
  async ({ sections }) => {
    const sectionsWithIds = sections.map(s => ({
      id: nanoid(),
      title: s.title,
      description: s.description
    }))

    // Create section divider slides
    const sectionDividerSlides = sectionsWithIds.map(s => ({
      slideId: `divider-${s.id}`,
      sectionId: s.id,
      title: s.title,
      layoutType: 'title-only',
      components: [{ id: nanoid(), type: 'title', content: s.title, position: { region: 'center' } }],
      status: 'draft'
    }))

    return JSON.stringify({
      cimOutline: { sections: sectionsWithIds },
      sectionDividerSlides
    })
  },
  {
    name: 'create_outline',
    description: 'Create the CIM outline structure. Call after user approves the proposed outline.',
    schema: z.object({
      sections: z.array(z.object({
        title: z.string(),
        description: z.string()
      }))
    })
  }
)
```

## Acceptance Criteria

1. All new tools are defined and exported
2. Tools return proper JSON for postToolNode to process
3. navigate_phase tool is removed
4. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 2 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-02-tools.md.

Read the story file for tool specifications.

Implement all tasks 2.1-2.10 in manda-app/lib/agent/cim-mvp/tools.ts.

Import types from ./state.ts as needed.

After each tool implementation, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>TOOLS_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 20 --completion-promise "TOOLS_COMPLETE"
```
