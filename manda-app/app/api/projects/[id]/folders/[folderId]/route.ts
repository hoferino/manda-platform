/**
 * Individual Folder API Route
 * PUT - Rename a folder
 * DELETE - Delete a folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Folder type (until migration is applied and types regenerated)
interface FolderRow {
  id: string
  deal_id: string
  name: string
  path: string
  parent_path: string | null
  created_at: string
  updated_at: string
}

interface RouteContext {
  params: Promise<{ id: string; folderId: string }>
}

// PUT /api/projects/[id]/folders/[folderId] - Rename a folder
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, folderId } = await context.params
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

    // Get the existing folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingFolder, error: folderError } = await (supabase as any)
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('deal_id', projectId)
      .single() as { data: FolderRow | null; error: Error | null }

    if (folderError || !existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { name } = body as { name: string }

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

    // Build the new path
    const oldPath = existingFolder.path
    const newPath = existingFolder.parent_path
      ? `${existingFolder.parent_path}/${trimmedName}`
      : trimmedName

    // Check if new path already exists
    if (newPath !== oldPath) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: conflictFolder } = await (supabase as any)
        .from('folders')
        .select('id')
        .eq('deal_id', projectId)
        .eq('path', newPath)
        .single()

      if (conflictFolder) {
        return NextResponse.json(
          { error: 'A folder with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Update the folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folder, error: updateError } = await (supabase as any)
      .from('folders')
      .update({
        name: trimmedName,
        path: newPath,
      })
      .eq('id', folderId)
      .select()
      .single() as { data: FolderRow | null; error: Error | null }

    if (updateError) {
      console.error('Error updating folder:', updateError)
      return NextResponse.json(
        { error: 'Failed to update folder' },
        { status: 500 }
      )
    }

    // Update child folders if path changed
    if (newPath !== oldPath) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: childFolders } = await (supabase as any)
        .from('folders')
        .select('id, path, parent_path')
        .eq('deal_id', projectId)
        .like('path', `${oldPath}/%`) as { data: Array<{ id: string; path: string; parent_path: string | null }> | null }

      if (childFolders && childFolders.length > 0) {
        for (const child of childFolders) {
          const updatedChildPath = child.path.replace(oldPath, newPath)
          const updatedParentPath = child.parent_path?.replace(oldPath, newPath) || null
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('folders')
            .update({
              path: updatedChildPath,
              parent_path: updatedParentPath,
            })
            .eq('id', child.id)
        }
      }

      // Update documents with old folder path
      await supabase
        .from('documents')
        .update({ folder_path: newPath })
        .eq('deal_id', projectId)
        .eq('folder_path', oldPath)

      // Update documents in subfolders
      const { data: docsInSubfolders } = await supabase
        .from('documents')
        .select('id, folder_path')
        .eq('deal_id', projectId)
        .like('folder_path', `${oldPath}/%`)

      if (docsInSubfolders && docsInSubfolders.length > 0) {
        for (const doc of docsInSubfolders) {
          const updatedDocPath = doc.folder_path?.replace(oldPath, newPath) || null
          await supabase
            .from('documents')
            .update({ folder_path: updatedDocPath })
            .eq('id', doc.id)
        }
      }
    }

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('Folder PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/folders/[folderId] - Delete a folder
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, folderId } = await context.params
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

    // Get the folder to delete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folder, error: folderError } = await (supabase as any)
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('deal_id', projectId)
      .single() as { data: FolderRow | null; error: Error | null }

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Delete child folders first (CASCADE should handle this, but being explicit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('folders')
      .delete()
      .eq('deal_id', projectId)
      .like('path', `${folder.path}/%`)

    // Delete the folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('folders')
      .delete()
      .eq('id', folderId)

    if (deleteError) {
      console.error('Error deleting folder:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete folder' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Folder DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
