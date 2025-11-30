/**
 * ExcelPreview Component
 * Displays Excel/spreadsheet content with cell highlighting
 * Story: E4.5 - Implement Source Attribution Links (AC: 3)
 *
 * Features:
 * - Sheet content display with cell grid visualization
 * - Referenced cell highlighted with visual indicator
 * - Sheet tabs for navigation (if metadata includes sheet info)
 * - Surrounding cells displayed for context
 */

'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChunkData, DocumentData, ChunkContext } from './DocumentPreviewModal'

export interface ExcelPreviewProps {
  chunk: ChunkData
  document: DocumentData
  context: ChunkContext
  cellReference: string | null
  sheetName: string | null
}

/**
 * Parse cell reference (e.g., "B15") into column and row
 */
function parseCellReference(ref: string | null): { col: string; row: number } | null {
  if (!ref) return null

  const match = ref.match(/^([A-Z]+)(\d+)$/i)
  if (!match || !match[1] || !match[2]) return null

  return {
    col: match[1].toUpperCase(),
    row: parseInt(match[2], 10),
  }
}

/**
 * Parse table content from chunk
 * Attempts to parse markdown table or JSON table data
 */
function parseTableContent(content: string): string[][] | null {
  // Try parsing as JSON array
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (Array.isArray(parsed[0])) {
        return parsed as string[][]
      }
      // Array of objects - convert to rows
      if (typeof parsed[0] === 'object' && parsed[0] !== null) {
        const headers = Object.keys(parsed[0] as Record<string, unknown>)
        const rows = [headers, ...parsed.map((row: Record<string, unknown>) =>
          headers.map(h => String(row[h] ?? ''))
        )]
        return rows
      }
    }
  } catch {
    // Not JSON, try markdown table
  }

  // Try parsing as markdown table
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length >= 2 && lines[0] && lines[0].includes('|')) {
    const rows: string[][] = []
    for (const line of lines) {
      // Skip separator lines (e.g., |---|---|)
      if (/^\|[\s-:]+\|$/.test(line.trim()) || /^[\s-:|]+$/.test(line.trim())) {
        continue
      }
      const cells = line
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
      if (cells.length > 0) {
        rows.push(cells)
      }
    }
    if (rows.length > 0) {
      return rows
    }
  }

  return null
}

/**
 * Get column letter from index (0 = A, 1 = B, etc.)
 */
function getColumnLetter(index: number): string {
  let letter = ''
  let temp = index
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter
    temp = Math.floor(temp / 26) - 1
  }
  return letter
}

export function ExcelPreview({
  chunk,
  document,
  context,
  cellReference,
  sheetName,
}: ExcelPreviewProps) {
  const parsedCell = useMemo(() => parseCellReference(cellReference), [cellReference])
  const tableData = useMemo(() => parseTableContent(chunk.content), [chunk.content])

  // If we have structured table data, render as grid
  if (tableData && tableData.length > 0) {
    return (
      <div className="p-4 space-y-4">
        {/* Sheet header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span className="font-medium">{document.name}</span>
            {sheetName && (
              <Badge variant="outline" className="text-xs">
                {sheetName}
              </Badge>
            )}
          </div>
          {cellReference && (
            <Badge variant="secondary" className="font-mono">
              {cellReference}
            </Badge>
          )}
        </div>

        {/* Table grid */}
        <div className="overflow-auto max-h-[400px] border rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {/* Row number header */}
                <th className="border border-border bg-muted/80 px-2 py-1 text-center text-xs font-medium text-muted-foreground w-10">
                  #
                </th>
                {/* Column headers */}
                {tableData[0]?.map((_, colIndex) => {
                  const colLetter = getColumnLetter(colIndex)
                  const isHighlightedCol = parsedCell?.col === colLetter
                  return (
                    <th
                      key={colIndex}
                      className={cn(
                        'border border-border px-3 py-1 text-center text-xs font-medium',
                        isHighlightedCol
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted/80 text-muted-foreground'
                      )}
                    >
                      {colLetter}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => {
                const displayRowNum = rowIndex + 1
                const isHighlightedRow = parsedCell?.row === displayRowNum
                return (
                  <tr key={rowIndex}>
                    {/* Row number */}
                    <td
                      className={cn(
                        'border border-border px-2 py-1 text-center text-xs font-medium',
                        isHighlightedRow
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted/50 text-muted-foreground'
                      )}
                    >
                      {displayRowNum}
                    </td>
                    {/* Cells */}
                    {row.map((cell, colIndex) => {
                      const colLetter = getColumnLetter(colIndex)
                      const isHighlighted =
                        parsedCell?.col === colLetter && parsedCell?.row === displayRowNum
                      return (
                        <td
                          key={colIndex}
                          className={cn(
                            'border border-border px-3 py-1.5 font-mono text-xs',
                            isHighlighted && [
                              'bg-primary/20 ring-2 ring-primary ring-inset',
                              'font-semibold',
                            ]
                          )}
                        >
                          {cell}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Context information */}
        {(context.previousChunk || context.nextChunk) && (
          <div className="text-xs text-muted-foreground">
            Showing extracted data from document. Click cells for more context.
          </div>
        )}
      </div>
    )
  }

  // Fallback: render chunk content as formatted text
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-green-600" aria-hidden="true" />
          <span className="font-medium">{document.name}</span>
          {sheetName && (
            <Badge variant="outline" className="text-xs">
              {sheetName}
            </Badge>
          )}
        </div>
        {cellReference && (
          <Badge variant="secondary" className="font-mono">
            {cellReference}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[400px]">
        <pre className="whitespace-pre-wrap text-sm font-mono">{chunk.content}</pre>
      </div>

      {/* Context */}
      {context.previousChunk && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            Previous context
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs font-mono text-muted-foreground bg-muted/50 p-3 rounded">
            {context.previousChunk.content}
          </pre>
        </details>
      )}
      {context.nextChunk && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
            Next context
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs font-mono text-muted-foreground bg-muted/50 p-3 rounded">
            {context.nextChunk.content}
          </pre>
        </details>
      )}
    </div>
  )
}
