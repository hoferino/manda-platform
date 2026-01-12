/**
 * CIM MVP Graph
 *
 * Simple LangGraph StateGraph for CIM conversations.
 * Always allows chat - knowledge is optional and loaded on demand.
 *
 * Story: CIM MVP Fast Track
 */

import { StateGraph, START, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { AIMessage } from '@langchain/core/messages'

import { CIMMVPState, type CIMMVPStateType, type CIMPhase } from './state'
import { cimMVPTools } from './tools'
import { getSystemPrompt } from './prompts'
import { loadKnowledge } from './knowledge-loader'
import { getCheckpointer, type Checkpointer } from '@/lib/agent/checkpointer'

// =============================================================================
// LLM Configuration
// =============================================================================

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
}).withConfig({
  runName: 'cim-mvp-agent',
  tags: ['cim-mvp', 'gpt-4o-mini'],
  metadata: {
    graph: 'cim-mvp',
    version: '1.0.0',
  },
}).bindTools(cimMVPTools)

// =============================================================================
// Graph Nodes
// =============================================================================

/**
 * Agent node
 *
 * Main reasoning node that processes messages and decides on tool calls.
 * Tries to load knowledge on first run, but continues even if unavailable.
 */
async function agentNode(
  state: CIMMVPStateType
): Promise<Partial<CIMMVPStateType>> {
  // Try to load knowledge if not yet attempted
  let knowledgeLoaded = state.knowledgeLoaded
  let companyName = state.companyName

  if (!knowledgeLoaded && !state.knowledgeAttempted) {
    try {
      const knowledgePath = state.knowledgePath || undefined
      const knowledge = await loadKnowledge(knowledgePath)
      knowledgeLoaded = true
      companyName = knowledge.metadata.company_name
      console.log(`[CIM-MVP] Knowledge loaded for: ${companyName}`)
    } catch {
      // Knowledge not available - that's OK, continue without it
      console.log('[CIM-MVP] No knowledge file found - continuing in chat mode')
    }
  }

  // Build system prompt with current state
  const systemPrompt = getSystemPrompt({
    ...state,
    knowledgeLoaded,
    companyName,
  })

  // Invoke the model
  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    ...state.messages,
  ])

  return {
    messages: [response],
    knowledgeLoaded,
    companyName,
    knowledgeAttempted: true,
  }
}

/**
 * Tool execution node
 */
const toolNode = new ToolNode(cimMVPTools)

/**
 * Post-tool processing node
 *
 * Handles tool results that affect state (navigation, slide updates).
 */
async function postToolNode(
  state: CIMMVPStateType
): Promise<Partial<CIMMVPStateType>> {
  const lastMessage = state.messages[state.messages.length - 1]

  if (lastMessage && 'content' in lastMessage) {
    const content = lastMessage.content
    if (typeof content === 'string') {
      try {
        const result = JSON.parse(content)

        // Handle navigation
        if (result.navigatedTo) {
          const newPhase = result.navigatedTo as CIMPhase
          const completedPhases = state.currentPhase !== newPhase
            ? [...state.completedPhases, state.currentPhase]
            : state.completedPhases

          return {
            currentPhase: newPhase,
            completedPhases: completedPhases.filter(
              (p, i, arr) => arr.indexOf(p) === i
            ),
          }
        }

        // Handle slide update
        if (result.slideId && result.sectionId) {
          return {
            pendingSlideUpdate: {
              slideId: result.slideId,
              sectionId: result.sectionId,
              title: result.title || 'Untitled Slide',
              components: result.components || [],
              status: 'draft',
            },
            allSlideUpdates: [{
              slideId: result.slideId,
              sectionId: result.sectionId,
              title: result.title || 'Untitled Slide',
              components: result.components || [],
              status: 'draft',
            }],
          }
        }
      } catch {
        // Not JSON, ignore
      }
    }
  }

  return {}
}

// =============================================================================
// Routing Logic
// =============================================================================

function shouldContinue(state: CIMMVPStateType): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1]

  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return 'tools'
  }

  return END
}

function afterTools(): 'post_tool' {
  return 'post_tool'
}

function afterPostTool(): 'agent' {
  return 'agent'
}

// =============================================================================
// Graph Definition
// =============================================================================

const workflow = new StateGraph(CIMMVPState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addNode('post_tool', postToolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addConditionalEdges('tools', afterTools, {
    post_tool: 'post_tool',
  })
  .addConditionalEdges('post_tool', afterPostTool, {
    agent: 'agent',
  })

/**
 * Compiled CIM MVP graph
 */
export const cimMVPGraph = workflow.compile()

// Cached graph with checkpointer
let cachedGraphWithCheckpointer: ReturnType<typeof workflow.compile> | null = null

/**
 * Get CIM MVP graph with persistence
 */
export async function getCIMMVPGraph() {
  if (cachedGraphWithCheckpointer) {
    return cachedGraphWithCheckpointer
  }

  const checkpointer = await getCheckpointer()

  cachedGraphWithCheckpointer = workflow.compile({
    checkpointer: checkpointer as Parameters<typeof workflow.compile>[0]['checkpointer'],
  })

  return cachedGraphWithCheckpointer
}

/**
 * Create a graph instance with custom checkpointer
 */
export function createCIMMVPGraph(checkpointer?: Checkpointer) {
  if (checkpointer) {
    return workflow.compile({
      checkpointer: checkpointer as Parameters<typeof workflow.compile>[0]['checkpointer'],
    })
  }
  return workflow.compile()
}
