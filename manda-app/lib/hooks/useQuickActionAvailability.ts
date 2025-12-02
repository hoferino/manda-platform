'use client'

/**
 * useQuickActionAvailability Hook
 *
 * Checks availability of quick actions based on project state.
 * Story: E5.5 - Implement Quick Actions and Suggested Follow-ups
 * AC: #4 (Disabled Button States)
 */

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface QuickActionAvailability {
  enabled: boolean
  reason?: string
}

export interface QuickActionAvailabilityState {
  findContradictions: QuickActionAvailability
  generateQA: QuickActionAvailability
  summarizeFindings: QuickActionAvailability
  identifyGaps: QuickActionAvailability
  isLoading: boolean
}

interface UseQuickActionAvailabilityOptions {
  projectId: string
}

/**
 * Maps quick action IDs to availability state keys
 */
export function getAvailabilityMap(state: QuickActionAvailabilityState): Record<string, QuickActionAvailability> {
  return {
    'find-contradictions': state.findContradictions,
    'generate-qa': state.generateQA,
    'summarize-findings': state.summarizeFindings,
    'identify-gaps': state.identifyGaps,
  }
}

export function useQuickActionAvailability({
  projectId,
}: UseQuickActionAvailabilityOptions): QuickActionAvailabilityState {
  const [hasDocuments, setHasDocuments] = useState(false)
  const [hasFindings, setHasFindings] = useState(false)
  const [hasIRL, setHasIRL] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAvailability = async () => {
      if (!projectId) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const supabase = createClient()

      try {
        // Check for documents, findings, and IRLs in parallel
        const [documentsResult, findingsResult, irlsResult] = await Promise.all([
          // Check documents
          supabase
            .from('documents')
            .select('id', { count: 'exact', head: true })
            .eq('deal_id', projectId)
            .limit(1),
          // Check findings
          supabase
            .from('findings')
            .select('id', { count: 'exact', head: true })
            .eq('deal_id', projectId)
            .limit(1),
          // Check IRLs
          supabase
            .from('irls')
            .select('id', { count: 'exact', head: true })
            .eq('deal_id', projectId)
            .limit(1),
        ])

        setHasDocuments((documentsResult.count ?? 0) > 0)
        setHasFindings((findingsResult.count ?? 0) > 0)
        setHasIRL((irlsResult.count ?? 0) > 0)
      } catch (error) {
        console.error('[useQuickActionAvailability] Error checking availability:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAvailability()
  }, [projectId])

  // Compute availability based on state
  const availability = useMemo<QuickActionAvailabilityState>(() => ({
    findContradictions: {
      enabled: hasDocuments,
      reason: hasDocuments ? undefined : 'Upload documents to detect contradictions',
    },
    generateQA: {
      enabled: hasDocuments,
      reason: hasDocuments ? undefined : 'Upload documents to generate Q&A',
    },
    summarizeFindings: {
      enabled: hasFindings,
      reason: hasFindings ? undefined : 'Process documents to see findings summary',
    },
    identifyGaps: {
      enabled: hasDocuments,
      reason: hasDocuments ? undefined : 'Upload documents to identify gaps',
    },
    isLoading,
  }), [hasDocuments, hasFindings, hasIRL, isLoading])

  return availability
}
