/**
 * Finding Source API Route
 * Story: E7.1 - Implement Finding Correction via Chat
 * AC: #8, #10 - Get original source citation before correction
 *
 * GET /api/projects/[id]/findings/[findingId]/source - Get original source
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOriginalSource } from '@/lib/services/corrections'

interface RouteContext {
  params: Promise<{ id: string; findingId: string }>
}

/**
 * GET /api/projects/[id]/findings/[findingId]/source
 * Get the original source citation for a finding
 * Used to display source before accepting corrections
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, findingId } = await context.params

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

    // Verify finding exists in this project
    const { data: finding, error: findingError } = await supabase
      .from('findings')
      .select('id')
      .eq('id', findingId)
      .eq('deal_id', projectId)
      .single()

    if (findingError || !finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // Get original source citation
    const sourceResult = await getOriginalSource(supabase, findingId)

    if (!sourceResult.found || !sourceResult.citation) {
      return NextResponse.json({
        found: false,
        message: 'Source information not available for this finding',
      })
    }

    return NextResponse.json({
      found: true,
      source: {
        documentId: sourceResult.citation.documentId,
        documentName: sourceResult.citation.documentName,
        location: sourceResult.citation.location,
        extractedValue: sourceResult.citation.extractedValue,
      },
    })
  } catch (err) {
    console.error('[api/findings/[findingId]/source] GET Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
