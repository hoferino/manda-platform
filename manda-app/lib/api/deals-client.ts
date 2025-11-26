/**
 * Deals API Client Functions
 * Client-side functions for creating and managing deals
 * Story: E1.5 - Implement Project Creation Wizard (AC: #7, #8)
 *
 * Note (v2.6): deal_type removed - it didn't drive any downstream behavior
 */

'use client'

import { createClient } from '@/lib/supabase/client'
import type { Deal, DealInsert } from '@/lib/supabase/types'

export interface CreateDealInput {
  name: string
  company_name?: string | null
  industry?: string | null
  irl_template?: string | null
  status?: string
}

export interface CreateDealResponse {
  data: Deal | null
  error: string | null
}

/**
 * Create a new deal record
 * Gets the current user ID from Supabase auth for RLS compliance
 */
export async function createDeal(input: CreateDealInput): Promise<CreateDealResponse> {
  const supabase = createClient()

  // Get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: null, error: 'Authentication required. Please sign in.' }
  }

  // Prepare the insert data with user_id
  const insertData: DealInsert = {
    user_id: user.id,
    name: input.name,
    company_name: input.company_name || null,
    industry: input.industry || null,
    irl_template: input.irl_template,
    status: input.status || 'active',
  }

  const { data, error } = await supabase
    .from('deals')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating deal:', error)

    // Handle specific error cases
    if (error.code === '23505') {
      return { data: null, error: 'A project with this name already exists' }
    }
    if (error.code === '23503') {
      return { data: null, error: 'Invalid reference data' }
    }
    if (error.code === 'PGRST301') {
      return { data: null, error: 'Authentication required. Please sign in.' }
    }

    return { data: null, error: error.message }
  }

  return { data, error: null }
}
