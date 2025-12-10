/**
 * CIM Agent Module
 *
 * LangGraph-based agent for CIM (Confidential Information Memorandum) creation.
 * Story: E9.4 - Agent Orchestration Core
 *
 * This module provides:
 * - CIM workflow state management
 * - Phase-based sequential workflow
 * - Tools for buyer persona, thesis, outline, slides
 * - Integration with deal documents via RAG
 *
 * Usage:
 * ```typescript
 * import { executeCIMChat, streamCIMChat } from '@/lib/agent/cim'
 *
 * // Non-streaming
 * const result = await executeCIMChat(cimId, dealId, message, userId)
 *
 * // Streaming
 * for await (const event of streamCIMChat(cimId, dealId, message, userId)) {
 *   if (event.type === 'token') console.log(event.data)
 * }
 * ```
 */

// State
export {
  CIMAgentState,
  type CIMAgentStateType,
  type PendingApproval,
  type SerializedCIMState,
  isPhaseCompleted,
  getNextPhase,
  getPreviousPhase,
  calculateProgress,
  getPhaseDescription,
  serializeState,
  deserializeState,
  createInitialState,
  convertToLangChainMessages,
  convertFromLangChainMessages,
} from './state'

// Prompts
export {
  CIM_AGENT_BASE_PROMPT,
  PHASE_PROMPTS,
  CIM_TOOL_USAGE_PROMPT,
  getCIMSystemPrompt,
  getPhaseIntroduction,
  getTransitionGuidance,
} from './prompts'

// Workflow
export {
  createCIMWorkflow,
  executeCIMWorkflow,
  streamCIMWorkflow,
  resumeCIMWorkflow,
  type CIMWorkflow,
  type CIMAgentConfig,
} from './workflow'

// Executor
export {
  executeCIMChat,
  streamCIMChat,
  getCIMWorkflowState,
  resetCIMWorkflow,
  navigateToPhase,
  clearWorkflowCache,
  type CIMChatResult,
  type CIMStreamEvent,
} from './executor'

// Tools
export {
  saveBuyerPersonaTool,
  saveInvestmentThesisTool,
  createOutlineSectionTool,
  updateOutlineSectionTool,
  generateSlideContentTool,
  updateSlideTool,
  setVisualConceptTool,
  transitionPhaseTool,
  cimTools,
  CIM_TOOL_COUNT,
} from './tools'
