/**
 * IRL Service
 *
 * CRUD operations for IRLs and IRL items stored in Supabase.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * Features:
 * - Get IRL with items
 * - Update IRL metadata
 * - Delete IRL
 * - Create/update/delete IRL items
 * - Batch reorder items
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  IRL,
  IRLItem,
  IRLWithItems,
  IRLProgress,
  IRLFulfilledProgress,
  CreateIRLItemRequest,
  UpdateIRLItemRequest,
  calculateIRLProgress,
  calculateIRLFulfilledProgress,
} from '@/lib/types/irl'

type DbIRL = Database['public']['Tables']['irls']['Row']
type DbIRLItem = Database['public']['Tables']['irl_items']['Row']

/**
 * Map database IRL row to IRL interface
 */
function mapDbToIRL(row: DbIRL): IRL {
  return {
    id: row.id,
    dealId: row.deal_id,
    title: row.name, // Map 'name' to 'title'
    templateType: row.template_type ?? undefined,
    sourceFileName: undefined, // Not in schema
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Map database IRL item row to IRLItem interface
 */
function mapDbToIRLItem(row: DbIRLItem): IRLItem {
  return {
    id: row.id,
    irlId: row.irl_id,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    itemName: row.item_name,
    description: row.description ?? undefined,
    priority: (row.priority as IRLItem['priority']) ?? 'medium',
    status: (row.status as IRLItem['status']) ?? 'not_started',
    fulfilled: (row as { fulfilled?: boolean }).fulfilled ?? false,
    notes: row.notes ?? undefined,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Get a single IRL by ID
 */
export async function getIRL(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<IRL | null> {
  const { data, error } = await supabase
    .from('irls')
    .select('*')
    .eq('id', irlId)
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error('Error fetching IRL:', error)
    }
    return null
  }

  return mapDbToIRL(data)
}

/**
 * Get IRL with all its items
 */
export async function getIRLWithItems(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<IRLWithItems | null> {
  // Fetch IRL
  const { data: irlData, error: irlError } = await supabase
    .from('irls')
    .select('*')
    .eq('id', irlId)
    .single()

  if (irlError || !irlData) {
    if (irlError?.code !== 'PGRST116') {
      console.error('Error fetching IRL:', irlError)
    }
    return null
  }

  // Fetch items
  const { data: itemsData, error: itemsError } = await supabase
    .from('irl_items')
    .select('*')
    .eq('irl_id', irlId)
    .order('sort_order', { ascending: true })

  if (itemsError) {
    console.error('Error fetching IRL items:', itemsError)
    return null
  }

  const irl = mapDbToIRL(irlData)
  const items = (itemsData || []).map(mapDbToIRLItem)

  return {
    ...irl,
    items,
  }
}

/**
 * Update IRL metadata
 */
export async function updateIRL(
  supabase: SupabaseClient<Database>,
  irlId: string,
  updates: { title?: string }
): Promise<IRL | null> {
  const dbUpdates: Partial<Database['public']['Tables']['irls']['Update']> = {}

  if (updates.title !== undefined) {
    dbUpdates.name = updates.title // Map 'title' to 'name'
  }

  if (Object.keys(dbUpdates).length === 0) {
    // No updates, return existing IRL
    return getIRL(supabase, irlId)
  }

  const { data, error } = await supabase
    .from('irls')
    .update(dbUpdates)
    .eq('id', irlId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating IRL:', error)
    return null
  }

  return mapDbToIRL(data)
}

/**
 * Delete an IRL (cascades to items)
 */
export async function deleteIRL(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('irls')
    .delete()
    .eq('id', irlId)

  if (error) {
    console.error('Error deleting IRL:', error)
    return false
  }

  return true
}

/**
 * Create a new IRL item
 */
export async function createIRLItem(
  supabase: SupabaseClient<Database>,
  irlId: string,
  item: CreateIRLItemRequest
): Promise<IRLItem | null> {
  const { data, error } = await supabase
    .from('irl_items')
    .insert({
      irl_id: irlId,
      category: item.category,
      subcategory: item.subcategory ?? null,
      item_name: item.itemName,
      description: item.description ?? null,
      priority: item.priority ?? 'medium',
      status: 'not_started',
      notes: item.notes ?? null,
      sort_order: item.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating IRL item:', error)
    return null
  }

  return mapDbToIRLItem(data)
}

/**
 * Update an IRL item
 */
export async function updateIRLItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
  updates: UpdateIRLItemRequest
): Promise<IRLItem | null> {
  const dbUpdates: Partial<Database['public']['Tables']['irl_items']['Update']> = {}

  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.subcategory !== undefined) dbUpdates.subcategory = updates.subcategory
  if (updates.itemName !== undefined) dbUpdates.item_name = updates.itemName
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

  if (Object.keys(dbUpdates).length === 0) {
    // No updates
    return getIRLItem(supabase, itemId)
  }

  const { data, error } = await supabase
    .from('irl_items')
    .update(dbUpdates)
    .eq('id', itemId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating IRL item:', error)
    return null
  }

  return mapDbToIRLItem(data)
}

/**
 * Get a single IRL item by ID
 */
export async function getIRLItem(
  supabase: SupabaseClient<Database>,
  itemId: string
): Promise<IRLItem | null> {
  const { data, error } = await supabase
    .from('irl_items')
    .select('*')
    .eq('id', itemId)
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('Error fetching IRL item:', error)
    }
    return null
  }

  return mapDbToIRLItem(data)
}

/**
 * Delete an IRL item
 */
export async function deleteIRLItem(
  supabase: SupabaseClient<Database>,
  itemId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('irl_items')
    .delete()
    .eq('id', itemId)

  if (error) {
    console.error('Error deleting IRL item:', error)
    return false
  }

  return true
}

/**
 * Batch reorder IRL items
 * Updates sort_order for multiple items in a single transaction
 */
export async function reorderIRLItems(
  supabase: SupabaseClient<Database>,
  items: Array<{ id: string; sortOrder: number; category?: string }>
): Promise<boolean> {
  // Process updates sequentially (Supabase doesn't support true batch updates)
  // In a production system, you might want to use a stored procedure
  for (const item of items) {
    const updates: Partial<Database['public']['Tables']['irl_items']['Update']> = {
      sort_order: item.sortOrder,
    }

    // If category is provided, update it too (for cross-category drag)
    if (item.category !== undefined) {
      updates.category = item.category
    }

    const { error } = await supabase
      .from('irl_items')
      .update(updates)
      .eq('id', item.id)

    if (error) {
      console.error('Error reordering IRL item:', error)
      return false
    }
  }

  return true
}

/**
 * Get all items for an IRL, grouped by category
 */
export async function getIRLItemsByCategory(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<Record<string, IRLItem[]>> {
  const { data, error } = await supabase
    .from('irl_items')
    .select('*')
    .eq('irl_id', irlId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching IRL items:', error)
    return {}
  }

  const items = (data || []).map(mapDbToIRLItem)

  // Group by category
  const result: Record<string, IRLItem[]> = {}
  for (const item of items) {
    if (!result[item.category]) {
      result[item.category] = []
    }
    result[item.category]!.push(item)
  }
  return result
}

/**
 * Get unique categories for an IRL
 */
export async function getIRLCategories(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('irl_items')
    .select('category')
    .eq('irl_id', irlId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching IRL categories:', error)
    return []
  }

  // Get unique categories while preserving order
  const seen = new Set<string>()
  const categories: string[] = []

  for (const row of data || []) {
    if (!seen.has(row.category)) {
      seen.add(row.category)
      categories.push(row.category)
    }
  }

  return categories
}

/**
 * Get IRL progress statistics
 */
export async function getIRLProgress(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<IRLProgress | null> {
  const { data, error } = await supabase
    .from('irl_items')
    .select('status')
    .eq('irl_id', irlId)

  if (error) {
    console.error('Error fetching IRL progress:', error)
    return null
  }

  // Create mock items with just status to use calculateIRLProgress
  const items = (data || []).map(row => ({
    status: (row.status as IRLItem['status']) ?? 'not_started',
  })) as IRLItem[]

  return calculateIRLProgress(items)
}

/**
 * Add a new category to an IRL
 * Creates a placeholder item with the category name
 */
export async function addCategory(
  supabase: SupabaseClient<Database>,
  irlId: string,
  categoryName: string
): Promise<IRLItem | null> {
  // Get the maximum sort_order to place the new category at the end
  const { data: existingItems } = await supabase
    .from('irl_items')
    .select('sort_order')
    .eq('irl_id', irlId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const maxSortOrder = existingItems?.[0]?.sort_order ?? -1
  const newSortOrder = maxSortOrder + 1

  return createIRLItem(supabase, irlId, {
    category: categoryName,
    itemName: 'New Item',
    priority: 'medium',
    sortOrder: newSortOrder,
  })
}

/**
 * Delete a category and all its items
 */
export async function deleteCategory(
  supabase: SupabaseClient<Database>,
  irlId: string,
  categoryName: string
): Promise<boolean> {
  const { error } = await supabase
    .from('irl_items')
    .delete()
    .eq('irl_id', irlId)
    .eq('category', categoryName)

  if (error) {
    console.error('Error deleting category:', error)
    return false
  }

  return true
}

/**
 * Rename a category (update category name for all items in that category)
 */
export async function renameCategory(
  supabase: SupabaseClient<Database>,
  irlId: string,
  oldName: string,
  newName: string
): Promise<boolean> {
  const { error } = await supabase
    .from('irl_items')
    .update({ category: newName })
    .eq('irl_id', irlId)
    .eq('category', oldName)

  if (error) {
    console.error('Error renaming category:', error)
    return false
  }

  return true
}

/**
 * Update progress_percent on the IRL based on item statuses
 */
export async function updateIRLProgressPercent(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<void> {
  const progress = await getIRLProgress(supabase, irlId)

  if (progress) {
    await supabase
      .from('irls')
      .update({ progress_percent: progress.percentComplete })
      .eq('id', irlId)
  }
}

/**
 * Update the fulfilled status of an IRL item (binary toggle)
 * Used for the manual checklist in Data Room sidebar
 * Story: E6.5 - Implement IRL-Document Linking and Progress Tracking
 */
export async function updateIRLItemFulfilled(
  supabase: SupabaseClient<Database>,
  itemId: string,
  fulfilled: boolean
): Promise<IRLItem | null> {
  const { data, error } = await supabase
    .from('irl_items')
    .update({ fulfilled } as unknown as Database['public']['Tables']['irl_items']['Update'])
    .eq('id', itemId)
    .select()
    .single()

  if (error || !data) {
    console.error('Error updating IRL item fulfilled status:', error)
    return null
  }

  return mapDbToIRLItem(data)
}

/**
 * Get IRL fulfilled progress statistics (binary fulfilled-based)
 * Used for the manual checklist in Data Room sidebar
 */
export async function getIRLFulfilledProgress(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<IRLFulfilledProgress | null> {
  const { data, error } = await supabase
    .from('irl_items')
    .select('fulfilled')
    .eq('irl_id', irlId)

  if (error) {
    console.error('Error fetching IRL fulfilled progress:', error)
    return null
  }

  // Create items with fulfilled field for calculation
  const items = (data || []).map(row => ({
    fulfilled: (row as { fulfilled?: boolean }).fulfilled ?? false,
  })) as Pick<IRLItem, 'fulfilled'>[]

  return calculateIRLFulfilledProgress(items as IRLItem[])
}

/**
 * Update progress_percent on the IRL based on fulfilled items
 * Used after toggling fulfilled status
 */
export async function updateIRLProgressPercentFromFulfilled(
  supabase: SupabaseClient<Database>,
  irlId: string
): Promise<void> {
  const progress = await getIRLFulfilledProgress(supabase, irlId)

  if (progress) {
    await supabase
      .from('irls')
      .update({ progress_percent: progress.percentComplete })
      .eq('id', irlId)
  }
}
