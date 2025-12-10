/**
 * CIM Tools Index
 *
 * Exports all CIM-specific agent tools.
 * Story: E9.4 - Agent Orchestration Core
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 * Story: E9.7 - Slide Content Creation (RAG-powered)
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
  // Visual concept tools
  setVisualConceptTool,
  // Workflow tools
  transitionPhaseTool,
  // Aggregate export
  cimTools,
  CIM_TOOL_COUNT,
} from './cim-tools'
