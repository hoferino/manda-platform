# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### CIM Builder Enhancements (v1.1.0)

- **Non-Linear Workflow Navigation**: New `navigate_to_stage` tool allows users to jump back to previous workflow stages (buyer_persona, hero_concept, investment_thesis, outline, building_sections) to revise decisions without losing progress
- **v3 Conversational Patterns**: Enhanced prompts across all workflow stages for more natural, collaborative interactions:
  - One question at a time approach (don't overwhelm users)
  - Always explain why (connect to buyer context and thesis)
  - Present options with equal detail (consistent formatting)
  - Wait for approval before proceeding (explicit confirmations)
  - Carry context forward (reference previous decisions)
  - Celebrate progress (acknowledge completed work)
- **Comprehensive Documentation**:
  - New `lib/agent/cim-mvp/README.md` with architecture, usage, and API reference
  - Enhanced JSDoc documentation in `prompts.ts`, `tools.ts`, and `graph.ts`
  - Updated `lib/agent/README.md` with recent changes section

#### New Exports

- `WORKFLOW_STAGE_ORDER` - Ordered array of workflow stages (exported from tools.ts)
- `NAVIGABLE_STAGES` - Stages that can be navigated to (excludes welcome/complete)
- `navigateToStageTool` - Tool for non-linear workflow navigation

### Changed

#### CIM Builder

- **prompts.ts**: Enhanced all 7 workflow stage instructions with v3 conversational patterns
  - `welcome`: Dynamic opening based on knowledge status
  - `buyer_persona`: Probing questions with context explanations
  - `hero_concept`: 3-option format with equal detail requirement
  - `investment_thesis`: 3-part thesis structure (Asset, Timing, Opportunity)
  - `outline`: Logical flow explanations for each section
  - `building_sections`: Two-step process (Content First, Then Visuals)
  - `complete`: Comprehensive summary with next steps
- **graph.ts**: `postToolNode` now distinguishes between navigation (backward) and advancement (forward) when updating workflow progress
- **tools.ts**: Added constants for workflow stages and improved JSDoc documentation

### Fixed

- Silent error catch in `postToolNode` now logs debug info for JSON-like content that fails to parse

### Technical Details

**Files Modified:**
- `manda-app/lib/agent/cim-mvp/prompts.ts` - Enhanced stage instructions and system prompt
- `manda-app/lib/agent/cim-mvp/tools.ts` - Added navigate_to_stage tool and exported constants
- `manda-app/lib/agent/cim-mvp/graph.ts` - Updated postToolNode for navigation handling

**Files Created:**
- `manda-app/lib/agent/cim-mvp/README.md` - Module documentation
- `manda-app/CHANGELOG.md` - This changelog

**Files Updated:**
- `manda-app/lib/agent/README.md` - Added recent changes section

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.1.0 | TBD | CIM Builder v3 conversational patterns and non-linear navigation |
| 1.0.0 | Previous | Initial CIM MVP workflow implementation |
