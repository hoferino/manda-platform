/**
 * CIM Tools Index
 *
 * Exports all CIM-specific agent tools.
 * Story: E9.4 - Agent Orchestration Core
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 * Story: E9.10 - Visual Concept Generation
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 */

export {
  // Persona tools
  saveBuyerPersonaTool,
  // Thesis tools
  saveInvestmentThesisTool,
  // Outline tools
  createOutlineSectionTool,
  updateOutlineSectionTool,
  deleteOutlineSectionTool,
  reorderOutlineSectionsTool,
  // Slide content tools (E9.7)
  generateSlideContentTool,
  selectContentOptionTool,
  approveSlideContentTool,
  updateSlideTool,
  // Visual concept tools (E9.10)
  generateVisualConceptTool,
  regenerateVisualConceptTool,
  setVisualConceptTool,
  // Dependency tracking tools (E9.11)
  trackDependenciesTool,
  getDependentSlidesTool,
  validateCoherenceTool,
  // Workflow tools
  transitionPhaseTool,
  // Aggregate export
  cimTools,
  CIM_TOOL_COUNT,
} from './cim-tools'
