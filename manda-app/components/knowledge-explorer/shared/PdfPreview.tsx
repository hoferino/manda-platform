/**
 * PdfPreview Component
 * Displays PDF content at referenced page with navigation
 * Story: E4.5 - Implement Source Attribution Links (AC: 4)
 *
 * Features:
 * - Display page content at referenced page number
 * - Page navigation controls (prev/next)
 * - Text content from parsed chunk
 * - Context from surrounding chunks
 *
 * Note: MVP approach uses chunk content directly rather than
 * rendering PDF. Full PDF rendering can be added later with react-pdf.
 */

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChunkData, DocumentData, ChunkContext } from './DocumentPreviewModal'

export interface PdfPreviewProps {
  chunk: ChunkData
  document: DocumentData
  context: ChunkContext
  pageNumber: number | null
}

export function PdfPreview({
  chunk,
  document,
  context,
  pageNumber,
}: PdfPreviewProps) {
  // Use chunk's page number if available, otherwise use provided pageNumber
  const displayPage = chunk.pageNumber ?? pageNumber

  return (
    <div className="p-4 space-y-4">
      {/* Header with page info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-600" aria-hidden="true" />
          <span className="font-medium truncate max-w-[300px]">{document.name}</span>
        </div>
        {displayPage !== null && displayPage !== undefined && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              Page {displayPage}
            </Badge>
          </div>
        )}
      </div>

      {/* Page navigation hint */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Extracted text content from document</span>
        <div className="flex items-center gap-1">
          {context.previousChunk && (
            <span className="text-xs">← Previous section available</span>
          )}
          {context.previousChunk && context.nextChunk && <span>|</span>}
          {context.nextChunk && (
            <span className="text-xs">Next section available →</span>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div
        className={cn(
          'bg-white border rounded-lg shadow-sm p-6',
          'min-h-[300px] max-h-[500px] overflow-auto'
        )}
        role="article"
        aria-label={`Content from page ${displayPage ?? 'unknown'}`}
      >
        {/* Page header simulation */}
        {displayPage !== null && displayPage !== undefined && (
          <div className="text-right text-xs text-muted-foreground mb-4 border-b pb-2">
            Page {displayPage}
          </div>
        )}

        {/* Chunk content */}
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {chunk.content}
          </div>
        </div>
      </div>

      {/* Context sections */}
      <div className="space-y-2">
        {context.previousChunk && (
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              Previous context
            </summary>
            <div className="mt-2 bg-muted/50 border-l-2 border-muted-foreground/20 pl-4 py-2 rounded-r">
              <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                {context.previousChunk.content}
              </pre>
            </div>
          </details>
        )}

        {context.nextChunk && (
          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Next context
            </summary>
            <div className="mt-2 bg-muted/50 border-l-2 border-muted-foreground/20 pl-4 py-2 rounded-r">
              <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                {context.nextChunk.content}
              </pre>
            </div>
          </details>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center">
        This preview shows extracted text content. For full PDF rendering, download the document.
      </p>
    </div>
  )
}
