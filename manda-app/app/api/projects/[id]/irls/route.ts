/**
 * IRL API Route
 * Creates IRLs from templates or as blank
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC8, AC9)
 *
 * Note: This story creates the API structure. Database migrations for
 * irls and irl_items tables will be applied in E6.2.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/services/irl-templates'
import {
  CreateIRLRequestSchema,
  CreateIRLResponse,
  IRL,
  IRLItem,
} from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * POST /api/projects/[id]/irls
 * Creates a new IRL from a template or blank
 *
 * Request body:
 * - title: string (required) - The name for this IRL
 * - templateId?: string (optional) - Template ID to pre-populate items
 *
 * AC8: "Use This Template" creates IRL with template items pre-populated
 * AC9: "Custom (Blank)" creates empty IRL for manual entry
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = CreateIRLRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { title, templateId } = parseResult.data

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

    // If templateId provided, validate it exists
    let template = null
    if (templateId) {
      template = await getTemplate(templateId)
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found', templateId },
          { status: 404 }
        )
      }
    }

    // Create the IRL record
    // Note: The existing irls table uses 'name' instead of 'title' and requires user_id
    const sectionsData = template
      ? template.categories.map((cat) => ({
          name: cat.name,
          items: cat.items.map((item) => ({
            name: item.name,
            description: item.description || '',
            priority: item.priority,
            status: 'not_started',
          })),
        }))
      : []

    const { data: irlData, error: irlError } = await supabase
      .from('irls')
      .insert({
        deal_id: projectId,
        user_id: user.id,
        name: title,
        template_type: templateId || null,
        sections: sectionsData,
        progress_percent: 0,
      })
      .select()
      .single()

    if (irlError) {
      console.error('Error creating IRL:', irlError)
      return NextResponse.json({ error: 'Failed to create IRL' }, { status: 500 })
    }

    const irl: IRL = {
      id: irlData.id,
      dealId: irlData.deal_id,
      title: irlData.name, // Map 'name' to 'title' in response
      templateType: irlData.template_type ?? undefined,
      sourceFileName: undefined, // Not in current schema
      createdAt: irlData.created_at,
      updatedAt: irlData.updated_at,
    }

    // Items are stored in the sections JSON column, not a separate table
    // Convert sections to IRLItem format for the response
    let items: IRLItem[] = []
    if (template) {
      let sortOrder = 0
      items = template.categories.flatMap((category) =>
        category.items.map((item) => ({
          id: `${irl.id}-${sortOrder}`, // Generated ID
          irlId: irl.id,
          category: category.name,
          subcategory: undefined,
          itemName: item.name,
          description: item.description,
          priority: item.priority ?? 'medium',
          status: 'not_started' as const,
          fulfilled: false,
          notes: undefined,
          sortOrder: sortOrder++,
          createdAt: irl.createdAt,
          updatedAt: irl.updatedAt,
        }))
      )
    }

    // Auto-generate folders from IRL template (BUG-001 fix)
    // This creates the Data Room folder structure automatically when using a template
    let folderGenerationResult = null
    if (templateId && template) {
      try {
        const { createFoldersFromIRL } = await import('@/lib/services/folders')
        folderGenerationResult = await createFoldersFromIRL(
          supabase,
          projectId,
          irlData.id
        )
        console.log(
          `[IRL Creation] Auto-generated ${folderGenerationResult.created} folders ` +
          `from template "${template.name}" (skipped ${folderGenerationResult.skipped} existing)`
        )
      } catch (error) {
        // Don't fail IRL creation if folder generation fails
        // User can still manually create folders or regenerate later
        console.error('[IRL Creation] Failed to auto-generate folders:', error)
        folderGenerationResult = {
          created: 0,
          skipped: 0,
          errors: [(error as Error).message || 'Unknown error'],
          folders: [],
        }
      }
    }

    const response: CreateIRLResponse = {
      irl,
      items: items.length > 0 ? items : undefined,
      folders: folderGenerationResult
        ? {
            created: folderGenerationResult.created,
            skipped: folderGenerationResult.skipped,
            errors: folderGenerationResult.errors,
            folders: folderGenerationResult.folders.map((f) => ({
              id: f.id,
              name: f.name,
              path: f.path,
              gcsPath: `deals/${projectId}/data-room${f.path}`,
            })),
          }
        : undefined,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/[id]/irls
 * List all IRLs for a project
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

    // Fetch all IRLs for this project
    const { data: irlsData, error: irlsError } = await supabase
      .from('irls')
      .select('*')
      .eq('deal_id', projectId)
      .order('created_at', { ascending: false })

    if (irlsError) {
      console.error('Error fetching IRLs:', irlsError)
      return NextResponse.json({ error: 'Failed to fetch IRLs' }, { status: 500 })
    }

    const irls: IRL[] = (irlsData || []).map(item => ({
      id: item.id,
      dealId: item.deal_id,
      title: item.name, // Map 'name' to 'title' in response
      templateType: item.template_type ?? undefined,
      sourceFileName: undefined, // Not in current schema
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))

    return NextResponse.json({ irls })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/irls:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
