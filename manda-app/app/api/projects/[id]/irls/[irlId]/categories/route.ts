/**
 * IRL Categories API Route
 * POST add category, DELETE category
 * Story: E6.2 - Implement IRL Creation and Editing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addCategory, deleteCategory, renameCategory, getIRLCategories } from '@/lib/services/irls'
import { AddCategoryRequestSchema, RenameCategoryRequestSchema } from '@/lib/types/irl'

interface RouteContext {
  params: Promise<{ id: string; irlId: string }>
}

/**
 * GET /api/projects/[id]/irls/[irlId]/categories
 * Get unique categories for an IRL
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params

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

    // Verify IRL exists and belongs to this project
    const { data: irl } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!irl || irl.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Get categories
    const categories = await getIRLCategories(supabase, irlId)

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/irls/[irlId]/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/irls/[irlId]/categories
 * Add a new category to the IRL
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = AddCategoryRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

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

    // Verify IRL exists and belongs to this project
    const { data: irl } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!irl || irl.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Check if category already exists
    const existingCategories = await getIRLCategories(supabase, irlId)
    if (existingCategories.includes(parseResult.data.name)) {
      return NextResponse.json(
        { error: 'Category already exists', name: parseResult.data.name },
        { status: 409 }
      )
    }

    // Add category (creates a placeholder item)
    const newItem = await addCategory(supabase, irlId, parseResult.data.name)

    if (!newItem) {
      return NextResponse.json({ error: 'Failed to add category' }, { status: 500 })
    }

    return NextResponse.json(
      { category: parseResult.data.name, firstItem: newItem },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls/[irlId]/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/projects/[id]/irls/[irlId]/categories
 * Rename a category
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = RenameCategoryRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

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

    // Verify IRL exists and belongs to this project
    const { data: irl } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!irl || irl.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Verify old category exists
    const existingCategories = await getIRLCategories(supabase, irlId)
    if (!existingCategories.includes(parseResult.data.oldName)) {
      return NextResponse.json(
        { error: 'Category not found', name: parseResult.data.oldName },
        { status: 404 }
      )
    }

    // Check new name doesn't conflict (unless it's the same as old)
    if (
      parseResult.data.newName !== parseResult.data.oldName &&
      existingCategories.includes(parseResult.data.newName)
    ) {
      return NextResponse.json(
        { error: 'Category name already exists', name: parseResult.data.newName },
        { status: 409 }
      )
    }

    // Rename category
    const success = await renameCategory(
      supabase,
      irlId,
      parseResult.data.oldName,
      parseResult.data.newName
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to rename category' }, { status: 500 })
    }

    return NextResponse.json({ success: true, category: parseResult.data.newName })
  } catch (error) {
    console.error('Error in PUT /api/projects/[id]/irls/[irlId]/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/irls/[irlId]/categories
 * Delete a category and all its items
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params
    const { searchParams } = new URL(request.url)
    const categoryName = searchParams.get('name')

    if (!categoryName) {
      return NextResponse.json(
        { error: 'Category name is required (query param: name)' },
        { status: 400 }
      )
    }

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

    // Verify IRL exists and belongs to this project
    const { data: irl } = await supabase
      .from('irls')
      .select('deal_id')
      .eq('id', irlId)
      .single()

    if (!irl || irl.deal_id !== projectId) {
      return NextResponse.json({ error: 'IRL not found' }, { status: 404 })
    }

    // Delete category
    const success = await deleteCategory(supabase, irlId, categoryName)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/projects/[id]/irls/[irlId]/categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
