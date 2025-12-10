/**
 * CIM Agent Executor
 *
 * High-level interface for executing the CIM workflow.
 * Story: E9.4 - Agent Orchestration Core
 *
 * Features:
 * - State persistence to database
 * - Session management
 * - Streaming support
 * - Error handling
 */

import { createClient } from '@/lib/supabase/server'
import { getCIM, updateCIM } from '@/lib/services/cim'
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import {
  CIMAgentStateType,
  createInitialState,
  convertToLangChainMessages,
  convertFromLangChainMessages,
  serializeState,
  deserializeState,
} from './state'
import {
  createCIMWorkflow,
  executeCIMWorkflow,
  streamCIMWorkflow,
  resumeCIMWorkflow,
  CIMWorkflow,
  CIMAgentConfig,
} from './workflow'
import { getCIMSystemPrompt } from './prompts'
import { ConversationMessage, CIM, WorkflowState, mapDbRowToCIM, CIMDbRow } from '@/lib/types/cim'
import { Json } from '@/lib/supabase/database.types'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of executing a CIM chat message
 */
export interface CIMChatResult {
  messageId: string
  response: string
  metadata: {
    phase: string
    slideRef?: string
    componentRef?: string
    sources?: Array<{ type: string; id: string; title: string }>
  }
  workflowState: WorkflowState
}

/**
 * Streaming event from CIM chat
 */
export interface CIMStreamEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'done' | 'error'
  data: unknown
}

// ============================================================================
// Session Management
// ============================================================================

// Cache for workflow instances per CIM
const workflowCache = new Map<string, {
  workflow: CIMWorkflow
  config: CIMAgentConfig
}>()

/**
 * Get or create a workflow for a CIM
 */
function getOrCreateWorkflow(
  cimId: string,
  config: CIMAgentConfig
): CIMWorkflow {
  const cached = workflowCache.get(cimId)

  if (cached) {
    return cached.workflow
  }

  const workflow = createCIMWorkflow(config)
  workflowCache.set(cimId, { workflow, config })

  return workflow
}

/**
 * Clear workflow cache for a CIM
 */
export function clearWorkflowCache(cimId: string): void {
  workflowCache.delete(cimId)
}

// ============================================================================
// Main Execution Functions
// ============================================================================

/**
 * Execute a chat message against the CIM agent
 * This is the main entry point for chat interactions
 */
export async function executeCIMChat(
  cimId: string,
  dealId: string,
  message: string,
  userId: string,
  dealName?: string
): Promise<CIMChatResult> {
  const supabase = await createClient()

  // Fetch CIM
  const cim = await getCIM(supabase, cimId)
  if (!cim) {
    throw new Error('CIM not found')
  }

  // Verify deal ID matches
  if (cim.dealId !== dealId) {
    throw new Error('CIM does not belong to this deal')
  }

  // Create agent config
  const config: CIMAgentConfig = {
    dealId,
    userId,
    cimId,
    dealName,
  }

  // Get or create workflow
  const workflow = getOrCreateWorkflow(cimId, config)

  // Build initial state from CIM data
  const conversationMessages = cim.conversationHistory.map(m => ({
    role: m.role,
    content: m.content,
  }))
  const langChainMessages = convertToLangChainMessages(conversationMessages)

  const initialState: Partial<CIMAgentStateType> = {
    messages: langChainMessages,
    currentPhase: cim.workflowState.current_phase,
    completedPhases: cim.workflowState.completed_phases,
    isComplete: cim.workflowState.is_complete,
    currentSectionIndex: cim.workflowState.current_section_index,
    currentSlideIndex: cim.workflowState.current_slide_index,
    buyerPersona: cim.buyerPersona,
    investmentThesis: cim.investmentThesis,
    outline: cim.outline,
    slides: cim.slides,
    dependencyGraph: cim.dependencyGraph,
    cimId,
    dealId,
    userId,
  }

  // Execute workflow
  const threadId = `cim-${cimId}`
  const result = await executeCIMWorkflow(workflow, message, threadId, initialState)

  // Extract assistant response
  const assistantMessages = result.messages.filter(
    m => m._getType() === 'ai'
  )
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
  const responseContent = typeof lastAssistantMessage?.content === 'string'
    ? lastAssistantMessage.content
    : 'I encountered an issue processing your request.'

  // Create message ID
  const messageId = crypto.randomUUID()

  // Convert messages back to storage format
  const newMessages = convertFromLangChainMessages(result.messages)

  // Build updated workflow state
  const updatedWorkflowState: WorkflowState = {
    current_phase: result.state.currentPhase,
    current_section_index: result.state.currentSectionIndex,
    current_slide_index: result.state.currentSlideIndex,
    completed_phases: result.state.completedPhases,
    is_complete: result.state.isComplete,
  }

  // Build updated conversation history
  const userMsg: ConversationMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  }

  const assistantMsg: ConversationMessage = {
    id: messageId,
    role: 'assistant',
    content: responseContent,
    timestamp: new Date().toISOString(),
    metadata: {
      phase: result.state.currentPhase,
    },
  }

  const updatedHistory: ConversationMessage[] = [
    ...cim.conversationHistory,
    userMsg,
    assistantMsg,
  ]

  // Persist to database
  await updateCIM(supabase, cimId, {
    workflowState: updatedWorkflowState,
    conversationHistory: updatedHistory,
    buyerPersona: result.state.buyerPersona,
    investmentThesis: result.state.investmentThesis,
    outline: result.state.outline,
    slides: result.state.slides,
    dependencyGraph: result.state.dependencyGraph,
  })

  return {
    messageId,
    response: responseContent,
    metadata: {
      phase: result.state.currentPhase,
      sources: result.state.sources,
    },
    workflowState: updatedWorkflowState,
  }
}

/**
 * Stream a chat message execution
 * Returns an async generator for real-time updates
 */
export async function* streamCIMChat(
  cimId: string,
  dealId: string,
  message: string,
  userId: string,
  dealName?: string
): AsyncGenerator<CIMStreamEvent> {
  const supabase = await createClient()

  // Fetch CIM
  const cim = await getCIM(supabase, cimId)
  if (!cim) {
    yield { type: 'error', data: { message: 'CIM not found' } }
    return
  }

  // Verify deal ID matches
  if (cim.dealId !== dealId) {
    yield { type: 'error', data: { message: 'CIM does not belong to this deal' } }
    return
  }

  // Create agent config
  const config: CIMAgentConfig = {
    dealId,
    userId,
    cimId,
    dealName,
  }

  // Get or create workflow
  const workflow = getOrCreateWorkflow(cimId, config)

  // Build initial state from CIM data
  const conversationMessages = cim.conversationHistory.map(m => ({
    role: m.role,
    content: m.content,
  }))
  const langChainMessages = convertToLangChainMessages(conversationMessages)

  const initialState: Partial<CIMAgentStateType> = {
    messages: langChainMessages,
    currentPhase: cim.workflowState.current_phase,
    completedPhases: cim.workflowState.completed_phases,
    isComplete: cim.workflowState.is_complete,
    buyerPersona: cim.buyerPersona,
    investmentThesis: cim.investmentThesis,
    outline: cim.outline,
    slides: cim.slides,
    dependencyGraph: cim.dependencyGraph,
    cimId,
    dealId,
    userId,
  }

  // Stream execution
  const threadId = `cim-${cimId}`
  let fullContent = ''
  let finalState: CIMAgentStateType | null = null

  try {
    for await (const event of streamCIMWorkflow(workflow, message, threadId, initialState)) {
      if (event.type === 'token') {
        fullContent += event.data as string
        yield { type: 'token', data: event.data }
      } else if (event.type === 'tool_start') {
        yield { type: 'tool_start', data: event.data }
      } else if (event.type === 'tool_end') {
        yield { type: 'tool_end', data: event.data }
      } else if (event.type === 'state_update') {
        finalState = event.data as CIMAgentStateType
      }
    }

    // Persist final state
    if (finalState) {
      const messageId = crypto.randomUUID()

      const userMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }

      const assistantMsg: ConversationMessage = {
        id: messageId,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date().toISOString(),
        metadata: {
          phase: finalState.currentPhase,
        },
      }

      const updatedWorkflowState: WorkflowState = {
        current_phase: finalState.currentPhase,
        current_section_index: finalState.currentSectionIndex,
        current_slide_index: finalState.currentSlideIndex,
        completed_phases: finalState.completedPhases,
        is_complete: finalState.isComplete,
      }

      await updateCIM(supabase, cimId, {
        workflowState: updatedWorkflowState,
        conversationHistory: [...cim.conversationHistory, userMsg, assistantMsg],
        buyerPersona: finalState.buyerPersona,
        investmentThesis: finalState.investmentThesis,
        outline: finalState.outline,
        slides: finalState.slides,
        dependencyGraph: finalState.dependencyGraph,
      })

      yield {
        type: 'done',
        data: {
          messageId,
          workflowState: updatedWorkflowState,
        },
      }
    }
  } catch (error) {
    console.error('[streamCIMChat] Error:', error)
    yield {
      type: 'error',
      data: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }
  }
}

/**
 * Get the current workflow state for a CIM
 */
export async function getCIMWorkflowState(
  cimId: string
): Promise<WorkflowState | null> {
  const supabase = await createClient()

  const cim = await getCIM(supabase, cimId)
  if (!cim) {
    return null
  }

  return cim.workflowState
}

/**
 * Reset the workflow for a CIM (start fresh)
 */
export async function resetCIMWorkflow(
  cimId: string
): Promise<boolean> {
  const supabase = await createClient()

  const cim = await getCIM(supabase, cimId)
  if (!cim) {
    return false
  }

  // Clear workflow cache
  clearWorkflowCache(cimId)

  // Reset to initial state
  await updateCIM(supabase, cimId, {
    workflowState: {
      current_phase: 'persona',
      current_section_index: null,
      current_slide_index: null,
      completed_phases: [],
      is_complete: false,
    },
    conversationHistory: [],
    buyerPersona: null,
    investmentThesis: null,
    outline: [],
    slides: [],
  })

  return true
}

/**
 * Navigate to a specific workflow phase (for editing)
 */
export async function navigateToPhase(
  cimId: string,
  targetPhase: string
): Promise<WorkflowState | null> {
  const supabase = await createClient()

  const cim = await getCIM(supabase, cimId)
  if (!cim) {
    return null
  }

  await updateCIM(supabase, cimId, {
    workflowState: {
      ...cim.workflowState,
      current_phase: targetPhase as WorkflowState['current_phase'],
    },
  })

  return {
    ...cim.workflowState,
    current_phase: targetPhase as WorkflowState['current_phase'],
  }
}
