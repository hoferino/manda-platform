/**
 * Chat API Client
 *
 * Functions for interacting with the chat API endpoints.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 */

import type {
  Conversation,
  ConversationWithMessages,
  Message,
  MessageConfidence,
  SSEEvent,
  parseSSEEvent,
} from '@/lib/types/chat'

/**
 * Base API path for chat
 */
function getChatApiPath(projectId: string): string {
  return `/api/projects/${projectId}/chat`
}

/**
 * Base API path for conversations
 */
function getConversationsApiPath(projectId: string): string {
  return `/api/projects/${projectId}/conversations`
}

/**
 * Fetch conversations for a project
 */
export async function getConversations(projectId: string): Promise<Conversation[]> {
  const response = await fetch(getConversationsApiPath(projectId), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to fetch conversations')
  }

  return response.json()
}

/**
 * Get a single conversation with its messages
 */
export async function getConversation(
  projectId: string,
  conversationId: string
): Promise<ConversationWithMessages> {
  const response = await fetch(
    `${getConversationsApiPath(projectId)}/${conversationId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to fetch conversation')
  }

  return response.json()
}

/**
 * Create a new conversation
 */
export async function createConversation(
  projectId: string,
  title?: string
): Promise<Conversation> {
  const response = await fetch(getConversationsApiPath(projectId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to create conversation')
  }

  return response.json()
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  projectId: string,
  conversationId: string
): Promise<void> {
  const response = await fetch(
    `${getConversationsApiPath(projectId)}/${conversationId}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to delete conversation')
  }
}

/**
 * Update a conversation title
 */
export async function updateConversation(
  projectId: string,
  conversationId: string,
  title: string
): Promise<Conversation> {
  const response = await fetch(
    `${getConversationsApiPath(projectId)}/${conversationId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to update conversation')
  }

  return response.json()
}

/**
 * Get messages for a conversation
 */
export async function getMessages(
  projectId: string,
  conversationId: string,
  options?: { limit?: number; before?: string }
): Promise<Message[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.before) params.set('before', options.before)

  const url = `${getConversationsApiPath(projectId)}/${conversationId}/messages${
    params.toString() ? `?${params.toString()}` : ''
  }`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to fetch messages')
  }

  return response.json()
}

/**
 * Callbacks for streaming chat response
 */
export interface ChatStreamCallbacks {
  onToken?: (token: string) => void
  onToolStart?: (tool: string, args: unknown) => void
  onToolEnd?: (tool: string, result: unknown) => void
  onSources?: (citations: Array<{ documentName: string; location: string; documentId?: string }>) => void
  /** E5.7: Include confidence data in done callback */
  onDone?: (message: Message, suggestedFollowups?: string[], confidence?: MessageConfidence) => void
  onError?: (error: Error, code?: string) => void
}

/**
 * Send a message and stream the response
 *
 * @param projectId - Project ID
 * @param message - User message content
 * @param conversationId - Optional existing conversation ID
 * @param callbacks - Streaming callbacks
 * @returns AbortController to cancel the request
 */
export function sendMessageStream(
  projectId: string,
  message: string,
  conversationId: string | undefined,
  callbacks: ChatStreamCallbacks
): AbortController {
  const controller = new AbortController()

  // Execute async without blocking
  ;(async () => {
    try {
      const response = await fetch(getChatApiPath(projectId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message,
          conversationId,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        callbacks.onError?.(new Error(error.error || 'Failed to send message'), error.code)
        return
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError?.(new Error('No response body'))
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data) {
              const event = parseSSEEventSafe(data)
              if (event) {
                handleSSEEvent(event, callbacks)
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't call error callback
        return
      }
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  })()

  return controller
}

/**
 * Parse SSE event safely
 */
function parseSSEEventSafe(data: string): SSEEvent | null {
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
 * Handle SSE event with callbacks
 * E5.7: Include confidence in done event
 */
function handleSSEEvent(event: SSEEvent, callbacks: ChatStreamCallbacks): void {
  switch (event.type) {
    case 'token':
      callbacks.onToken?.(event.text)
      break
    case 'tool_start':
      callbacks.onToolStart?.(event.tool, event.args)
      break
    case 'tool_end':
      callbacks.onToolEnd?.(event.tool, event.result)
      break
    case 'sources':
      callbacks.onSources?.(event.citations)
      break
    case 'done':
      callbacks.onDone?.(
        {
          id: event.message.id,
          conversationId: '', // Will be set by the caller
          role: event.message.role,
          content: event.message.content,
          createdAt: new Date().toISOString(),
          // E5.7: Include confidence in the message
          confidence: event.confidence,
        },
        event.suggestedFollowups,
        event.confidence
      )
      break
    case 'error':
      callbacks.onError?.(new Error(event.message), event.code)
      break
  }
}

/**
 * Send a message without streaming (for testing or fallback)
 */
export async function sendMessage(
  projectId: string,
  message: string,
  conversationId?: string
): Promise<{ message: Message; conversationId: string; suggestedFollowups?: string[] }> {
  const response = await fetch(getChatApiPath(projectId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Don't request SSE
    },
    body: JSON.stringify({
      message,
      conversationId,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to send message')
  }

  return response.json()
}
