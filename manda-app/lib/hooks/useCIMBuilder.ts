'use client'

/**
 * useCIMBuilder Hook
 *
 * Centralized state management for the CIM Builder interface.
 * Handles CIM loading, updates, and state coordination.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #1-6 - State management for all acceptance criteria
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type {
  CIM,
  OutlineSection,
  Slide,
  ConversationMessage,
} from '@/lib/types/cim'

interface UseCIMBuilderReturn {
  cim: CIM | null
  isLoading: boolean
  error: string | null
  sourceRef: string
  setSourceRef: (ref: string) => void
  currentSlideIndex: number
  setCurrentSlideIndex: (index: number) => void
  addMessage: (message: ConversationMessage) => void
  updateOutline: (outline: OutlineSection[]) => Promise<void>
  updateSlides: (slides: Slide[]) => Promise<void>
  refresh: () => Promise<void>
}

export function useCIMBuilder(projectId: string, cimId: string): UseCIMBuilderReturn {
  const [cim, setCIM] = useState<CIM | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceRef, setSourceRef] = useState('')
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  // Track if initial load has completed
  const initialLoadRef = useRef(false)

  // Fetch CIM data
  const fetchCIM = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/projects/${projectId}/cims/${cimId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load CIM')
      }

      const data = await response.json()
      setCIM(data.cim)

      // Set initial slide index based on workflow state
      if (data.cim?.workflowState?.current_slide_index !== null) {
        setCurrentSlideIndex(data.cim.workflowState.current_slide_index)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load CIM'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
      initialLoadRef.current = true
    }
  }, [projectId, cimId])

  // Initial fetch
  useEffect(() => {
    fetchCIM()
  }, [fetchCIM])

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchCIM()
  }, [fetchCIM])

  // Add a message to conversation history (optimistic update)
  const addMessage = useCallback((message: ConversationMessage) => {
    setCIM((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        conversationHistory: [...prev.conversationHistory, message],
      }
    })
  }, [])

  // Update outline
  const updateOutline = useCallback(
    async (outline: OutlineSection[]) => {
      if (!cim) return

      // Optimistic update
      const previousOutline = cim.outline
      setCIM((prev) => (prev ? { ...prev, outline } : prev))

      try {
        const response = await fetch(`/api/projects/${projectId}/cims/${cimId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outline }),
        })

        if (!response.ok) {
          throw new Error('Failed to update outline')
        }
      } catch (err) {
        // Rollback on error
        setCIM((prev) => (prev ? { ...prev, outline: previousOutline } : prev))
        toast.error('Failed to update outline')
      }
    },
    [cim, projectId, cimId]
  )

  // Update slides
  const updateSlides = useCallback(
    async (slides: Slide[]) => {
      if (!cim) return

      // Optimistic update
      const previousSlides = cim.slides
      setCIM((prev) => (prev ? { ...prev, slides } : prev))

      try {
        const response = await fetch(`/api/projects/${projectId}/cims/${cimId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slides }),
        })

        if (!response.ok) {
          throw new Error('Failed to update slides')
        }
      } catch (err) {
        // Rollback on error
        setCIM((prev) => (prev ? { ...prev, slides: previousSlides } : prev))
        toast.error('Failed to update slides')
      }
    },
    [cim, projectId, cimId]
  )

  return {
    cim,
    isLoading,
    error,
    sourceRef,
    setSourceRef,
    currentSlideIndex,
    setCurrentSlideIndex,
    addMessage,
    updateOutline,
    updateSlides,
    refresh,
  }
}
