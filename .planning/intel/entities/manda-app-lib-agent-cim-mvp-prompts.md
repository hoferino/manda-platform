---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim-mvp/prompts.ts
type: service
updated: 2026-01-20
status: active
---

# prompts.ts

## Purpose

Generates stage-aware system prompts for the CIM MVP workflow agent with McKinsey/BCG/Bain presentation standards baked in. Implements prompt caching optimization by splitting prompts into static (cacheable, ~8,500 tokens with all stage instructions and guidelines) and dynamic (state-specific context) portions for 60-80% cost reduction on subsequent requests.

## Exports

- `getSystemPrompt(state): string` - Full system prompt with workflow state
- `getSystemPromptForCaching(state): CacheableSystemPrompt` - Split prompt for Anthropic caching
- `getWorkflowStageInstructions(stage): string` - Stage-specific instructions
- `formatWorkflowProgress(progress): string` - Checklist with section status
- `formatBuyerPersona(persona): string` - Format buyer persona for display
- `formatHeroContext(hero): string` - Format hero concept and thesis
- `formatCIMOutline(outline): string` - Format CIM sections
- `getPhaseDescription(phase): string` - (Deprecated) Legacy phase descriptions
- `getAllPhases(): CIMPhase[]` - (Deprecated) Legacy phase list
- `CacheableSystemPrompt` - Type for split prompt structure

## Dependencies

- [[manda-app-lib-agent-cim-mvp-state]] - CIMMVPStateType, WorkflowStage, and related types
- [[manda-app-lib-agent-cim-mvp-knowledge-loader]] - getFullSectionContext, getDataGaps, getCompanyMetadata

## Used By

TBD

## Notes

Static prompt includes all 7 stage instructions (welcome through complete) pre-computed for caching efficiency. Minimum cacheable tokens for Haiku is 4,096 - static prompt is ~8,500 tokens to exceed this. Inlines presentation guidelines (Action Titles, Pyramid Principle, Visual Hierarchy) to avoid file reads that would break caching.
