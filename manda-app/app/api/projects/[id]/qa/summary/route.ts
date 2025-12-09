/**
 * Q&A Summary API Route
 * Returns aggregate statistics for Q&A items
 * Story: E8.1 - Q&A Data Model and CRUD API
 * AC: #7 - GET /qa/summary returns aggregate stats (total, pending, answered, by_category, by_priority)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { QASummary, QACategory, QAPriority, QA_CATEGORIES, QA_PRIORITIES } from '@/lib/types/qa'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/qa/summary
 * Fetch summary statistics for Q&A items in a project
 * AC: #7 - Returns aggregate stats (total, pending, answered, by_category, by_priority)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch all Q&A items for aggregation
    // For larger datasets, this could be optimized with SQL aggregation functions
    const { data, error } = await supabase
      .from('qa_items')
      .select('category, priority, date_answered')
      .eq('deal_id', projectId)

    if (error) {
      console.error('[api/qa/summary] Error fetching Q&A items:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const items = data || []

    // Initialize summary with zeros for all categories and priorities
    const summary: QASummary = {
      total: items.length,
      pending: 0,
      answered: 0,
      byCategory: {} as Record<QACategory, number>,
      byPriority: {} as Record<QAPriority, number>,
    }

    // Initialize all categories and priorities to 0
    for (const category of QA_CATEGORIES) {
      summary.byCategory[category] = 0
    }
    for (const priority of QA_PRIORITIES) {
      summary.byPriority[priority] = 0
    }

    // Calculate counts
    for (const item of items) {
      // Count by status (derived from date_answered)
      if (item.date_answered === null) {
        summary.pending++
      } else {
        summary.answered++
      }

      // Count by category
      const category = item.category as QACategory
      if (category in summary.byCategory) {
        summary.byCategory[category]++
      }

      // Count by priority
      const priority = item.priority as QAPriority
      if (priority && priority in summary.byPriority) {
        summary.byPriority[priority]++
      }
    }

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[api/qa/summary] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
