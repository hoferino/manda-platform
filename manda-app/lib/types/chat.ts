/**
 * Chat Types
 *
 * TypeScript types for the chat interface and conversation management.
 * Story: E5.3 - Build Chat Interface with Conversation History
 */

import { z } from 'zod'

/**
 * Source citation from agent responses
 * Extended with metadata for DocumentPreviewModal integration
 * Story: E5.4 - AC: #3, #7
 */
export interface SourceCitation {
  /** Document filename */
  documentName: string
  /** Location string (e.g., "p.15", "Sheet 'P&L', Cell B15") */
  location: string
  /** Document ID for viewer integration */
  documentId?: string
  /** Chunk ID for chunk-level navigation */
  chunkId?: string
  /** Page number for PDFs */
  pageNumber?: number
  /** Sheet name for Excel files */
  sheetName?: string
  /** Cell reference for Excel files */
  cellReference?: string
  /** Text snippet from the source (for context) */
  textSnippet?: string
}

/**
 * Tool call record
 */
export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  result?: unknown
}

/**
 * Message role - supports both legacy and new naming
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool' | 'human' | 'ai'

/**
 * Chat message
 */
export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  sources?: SourceCitation[]
  metadata?: Record<string, unknown>
  tokensUsed?: number
  createdAt: string
}

/**
 * Conversation
 */
export interface Conversation {
  id: string
  dealId: string
  userId: string
  title: string | null
  createdAt: string
  updatedAt: string
  messageCount?: number
  lastMessage?: string
}

/**
 * Conversation with messages
 */
export interface ConversationWithMessages extends Conversation {
  messages: Message[]
}

/**
 * Chat request body
 */
export interface ChatRequest {
  message: string
  conversationId?: string
}

/**
 * SSE Event types from streaming
 */
export type SSEEventType = 'token' | 'tool_start' | 'tool_end' | 'sources' | 'done' | 'error'

/**
 * SSE Token event
 */
export interface SSETokenEvent {
  type: 'token'
  text: string
}

/**
 * SSE Tool start event
 */
export interface SSEToolStartEvent {
  type: 'tool_start'
  tool: string
  args: unknown
}

/**
 * SSE Tool end event
 */
export interface SSEToolEndEvent {
  type: 'tool_end'
  tool: string
  result: unknown
}

/**
 * SSE Sources event
 */
export interface SSESourcesEvent {
  type: 'sources'
  citations: SourceCitation[]
}

/**
 * SSE Done event
 */
export interface SSEDoneEvent {
  type: 'done'
  message: {
    id: string
    content: string
    role: 'assistant'
  }
  suggestedFollowups?: string[]
}

/**
 * SSE Error event
 */
export interface SSEErrorEvent {
  type: 'error'
  message: string
  code?: string
}

/**
 * Union of all SSE event types
 */
export type SSEEvent =
  | SSETokenEvent
  | SSEToolStartEvent
  | SSEToolEndEvent
  | SSESourcesEvent
  | SSEDoneEvent
  | SSEErrorEvent

/**
 * Chat state for useChat hook
 */
export interface ChatState {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: Error | null
  conversationId: string | null
  contextMessageCount: number
  currentTool: string | null
}

/**
 * Zod Schemas for validation
 */
export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
})

export const ConversationCreateSchema = z.object({
  title: z.string().max(255).optional(),
})

export const ConversationUpdateSchema = z.object({
  title: z.string().max(255).optional(),
})

export const MessageQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
})

/**
 * Helper to normalize message role
 * Maps 'human' -> 'user' and 'ai' -> 'assistant'
 */
export function normalizeMessageRole(role: MessageRole): 'user' | 'assistant' | 'system' | 'tool' {
  if (role === 'human') return 'user'
  if (role === 'ai') return 'assistant'
  return role as 'user' | 'assistant' | 'system' | 'tool'
}

/**
 * Helper to get display role (for DB storage)
 * Uses 'user' and 'assistant' for new messages
 */
export function getStorageRole(role: 'user' | 'assistant' | 'system' | 'tool'): string {
  return role
}

/**
 * Tool name to user-friendly display message
 */
export const TOOL_DISPLAY_MESSAGES: Record<string, string> = {
  query_knowledge_base: 'Searching knowledge base...',
  update_knowledge_base: 'Updating knowledge base...',
  validate_finding: 'Validating finding...',
  update_knowledge_graph: 'Updating knowledge graph...',
  detect_contradictions: 'Checking for contradictions...',
  find_gaps: 'Analyzing gaps...',
  get_document_info: 'Looking up document...',
  trigger_analysis: 'Triggering document analysis...',
  suggest_questions: 'Generating questions...',
  add_to_qa: 'Adding to Q&A list...',
  create_irl: 'Creating IRL item...',
}

/**
 * Get display message for a tool
 */
export function getToolDisplayMessage(toolName: string): string {
  return TOOL_DISPLAY_MESSAGES[toolName] || `Running ${toolName}...`
}

/**
 * Parse SSE event from string data
 */
export function parseSSEEvent(data: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed && typeof parsed.type === 'string') {
      return parsed as SSEEvent
    }
    return null
  } catch {
    return null
  }
}

/**
 * Convert database message to Message type
 */
export function dbMessageToMessage(dbMessage: {
  id: string
  conversation_id: string
  role: string
  content: string
  tool_calls?: unknown
  metadata?: unknown
  sources?: unknown
  tokens_used?: number
  created_at: string
}): Message {
  return {
    id: dbMessage.id,
    conversationId: dbMessage.conversation_id,
    role: normalizeMessageRole(dbMessage.role as MessageRole),
    content: dbMessage.content,
    toolCalls: dbMessage.tool_calls as ToolCall[] | undefined,
    sources: dbMessage.sources as SourceCitation[] | undefined,
    metadata: dbMessage.metadata as Record<string, unknown> | undefined,
    tokensUsed: dbMessage.tokens_used,
    createdAt: dbMessage.created_at,
  }
}

/**
 * Convert database conversation to Conversation type
 */
export function dbConversationToConversation(dbConv: {
  id: string
  deal_id: string
  user_id: string
  title: string | null
  created_at: string
  updated_at: string
}): Conversation {
  return {
    id: dbConv.id,
    dealId: dbConv.deal_id,
    userId: dbConv.user_id,
    title: dbConv.title,
    createdAt: dbConv.created_at,
    updatedAt: dbConv.updated_at,
  }
}
