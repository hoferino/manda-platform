/**
 * IRL (Information Request List) API Types and Functions
 * Story: E2.8 - Implement IRL Integration with Document Tracking
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 */

import { createClient } from '@/lib/supabase/client'

/**
 * IRL Item - Individual item in the checklist
 */
export interface IRLItem {
  id: string
  irlId: string
  category: string
  name: string
  description: string | null
  required: boolean
  fulfilled: boolean
  sortOrder: number
  documentId: string | null
  documentName: string | null
  createdAt: string
  updatedAt: string
}

/**
 * IRL with items grouped by category
 */
export interface IRL {
  id: string
  dealId: string
  name: string
  templateType: string | null
  progressPercent: number
  items: IRLItem[]
  createdAt: string
  updatedAt: string
}

/**
 * IRL Progress statistics
 */
export interface IRLProgress {
  total: number
  completed: number
  percentage: number
  byCategory: {
    category: string
    total: number
    completed: number
  }[]
}

/**
 * IRL Item grouped by category for display
 */
export interface IRLCategory {
  name: string
  items: IRLItem[]
  completedCount: number
  totalCount: number
}

/**
 * Fetch IRL for a project with items and linked documents
 */
export async function getProjectIRL(projectId: string): Promise<{
  irl: IRL | null
  error?: string
}> {
  try {
    const supabase = createClient()

    // Get IRL for this project
    const { data: irlData, error: irlError } = await supabase
      .from('irls')
      .select('*')
      .eq('deal_id', projectId)
      .single()

    if (irlError) {
      if (irlError.code === 'PGRST116') {
        // No IRL found
        return { irl: null }
      }
      throw irlError
    }

    if (!irlData) {
      return { irl: null }
    }

    // Get IRL items with linked document info
    // Note: fulfilled column will be added once migration is applied
    const { data: itemsData, error: itemsError } = await supabase
      .from('irl_items')
      .select(`
        id,
        irl_id,
        category,
        item_name,
        description,
        required,
        sort_order,
        created_at,
        updated_at
      `)
      .eq('irl_id', irlData.id)
      .order('category')
      .order('sort_order')

    if (itemsError) {
      throw itemsError
    }

    // Get documents linked to IRL items
    const { data: docsData, error: docsError } = await supabase
      .from('documents')
      .select('id, name, irl_item_id')
      .eq('deal_id', projectId)
      .not('irl_item_id', 'is', null)

    if (docsError) {
      throw docsError
    }

    // Create a map of item_id -> document info
    const docsByItemId = new Map<string, { id: string; name: string }>()
    for (const doc of docsData || []) {
      if (doc.irl_item_id) {
        docsByItemId.set(doc.irl_item_id, { id: doc.id, name: doc.name })
      }
    }

    // Map items with document info
    // Use type assertion to access fulfilled until migration is applied
    const items: IRLItem[] = (itemsData || []).map((item) => {
      const linkedDoc = docsByItemId.get(item.id)
      const itemWithFulfilled = item as typeof item & { fulfilled?: boolean }
      return {
        id: item.id,
        irlId: item.irl_id,
        category: item.category,
        name: item.item_name,
        description: item.description,
        required: item.required ?? true,
        fulfilled: itemWithFulfilled.fulfilled ?? false,
        sortOrder: item.sort_order ?? 0,
        documentId: linkedDoc?.id || null,
        documentName: linkedDoc?.name || null,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }
    })

    // Calculate progress based on fulfilled status
    const completedCount = items.filter((item) => item.fulfilled).length
    const progressPercent = items.length > 0
      ? Math.round((completedCount / items.length) * 100)
      : 0

    return {
      irl: {
        id: irlData.id,
        dealId: irlData.deal_id,
        name: irlData.name,
        templateType: irlData.template_type,
        progressPercent,
        items,
        createdAt: irlData.created_at,
        updatedAt: irlData.updated_at,
      },
    }
  } catch (error) {
    console.error('Error fetching IRL:', error)
    return {
      irl: null,
      error: error instanceof Error ? error.message : 'Failed to fetch IRL',
    }
  }
}

/**
 * Get IRL progress statistics
 */
export async function getIRLProgress(projectId: string): Promise<{
  progress: IRLProgress | null
  error?: string
}> {
  try {
    const result = await getProjectIRL(projectId)

    if (result.error || !result.irl) {
      return {
        progress: null,
        error: result.error || 'No IRL found',
      }
    }

    const { items } = result.irl
    const completedCount = items.filter((item) => item.fulfilled).length

    // Group by category
    const categoryMap = new Map<string, { total: number; completed: number }>()
    for (const item of items) {
      const existing = categoryMap.get(item.category) || { total: 0, completed: 0 }
      existing.total++
      if (item.fulfilled) {
        existing.completed++
      }
      categoryMap.set(item.category, existing)
    }

    const byCategory = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      total: stats.total,
      completed: stats.completed,
    }))

    return {
      progress: {
        total: items.length,
        completed: completedCount,
        percentage: items.length > 0
          ? Math.round((completedCount / items.length) * 100)
          : 0,
        byCategory,
      },
    }
  } catch (error) {
    console.error('Error fetching IRL progress:', error)
    return {
      progress: null,
      error: error instanceof Error ? error.message : 'Failed to fetch IRL progress',
    }
  }
}

/**
 * Link a document to an IRL item
 */
export async function linkDocumentToIRLItem(
  documentId: string,
  irlItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('documents')
      .update({ irl_item_id: irlItemId })
      .eq('id', documentId)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error linking document to IRL item:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link document',
    }
  }
}

/**
 * Unlink a document from an IRL item
 */
export async function unlinkDocumentFromIRLItem(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('documents')
      .update({ irl_item_id: null })
      .eq('id', documentId)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error unlinking document from IRL item:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unlink document',
    }
  }
}

/**
 * Group IRL items by category
 */
export function groupItemsByCategory(items: IRLItem[]): IRLCategory[] {
  const categoryMap = new Map<string, IRLItem[]>()

  for (const item of items) {
    const existing = categoryMap.get(item.category) || []
    existing.push(item)
    categoryMap.set(item.category, existing)
  }

  return Array.from(categoryMap.entries())
    .map(([name, categoryItems]) => ({
      name,
      items: categoryItems.sort((a, b) => a.sortOrder - b.sortOrder),
      completedCount: categoryItems.filter((item) => item.fulfilled).length,
      totalCount: categoryItems.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ============================================================================
// E6.5 - IRL Item Fulfilled Toggle
// ============================================================================

/**
 * Toggle the fulfilled status of an IRL item
 * Used for the manual checklist in Data Room sidebar
 * Story: E6.5 - Implement IRL-Document Linking and Progress Tracking
 */
export async function toggleIRLItemFulfilled(
  itemId: string,
  fulfilled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('irl_items')
      .update({ fulfilled } as Record<string, unknown>)
      .eq('id', itemId)

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error toggling IRL item fulfilled:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update item',
    }
  }
}

// ============================================================================
// E6.3 - AI-Assisted IRL Suggestions
// ============================================================================

/**
 * IRL Suggestion from AI
 */
export interface IRLSuggestion {
  category: string
  itemName: string
  priority: 'high' | 'medium' | 'low'
  rationale: string
}

/**
 * Get AI-generated IRL suggestions for a project
 * Uses the generate_irl_suggestions agent tool via chat API
 */
export async function getIRLSuggestions(
  projectId: string,
  irlId?: string,
  dealType?: string
): Promise<{
  suggestions: IRLSuggestion[]
  error?: string
}> {
  try {
    // This would typically be called through the chat interface
    // For direct API access, we call the suggestions endpoint
    const response = await fetch(`/api/projects/${projectId}/irls/suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        irlId,
        dealType,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to get suggestions')
    }

    const data = await response.json()
    return { suggestions: data.suggestions || [] }
  } catch (error) {
    console.error('Error getting IRL suggestions:', error)
    return {
      suggestions: [],
      error: error instanceof Error ? error.message : 'Failed to get suggestions',
    }
  }
}

/**
 * Add a suggested item to an IRL
 */
export async function addSuggestionToIRL(
  projectId: string,
  irlId: string,
  suggestion: IRLSuggestion
): Promise<{
  success: boolean
  itemId?: string
  error?: string
}> {
  try {
    const response = await fetch(`/api/projects/${projectId}/irls/${irlId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: suggestion.category,
        itemName: suggestion.itemName,
        description: suggestion.rationale,
        priority: suggestion.priority,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to add item')
    }

    const item = await response.json()
    return { success: true, itemId: item.id }
  } catch (error) {
    console.error('Error adding suggestion to IRL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add item',
    }
  }
}

/**
 * Add multiple suggestions to IRL
 */
export async function addMultipleSuggestionsToIRL(
  projectId: string,
  irlId: string,
  suggestions: IRLSuggestion[]
): Promise<{
  success: boolean
  addedCount: number
  errors: string[]
}> {
  const errors: string[] = []
  let addedCount = 0

  for (const suggestion of suggestions) {
    const result = await addSuggestionToIRL(projectId, irlId, suggestion)
    if (result.success) {
      addedCount++
    } else {
      errors.push(`Failed to add "${suggestion.itemName}": ${result.error}`)
    }
  }

  return {
    success: errors.length === 0,
    addedCount,
    errors,
  }
}

// ============================================================================
// E6.4 - Folder Generation from IRL
// ============================================================================

/**
 * Result of folder generation from IRL
 */
export interface FolderGenerationResult {
  folders: Array<{
    id: string
    dealId: string
    name: string
    path: string
    parentPath: string | null
    createdAt: string
    updatedAt: string
  }>
  tree: Array<{
    id: string
    name: string
    path: string
    children: Array<unknown>
  }>
  created: number
  skipped: number
  errors: string[]
}

/**
 * Generate Data Room folder structure from IRL categories
 *
 * Extracts categories and subcategories from the IRL and creates:
 * 1. Folder records in PostgreSQL
 * 2. GCS folder prefixes for file storage
 *
 * @param projectId - The project/deal ID
 * @param irlId - The IRL ID to generate folders from
 * @returns FolderGenerationResult with created folders and tree structure
 */
export async function generateFoldersFromIRL(
  projectId: string,
  irlId: string
): Promise<{
  result: FolderGenerationResult | null
  error?: string
}> {
  try {
    const response = await fetch(
      `/api/projects/${projectId}/irls/${irlId}/generate-folders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to generate folders')
    }

    const result: FolderGenerationResult = await response.json()
    return { result }
  } catch (error) {
    console.error('Error generating folders from IRL:', error)
    return {
      result: null,
      error: error instanceof Error ? error.message : 'Failed to generate folders',
    }
  }
}

/**
 * Get all IRLs for a project
 */
export async function getProjectIRLs(projectId: string): Promise<{
  irls: Array<{
    id: string
    name: string
    templateType: string | null
    progressPercent: number
    itemCount: number
  }>
  error?: string
}> {
  try {
    const supabase = createClient()

    const { data: irlsData, error: irlsError } = await supabase
      .from('irls')
      .select(`
        id,
        name,
        template_type,
        progress_percent
      `)
      .eq('deal_id', projectId)
      .order('created_at', { ascending: false })

    if (irlsError) {
      throw irlsError
    }

    // Get item counts for each IRL
    const irls = await Promise.all(
      (irlsData || []).map(async (irl) => {
        const { count } = await supabase
          .from('irl_items')
          .select('*', { count: 'exact', head: true })
          .eq('irl_id', irl.id)

        return {
          id: irl.id,
          name: irl.name,
          templateType: irl.template_type,
          progressPercent: irl.progress_percent ?? 0,
          itemCount: count ?? 0,
        }
      })
    )

    return { irls }
  } catch (error) {
    console.error('Error fetching IRLs:', error)
    return {
      irls: [],
      error: error instanceof Error ? error.message : 'Failed to fetch IRLs',
    }
  }
}
