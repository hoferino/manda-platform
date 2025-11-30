/**
 * Export Findings API Route
 * POST /api/projects/[id]/findings/export
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #2, #3, #6)
 *
 * Exports findings to CSV or Excel format with filter support.
 * Server-side generation for handling large datasets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { stringify } from 'csv-stringify/sync'
import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { FindingDomain, FindingType, FindingStatus, Finding, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'
import { FINDING_DOMAINS, FINDING_STATUSES } from '@/lib/types/findings'

// Maximum findings per export to prevent timeout
const MAX_EXPORT_FINDINGS = 5000

// Request body validation schema
const ExportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  filters: z.object({
    documentId: z.string().uuid().optional(),
    domain: z.array(z.enum(['financial', 'operational', 'market', 'legal', 'technical'])).optional(),
    findingType: z.array(z.enum(['metric', 'fact', 'risk', 'opportunity', 'contradiction'])).optional(),
    status: z.array(z.enum(['pending', 'validated', 'rejected'])).optional(),
    confidenceMin: z.number().min(0).max(1).optional(),
    confidenceMax: z.number().min(0).max(1).optional(),
  }).optional(),
  searchQuery: z.string().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// Column definitions for export
const EXPORT_COLUMNS = [
  { key: 'text', header: 'Finding Text' },
  { key: 'domain', header: 'Domain' },
  { key: 'findingType', header: 'Type' },
  { key: 'confidence', header: 'Confidence' },
  { key: 'status', header: 'Status' },
  { key: 'sourceDocument', header: 'Source Document' },
  { key: 'pageReference', header: 'Page/Cell Reference' },
  { key: 'createdAt', header: 'Created Date' },
]

// Domain colors for Excel export
const DOMAIN_COLORS: Record<FindingDomain, string> = {
  financial: '10B981', // emerald-500
  operational: '3B82F6', // blue-500
  market: 'A855F7', // purple-500
  legal: 'F59E0B', // amber-500
  technical: '64748B', // slate-500
}

// Status colors for Excel export
const STATUS_COLORS: Record<FindingStatus, string> = {
  pending: 'EAB308', // yellow-500
  validated: '22C55E', // green-500
  rejected: 'EF4444', // red-500
}

// Confidence color based on value
function getConfidenceColor(confidence: number | null): string {
  if (confidence === null) return 'GRAY'
  if (confidence >= 0.8) return '22C55E' // green-500
  if (confidence >= 0.6) return 'EAB308' // yellow-500
  return 'EF4444' // red-500
}

/**
 * Transform database finding to export row
 */
function transformFindingForExport(finding: Finding): Record<string, string | number | null> {
  return {
    text: finding.text,
    domain: finding.domain || 'Unknown',
    findingType: finding.findingType || 'Unknown',
    confidence: finding.confidence,
    status: finding.status,
    sourceDocument: finding.sourceDocument || '',
    pageReference: finding.pageNumber ? `Page ${finding.pageNumber}` : '',
    createdAt: finding.createdAt ? format(new Date(finding.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
  }
}

/**
 * Generate CSV content from findings
 */
function generateCsv(findings: Finding[]): string {
  const rows = findings.map(transformFindingForExport)

  return stringify(rows, {
    header: true,
    columns: EXPORT_COLUMNS.map(col => ({
      key: col.key,
      header: col.header,
    })),
    bom: true, // Add BOM for UTF-8 support in Excel
    quoted_string: true,
  })
}

/**
 * Generate Excel workbook from findings
 */
async function generateExcel(findings: Finding[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet('Findings', {
    views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row
  })

  // Define columns with headers
  worksheet.columns = EXPORT_COLUMNS.map(col => ({
    header: col.header,
    key: col.key,
    width: col.key === 'text' ? 60 : col.key === 'sourceDocument' ? 30 : 15,
  }))

  // Style header row
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF374151' }, // gray-700
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 25

  // Add data rows with styling
  findings.forEach((finding, index) => {
    const rowData = transformFindingForExport(finding)
    const row = worksheet.addRow(rowData)

    // Alternate row background
    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' }, // gray-50
      }
    }

    // Style Domain cell with color
    const domainCell = row.getCell('domain')
    if (finding.domain && DOMAIN_COLORS[finding.domain]) {
      domainCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${DOMAIN_COLORS[finding.domain]}` },
      }
      domainCell.font = { color: { argb: 'FFFFFFFF' } }
    }

    // Style Status cell with color
    const statusCell = row.getCell('status')
    if (finding.status && STATUS_COLORS[finding.status]) {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${STATUS_COLORS[finding.status]}` },
      }
      statusCell.font = { color: { argb: 'FFFFFFFF' } }
    }

    // Style Confidence cell with conditional color
    const confidenceCell = row.getCell('confidence')
    if (finding.confidence !== null) {
      // Format as percentage
      confidenceCell.numFmt = '0%'
      const confColor = getConfidenceColor(finding.confidence)
      if (confColor !== 'GRAY') {
        confidenceCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `20${confColor}` }, // 20% opacity
        }
      }
    }

    // Wrap text for finding text cell
    const textCell = row.getCell('text')
    textCell.alignment = { wrapText: true, vertical: 'top' }
  })

  // Auto-fit columns based on content (with max width constraints)
  worksheet.columns.forEach(column => {
    if (column.width && column.width < 60) {
      // Already set, keep it
    }
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * POST /api/projects/[id]/findings/export
 * Export findings to CSV or Excel
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = ExportRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { format: exportFormat, filters, searchQuery } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get project name
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build query
    let query = supabase
      .from('findings')
      .select('*')
      .eq('deal_id', projectId)
      .limit(MAX_EXPORT_FINDINGS)

    // Apply filters
    if (filters) {
      if (filters.documentId) {
        query = query.eq('document_id', filters.documentId)
      }

      if (filters.domain && filters.domain.length > 0) {
        query = query.in('domain', filters.domain)
      }

      if (filters.findingType && filters.findingType.length > 0) {
        query = query.in('finding_type', filters.findingType)
      }

      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status)
      }

      if (filters.confidenceMin !== undefined) {
        query = query.gte('confidence', filters.confidenceMin)
      }

      if (filters.confidenceMax !== undefined) {
        query = query.lte('confidence', filters.confidenceMax)
      }
    }

    // Sort by created date descending
    query = query.order('created_at', { ascending: false })

    // Execute query
    const { data, error } = await query

    if (error) {
      console.error('[api/export] Error fetching findings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No findings to export' },
        { status: 400 }
      )
    }

    // Transform database records to Finding type
    const findings: Finding[] = data.map(row => {
      const extendedRow = row as typeof row & {
        status?: string
        validation_history?: Json
      }

      return {
        id: row.id,
        dealId: row.deal_id,
        documentId: row.document_id,
        chunkId: row.chunk_id,
        userId: row.user_id,
        text: row.text,
        sourceDocument: row.source_document,
        pageNumber: row.page_number,
        confidence: row.confidence,
        findingType: row.finding_type,
        domain: row.domain,
        status: (extendedRow.status as FindingStatus) || 'pending',
        validationHistory: (extendedRow.validation_history as unknown as ValidationEvent[]) || [],
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    // Generate filename
    const projectName = (project.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const extension = exportFormat === 'csv' ? 'csv' : 'xlsx'
    const filename = `findings-${projectName}-${dateStr}.${extension}`

    // Generate export file
    let blob: Blob
    let contentType: string
    let fileSize: number

    if (exportFormat === 'csv') {
      const csvContent = generateCsv(findings)
      contentType = 'text/csv; charset=utf-8'
      blob = new Blob([csvContent], { type: contentType })
      fileSize = blob.size
    } else {
      const buffer = await generateExcel(findings)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      // Convert Node Buffer to ArrayBuffer for Blob compatibility
      // Note: buffer.slice() creates a copy, ensuring we have a proper ArrayBuffer
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      blob = new Blob([arrayBuffer as ArrayBuffer], { type: contentType })
      fileSize = blob.size
    }

    // Return file with appropriate headers
    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileSize.toString(),
        'X-Export-Count': findings.length.toString(),
        'X-Export-Filename': filename,
      },
    })
  } catch (err) {
    console.error('[api/export] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
