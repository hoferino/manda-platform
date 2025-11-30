/**
 * Gaps API Route
 * Handles listing gaps for a project by analyzing IRL items and finding coverage
 * Story: E4.8 - Build Gap Analysis View (AC: #1, #2, #3, #8)
 *
 * GET /api/projects/[id]/gaps
 * Query: category, status, priority, sortBy, sortOrder
 * Response: { gaps: Gap[], irlGaps: number, infoGaps: number, total: number, resolved: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Gap, GapCategory, GapPriority, GapStatus } from '@/lib/types/gaps'
import type { FindingDomain } from '@/lib/types/findings'
import { PRIORITY_ORDER } from '@/lib/types/gaps'

// Query parameter validation schema
const GapsQuerySchema = z.object({
  category: z.enum(['all', 'irl_missing', 'information_gap', 'incomplete_analysis']).optional().default('all'),
  status: z.enum(['all', 'active', 'resolved', 'not_applicable']).optional().default('active'),
  priority: z.enum(['all', 'high', 'medium', 'low']).optional().default('all'),
  sortBy: z.enum(['priority', 'category', 'createdAt']).optional().default('priority'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// Domain coverage thresholds for information gap detection
const DOMAIN_COVERAGE_THRESHOLDS: Record<FindingDomain, { min: number; priority: GapPriority }> = {
  financial: { min: 5, priority: 'high' },
  operational: { min: 3, priority: 'medium' },
  market: { min: 3, priority: 'medium' },
  legal: { min: 2, priority: 'high' },
  technical: { min: 2, priority: 'low' },
}

// Information gap descriptions by domain
const DOMAIN_GAP_DESCRIPTIONS: Record<FindingDomain, string> = {
  financial: 'Limited financial data extracted - may be missing revenue, costs, or key metrics',
  operational: 'Sparse operational findings - consider reviewing organizational structure and processes',
  market: 'Market analysis is incomplete - competitive landscape may need more detail',
  legal: 'Legal and compliance findings are sparse - review contracts and regulatory documents',
  technical: 'Technical infrastructure not fully documented - consider IT systems review',
}

/**
 * GET /api/projects/[id]/gaps
 * Compute and return gaps for a project
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())

    // Validate query parameters
    const parseResult = GapsQuerySchema.safeParse(searchParams)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { category, status, priority, sortBy, sortOrder } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get metadata for gap resolutions
    // Note: metadata column added in migration 00024 - using type assertion until types are regenerated
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, metadata')
      .eq('id', projectId)
      .single() as { data: { id: string; metadata: Record<string, unknown> | null } | null; error: Error | null }

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get stored gap resolutions from deal metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (project.metadata as Record<string, any>) || {}
    const gapResolutions: Record<string, { status: GapStatus; note?: string; resolvedAt: string }> =
      metadata.gapResolutions || {}

    // Collect all gaps
    const gaps: Gap[] = []

    // 1. Detect IRL gaps (IRL items without linked documents)
    const irlGaps = await detectIrlGaps(supabase, projectId, gapResolutions)
    gaps.push(...irlGaps)

    // 2. Detect information gaps (domains with sparse coverage)
    const infoGaps = await detectInformationGaps(supabase, projectId, gapResolutions)
    gaps.push(...infoGaps)

    // Apply filters
    let filteredGaps = gaps

    if (category !== 'all') {
      filteredGaps = filteredGaps.filter((g) => g.category === category)
    }

    if (status !== 'all') {
      filteredGaps = filteredGaps.filter((g) => g.status === status)
    }

    if (priority !== 'all') {
      filteredGaps = filteredGaps.filter((g) => g.priority === priority)
    }

    // Apply sorting
    filteredGaps = sortGaps(filteredGaps, sortBy, sortOrder)

    // Calculate statistics
    const irlGapsCount = gaps.filter((g) => g.category === 'irl_missing').length
    const infoGapsCount = gaps.filter((g) => g.category === 'information_gap' || g.category === 'incomplete_analysis').length
    const resolvedCount = gaps.filter((g) => g.status === 'resolved' || g.status === 'not_applicable').length

    return NextResponse.json({
      gaps: filteredGaps,
      irlGaps: irlGapsCount,
      infoGaps: infoGapsCount,
      total: gaps.length,
      resolved: resolvedCount,
    })
  } catch (err) {
    console.error('[api/gaps] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Detect IRL gaps - IRL items that don't have linked documents
 */
async function detectIrlGaps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  gapResolutions: Record<string, { status: GapStatus; note?: string; resolvedAt: string }>
): Promise<Gap[]> {
  // Get IRL for this project
  const { data: irlData } = await supabase
    .from('irls')
    .select('id')
    .eq('deal_id', projectId)
    .single()

  if (!irlData) {
    return []
  }

  // Get all IRL items
  const { data: items, error: itemsError } = await supabase
    .from('irl_items')
    .select('id, irl_id, category, name, description, required, sort_order, created_at')
    .eq('irl_id', irlData.id)
    .order('category')
    .order('sort_order')

  if (itemsError || !items) {
    return []
  }

  // Get documents linked to IRL items
  const { data: linkedDocs } = await supabase
    .from('documents')
    .select('irl_item_id')
    .eq('deal_id', projectId)
    .not('irl_item_id', 'is', null)

  const linkedItemIds = new Set((linkedDocs || []).map((d: { irl_item_id: string }) => d.irl_item_id))

  // Create gaps for IRL items without linked documents
  const gaps: Gap[] = []
  for (const item of items) {
    if (!linkedItemIds.has(item.id)) {
      const gapId = `irl-${item.id}`
      // Determine priority based on required flag
      const priority: GapPriority = item.required ? 'high' : 'medium'

      // Check if this gap has been resolved
      const resolution = gapResolutions[gapId]
      const gapStatus: GapStatus = resolution?.status || 'active'

      gaps.push({
        id: gapId,
        dealId: projectId,
        category: 'irl_missing' as GapCategory,
        description: item.name,
        priority,
        status: gapStatus,
        relatedIrlItemId: item.id,
        relatedIrlItem: {
          id: item.id,
          irlId: item.irl_id,
          category: item.category,
          name: item.name,
          description: item.description,
          required: item.required ?? true,
          sortOrder: item.sort_order ?? 0,
          documentId: null,
          documentName: null,
          createdAt: item.created_at,
          updatedAt: item.created_at,
        },
        source: `IRL Checklist - ${item.category}`,
        detectedAt: item.created_at,
        resolvedAt: resolution?.resolvedAt,
      })
    }
  }

  return gaps
}

/**
 * Detect information gaps - domains with sparse finding coverage
 */
async function detectInformationGaps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  projectId: string,
  gapResolutions: Record<string, { status: GapStatus; note?: string; resolvedAt: string }>
): Promise<Gap[]> {
  // Count findings per domain
  const { data: findings } = await supabase
    .from('findings')
    .select('domain')
    .eq('deal_id', projectId)
    .not('domain', 'is', null)

  if (!findings || findings.length === 0) {
    // No findings at all - report all domains as gaps
    return Object.entries(DOMAIN_COVERAGE_THRESHOLDS).map(([domain, config]) => {
      const gapId = `info-${domain}`
      const resolution = gapResolutions[gapId]
      return {
        id: gapId,
        dealId: projectId,
        category: 'information_gap' as GapCategory,
        description: DOMAIN_GAP_DESCRIPTIONS[domain as FindingDomain],
        priority: config.priority,
        status: (resolution?.status || 'active') as GapStatus,
        domain: domain as FindingDomain,
        source: 'Domain coverage analysis',
        detectedAt: new Date().toISOString(),
        resolvedAt: resolution?.resolvedAt,
      }
    })
  }

  // Count findings per domain
  const domainCounts: Record<string, number> = {}
  for (const f of findings) {
    domainCounts[f.domain] = (domainCounts[f.domain] || 0) + 1
  }

  // Identify domains with sparse coverage
  const gaps: Gap[] = []
  for (const [domain, config] of Object.entries(DOMAIN_COVERAGE_THRESHOLDS)) {
    const count = domainCounts[domain] || 0
    if (count < config.min) {
      const gapId = `info-${domain}`
      const resolution = gapResolutions[gapId]
      const gapStatus: GapStatus = resolution?.status || 'active'

      gaps.push({
        id: gapId,
        dealId: projectId,
        category: count === 0 ? 'information_gap' : 'incomplete_analysis',
        description: count === 0
          ? DOMAIN_GAP_DESCRIPTIONS[domain as FindingDomain]
          : `Only ${count} ${domain} finding${count === 1 ? '' : 's'} found (minimum expected: ${config.min})`,
        priority: config.priority,
        status: gapStatus,
        domain: domain as FindingDomain,
        source: 'Domain coverage analysis',
        detectedAt: new Date().toISOString(),
        resolvedAt: resolution?.resolvedAt,
        metadata: {
          findingsCount: count,
          expectedMinimum: config.min,
        },
      })
    }
  }

  return gaps
}

/**
 * Sort gaps by specified field and order
 */
function sortGaps(gaps: Gap[], sortBy: string, sortOrder: string): Gap[] {
  const sorted = [...gaps]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'priority':
        comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        break
      case 'category':
        const categoryOrder: Record<GapCategory, number> = {
          irl_missing: 0,
          information_gap: 1,
          incomplete_analysis: 2,
        }
        comparison = categoryOrder[a.category] - categoryOrder[b.category]
        break
      case 'createdAt':
        comparison = new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
        break
    }

    return sortOrder === 'desc' ? -comparison : comparison
  })

  return sorted
}
