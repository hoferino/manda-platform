/**
 * Document Lookup API
 *
 * Resolves document names to document IDs within a project.
 * Used for citation click-through functionality.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #3 (Document Viewer Integration), #6 (Fallback)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for batch lookup request
const BatchLookupSchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(50),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/documents/lookup?name=filename.ext
 * Single document lookup by name
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const searchParams = request.nextUrl.searchParams
    const documentName = searchParams.get('name')

    if (!documentName) {
      return NextResponse.json(
        { error: 'Missing required query parameter: name' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user has access to project
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check project access
    const { data: project } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Look up document by name (exact match, case-insensitive)
    const { data: document, error } = await supabase
      .from('documents')
      .select('id, name')
      .eq('project_id', projectId)
      .ilike('name', documentName)
      .limit(1)
      .single()

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found', documentName },
        { status: 404 }
      )
    }

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
      },
    })
  } catch (error) {
    console.error('Document lookup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/projects/[id]/documents/lookup
 * Batch document lookup by names
 * Body: { names: string[] }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params
    const body = await request.json()

    const parseResult = BatchLookupSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const { names } = parseResult.data

    const supabase = await createClient()

    // Verify user has access to project
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check project access
    const { data: project } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Look up documents by names
    // Use OR filter with ilike for case-insensitive matching
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, name')
      .eq('project_id', projectId)
      .in('name', names)

    if (error) {
      console.error('Batch lookup error:', error)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    // Also try case-insensitive lookup for names not found
    const foundNames = new Set((documents || []).map(d => d.name.toLowerCase()))
    const notFoundNames = names.filter(n => !foundNames.has(n.toLowerCase()))

    let additionalDocs: typeof documents = []
    if (notFoundNames.length > 0) {
      // Use ilike for each unfound name
      const { data: ilikeDocs } = await supabase
        .from('documents')
        .select('id, name')
        .eq('project_id', projectId)

      if (ilikeDocs) {
        additionalDocs = ilikeDocs.filter(doc =>
          notFoundNames.some(name =>
            doc.name.toLowerCase() === name.toLowerCase()
          )
        )
      }
    }

    const allDocuments = [...(documents || []), ...additionalDocs]
    const uniqueDocuments = Array.from(
      new Map(allDocuments.map(d => [d.id, d])).values()
    )

    return NextResponse.json({
      documents: uniqueDocuments.map(doc => ({
        id: doc.id,
        name: doc.name,
      })),
      foundCount: uniqueDocuments.length,
      requestedCount: names.length,
    })
  } catch (error) {
    console.error('Batch document lookup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
