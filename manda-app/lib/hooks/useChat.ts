'use client'

/**
 * useChat Hook
 *
 * Manages chat state, message submission, and SSE streaming.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #2 (Message Submission), #3 (Streaming Responses), #9 (Chat Hook)
 * AC: E5.7 #8 (Badge Display in Message Items)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Message, SourceCitation, MessageConfidence } from '@/lib/types/chat'
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
  /** Conversation ID that has a stream running in the background (user switched away) */
  backgroundStreamConversationId: string | null
  error: Error | null
  currentTool: string | null
  contextMessageCount: number
  suggestedFollowups: string[]
  /** Send a message. Optional conversationIdOverride bypasses React state delay for newly created conversations. */
  sendMessage: (content: string, conversationIdOverride?: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  clearError: () => void
  clearSuggestions: () => void
  loadConversation: (conversationId: string) => Promise<void>
  /** Call before creating a new conversation to prevent reload from wiping optimistic state */
  prepareForNewConversation: () => void
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
  const [backgroundStreamConversationId, setBackgroundStreamConversationId] = useState<string | null>(null)
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
  // Track confidence data (E5.7)
  const confidenceRef = useRef<MessageConfidence | undefined>(undefined)

  // Track the conversation ID that's currently being created/streamed to
  // This prevents reload for THIS conversation but allows switching to others
  const pendingConversationIdRef = useRef<string | null>(null)
  // Track the conversation ID we're actively streaming to (for callback guards)
  const streamingConversationIdRef = useRef<string | null>(null)

  // Update internal ref when prop changes
  useEffect(() => {
    currentConversationRef.current = conversationId
  }, [conversationId])

  // Load conversation messages when conversationId changes
  // Skip reload only if we're streaming to THIS specific conversation
  useEffect(() => {
    console.log('[useChat] conversationId effect:', conversationId, 'pending:', pendingConversationIdRef.current)
    if (conversationId) {
      // Only skip reload if this is the conversation we're actively streaming to
      // This allows switching to OTHER conversations while streaming
      if (pendingConversationIdRef.current === conversationId) {
        console.log('[useChat] Skipped reload - this is the pending conversation')
      } else {
        console.log('[useChat] Loading conversation messages for:', conversationId)
        loadConversationMessages(conversationId)
      }
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
  // Only skip if trying to load the conversation we're actively streaming to
  const loadConversation = useCallback(
    async (convId: string) => {
      // Allow switching to OTHER conversations, only block reload of pending one
      if (pendingConversationIdRef.current === convId) {
        console.log('[useChat] loadConversation skipped - this is the pending conversation')
        return
      }

      // If switching away from a streaming conversation, DON'T abort -
      // let it continue in background. Track it so UI can show indicator.
      if (streamingConversationIdRef.current && streamingConversationIdRef.current !== convId) {
        console.log('[useChat] Switching away from streaming conversation, stream continues in background')
        // Don't abort - let stream continue so response is saved
        // Track as background stream so UI can show indicator
        setBackgroundStreamConversationId(streamingConversationIdRef.current)
        // Clear active streaming state for this view
        setIsStreaming(false)
        setCurrentTool(null)
      }

      currentConversationRef.current = convId
      await loadConversationMessages(convId)
    },
    [projectId]
  )

  // Send a message
  // Optional conversationIdOverride allows passing a newly created conversation ID
  // before React state has propagated through the effect chain
  const sendMessage = useCallback(
    async (content: string, conversationIdOverride?: string) => {
      if (!content.trim() || isStreaming) return

      // Use override if provided (for newly created conversations)
      const effectiveConversationId = conversationIdOverride ?? currentConversationRef.current

      // Update the ref immediately if override provided
      if (conversationIdOverride) {
        currentConversationRef.current = conversationIdOverride
      }

      // Mark this conversation as pending (prevents reload from wiping optimistic messages)
      // Only blocks reload for THIS conversation, not switching to others
      pendingConversationIdRef.current = effectiveConversationId
      // Track which conversation we're streaming to (for switch-away detection)
      streamingConversationIdRef.current = effectiveConversationId

      // Store for retry
      lastUserMessageRef.current = content

      // Create optimistic user message
      const userMessageId = crypto.randomUUID()
      const userMessage: Message = {
        id: userMessageId,
        conversationId: effectiveConversationId || '',
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
      confidenceRef.current = undefined // Reset confidence (E5.7)

      // Create placeholder for assistant message
      const assistantMessageId = crypto.randomUUID()
      const assistantMessage: Message = {
        id: assistantMessageId,
        conversationId: effectiveConversationId || '',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Set up streaming callbacks
      // Guard callbacks to only update if we're still viewing this conversation
      const callbacks: ChatStreamCallbacks = {
        onToken: (token) => {
          // Guard: only update if we're still on this conversation
          if (streamingConversationIdRef.current !== effectiveConversationId) return
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
          if (streamingConversationIdRef.current !== effectiveConversationId) return
          setCurrentTool(tool)
        },
        onToolEnd: () => {
          if (streamingConversationIdRef.current !== effectiveConversationId) return
          setCurrentTool(null)
        },
        onSources: (citations) => {
          sourcesRef.current = citations
        },
        onDone: (message, followups, confidence) => {
          // Only update UI if we're still on this conversation
          const isStillOnConversation = streamingConversationIdRef.current === effectiveConversationId

          // Always clear streaming refs and background state
          streamingConversationIdRef.current = null
          pendingConversationIdRef.current = null
          setBackgroundStreamConversationId(null) // Clear background indicator

          if (!isStillOnConversation) {
            // User switched away, just clean up state
            setIsStreaming(false)
            setCurrentTool(null)
            return
          }

          // Store confidence for final update (E5.7)
          if (confidence) {
            confidenceRef.current = confidence
          }
          // Update the assistant message with final content, sources, and confidence
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    id: message.id, // Use server-generated ID
                    content: message.content,
                    sources: sourcesRef.current,
                    confidence: confidenceRef.current, // E5.7: Include confidence
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
          // Only show error if we're still on this conversation
          const isStillOnConversation = streamingConversationIdRef.current === effectiveConversationId

          // Always clear streaming refs and background state
          streamingConversationIdRef.current = null
          pendingConversationIdRef.current = null
          setBackgroundStreamConversationId(null) // Clear background indicator
          setIsStreaming(false)
          setCurrentTool(null)

          if (!isStillOnConversation) return

          setError(err)
          // Remove the empty assistant message on error
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId))
        },
      }

      // Start streaming
      const controller = sendMessageStream(
        projectId,
        content,
        effectiveConversationId || undefined,
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

  // Prepare for new conversation - sets a temporary pending ID to prevent
  // the conversationId change effect from reloading messages
  // The actual ID will be set in sendMessage when we know the real conversation ID
  const prepareForNewConversation = useCallback(() => {
    // Use a temporary marker - will be replaced with actual ID in sendMessage
    pendingConversationIdRef.current = 'pending-new'
  }, [])

  // Calculate context message count
  const contextMessageCount = Math.min(messages.length, CONTEXT_WINDOW_SIZE * 2)

  return {
    messages,
    isLoading,
    isStreaming,
    backgroundStreamConversationId,
    error,
    currentTool,
    contextMessageCount,
    suggestedFollowups,
    sendMessage,
    retryLastMessage,
    clearError,
    clearSuggestions,
    loadConversation,
    prepareForNewConversation,
  }
}
