/**
 * Q&A Service
 *
 * CRUD operations for Q&A items stored in Supabase.
 * Story: E8.1 - Q&A Data Model and CRUD API
 *
 * Features:
 * - Create, read, update, delete Q&A items
 * - Optimistic locking via updated_at timestamp
 * - Filtered queries with pagination
 * - Summary statistics
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  QAItem,
  QAFilters,
  QASummary,
  QAConflictError,
  CreateQAItemInput,
  UpdateQAItemInput,
  mapDbRowToQAItem,
  mapQAItemToDbInsert,
  mapQAItemToDbUpdate,
} from '@/lib/types/qa'

// Type alias for Supabase client with our database types
type SupabaseClientTyped = SupabaseClient<Database>

// Database row type from generated types
type QAItemRow = Database['public']['Tables']['qa_items']['Row']

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new Q&A item
 * AC: #1 - POST /qa with valid input returns 201 with QAItem including generated id and timestamps
 */
export async function createQAItem(
  supabase: SupabaseClientTyped,
  dealId: string,
  input: CreateQAItemInput,
  userId?: string
): Promise<QAItem> {
  const insertData = mapQAItemToDbInsert(input, dealId, userId)

  const { data, error } = await supabase
    .from('qa_items')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating Q&A item:', error)
    throw new Error(`Failed to create Q&A item: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to create Q&A item: No data returned')
  }

  return mapDbRowToQAItem(data)
}

/**
 * Get a single Q&A item by ID
 */
export async function getQAItem(
  supabase: SupabaseClientTyped,
  itemId: string
): Promise<QAItem | null> {
  const { data, error } = await supabase
    .from('qa_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null
    }
    console.error('Error fetching Q&A item:', error)
    throw new Error(`Failed to fetch Q&A item: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapDbRowToQAItem(data)
}

/**
 * Get Q&A items for a deal with optional filters
 * AC: #2 - GET /qa returns list filtered by category, priority, and status query params
 */
export async function getQAItems(
  supabase: SupabaseClientTyped,
  dealId: string,
  filters?: QAFilters
): Promise<QAItem[]> {
  let query = supabase
    .from('qa_items')
    .select('*')
    .eq('deal_id', dealId)
    .order('date_added', { ascending: false })

  // Apply filters
  if (filters?.category) {
    query = query.eq('category', filters.category)
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }

  if (filters?.status === 'pending') {
    query = query.is('date_answered', null)
  } else if (filters?.status === 'answered') {
    query = query.not('date_answered', 'is', null)
  }

  // Apply pagination
  const limit = filters?.limit ?? 50
  const offset = filters?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching Q&A items:', error)
    throw new Error(`Failed to fetch Q&A items: ${error.message}`)
  }

  return (data || []).map((row) => mapDbRowToQAItem(row))
}

/**
 * Update a Q&A item with optimistic locking
 * AC: #3 - PUT /qa/{id} with current updated_at timestamp succeeds
 * AC: #4 - PUT /qa/{id} with stale updated_at returns 409 Conflict
 */
export async function updateQAItem(
  supabase: SupabaseClientTyped,
  itemId: string,
  input: UpdateQAItemInput
): Promise<QAItem | QAConflictError> {
  const { updatedAt, ...updateFields } = input
  const updateData = mapQAItemToDbUpdate(updateFields)

  if (Object.keys(updateData).length === 0) {
    // No actual updates, just return current item
    const currentItem = await getQAItem(supabase, itemId)
    if (!currentItem) {
      throw new Error('Q&A item not found')
    }
    return currentItem
  }

  // Use optimistic locking: only update if updated_at matches
  const { data, error } = await supabase
    .from('qa_items')
    .update(updateData)
    .eq('id', itemId)
    .eq('updated_at', updatedAt) // Optimistic locking
    .select('*')

  if (error) {
    console.error('Error updating Q&A item:', error)
    throw new Error(`Failed to update Q&A item: ${error.message}`)
  }

  // Check if update succeeded (row was matched)
  if (!data || data.length === 0) {
    // No rows updated - either item doesn't exist or updated_at didn't match
    const currentItem = await getQAItem(supabase, itemId)

    if (!currentItem) {
      throw new Error('Q&A item not found')
    }

    // Return conflict error with current item state
    return {
      type: 'conflict',
      message: 'This item was modified by another user. Please review the current values.',
      currentItem,
      yourChanges: updateFields,
    }
  }

  const updatedRow = data[0]
  if (!updatedRow) {
    throw new Error('Failed to update Q&A item: No data returned')
  }

  return mapDbRowToQAItem(updatedRow)
}

/**
 * Delete a Q&A item
 * AC: #5 - DELETE /qa/{id} returns 204 No Content
 */
export async function deleteQAItem(
  supabase: SupabaseClientTyped,
  itemId: string
): Promise<boolean> {
  const { error } = await supabase.from('qa_items').delete().eq('id', itemId)

  if (error) {
    console.error('Error deleting Q&A item:', error)
    throw new Error(`Failed to delete Q&A item: ${error.message}`)
  }

  return true
}

// ============================================================================
// Summary and Statistics
// ============================================================================

/**
 * Get summary statistics for Q&A items in a deal
 * AC: #7 - GET /qa/summary returns aggregate stats
 */
export async function getQASummary(
  supabase: SupabaseClientTyped,
  dealId: string
): Promise<QASummary> {
  // Fetch all items to calculate summary
  // For large datasets, this could be optimized with SQL aggregation
  const { data, error } = await supabase
    .from('qa_items')
    .select('category, priority, date_answered')
    .eq('deal_id', dealId)

  if (error) {
    console.error('Error fetching Q&A summary:', error)
    throw new Error(`Failed to fetch Q&A summary: ${error.message}`)
  }

  const items = data || []

  // Initialize summary
  const summary: QASummary = {
    total: items.length,
    pending: 0,
    answered: 0,
    byCategory: {
      Financials: 0,
      Legal: 0,
      Operations: 0,
      Market: 0,
      Technology: 0,
      HR: 0,
    },
    byPriority: {
      high: 0,
      medium: 0,
      low: 0,
    },
  }

  // Calculate counts
  for (const item of items) {
    // Count by status
    if (item.date_answered === null) {
      summary.pending++
    } else {
      summary.answered++
    }

    // Count by category
    const category = item.category as keyof typeof summary.byCategory
    if (category in summary.byCategory) {
      summary.byCategory[category]++
    }

    // Count by priority
    const priority = item.priority as keyof typeof summary.byPriority
    if (priority && priority in summary.byPriority) {
      summary.byPriority[priority]++
    }
  }

  return summary
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Create multiple Q&A items at once
 */
export async function createQAItems(
  supabase: SupabaseClientTyped,
  dealId: string,
  items: CreateQAItemInput[],
  userId?: string
): Promise<QAItem[]> {
  if (items.length === 0) {
    return []
  }

  const insertData = items.map(input => mapQAItemToDbInsert(input, dealId, userId))

  const { data, error } = await supabase
    .from('qa_items')
    .insert(insertData)
    .select('*')

  if (error) {
    console.error('Error creating Q&A items:', error)
    throw new Error(`Failed to create Q&A items: ${error.message}`)
  }

  return (data || []).map((row) => mapDbRowToQAItem(row))
}

/**
 * Delete multiple Q&A items at once
 */
export async function deleteQAItems(
  supabase: SupabaseClientTyped,
  itemIds: string[]
): Promise<boolean> {
  if (itemIds.length === 0) {
    return true
  }

  const { error } = await supabase.from('qa_items').delete().in('id', itemIds)

  if (error) {
    console.error('Error deleting Q&A items:', error)
    throw new Error(`Failed to delete Q&A items: ${error.message}`)
  }

  return true
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Get count of Q&A items for a deal
 */
export async function getQAItemCount(
  supabase: SupabaseClientTyped,
  dealId: string,
  status?: 'pending' | 'answered'
): Promise<number> {
  let query = supabase
    .from('qa_items')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId)

  if (status === 'pending') {
    query = query.is('date_answered', null)
  } else if (status === 'answered') {
    query = query.not('date_answered', 'is', null)
  }

  const { count, error } = await query

  if (error) {
    console.error('Error counting Q&A items:', error)
    throw new Error(`Failed to count Q&A items: ${error.message}`)
  }

  return count ?? 0
}

/**
 * Check if a Q&A item exists
 */
export async function qaItemExists(
  supabase: SupabaseClientTyped,
  itemId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('qa_items')
    .select('id', { count: 'exact', head: true })
    .eq('id', itemId)

  if (error) {
    console.error('Error checking Q&A item existence:', error)
    return false
  }

  return (count ?? 0) > 0
}

/**
 * Get Q&A items linked to a specific finding
 */
export async function getQAItemsByFinding(
  supabase: SupabaseClientTyped,
  findingId: string
): Promise<QAItem[]> {
  const { data, error } = await supabase
    .from('qa_items')
    .select('*')
    .eq('source_finding_id', findingId)
    .order('date_added', { ascending: false })

  if (error) {
    console.error('Error fetching Q&A items by finding:', error)
    throw new Error(`Failed to fetch Q&A items: ${error.message}`)
  }

  return (data || []).map((row) => mapDbRowToQAItem(row))
}
