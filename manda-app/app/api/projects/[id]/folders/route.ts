/**
 * Folders API Route
 * GET - List all folders for a project
 * POST - Create a new folder
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createGCSFolderPrefix } from '@/lib/gcs/folder-operations'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/projects/[id]/folders - List all folders
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all folders for this project
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('deal_id', projectId)
      .order('path', { ascending: true })

    if (foldersError) {
      console.error('Error fetching folders:', foldersError)
      return NextResponse.json(
        { error: 'Failed to fetch folders' },
        { status: 500 }
      )
    }

    return NextResponse.json({ folders: folders || [] })
  } catch (error) {
    console.error('Folders GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/folders - Create a new folder
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { name, parentPath } = body as { name: string; parentPath: string | null }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // Validate folder name
    const trimmedName = name.trim()
    if (trimmedName.includes('/')) {
      return NextResponse.json(
        { error: 'Folder name cannot contain "/"' },
        { status: 400 }
      )
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { error: 'Folder name must be under 100 characters' },
        { status: 400 }
      )
    }

    // Build the full path
    const path = parentPath ? `${parentPath}/${trimmedName}` : trimmedName

    // Check if folder already exists
    const { data: existingFolder } = await supabase
      .from('folders')
      .select('id')
      .eq('deal_id', projectId)
      .eq('path', path)
      .single()

    if (existingFolder) {
      return NextResponse.json(
        { error: 'A folder with this name already exists' },
        { status: 409 }
      )
    }

    // Create the folder
    const { data: folder, error: createError } = await supabase
      .from('folders')
      .insert({
        deal_id: projectId,
        name: trimmedName,
        path,
        parent_path: parentPath || null,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating folder:', createError)
      return NextResponse.json(
        { error: 'Failed to create folder' },
        { status: 500 }
      )
    }

    // Create GCS folder prefix (don't fail if this fails, folder is created)
    try {
      const gcsPath = `${projectId}/data-room/${path}/`
      await createGCSFolderPrefix(gcsPath)
    } catch (gcsError) {
      // Log but don't fail - DB folder was created successfully
      console.error('Failed to create GCS folder prefix:', gcsError)
    }

    return NextResponse.json({ folder }, { status: 201 })
  } catch (error) {
    console.error('Folders POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
