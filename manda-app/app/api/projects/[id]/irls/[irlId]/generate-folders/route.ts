/**
 * Generate Folders from IRL API Route
 *
 * POST: Creates Data Room folder structure from IRL categories
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 *
 * Features:
 * - Extracts categories/subcategories from IRL items
 * - Creates folders in PostgreSQL with sanitized paths
 * - Creates GCS folder prefixes for file storage
 * - Skips existing folders to prevent duplicates
 * - Returns created folder tree structure
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createFoldersFromIRL, getFolders, sanitizeFolderName } from '@/lib/services/folders'
import { buildFolderTree, FolderNode } from '@/components/data-room/folder-tree'

interface RouteContext {
  params: Promise<{ id: string; irlId: string }>
}

/**
 * POST /api/projects/[id]/irls/[irlId]/generate-folders
 *
 * Generates a Data Room folder structure based on the IRL's categories and subcategories.
 *
 * Response:
 * - folders: Array of created/existing folder records
 * - tree: Hierarchical folder tree structure
 * - created: Number of folders created
 * - skipped: Number of existing folders skipped
 * - errors: Any errors encountered during creation
 *
 * Example response:
 * {
 *   "folders": [
 *     { "id": "...", "name": "Financial", "path": "financial", ... },
 *     { "id": "...", "name": "Q1 Reports", "path": "financial/q1-reports", ... }
 *   ],
 *   "tree": [
 *     { "id": "financial", "name": "Financial", "children": [...] }
 *   ],
 *   "created": 5,
 *   "skipped": 2,
 *   "errors": []
 * }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, irlId } = await context.params

    const supabase = await createClient()

    // Authenticate user
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

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Verify IRL exists and belongs to this project
    const { data: irl, error: irlError } = await supabase
      .from('irls')
      .select('id, deal_id')
      .eq('id', irlId)
      .single()

    if (irlError || !irl) {
      return NextResponse.json(
        { error: 'IRL not found' },
        { status: 404 }
      )
    }

    if (irl.deal_id !== projectId) {
      return NextResponse.json(
        { error: 'IRL does not belong to this project' },
        { status: 404 }
      )
    }

    // Create folders from IRL categories
    const result = await createFoldersFromIRL(supabase, projectId, irlId)

    // Get all folders for this project to build the tree
    const allFolders = await getFolders(supabase, projectId)

    // Build folder tree from paths
    const folderPaths = allFolders.map(f => f.path)
    const tree = buildFolderTree(folderPaths)

    // Add folder data to tree nodes
    function enrichTree(nodes: FolderNode[]): FolderNode[] {
      return nodes.map(node => {
        const folder = allFolders.find(f => f.path === node.path)
        return {
          ...node,
          id: folder?.id || node.id,
          children: enrichTree(node.children),
        }
      })
    }

    const enrichedTree = enrichTree(tree)

    return NextResponse.json({
      folders: result.folders,
      tree: enrichedTree,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
    }, { status: result.created > 0 ? 201 : 200 })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls/[irlId]/generate-folders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
