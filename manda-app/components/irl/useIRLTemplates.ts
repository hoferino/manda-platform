'use client'

/**
 * useIRLTemplates Hook
 *
 * Fetches IRL templates from the API with caching.
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 */

import { useState, useEffect, useCallback } from 'react'
import { IRLTemplate } from '@/lib/types/irl'
import { getOrganizationId } from '@/lib/api/client'

export interface UseIRLTemplatesResult {
  templates: IRLTemplate[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useIRLTemplates(projectId: string): UseIRLTemplatesResult {
  const [templates, setTemplates] = useState<IRLTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const headers: Record<string, string> = {}
      const orgId = getOrganizationId()
      if (orgId) {
        headers['x-organization-id'] = orgId
      }
      const response = await fetch(`/api/projects/${projectId}/irls/templates`, { headers })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    isLoading,
    error,
    refetch: fetchTemplates,
  }
}

export default useIRLTemplates
