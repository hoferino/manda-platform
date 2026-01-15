'use client'

/**
 * useCIMMVPChat Hook
 *
 * Chat functionality for the CIM MVP Builder interface.
 * Uses SSE streaming for real-time responses and slide updates.
 * Automatically sends intro message on mount.
 *
 * Story: CIM MVP Fast Track
 */

import { useState, useCallback, useRef } from 'react'

import type { ConversationMessage } from '@/lib/types/cim'
import type {
  SlideUpdate,
  CIMPhase,
  WorkflowProgress,
  CIMOutline,
  KnowledgeMode,
} from '@/lib/agent/cim-mvp'

interface UseCIMMVPChatOptions {
  projectId: string
  cimId: string
  initialMessages?: ConversationMessage[]
  // Knowledge source configuration (Story: CIM Knowledge Toggle)
  knowledgeMode?: KnowledgeMode // 'json' | 'graphiti'
  knowledgePath?: string // Required if mode === 'json'
  dealId?: string // Required if mode === 'graphiti'
  // Existing callbacks
  onMessageComplete?: (message: ConversationMessage) => void
  onSlideUpdate?: (slide: SlideUpdate) => void
  onPhaseChange?: (phase: CIMPhase) => void
  onCIMStateChanged?: () => void
  // Story 6: New workflow callbacks
  onWorkflowProgress?: (progress: WorkflowProgress) => void
  onOutlineCreated?: (outline: CIMOutline) => void
  onOutlineUpdated?: (outline: CIMOutline) => void
  onSectionStarted?: (sectionId: string, sectionTitle: string) => void
}

interface UseCIMMVPChatReturn {
  messages: ConversationMessage[]
  isStreaming: boolean
  error: string | null
  currentTool: string | null
  currentPhase: CIMPhase
  conversationId: string | null
  // Story 6: New workflow state
  workflowProgress: WorkflowProgress | null
  cimOutline: CIMOutline | null
  // Methods
  sendMessage: (content: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  clearError: () => void
}

export function useCIMMVPChat({
  projectId,
  cimId,
  initialMessages = [],
  // Knowledge source configuration (Story: CIM Knowledge Toggle)
  knowledgeMode = 'json', // Default to JSON for safety
  knowledgePath,
  dealId,
  onMessageComplete,
  onSlideUpdate,
  onPhaseChange,
  onCIMStateChanged,
  // Story 6: New workflow callbacks
  onWorkflowProgress,
  onOutlineCreated,
  onOutlineUpdated,
  onSectionStarted,
}: UseCIMMVPChatOptions): UseCIMMVPChatReturn {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<CIMPhase>('executive_summary')
  const [conversationId, setConversationId] = useState<string | null>(null)
  // Story 6: New workflow state
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null)
  const [cimOutline, setCimOutline] = useState<CIMOutline | null>(null)

  // Track last user message for retry
  const lastUserMessageRef = useRef<string | null>(null)
  // AbortController for cancelling streams
  const abortControllerRef = useRef<AbortController | null>(null)

  // Send a message to the CIM MVP agent with SSE streaming
  const sendMessage = useCallback(
    async (content: string, options?: { hideUserMessage?: boolean }) => {
      if (!content.trim() || isStreaming) return

      const hideUserMessage = options?.hideUserMessage || content.startsWith('[SYSTEM]')

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Store for retry
      lastUserMessageRef.current = content
      setError(null)

      // Create optimistic user message (skip if hidden)
      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }

      // Add user message optimistically (unless hidden)
      if (!hideUserMessage) {
        setMessages((prev) => [...prev, userMessage])
      }
      setIsStreaming(true)

      // Create placeholder for assistant message
      const assistantMessageId = crypto.randomUUID()
      let assistantContent = ''

      try {
        // Send message to CIM MVP chat API with streaming
        // Story: CIM Knowledge Toggle - pass knowledgeMode and dealId
        const response = await fetch(
          `/api/projects/${projectId}/cims/${cimId}/chat-mvp`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content,
              stream: true,
              knowledgeMode,
              knowledgePath: knowledgeMode === 'json' ? knowledgePath : undefined,
              dealId: knowledgeMode === 'graphiti' ? dealId : undefined,
              conversationId,
            }),
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to send message')
        }

        // Handle SSE stream
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        console.log('[useCIMMVPChat] Starting SSE stream processing')

        // Add placeholder assistant message
        setMessages((prev) => {
          console.log('[useCIMMVPChat] Adding placeholder message, current count:', prev.length)
          return [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: new Date().toISOString(),
            },
          ]
        })

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log('[useCIMMVPChat] Stream done, final content length:', assistantContent.length)
            break
          }

          buffer += decoder.decode(value, { stream: true })
          console.log('[useCIMMVPChat] Received chunk, buffer length:', buffer.length)

          // Process complete SSE events
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              console.log('[useCIMMVPChat] Processing SSE data:', data.substring(0, 100))
              if (data === '[DONE]') continue

              try {
                const event = JSON.parse(data)

                switch (event.type) {
                  case 'token':
                    // Append token to assistant message
                    assistantContent += event.content
                    console.log('[useCIMMVPChat] Received token, content length:', assistantContent.length)
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: assistantContent }
                          : m
                      )
                    )
                    break

                  case 'slide_update':
                    // Notify parent of slide update
                    console.log('[useCIMMVPChat] Received slide_update event:', event.slide?.slideId, event.slide?.title)
                    onSlideUpdate?.(event.slide)
                    break

                  case 'phase_change':
                    // Update current phase
                    setCurrentPhase(event.phase)
                    onPhaseChange?.(event.phase)
                    break

                  case 'tool_start':
                    setCurrentTool(event.tool)
                    break

                  case 'tool_end':
                    setCurrentTool(null)
                    break

                  case 'sources':
                    // Could add sources to message metadata
                    break

                  // Story 6: New workflow event handlers
                  case 'workflow_progress': {
                    const progress = event.data as WorkflowProgress
                    setWorkflowProgress(progress)
                    onWorkflowProgress?.(progress)
                    break
                  }

                  case 'outline_created': {
                    const outline = { sections: event.data.sections } as CIMOutline
                    setCimOutline(outline)
                    onOutlineCreated?.(outline)
                    break
                  }

                  case 'outline_updated': {
                    const updatedOutline = { sections: event.data.sections } as CIMOutline
                    setCimOutline(updatedOutline)
                    onOutlineUpdated?.(updatedOutline)
                    break
                  }

                  case 'section_started': {
                    const { sectionId, sectionTitle } = event.data
                    setWorkflowProgress((prev) =>
                      prev
                        ? {
                            ...prev,
                            currentSectionId: sectionId,
                          }
                        : null
                    )
                    onSectionStarted?.(sectionId, sectionTitle)
                    break
                  }

                  case 'done':
                    console.log('[useCIMMVPChat] Received done event')
                    // Store conversation ID for persistence
                    if (event.conversationId) {
                      setConversationId(event.conversationId)
                    }
                    break

                  case 'error':
                    throw new Error(event.message)
                }
              } catch (parseError) {
                // Ignore JSON parse errors for malformed events
                if (parseError instanceof SyntaxError) {
                  console.warn('[useCIMMVPChat] Failed to parse SSE event:', data)
                } else {
                  throw parseError
                }
              }
            }
          }
        }

        // Finalize assistant message
        const finalMessage: ConversationMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? finalMessage : m))
        )
        onMessageComplete?.(finalMessage)

        // Trigger CIM state refresh
        onCIMStateChanged?.()
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }

        const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMessage)

        // Update or add error assistant message
        const errorAssistantMessage: ConversationMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
          timestamp: new Date().toISOString(),
        }

        setMessages((prev) => {
          // Check if we already added a placeholder
          const hasPlaceholder = prev.some((m) => m.id === assistantMessageId)
          if (hasPlaceholder) {
            return prev.map((m) =>
              m.id === assistantMessageId ? errorAssistantMessage : m
            )
          }
          return [...prev, errorAssistantMessage]
        })
      } finally {
        setIsStreaming(false)
        setCurrentTool(null)
        abortControllerRef.current = null
      }
    },
    [
      projectId,
      cimId,
      isStreaming,
      // Story: CIM Knowledge Toggle
      knowledgeMode,
      knowledgePath,
      dealId,
      conversationId,
      onMessageComplete,
      onSlideUpdate,
      onPhaseChange,
      onCIMStateChanged,
      // Story 6: New workflow callbacks
      onWorkflowProgress,
      onOutlineCreated,
      onOutlineUpdated,
      onSectionStarted,
    ]
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
    currentPhase,
    conversationId,
    // Story 6: New workflow state
    workflowProgress,
    cimOutline,
    // Methods
    sendMessage,
    retryLastMessage,
    clearError,
  }
}
