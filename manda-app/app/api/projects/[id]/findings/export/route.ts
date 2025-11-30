/**
 * Export Findings API Route
 * POST /api/projects/[id]/findings/export
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #2, #3, #6)
 * Story: E4.12 - Implement Export Findings Feature (Advanced) (AC: #4, #5, #6, #8)
 *
 * Exports findings to CSV, Excel, or Report (HTML) format with:
 * - Field selection (choose which columns to export)
 * - Export scope (all, filtered, or selected findings)
 * - Filter criteria inclusion
 * - Report format with grouped findings and statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { stringify } from 'csv-stringify/sync'
import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { FindingDomain, FindingStatus, Finding, ValidationEvent } from '@/lib/types/findings'
import type { Json } from '@/lib/supabase/database.types'

// Maximum findings per export to prevent timeout
const MAX_EXPORT_FINDINGS = 5000

// All available export fields
const ALL_EXPORT_FIELDS = [
  { key: 'text', header: 'Finding Text' },
  { key: 'sourceDocument', header: 'Source Document' },
  { key: 'pageReference', header: 'Page/Cell Reference' },
  { key: 'domain', header: 'Domain' },
  { key: 'findingType', header: 'Type' },
  { key: 'confidence', header: 'Confidence' },
  { key: 'status', header: 'Status' },
  { key: 'createdAt', header: 'Created Date' },
] as const

type ExportFieldKey = (typeof ALL_EXPORT_FIELDS)[number]['key']

// Request body validation schema
const ExportRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx', 'report']),
  fields: z.array(z.string()).optional(),
  scope: z.enum(['all', 'filtered', 'selected']).optional().default('filtered'),
  findingIds: z.array(z.string().uuid()).optional(),
  includeFilterCriteria: z.boolean().optional().default(false),
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
function transformFindingForExport(finding: Finding, fields: ExportFieldKey[]): Record<string, string | number | null> {
  const fullRow: Record<ExportFieldKey, string | number | null> = {
    text: finding.text,
    domain: finding.domain || 'Unknown',
    findingType: finding.findingType || 'Unknown',
    confidence: finding.confidence,
    status: finding.status,
    sourceDocument: finding.sourceDocument || '',
    pageReference: finding.pageNumber ? `Page ${finding.pageNumber}` : '',
    createdAt: finding.createdAt ? format(new Date(finding.createdAt), 'yyyy-MM-dd HH:mm:ss') : '',
  }

  // Return only selected fields in order
  const row: Record<string, string | number | null> = {}
  for (const field of fields) {
    if (field in fullRow) {
      row[field] = fullRow[field as ExportFieldKey]
    }
  }
  return row
}

/**
 * Get column definitions based on selected fields
 */
function getColumnDefinitions(fields: ExportFieldKey[]): { key: string; header: string }[] {
  return fields
    .map((key) => ALL_EXPORT_FIELDS.find((f) => f.key === key))
    .filter((f): f is (typeof ALL_EXPORT_FIELDS)[number] => f !== undefined)
}

/**
 * Build filter criteria string
 */
function buildFilterCriteriaString(
  filters: z.infer<typeof ExportRequestSchema>['filters'],
  searchQuery?: string
): string {
  const parts: string[] = []

  if (filters?.documentId) {
    parts.push(`Document: ${filters.documentId}`)
  }
  if (filters?.domain && filters.domain.length > 0) {
    parts.push(`Domain: ${filters.domain.join(', ')}`)
  }
  if (filters?.findingType && filters.findingType.length > 0) {
    parts.push(`Type: ${filters.findingType.join(', ')}`)
  }
  if (filters?.status && filters.status.length > 0) {
    parts.push(`Status: ${filters.status.join(', ')}`)
  }
  if (filters?.confidenceMin !== undefined) {
    parts.push(`Confidence >= ${Math.round(filters.confidenceMin * 100)}%`)
  }
  if (filters?.confidenceMax !== undefined) {
    parts.push(`Confidence <= ${Math.round(filters.confidenceMax * 100)}%`)
  }
  if (searchQuery) {
    parts.push(`Search: "${searchQuery}"`)
  }

  return parts.length > 0 ? parts.join('; ') : 'No filters applied'
}

/**
 * Generate CSV content from findings
 */
function generateCsv(
  findings: Finding[],
  fields: ExportFieldKey[],
  includeFilterCriteria: boolean,
  filterCriteriaString: string
): string {
  const columns = getColumnDefinitions(fields)
  const rows = findings.map((f) => transformFindingForExport(f, fields))

  // Build CSV with optional filter criteria comment
  let csv = ''

  if (includeFilterCriteria) {
    // Add filter criteria as a comment row
    csv = `# Filter Criteria: ${filterCriteriaString}\n# Export Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n# Total Findings: ${findings.length}\n\n`
  }

  csv += stringify(rows, {
    header: true,
    columns: columns.map((col) => ({
      key: col.key,
      header: col.header,
    })),
    bom: true, // Add BOM for UTF-8 support in Excel
    quoted_string: true,
  })

  return csv
}

/**
 * Generate Excel workbook from findings
 */
async function generateExcel(
  findings: Finding[],
  fields: ExportFieldKey[],
  includeFilterCriteria: boolean,
  filterCriteriaString: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  workbook.modified = new Date()

  const columns = getColumnDefinitions(fields)

  const worksheet = workbook.addWorksheet('Findings', {
    views: [{ state: 'frozen', ySplit: includeFilterCriteria ? 2 : 1 }],
  })

  // Define columns with headers
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.key === 'text' ? 60 : col.key === 'sourceDocument' ? 30 : 15,
  }))

  // Add filter criteria row if requested
  if (includeFilterCriteria) {
    const criteriaRow = worksheet.insertRow(1, [`Filter: ${filterCriteriaString} | Exported: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')} | Count: ${findings.length}`])
    criteriaRow.font = { italic: true, color: { argb: 'FF666666' } }
    worksheet.mergeCells(1, 1, 1, columns.length)
    // Update frozen pane to account for criteria row
    worksheet.views = [{ state: 'frozen', ySplit: 2 }]
  }

  // Style header row
  const headerRowIndex = includeFilterCriteria ? 2 : 1
  const headerRow = worksheet.getRow(headerRowIndex)
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
    const rowData = transformFindingForExport(finding, fields)
    const row = worksheet.addRow(rowData)

    // Alternate row background
    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' }, // gray-50
      }
    }

    // Style Domain cell with color (if field is included)
    if (fields.includes('domain')) {
      const domainCell = row.getCell('domain')
      if (finding.domain && DOMAIN_COLORS[finding.domain]) {
        domainCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${DOMAIN_COLORS[finding.domain]}` },
        }
        domainCell.font = { color: { argb: 'FFFFFFFF' } }
      }
    }

    // Style Status cell with color (if field is included)
    if (fields.includes('status')) {
      const statusCell = row.getCell('status')
      if (finding.status && STATUS_COLORS[finding.status]) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${STATUS_COLORS[finding.status]}` },
        }
        statusCell.font = { color: { argb: 'FFFFFFFF' } }
      }
    }

    // Style Confidence cell with conditional color and percentage format (if field is included)
    if (fields.includes('confidence')) {
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
    }

    // Format date column (if field is included)
    if (fields.includes('createdAt')) {
      const dateCell = row.getCell('createdAt')
      dateCell.numFmt = 'yyyy-mm-dd hh:mm:ss'
    }

    // Wrap text for finding text cell (if field is included)
    if (fields.includes('text')) {
      const textCell = row.getCell('text')
      textCell.alignment = { wrapText: true, vertical: 'top' }
    }
  })

  // Auto-fit columns based on content
  worksheet.columns.forEach((column) => {
    if (column.header === 'Finding Text') {
      column.width = 60
    } else if (column.header === 'Source Document') {
      column.width = 30
    } else {
      column.width = 15
    }
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Generate HTML Report from findings
 */
function generateReport(
  findings: Finding[],
  projectName: string,
  filterCriteriaString: string,
  includeFilterCriteria: boolean
): string {
  // Group findings by domain
  const findingsByDomain: Record<string, Finding[]> = {}
  findings.forEach((finding) => {
    const domain = finding.domain || 'unknown'
    if (!findingsByDomain[domain]) {
      findingsByDomain[domain] = []
    }
    findingsByDomain[domain].push(finding)
  })

  // Calculate statistics
  const stats = {
    total: findings.length,
    byDomain: Object.entries(findingsByDomain).map(([domain, items]) => ({
      domain,
      count: items.length,
    })),
    byStatus: {
      pending: findings.filter((f) => f.status === 'pending').length,
      validated: findings.filter((f) => f.status === 'validated').length,
      rejected: findings.filter((f) => f.status === 'rejected').length,
    },
    confidenceDistribution: {
      high: findings.filter((f) => (f.confidence || 0) >= 0.8).length,
      medium: findings.filter((f) => (f.confidence || 0) >= 0.6 && (f.confidence || 0) < 0.8).length,
      low: findings.filter((f) => (f.confidence || 0) < 0.6).length,
    },
  }

  // Build HTML
  const domainColors: Record<string, string> = {
    financial: '#10B981',
    operational: '#3B82F6',
    market: '#A855F7',
    legal: '#F59E0B',
    technical: '#64748B',
    unknown: '#9CA3AF',
  }

  const statusColors: Record<string, string> = {
    pending: '#EAB308',
    validated: '#22C55E',
    rejected: '#EF4444',
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Findings Report - ${projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 2rem; }
    .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { padding: 2rem; border-bottom: 1px solid #e5e7eb; }
    .header h1 { font-size: 1.5rem; color: #111827; margin-bottom: 0.5rem; }
    .header .meta { color: #6b7280; font-size: 0.875rem; }
    .header .meta span { display: inline-block; margin-right: 1.5rem; }
    .filters { background: #f3f4f6; padding: 1rem 2rem; border-bottom: 1px solid #e5e7eb; font-size: 0.875rem; color: #4b5563; }
    .domain-section { padding: 1.5rem 2rem; border-bottom: 1px solid #e5e7eb; }
    .domain-section:last-of-type { border-bottom: none; }
    .domain-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .domain-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; color: white; }
    .domain-count { color: #6b7280; font-size: 0.875rem; }
    .finding { background: #f9fafb; border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; }
    .finding:last-child { margin-bottom: 0; }
    .finding-text { margin-bottom: 0.5rem; }
    .finding-meta { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.75rem; color: #6b7280; }
    .finding-meta span { display: flex; align-items: center; gap: 0.25rem; }
    .confidence-bar { display: inline-block; width: 60px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; vertical-align: middle; }
    .confidence-fill { height: 100%; border-radius: 4px; }
    .status-badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: white; }
    .statistics { padding: 2rem; background: #f9fafb; border-radius: 0 0 8px 8px; }
    .statistics h2 { font-size: 1.125rem; color: #111827; margin-bottom: 1rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .stat-card { background: white; padding: 1rem; border-radius: 6px; border: 1px solid #e5e7eb; }
    .stat-card h3 { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem; }
    .stat-card .value { font-size: 1.5rem; font-weight: 600; color: #111827; }
    .stat-list { margin-top: 0.5rem; }
    .stat-list-item { display: flex; justify-content: space-between; font-size: 0.875rem; padding: 0.25rem 0; }
    .stat-list-item .label { color: #6b7280; }
    .stat-list-item .count { font-weight: 500; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Findings Report</h1>
      <div class="meta">
        <span><strong>Project:</strong> ${projectName}</span>
        <span><strong>Export Date:</strong> ${format(new Date(), 'yyyy-MM-dd HH:mm')}</span>
        <span><strong>Total Findings:</strong> ${findings.length}</span>
      </div>
    </div>
    ${includeFilterCriteria ? `<div class="filters"><strong>Filters:</strong> ${filterCriteriaString}</div>` : ''}

    ${Object.entries(findingsByDomain)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([domain, domainFindings]) => `
      <div class="domain-section">
        <div class="domain-header">
          <span class="domain-badge" style="background: ${domainColors[domain] || domainColors.unknown}">${domain.charAt(0).toUpperCase() + domain.slice(1)}</span>
          <span class="domain-count">${domainFindings.length} finding${domainFindings.length === 1 ? '' : 's'}</span>
        </div>
        ${domainFindings
          .map(
            (finding) => `
          <div class="finding">
            <div class="finding-text">${escapeHtml(finding.text)}</div>
            <div class="finding-meta">
              ${finding.sourceDocument ? `<span><strong>Source:</strong> ${escapeHtml(finding.sourceDocument)}${finding.pageNumber ? `, Page ${finding.pageNumber}` : ''}</span>` : ''}
              <span>
                <strong>Confidence:</strong>
                <span class="confidence-bar">
                  <span class="confidence-fill" style="width: ${Math.round((finding.confidence || 0) * 100)}%; background: ${getConfidenceColorHex(finding.confidence)}"></span>
                </span>
                ${Math.round((finding.confidence || 0) * 100)}%
              </span>
              <span>
                <span class="status-badge" style="background: ${statusColors[finding.status] || statusColors.pending}">${finding.status}</span>
              </span>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `
      )
      .join('')}

    <div class="statistics">
      <h2>Summary Statistics</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Findings</h3>
          <div class="value">${stats.total}</div>
        </div>
        <div class="stat-card">
          <h3>By Status</h3>
          <div class="stat-list">
            <div class="stat-list-item"><span class="label">Pending</span><span class="count">${stats.byStatus.pending}</span></div>
            <div class="stat-list-item"><span class="label">Validated</span><span class="count">${stats.byStatus.validated}</span></div>
            <div class="stat-list-item"><span class="label">Rejected</span><span class="count">${stats.byStatus.rejected}</span></div>
          </div>
        </div>
        <div class="stat-card">
          <h3>Confidence Distribution</h3>
          <div class="stat-list">
            <div class="stat-list-item"><span class="label">High (80%+)</span><span class="count">${stats.confidenceDistribution.high}</span></div>
            <div class="stat-list-item"><span class="label">Medium (60-79%)</span><span class="count">${stats.confidenceDistribution.medium}</span></div>
            <div class="stat-list-item"><span class="label">Low (&lt;60%)</span><span class="count">${stats.confidenceDistribution.low}</span></div>
          </div>
        </div>
        <div class="stat-card">
          <h3>By Domain</h3>
          <div class="stat-list">
            ${stats.byDomain
              .sort((a, b) => b.count - a.count)
              .map(
                (d) => `<div class="stat-list-item"><span class="label">${d.domain.charAt(0).toUpperCase() + d.domain.slice(1)}</span><span class="count">${d.count}</span></div>`
              )
              .join('')}
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`

  return html
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Get confidence color as hex for HTML
 */
function getConfidenceColorHex(confidence: number | null): string {
  if (confidence === null) return '#9CA3AF'
  if (confidence >= 0.8) return '#22C55E'
  if (confidence >= 0.6) return '#EAB308'
  return '#EF4444'
}

/**
 * POST /api/projects/[id]/findings/export
 * Export findings to CSV, Excel, or Report format
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

    const {
      format: exportFormat,
      fields: requestedFields,
      scope,
      findingIds,
      includeFilterCriteria,
      filters,
      searchQuery,
    } = parseResult.data

    // Validate scope requirements
    if (scope === 'selected' && (!findingIds || findingIds.length === 0)) {
      return NextResponse.json(
        { error: 'findingIds required for selected scope' },
        { status: 400 }
      )
    }

    // Validate fields (use default if not specified)
    const fields: ExportFieldKey[] = requestedFields
      ? (requestedFields.filter((f) =>
          ALL_EXPORT_FIELDS.some((ef) => ef.key === f)
        ) as ExportFieldKey[])
      : ALL_EXPORT_FIELDS.map((f) => f.key)

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid field must be selected' },
        { status: 400 }
      )
    }

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

    // Apply scope-based filtering
    if (scope === 'selected' && findingIds) {
      query = query.in('id', findingIds)
    } else if (scope === 'filtered' || scope === 'all') {
      // Apply filters only for filtered/all scope
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
    const findings: Finding[] = data.map((row) => {
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

    // Build filter criteria string
    const filterCriteriaString = buildFilterCriteriaString(filters, searchQuery)

    // Generate filename
    const projectName = (project.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const scopeLabel = scope === 'selected' ? 'selected' : scope === 'filtered' ? 'filtered' : 'all'
    const extension = exportFormat === 'csv' ? 'csv' : exportFormat === 'xlsx' ? 'xlsx' : 'html'
    const filename = `findings-${scopeLabel}-${projectName}-${dateStr}.${extension}`

    // Generate export file
    let blob: Blob
    let contentType: string
    let fileSize: number

    if (exportFormat === 'csv') {
      const csvContent = generateCsv(findings, fields, includeFilterCriteria, filterCriteriaString)
      contentType = 'text/csv; charset=utf-8'
      blob = new Blob([csvContent], { type: contentType })
      fileSize = blob.size
    } else if (exportFormat === 'xlsx') {
      const buffer = await generateExcel(findings, fields, includeFilterCriteria, filterCriteriaString)
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      blob = new Blob([arrayBuffer as ArrayBuffer], { type: contentType })
      fileSize = blob.size
    } else {
      // Report format (HTML)
      const htmlContent = generateReport(findings, project.name || 'Project', filterCriteriaString, includeFilterCriteria)
      contentType = 'text/html; charset=utf-8'
      blob = new Blob([htmlContent], { type: contentType })
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
