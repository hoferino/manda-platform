'use client'

/**
 * useConversations Hook
 *
 * Manages conversation list state for the chat sidebar.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #5 (Conversation History Sidebar), #6 (New Conversation)
 */

import { useState, useEffect, useCallback } from 'react'
import type { Conversation } from '@/lib/types/chat'
import {
  getConversations,
  createConversation,
  deleteConversation as apiDeleteConversation,
  updateConversation as apiUpdateConversation,
} from '@/lib/api/chat'

interface UseConversationsOptions {
  projectId: string
  initialConversationId?: string
}

interface UseConversationsReturn {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  error: Error | null
  selectConversation: (id: string | null) => void
  createNewConversation: (title?: string) => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>
  updateConversationTitle: (id: string, title: string) => Promise<void>
  refreshConversations: () => Promise<void>
}

export function useConversations({
  projectId,
  initialConversationId,
}: UseConversationsOptions): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    initialConversationId || null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!projectId) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await getConversations(projectId)
      setConversations(data)

      // If we have an initial conversation ID, verify it exists
      if (initialConversationId && !data.some((c) => c.id === initialConversationId)) {
        setCurrentConversationId(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch conversations'))
      console.error('[useConversations] Error fetching:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, initialConversationId])

  // Initial fetch
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Select a conversation
  const selectConversation = useCallback((id: string | null) => {
    setCurrentConversationId(id)
  }, [])

  // Create a new conversation
  const createNewConversation = useCallback(
    async (title?: string): Promise<Conversation> => {
      const conversation = await createConversation(projectId, title)

      // Add to list and select
      setConversations((prev) => [conversation, ...prev])
      setCurrentConversationId(conversation.id)

      return conversation
    },
    [projectId]
  )

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteConversation(projectId, id)

      // Remove from list
      setConversations((prev) => prev.filter((c) => c.id !== id))

      // If we deleted the current conversation, deselect it
      if (currentConversationId === id) {
        setCurrentConversationId(null)
      }
    },
    [projectId, currentConversationId]
  )

  // Update a conversation title
  const updateConversationTitle = useCallback(
    async (id: string, title: string): Promise<void> => {
      const updated = await apiUpdateConversation(projectId, id, title)

      // Update in list
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      )
    },
    [projectId]
  )

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    await fetchConversations()
  }, [fetchConversations])

  return {
    conversations,
    currentConversationId,
    isLoading,
    error,
    selectConversation,
    createNewConversation,
    deleteConversation,
    updateConversationTitle,
    refreshConversations,
  }
}
