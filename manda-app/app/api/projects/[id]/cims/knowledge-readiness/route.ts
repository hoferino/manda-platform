/**
 * Knowledge Readiness API Route
 *
 * Checks if a deal has sufficient knowledge indexed in Graphiti
 * before allowing CIM creation in Graphiti mode.
 *
 * Story: CIM Knowledge Toggle - Story 4
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createKnowledgeService } from '@/lib/agent/cim-mvp'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/cims/knowledge-readiness
 *
 * Check knowledge readiness for Graphiti mode CIM building.
 *
 * Response:
 * {
 *   ready: boolean,
 *   score: number (0-100),
 *   level: 'good' | 'limited' | 'insufficient',
 *   details: {
 *     financialCoverage: number,
 *     marketCoverage: number,
 *     companyCoverage: number,
 *     documentCount: number,
 *     findingCount: number,
 *   },
 *   recommendations: string[],
 * }
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Create Graphiti knowledge service for this project
    const knowledgeService = createKnowledgeService({
      mode: 'graphiti',
      dealId: projectId,
      groupId: projectId,
    })

    // Check readiness
    const readiness = await knowledgeService.checkReadiness()

    console.log(`[api/cims/knowledge-readiness] Project ${projectId}: score=${readiness.score}, level=${readiness.level}`)

    return NextResponse.json(readiness)
  } catch (err) {
    console.error('[api/cims/knowledge-readiness] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
