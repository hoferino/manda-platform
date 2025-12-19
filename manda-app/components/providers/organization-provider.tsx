'use client'

/**
 * Organization Context Provider
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #9)
 *
 * Provides organization context throughout the application:
 * - Current organization selection
 * - User's organization memberships
 * - Organization switching
 * - Automatic header injection for API requests
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './auth-provider'

/**
 * Organization data structure.
 */
export interface Organization {
  id: string
  name: string
  slug: string
}

/**
 * User's membership in an organization.
 */
export interface OrganizationMembership {
  organization_id: string
  role: 'superadmin' | 'admin' | 'member'
  organizations: Organization
}

interface OrganizationContextType {
  /** Currently selected organization */
  currentOrganization: Organization | null
  /** All organizations user belongs to */
  organizations: Organization[]
  /** User's role in current organization */
  currentRole: 'superadmin' | 'admin' | 'member' | null
  /** Loading state */
  loading: boolean
  /** Error state */
  error: string | null
  /** Switch to a different organization */
  switchOrganization: (orgId: string) => void
  /** Check if user has admin privileges in current org */
  isAdmin: boolean
  /** Check if user has superadmin privileges */
  isSuperadmin: boolean
  /** Get headers for API requests (includes x-organization-id) */
  getApiHeaders: () => Record<string, string>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const ORG_STORAGE_KEY = 'manda_current_org_id'

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth()
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  // Fetch user's organization memberships
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!user) {
        setMemberships([])
        setCurrentOrgId(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('organization_members')
          .select(`
            organization_id,
            role,
            organizations (
              id,
              name,
              slug
            )
          `)
          .eq('user_id', user.id)

        if (fetchError) {
          console.error('[OrganizationProvider] Fetch error:', fetchError)
          setError('Failed to load organizations')
          setMemberships([])
          return
        }

        const orgs = (data as OrganizationMembership[]) || []
        setMemberships(orgs)

        // Restore saved organization or use first available
        if (orgs.length > 0) {
          const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY)
          const savedOrgExists = orgs.some(m => m.organization_id === savedOrgId)

          if (savedOrgId && savedOrgExists) {
            setCurrentOrgId(savedOrgId)
          } else if (orgs[0]) {
            // Default to first organization and persist to localStorage
            const firstOrgId = orgs[0].organization_id
            setCurrentOrgId(firstOrgId)
            localStorage.setItem(ORG_STORAGE_KEY, firstOrgId)
          }
        }
      } catch (err) {
        console.error('[OrganizationProvider] Error:', err)
        setError('Failed to load organizations')
      } finally {
        setLoading(false)
      }
    }

    fetchOrganizations()
  }, [user, supabase])

  // Switch organization
  const switchOrganization = useCallback((orgId: string) => {
    const membership = memberships.find(m => m.organization_id === orgId)
    if (membership) {
      setCurrentOrgId(orgId)
      localStorage.setItem(ORG_STORAGE_KEY, orgId)
    }
  }, [memberships])

  // Derive current organization and role
  const currentMembership = useMemo(() => {
    return memberships.find(m => m.organization_id === currentOrgId) || null
  }, [memberships, currentOrgId])

  const currentOrganization = useMemo(() => {
    return currentMembership?.organizations || null
  }, [currentMembership])

  const currentRole = useMemo(() => {
    return currentMembership?.role || null
  }, [currentMembership])

  const organizations = useMemo(() => {
    return memberships.map(m => m.organizations)
  }, [memberships])

  const isAdmin = useMemo(() => {
    return currentRole === 'admin' || currentRole === 'superadmin'
  }, [currentRole])

  const isSuperadmin = useMemo(() => {
    return currentRole === 'superadmin'
  }, [currentRole])

  // Get headers for API requests
  const getApiHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (currentOrgId) {
      headers['x-organization-id'] = currentOrgId
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    return headers
  }, [currentOrgId, session])

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    currentRole,
    loading,
    error,
    switchOrganization,
    isAdmin,
    isSuperadmin,
    getApiHeaders,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

/**
 * Hook to access organization context.
 *
 * @throws Error if used outside OrganizationProvider
 */
export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

/**
 * Hook to get the current organization ID.
 * Useful for simpler cases where full context is not needed.
 */
export function useOrganizationId(): string | null {
  const { currentOrganization } = useOrganization()
  return currentOrganization?.id || null
}
