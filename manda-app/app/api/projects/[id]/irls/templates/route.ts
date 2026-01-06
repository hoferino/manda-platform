/**
 * IRL Templates API Route
 * Returns available IRL templates for a project
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC4, AC5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllTemplates } from '@/lib/services/irl-templates'
import { countTemplateItems } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/irls/templates
 * Returns all available IRL templates (AC4)
 *
 * Templates are loaded dynamically from the templates directory,
 * so adding a new JSON file automatically makes it available (AC5)
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

    // Load all templates dynamically from the templates directory
    const templates = getAllTemplates()

    // Add item counts to each template for display
    const templatesWithCounts = templates.map(template => ({
      ...template,
      totalItems: countTemplateItems(template),
      categoryCount: template.categories.length,
    }))

    return NextResponse.json({
      templates: templatesWithCounts,
    })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}
