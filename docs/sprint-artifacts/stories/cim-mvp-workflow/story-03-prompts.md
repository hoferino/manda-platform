# Story 3: Prompt Restructuring

**File:** `manda-app/lib/agent/cim-mvp/prompts.ts`
**Completion Promise:** `PROMPTS_COMPLETE`
**Max Iterations:** 15

---

## Overview

Restructure the system prompts to use workflow stages instead of CIM phases. Each stage has clear instructions, goals, tools to use, and exit criteria. Add formatting functions for displaying workflow state.

## Dependencies

- Story 1 (State Schema) must be complete

## Tasks

- [ ] 3.1 Create `getWorkflowStageInstructions(stage: WorkflowStage)` function
  - Returns detailed instructions for each of the 7 workflow stages
  - Includes: goal, questions to ask, tools to use, exit criteria

- [ ] 3.2 Create `formatWorkflowProgress(progress: WorkflowProgress)` function
  - Shows checklist with checkmarks for completed stages
  - Highlights current stage
  - Shows section/slide progress if in building_sections stage

- [ ] 3.3 Create `formatBuyerPersona(persona: BuyerPersona | null)` function
  - Returns "Not yet defined" if null
  - Otherwise shows type, motivations, concerns in readable format

- [ ] 3.4 Create `formatHeroContext(hero: HeroContext | null)` function
  - Returns "Not yet defined" if null
  - Otherwise shows selected hero and investment thesis

- [ ] 3.5 Create `formatCIMOutline(outline: CIMOutline | null)` function
  - Returns "Not yet created" if null
  - Otherwise shows numbered sections with descriptions

- [ ] 3.6 Update `getSystemPrompt(state)` to use workflow stages
  - Replace phase-based logic with workflow stage logic
  - Include formatted workflow progress, buyer persona, hero context, outline
  - Keep knowledge base section
  - Keep gathered context section

- [ ] 3.7 Add detour handling instructions
  - "If user asks a question unrelated to current stage, help them, save any useful findings, then ask if they want to continue where we left off"

- [ ] 3.8 Add completion criteria for each stage
  - welcome: User acknowledges, move to buyer_persona
  - buyer_persona: User confirms buyer type and concerns
  - hero_concept: User selects or refines hero
  - investment_thesis: User approves 3-part thesis
  - outline: User approves section structure
  - building_sections: All sections complete

- [ ] 3.9 Remove old phase-based functions (`getPhaseInstructions`, `getPhaseDescription`)
  - Keep `getAllPhases` for backward compatibility but deprecate

- [ ] 3.10 Run `npm run type-check` - must pass with no errors

## Stage Instructions

### welcome
```
**Goal:** Greet the user and set context.

**What to do:**
- Confirm knowledge base is loaded (or not)
- Briefly explain the CIM creation process
- Ask if user is ready to begin

**Tools:** None needed

**Exit criteria:** User is ready to proceed → advance to buyer_persona
```

### buyer_persona
```
**Goal:** Understand who will be reading this CIM.

**Questions to ask:**
- Who is the target buyer? (strategic, financial/PE, public company, competitor)
- What are their primary motivations?
- What concerns should we address proactively?

**Tools:** save_buyer_persona when user confirms

**Exit criteria:** Buyer persona saved → advance to hero_concept
```

### hero_concept
```
**Goal:** Identify the story hook - what makes this company special.

**What to do:**
- Based on knowledge base and buyer persona, present 3 hero concept options
- Each option should have supporting data points from knowledge base
- Explain why each would resonate with the buyer type
- Let user pick, refine, or suggest alternative

**Tools:** save_hero_concept when user confirms selection

**Exit criteria:** Hero concept selected → advance to investment_thesis
```

### investment_thesis
```
**Goal:** Create the 3-part investment thesis.

**What to do:**
- Draft the thesis based on hero concept:
  - The Asset: What makes this company valuable
  - The Timing: Why now is the right time
  - The Opportunity: What's the upside
- Get user approval or iterate

**Tools:** save_hero_concept (updates thesis part) when user confirms

**Exit criteria:** Investment thesis approved → advance to outline
```

### outline
```
**Goal:** Define the CIM structure.

**What to do:**
- Propose sections based on knowledge base and buyer context
- Explain logical flow and why this order makes sense
- Let user add/remove/reorder sections
- Once approved, create the outline

**Tools:** create_outline when user approves

**Exit criteria:** Outline created → advance to building_sections
```

### building_sections
```
**Goal:** Build each section collaboratively.

**What to do:**
- Let user choose which section to work on
- For each section:
  1. Content Development: What key points to include
  2. For each slide:
     - Define slide content
     - Design visual layout
     - Get user approval
  3. Mark section complete
- Track progress with sectionProgress

**Tools:** start_section, update_slide, advance_workflow (for section completion)

**Exit criteria:** All sections complete → advance to complete
```

## Acceptance Criteria

1. New formatting functions return properly formatted strings
2. getSystemPrompt uses workflow stages instead of CIM phases
3. Each stage has clear instructions in the prompt
4. Old phase functions are removed (except getAllPhases with deprecation)
5. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 3 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-03-prompts.md.

Read the story file for stage instruction details.

Implement all tasks 3.1-3.10 in manda-app/lib/agent/cim-mvp/prompts.ts.

Import types from ./state.ts as needed.

After significant changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>PROMPTS_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 15 --completion-promise "PROMPTS_COMPLETE"
```
