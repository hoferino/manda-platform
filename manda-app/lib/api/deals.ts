/**
 * Deals API Functions
 * Server-side data fetching for deals/projects
 * Story: E1.4 - Build Projects Overview Screen
 */

import { createClient } from '@/lib/supabase/server'
import type { Deal } from '@/lib/supabase/types'

export interface DealsResponse {
  data: Deal[] | null
  error: string | null
}

/**
 * Fetch all deals for the authenticated user
 * RLS policies ensure users only see their own deals
 */
export async function getDeals(): Promise<DealsResponse> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching deals:', error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Get a single deal by ID
 */
export async function getDealById(id: string): Promise<{ data: Deal | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching deal:', error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}
