/**
 * Single IRL Template API Route
 * Returns a specific IRL template by ID
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/services/irl-templates'
import { countTemplateItems } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string; templateId: string }>
}

/**
 * GET /api/projects/[id]/irls/templates/[templateId]
 * Returns a single template for preview
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, templateId } = await context.params

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

    // Load the template
    const template = await getTemplate(templateId)

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Add counts for display
    const templateWithCounts = {
      ...template,
      totalItems: countTemplateItems(template),
      categoryCount: template.categories.length,
    }

    return NextResponse.json({
      template: templateWithCounts,
    })
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}
