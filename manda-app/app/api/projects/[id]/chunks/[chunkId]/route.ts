/**
 * Chunk API Route
 * Handles GET operations for individual document chunks with context
 * Story: E4.5 - Implement Source Attribution Links (AC: 2, 3, 4)
 *
 * GET /api/projects/[id]/chunks/[chunkId] - Get chunk with surrounding context
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string; chunkId: string }>
}

interface ChunkRow {
  id: string
  document_id: string
  chunk_index: number
  content: string
  chunk_type: string
  page_number: number | null
  sheet_name: string | null
  cell_reference: string | null
  token_count: number | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface DocumentRow {
  id: string
  name: string
  file_path: string | null
  mime_type: string | null
  processing_status: string
  file_size: number | null
  created_at: string
}

/**
 * GET /api/projects/[id]/chunks/[chunkId]
 * Get a single chunk with full context (previous and next chunks)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, chunkId } = await context.params

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project (deal)
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch the chunk
    const { data: chunkData, error: chunkError } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('id', chunkId)
      .single()

    if (chunkError || !chunkData) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 })
    }

    const chunk = chunkData as ChunkRow

    // Fetch the parent document
    const { data: documentData, error: documentError } = await supabase
      .from('documents')
      .select('id, name, file_path, mime_type, processing_status, file_size, created_at')
      .eq('id', chunk.document_id)
      .single()

    if (documentError || !documentData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const document = documentData as DocumentRow

    // Verify the document belongs to the project
    const { data: docCheck, error: docCheckError } = await supabase
      .from('documents')
      .select('deal_id')
      .eq('id', chunk.document_id)
      .single()

    if (docCheckError || !docCheck || docCheck.deal_id !== projectId) {
      return NextResponse.json({ error: 'Document not found in this project' }, { status: 404 })
    }

    // Fetch surrounding context (previous and next chunks)
    const { data: previousChunkData } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', chunk.document_id)
      .eq('chunk_index', chunk.chunk_index - 1)
      .single()

    const { data: nextChunkData } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('document_id', chunk.document_id)
      .eq('chunk_index', chunk.chunk_index + 1)
      .single()

    // Build response
    const response = {
      chunk: {
        id: chunk.id,
        content: chunk.content,
        chunkType: chunk.chunk_type,
        pageNumber: chunk.page_number,
        sheetName: chunk.sheet_name,
        cellReference: chunk.cell_reference,
        metadata: chunk.metadata || {},
      },
      document: {
        id: document.id,
        name: document.name,
        filePath: document.file_path || '',
        mimeType: document.mime_type || 'application/octet-stream',
        processingStatus: document.processing_status,
        fileSize: document.file_size,
        uploadedAt: document.created_at,
      },
      context: {
        previousChunk: previousChunkData
          ? { id: previousChunkData.id, content: previousChunkData.content }
          : null,
        nextChunk: nextChunkData
          ? { id: nextChunkData.id, content: nextChunkData.content }
          : null,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[api/chunks/[chunkId]] GET Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
