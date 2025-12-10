'use client'

/**
 * useCIMChat Hook
 *
 * Chat functionality for the CIM Builder interface.
 * Manages conversation state and agent communication.
 * Placeholder for E9.4 agent integration.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #4 - Conversation panel chat functionality
 */

import { useState, useCallback, useRef } from 'react'
import type { ConversationMessage } from '@/lib/types/cim'

interface UseCIMChatOptions {
  projectId: string
  cimId: string
  initialMessages?: ConversationMessage[]
  onMessageComplete?: (message: ConversationMessage) => void
}

interface UseCIMChatReturn {
  messages: ConversationMessage[]
  isStreaming: boolean
  error: string | null
  currentTool: string | null
  sendMessage: (content: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  clearError: () => void
}

export function useCIMChat({
  projectId,
  cimId,
  initialMessages = [],
  onMessageComplete,
}: UseCIMChatOptions): UseCIMChatReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)

  // Track last user message for retry
  const lastUserMessageRef = useRef<string | null>(null)

  // Send a message to the CIM agent
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      // Store for retry
      lastUserMessageRef.current = content
      setError(null)

      // Create optimistic user message
      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }

      // Add user message optimistically
      setMessages((prev) => [...prev, userMessage])
      setIsStreaming(true)

      try {
        // Send message to CIM chat API
        const response = await fetch(`/api/projects/${projectId}/cims/${cimId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to send message')
        }

        // Handle streaming response or regular response
        // For now, using regular response (E9.4 will add SSE streaming)
        const data = await response.json()

        // Create assistant message from response
        const assistantMessage: ConversationMessage = {
          id: data.messageId || crypto.randomUUID(),
          role: 'assistant',
          content: data.response || 'I received your message. (Agent connection pending E9.4)',
          timestamp: new Date().toISOString(),
          metadata: data.metadata,
        }

        setMessages((prev) => [...prev, assistantMessage])
        onMessageComplete?.(assistantMessage)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)

        // Create error assistant message as placeholder
        const errorAssistantMessage: ConversationMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, errorAssistantMessage])
      } finally {
        setIsStreaming(false)
        setCurrentTool(null)
      }
    },
    [projectId, cimId, isStreaming, onMessageComplete]
  )

  // Retry the last message
  const retryLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) return

    // Remove the last two messages (user message + error response)
    setMessages((prev) => prev.slice(0, -2))

    await sendMessage(lastUserMessageRef.current)
  }, [sendMessage])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    messages,
    isStreaming,
    error,
    currentTool,
    sendMessage,
    retryLastMessage,
    clearError,
  }
}
