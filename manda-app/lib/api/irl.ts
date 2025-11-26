/**
 * IRL (Information Request List) API Types and Functions
 * Story: E2.8 - Implement IRL Integration with Document Tracking
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
    const { data: itemsData, error: itemsError } = await supabase
      .from('irl_items')
      .select(`
        id,
        irl_id,
        category,
        name,
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
    const items: IRLItem[] = (itemsData || []).map((item) => {
      const linkedDoc = docsByItemId.get(item.id)
      return {
        id: item.id,
        irlId: item.irl_id,
        category: item.category,
        name: item.name,
        description: item.description,
        required: item.required ?? true,
        sortOrder: item.sort_order ?? 0,
        documentId: linkedDoc?.id || null,
        documentName: linkedDoc?.name || null,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }
    })

    // Calculate progress
    const completedCount = items.filter((item) => item.documentId !== null).length
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
    const completedCount = items.filter((item) => item.documentId !== null).length

    // Group by category
    const categoryMap = new Map<string, { total: number; completed: number }>()
    for (const item of items) {
      const existing = categoryMap.get(item.category) || { total: 0, completed: 0 }
      existing.total++
      if (item.documentId) {
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
      completedCount: categoryItems.filter((item) => item.documentId !== null).length,
      totalCount: categoryItems.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
