/**
 * Chat Orchestrator Graph
 *
 * LangGraph-based orchestration with three paths:
 * 1. Vanilla - Direct LLM response (greetings, general chat)
 * 2. Retrieval - Neo4j context injection + LLM (document questions)
 * 3. Analysis - Subagent routing (complex analysis)
 *
 * Design Philosophy:
 * - Conversation memory persists across invocations (MessagesState pattern)
 * - Default to vanilla LLM experience (like ChatGPT)
 * - Only invoke complexity when needed for document/analysis queries
 * - Lightweight router (<5ms) determines path based on last user message
 */

import { StateGraph, START, END, Annotation, messagesStateReducer } from '@langchain/langgraph'
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import { MemorySaver } from '@langchain/langgraph'

import { routeMessage, type RoutePath, type RouterResult } from './router'
import { streamVanillaPath, executeVanillaPath } from './paths/vanilla'
import { streamRetrievalPath, executeRetrievalPath } from './paths/retrieval'
import { streamAnalysisPath, executeAnalysisPath } from './paths/analysis'

// =============================================================================
// State Definition (MessagesState pattern)
// =============================================================================

interface SourceItem {
  documentId?: string
  documentName?: string
  page?: number
  excerpt?: string
  snippet?: string
}

interface MetricsType {
  routeLatencyMs?: number
  pathLatencyMs?: number
  totalLatencyMs?: number
  model?: string
  specialists?: string[]
  retrievalLatencyMs?: number
  hadContext?: boolean
}

/**
 * Orchestrator state using MessagesState pattern
 *
 * The `messages` field uses messagesStateReducer which:
 * - Appends new messages to existing ones
 * - Handles message ID-based updates
 * - Persists across invocations with checkpointing
 */
const OrchestratorStateAnnotation = Annotation.Root({
  // Core conversation state (accumulated)
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Context (set per-invocation)
  dealId: Annotation<string>({
    reducer: (_, incoming) => incoming,
    default: () => '',
  }),
  userId: Annotation<string>({
    reducer: (_, incoming) => incoming,
    default: () => '',
  }),
  organizationId: Annotation<string | undefined>({
    reducer: (_, incoming) => incoming,
    default: () => undefined,
  }),

  // Routing (computed each turn)
  routerResult: Annotation<RouterResult | undefined>({
    reducer: (_, incoming) => incoming,
    default: () => undefined,
  }),
  selectedPath: Annotation<RoutePath | undefined>({
    reducer: (_, incoming) => incoming,
    default: () => undefined,
  }),

  // Sources from retrieval (per-turn)
  sources: Annotation<SourceItem[]>({
    reducer: (_, incoming) => incoming,
    default: () => [],
  }),

  // Metrics (per-turn)
  metrics: Annotation<MetricsType>({
    reducer: (_, incoming) => incoming,
    default: () => ({}),
  }),
})

type OrchestratorState = typeof OrchestratorStateAnnotation.State

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the last human message from the conversation
 */
function getLastHumanMessage(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]._getType() === 'human') {
      const content = messages[i].content
      return typeof content === 'string' ? content : JSON.stringify(content)
    }
  }
  return ''
}

/**
 * Get chat history excluding the last message (for context)
 */
function getChatHistoryForContext(messages: BaseMessage[]): BaseMessage[] {
  if (messages.length <= 1) return []
  return messages.slice(0, -1)
}

// =============================================================================
// Graph Nodes
// =============================================================================

/**
 * Route node - determines which path to take based on last user message
 */
function routeNode(state: OrchestratorState): Partial<OrchestratorState> {
  const startTime = Date.now()

  const lastMessage = getLastHumanMessage(state.messages)
  const routerResult = routeMessage(lastMessage)

  console.log(
    `[Orchestrator] Route: ${routerResult.path} ` +
    `(confidence: ${routerResult.confidence.toFixed(2)}, ` +
    `keywords: [${routerResult.matchedKeywords.join(', ')}])`
  )

  return {
    routerResult,
    selectedPath: routerResult.path,
    metrics: {
      routeLatencyMs: Date.now() - startTime,
    },
  }
}

/**
 * Conditional edge function - routes to the appropriate path
 */
function routeToPath(state: OrchestratorState): RoutePath {
  return state.selectedPath || 'vanilla'
}

/**
 * Vanilla path node - direct LLM response
 */
async function vanillaNode(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
  const startTime = Date.now()

  const lastMessage = getLastHumanMessage(state.messages)
  const chatHistory = getChatHistoryForContext(state.messages)

  const result = await executeVanillaPath({
    message: lastMessage,
    chatHistory,
  })

  // Add AI response to messages
  const aiMessage = new AIMessage(result.content)

  return {
    messages: [aiMessage],
    sources: [],
    metrics: {
      routeLatencyMs: state.metrics?.routeLatencyMs,
      pathLatencyMs: result.latencyMs,
      model: result.model,
      totalLatencyMs: Date.now() - startTime + (state.metrics?.routeLatencyMs || 0),
    },
  }
}

/**
 * Retrieval path node - context injection + LLM
 */
async function retrievalNode(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
  const startTime = Date.now()

  const lastMessage = getLastHumanMessage(state.messages)
  const chatHistory = getChatHistoryForContext(state.messages)

  const result = await executeRetrievalPath({
    message: lastMessage,
    dealId: state.dealId,
    organizationId: state.organizationId,
    chatHistory,
  })

  // Add AI response to messages
  const aiMessage = new AIMessage(result.content)

  return {
    messages: [aiMessage],
    sources: result.sources.map(s => ({
      documentName: s.documentName,
      page: s.page,
      excerpt: s.excerpt,
    })),
    metrics: {
      routeLatencyMs: state.metrics?.routeLatencyMs,
      pathLatencyMs: result.latencyMs,
      retrievalLatencyMs: result.retrievalLatencyMs,
      hadContext: result.hadContext,
      model: result.model,
      totalLatencyMs: Date.now() - startTime + (state.metrics?.routeLatencyMs || 0),
    },
  }
}

/**
 * Analysis path node - subagent routing
 */
async function analysisNode(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
  const startTime = Date.now()

  const lastMessage = getLastHumanMessage(state.messages)
  const chatHistory = getChatHistoryForContext(state.messages)

  const result = await executeAnalysisPath({
    message: lastMessage,
    dealId: state.dealId,
    userId: state.userId,
    organizationId: state.organizationId,
    chatHistory,
  })

  // Add AI response to messages
  const aiMessage = new AIMessage(result.content)

  return {
    messages: [aiMessage],
    sources: result.sources.map(s => ({
      documentName: s.documentName,
      snippet: s.snippet,
    })),
    metrics: {
      routeLatencyMs: state.metrics?.routeLatencyMs,
      pathLatencyMs: result.latencyMs,
      specialists: result.specialists,
      totalLatencyMs: Date.now() - startTime + (state.metrics?.routeLatencyMs || 0),
    },
  }
}

// =============================================================================
// Graph Construction
// =============================================================================

/**
 * Create the orchestrator graph
 *
 * @param checkpointer - Optional memory saver for conversation persistence
 */
export function createOrchestratorGraph(checkpointer?: MemorySaver) {
  const workflow = new StateGraph(OrchestratorStateAnnotation)
    // Add nodes
    .addNode('route', routeNode)
    .addNode('vanilla', vanillaNode)
    .addNode('retrieval', retrievalNode)
    .addNode('analysis', analysisNode)

    // Add edges
    .addEdge(START, 'route')
    .addConditionalEdges('route', routeToPath, {
      vanilla: 'vanilla',
      retrieval: 'retrieval',
      analysis: 'analysis',
    })
    .addEdge('vanilla', END)
    .addEdge('retrieval', END)
    .addEdge('analysis', END)

  // Compile with optional checkpointer for memory
  if (checkpointer) {
    return workflow.compile({ checkpointer })
  }
  return workflow.compile()
}

/**
 * Pre-compiled orchestrator graph for LangGraph Studio visualization
 * Uses in-memory checkpointing for conversation persistence in Studio
 */
const studioCheckpointer = new MemorySaver()
export const orchestratorGraph = createOrchestratorGraph(studioCheckpointer)

// =============================================================================
// Invocation Types
// =============================================================================

export interface OrchestratorInput {
  message: string
  dealId: string
  userId: string
  organizationId?: string
  chatHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export interface OrchestratorResult {
  content: string
  path: RoutePath
  sources: Array<{
    documentId?: string
    documentName?: string
    page?: number
    excerpt?: string
    snippet?: string
  }>
  metrics: {
    routeLatencyMs: number
    pathLatencyMs: number
    totalLatencyMs: number
    model?: string
    specialists?: string[]
    retrievalLatencyMs?: number
    hadContext?: boolean
  }
  routing: {
    confidence: number
    matchedKeywords: string[]
    reason: string
  }
}

// =============================================================================
// Streaming Callbacks
// =============================================================================

export interface OrchestratorCallbacks {
  onToken?: (token: string) => void
  onRouteDecision?: (result: RouterResult) => void
  onPathStart?: (path: RoutePath) => void
  onPathComplete?: (path: RoutePath, latencyMs: number) => void
}

// =============================================================================
// Helper: Convert legacy chat history format to BaseMessage[]
// =============================================================================

function convertLegacyChatHistory(
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): BaseMessage[] {
  return history.map(msg => {
    switch (msg.role) {
      case 'user':
        return new HumanMessage(msg.content)
      case 'assistant':
        return new AIMessage(msg.content)
      case 'system':
        return new SystemMessage(msg.content)
      default:
        return new HumanMessage(msg.content)
    }
  })
}

// =============================================================================
// Main Invocation Functions
// =============================================================================

/**
 * Invoke the orchestrator (non-streaming)
 *
 * For API usage, this creates a fresh graph without checkpointing.
 * Chat history is passed in from the database.
 */
export async function invokeOrchestrator(
  input: OrchestratorInput
): Promise<OrchestratorResult> {
  // Create graph without checkpointer (API manages state via database)
  const graph = createOrchestratorGraph()

  // Convert legacy chat history and add new user message
  const existingMessages = convertLegacyChatHistory(input.chatHistory || [])
  const userMessage = new HumanMessage(input.message)

  const result = await graph.invoke({
    messages: [...existingMessages, userMessage],
    dealId: input.dealId,
    userId: input.userId,
    organizationId: input.organizationId,
  })

  // Get the last AI message as the response
  const lastMessage = result.messages[result.messages.length - 1]
  const content = lastMessage
    ? (typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content))
    : ''

  return {
    content,
    path: result.selectedPath || 'vanilla',
    sources: result.sources || [],
    metrics: {
      routeLatencyMs: result.metrics?.routeLatencyMs || 0,
      pathLatencyMs: result.metrics?.pathLatencyMs || 0,
      totalLatencyMs: result.metrics?.totalLatencyMs || 0,
      model: result.metrics?.model,
      specialists: result.metrics?.specialists,
      retrievalLatencyMs: result.metrics?.retrievalLatencyMs,
      hadContext: result.metrics?.hadContext,
    },
    routing: {
      confidence: result.routerResult?.confidence || 0,
      matchedKeywords: result.routerResult?.matchedKeywords || [],
      reason: result.routerResult?.reason || '',
    },
  }
}

/**
 * Stream the orchestrator response
 *
 * For API usage, this creates a fresh graph without checkpointing.
 * Chat history is passed in from the database.
 */
export async function streamOrchestrator(
  input: OrchestratorInput,
  callbacks: OrchestratorCallbacks
): Promise<OrchestratorResult> {
  // Create graph without checkpointer (API manages state via database)
  const graph = createOrchestratorGraph()

  // Convert legacy chat history and add new user message
  const existingMessages = convertLegacyChatHistory(input.chatHistory || [])
  const userMessage = new HumanMessage(input.message)

  // First, run the router to determine path
  const routerResult = routeMessage(input.message)
  callbacks.onRouteDecision?.(routerResult)
  callbacks.onPathStart?.(routerResult.path)

  const pathStartTime = Date.now()

  // Stream based on the selected path
  let response: string
  let sources: OrchestratorResult['sources'] = []
  let metrics: OrchestratorResult['metrics']

  const chatHistory = existingMessages

  switch (routerResult.path) {
    case 'vanilla': {
      const result = await streamVanillaPath(
        { message: input.message, chatHistory },
        (token) => callbacks.onToken?.(token)
      )
      response = result.content
      metrics = {
        routeLatencyMs: 0,
        pathLatencyMs: result.latencyMs,
        totalLatencyMs: result.latencyMs,
        model: result.model,
      }
      break
    }

    case 'retrieval': {
      const result = await streamRetrievalPath(
        {
          message: input.message,
          dealId: input.dealId,
          organizationId: input.organizationId,
          chatHistory,
        },
        (token) => callbacks.onToken?.(token)
      )
      response = result.content
      sources = result.sources.map(s => ({
        documentName: s.documentName,
        page: s.page,
        excerpt: s.excerpt,
      }))
      metrics = {
        routeLatencyMs: 0,
        pathLatencyMs: result.latencyMs,
        totalLatencyMs: result.latencyMs,
        retrievalLatencyMs: result.retrievalLatencyMs,
        hadContext: result.hadContext,
        model: result.model,
      }
      break
    }

    case 'analysis': {
      const result = await streamAnalysisPath(
        {
          message: input.message,
          dealId: input.dealId,
          userId: input.userId,
          organizationId: input.organizationId,
          chatHistory,
        },
        (token) => callbacks.onToken?.(token)
      )
      response = result.content
      sources = result.sources.map(s => ({
        documentName: s.documentName,
        snippet: s.snippet,
      }))
      metrics = {
        routeLatencyMs: 0,
        pathLatencyMs: result.latencyMs,
        totalLatencyMs: result.latencyMs,
        specialists: result.specialists,
      }
      break
    }
  }

  callbacks.onPathComplete?.(routerResult.path, Date.now() - pathStartTime)

  return {
    content: response,
    path: routerResult.path,
    sources,
    metrics,
    routing: {
      confidence: routerResult.confidence,
      matchedKeywords: routerResult.matchedKeywords,
      reason: routerResult.reason,
    },
  }
}

// Re-export types
export type { RoutePath, RouterResult } from './router'
