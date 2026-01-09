'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const refreshSession = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    setSession(currentSession)
    setUser(currentSession?.user ?? null)
  }, [supabase.auth])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }, [supabase.auth])

  useEffect(() => {
    // Get initial session
    const initSession = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession()
      setSession(initialSession)
      setUser(initialSession?.user ?? null)

      // Ensure organization ID is set for existing session (E12.9 fix)
      if (initialSession?.user) {
        const existingOrgId = localStorage.getItem('manda_current_org_id')
        if (!existingOrgId) {
          const { data: memberships } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', initialSession.user.id)
            .limit(1)

          if (memberships?.[0]?.organization_id) {
            localStorage.setItem('manda_current_org_id', memberships[0].organization_id)
          }
        }
      }

      setLoading(false)
    }

    initSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setLoading(false)

        // Handle specific auth events
        if (event === 'SIGNED_IN' && currentSession?.user) {
          console.log('User signed in:', currentSession?.user?.email)

          // Ensure organization ID is set in localStorage (E12.9 fix)
          // This prevents race condition with OrganizationProvider
          const existingOrgId = localStorage.getItem('manda_current_org_id')
          if (!existingOrgId) {
            const { data: memberships } = await supabase
              .from('organization_members')
              .select('organization_id')
              .eq('user_id', currentSession.user.id)
              .limit(1)

            if (memberships?.[0]?.organization_id) {
              localStorage.setItem('manda_current_org_id', memberships[0].organization_id)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out')
          localStorage.removeItem('manda_current_org_id')
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed')
        }
      }
    )

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  const value: AuthContextType = {
    user,
    session,
    loading,
    signOut,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
