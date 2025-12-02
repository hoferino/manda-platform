'use client'

/**
 * useChat Hook
 *
 * Manages chat state, message submission, and SSE streaming.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #2 (Message Submission), #3 (Streaming Responses), #9 (Chat Hook)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Message, SourceCitation } from '@/lib/types/chat'
import { getConversation } from '@/lib/api/chat'
import { sendMessageStream, type ChatStreamCallbacks } from '@/lib/api/chat'

interface UseChatOptions {
  projectId: string
  conversationId: string | null
  onConversationCreated?: (id: string) => void
}

interface UseChatReturn {
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: Error | null
  currentTool: string | null
  contextMessageCount: number
  suggestedFollowups: string[]
  sendMessage: (content: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  clearError: () => void
  clearSuggestions: () => void
  loadConversation: (conversationId: string) => Promise<void>
}

const CONTEXT_WINDOW_SIZE = 10

export function useChat({
  projectId,
  conversationId,
  onConversationCreated,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [suggestedFollowups, setSuggestedFollowups] = useState<string[]>([])

  // Track the current conversation ID internally
  const currentConversationRef = useRef<string | null>(conversationId)
  // Track last user message for retry
  const lastUserMessageRef = useRef<string | null>(null)
  // Track abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null)
  // Track streaming message content
  const streamingContentRef = useRef<string>('')
  // Track collected sources
  const sourcesRef = useRef<SourceCitation[]>([])

  // Update internal ref when prop changes
  useEffect(() => {
    currentConversationRef.current = conversationId
  }, [conversationId])

  // Load conversation messages when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadConversationMessages(conversationId)
    } else {
      setMessages([])
    }
  }, [conversationId])

  // Load conversation messages from API
  const loadConversationMessages = async (convId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const conversation = await getConversation(projectId, convId)
      setMessages(conversation.messages)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load conversation'))
      console.error('[useChat] Error loading conversation:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load a specific conversation
  const loadConversation = useCallback(
    async (convId: string) => {
      currentConversationRef.current = convId
      await loadConversationMessages(convId)
    },
    [projectId]
  )

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      // Store for retry
      lastUserMessageRef.current = content

      // Create optimistic user message
      const userMessageId = crypto.randomUUID()
      const userMessage: Message = {
        id: userMessageId,
        conversationId: currentConversationRef.current || '',
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      }

      // Add user message optimistically
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)
      setError(null)
      setSuggestedFollowups([]) // Clear suggestions on new message
      streamingContentRef.current = ''
      sourcesRef.current = []

      // Create placeholder for assistant message
      const assistantMessageId = crypto.randomUUID()
      const assistantMessage: Message = {
        id: assistantMessageId,
        conversationId: currentConversationRef.current || '',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Set up streaming callbacks
      const callbacks: ChatStreamCallbacks = {
        onToken: (token) => {
          streamingContentRef.current += token
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: streamingContentRef.current }
                : msg
            )
          )
        },
        onToolStart: (tool) => {
          setCurrentTool(tool)
        },
        onToolEnd: () => {
          setCurrentTool(null)
        },
        onSources: (citations) => {
          sourcesRef.current = citations
        },
        onDone: (message, followups) => {
          // Update the assistant message with final content and sources
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    id: message.id, // Use server-generated ID
                    content: message.content,
                    sources: sourcesRef.current,
                  }
                : msg
            )
          )
          // Set suggested followups from SSE done event
          if (followups && followups.length > 0) {
            setSuggestedFollowups(followups)
          }
          setIsStreaming(false)
          setCurrentTool(null)
        },
        onError: (err, code) => {
          setError(err)
          setIsStreaming(false)
          setCurrentTool(null)

          // Remove the empty assistant message on error
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId))
        },
      }

      // Start streaming
      const controller = sendMessageStream(
        projectId,
        content,
        currentConversationRef.current || undefined,
        {
          ...callbacks,
          onDone: (message, suggestedFollowups) => {
            callbacks.onDone?.(message, suggestedFollowups)

            // Check if a new conversation was created (from response header)
            // The conversation ID will be in the X-Conversation-Id header
          },
        }
      )

      abortControllerRef.current = controller

      // We need to handle conversation creation from headers
      // This is done via polling or the header in the response
    },
    [projectId, isStreaming]
  )

  // Retry the last message
  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) return

    // Remove the last assistant message (error state) and retry
    setMessages((prev) => {
      const lastUserIndex = prev.findLastIndex((m) => m.role === 'user')
      if (lastUserIndex === -1) return prev
      return prev.slice(0, lastUserIndex)
    })

    await sendMessage(lastUserMessageRef.current)
  }, [sendMessage])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestedFollowups([])
  }, [])

  // Calculate context message count
  const contextMessageCount = Math.min(messages.length, CONTEXT_WINDOW_SIZE * 2)

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    currentTool,
    contextMessageCount,
    suggestedFollowups,
    sendMessage,
    retryLastMessage,
    clearError,
    clearSuggestions,
    loadConversation,
  }
}
