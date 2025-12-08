/**
 * Audit Export Service
 *
 * Provides export functionality for audit trail data.
 * Story: E7.5 - Maintain Comprehensive Audit Trail
 *
 * Features:
 * - Export to CSV with UTF-8 BOM for Excel compatibility (AC: #6)
 * - Export to JSON with complete field mapping (AC: #6)
 * - Streaming support for large datasets
 * - Field selection for export customization
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { format } from 'date-fns'
import { stringify } from 'csv-stringify/sync'
import {
  AuditExportOptions,
  AuditExportResult,
  AuditExportJSON,
  AuditEntry,
  AuditEntryType,
  auditEntryToCsvRow,
  AUDIT_CSV_HEADERS,
} from '@/lib/types/feedback'
import { queryAllFeedback } from './audit-trail'

// UTF-8 BOM for Excel compatibility
const UTF8_BOM = '\uFEFF'

// Maximum records per export to prevent memory issues
const MAX_EXPORT_RECORDS = 10000

/**
 * Export audit trail to CSV format
 * (AC: #6 - Export to CSV with all fields included)
 */
export async function exportToCSV(
  supabase: SupabaseClient<Database>,
  dealId: string,
  userId: string,
  options: AuditExportOptions
): Promise<AuditExportResult> {
  const exportedAt = new Date().toISOString()

  try {
    // Query all feedback with filters
    const result = await queryAllFeedback(supabase, dealId, {
      startDate: options.startDate,
      endDate: options.endDate,
      analystId: options.analystId,
      findingId: options.findingId,
      types: options.types,
      limit: MAX_EXPORT_RECORDS,
      offset: 0,
      orderDir: 'desc',
    })

    if (result.data.length === 0) {
      return {
        success: false,
        filename: '',
        format: 'csv',
        recordCount: 0,
        exportedAt,
        exportedBy: userId,
        dateRange: {
          start: options.startDate ? toISOString(options.startDate) : null,
          end: options.endDate ? toISOString(options.endDate) : null,
        },
        filters: {
          analystId: options.analystId,
          findingId: options.findingId,
          types: options.types,
        },
        content: '',
      }
    }

    // Convert entries to CSV rows
    const rows = result.data.map(auditEntryToCsvRow)

    // Determine which headers to include based on field selection
    const headers = options.fields && options.fields.length > 0
      ? AUDIT_CSV_HEADERS.filter(h => options.fields!.includes(h))
      : [...AUDIT_CSV_HEADERS]

    // Generate CSV content
    let csv = ''

    // Add metadata header if requested
    if (options.includeMetadata) {
      csv += `# Audit Trail Export\n`
      csv += `# Exported: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`
      csv += `# Records: ${result.data.length}\n`
      if (options.startDate || options.endDate) {
        csv += `# Date Range: ${options.startDate || 'start'} to ${options.endDate || 'end'}\n`
      }
      if (options.analystId) {
        csv += `# Analyst: ${options.analystId}\n`
      }
      if (options.findingId) {
        csv += `# Finding: ${options.findingId}\n`
      }
      csv += `#\n`
    }

    // Add UTF-8 BOM and CSV data
    csv = UTF8_BOM + csv + stringify(rows, {
      header: true,
      columns: headers.map(h => ({ key: h, header: h })),
      quoted_string: true,
    })

    // Generate filename
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const filename = `audit-trail-${dealId.slice(0, 8)}-${dateStr}.csv`

    return {
      success: true,
      filename,
      format: 'csv',
      recordCount: result.data.length,
      exportedAt,
      exportedBy: userId,
      dateRange: {
        start: options.startDate ? toISOString(options.startDate) : null,
        end: options.endDate ? toISOString(options.endDate) : null,
      },
      filters: {
        analystId: options.analystId,
        findingId: options.findingId,
        types: options.types,
      },
      content: csv,
    }
  } catch (err) {
    console.error('[audit-export] Error exporting to CSV:', err)
    return {
      success: false,
      filename: '',
      format: 'csv',
      recordCount: 0,
      exportedAt,
      exportedBy: userId,
      dateRange: {
        start: options.startDate ? toISOString(options.startDate) : null,
        end: options.endDate ? toISOString(options.endDate) : null,
      },
      filters: {
        analystId: options.analystId,
        findingId: options.findingId,
        types: options.types,
      },
    }
  }
}

/**
 * Export audit trail to JSON format
 * (AC: #6 - Export to JSON with all fields included)
 */
export async function exportToJSON(
  supabase: SupabaseClient<Database>,
  dealId: string,
  userId: string,
  options: AuditExportOptions
): Promise<AuditExportResult> {
  const exportedAt = new Date().toISOString()

  try {
    // Query all feedback with filters
    const result = await queryAllFeedback(supabase, dealId, {
      startDate: options.startDate,
      endDate: options.endDate,
      analystId: options.analystId,
      findingId: options.findingId,
      types: options.types,
      limit: MAX_EXPORT_RECORDS,
      offset: 0,
      orderDir: 'desc',
    })

    const dateRange = {
      start: options.startDate ? toISOString(options.startDate) : null,
      end: options.endDate ? toISOString(options.endDate) : null,
    }

    const filters = {
      analystId: options.analystId,
      findingId: options.findingId,
      types: options.types,
    }

    // Build JSON export structure
    const exportData: AuditExportJSON = {
      exportedAt,
      exportedBy: userId,
      dateRange,
      filters,
      totalRecords: result.data.length,
      records: result.data,
    }

    // Generate filename
    const dateStr = format(new Date(), 'yyyy-MM-dd')
    const filename = `audit-trail-${dealId.slice(0, 8)}-${dateStr}.json`

    return {
      success: true,
      filename,
      format: 'json',
      recordCount: result.data.length,
      exportedAt,
      exportedBy: userId,
      dateRange,
      filters,
      records: result.data,
      content: JSON.stringify(exportData, null, 2),
    }
  } catch (err) {
    console.error('[audit-export] Error exporting to JSON:', err)
    return {
      success: false,
      filename: '',
      format: 'json',
      recordCount: 0,
      exportedAt,
      exportedBy: userId,
      dateRange: {
        start: options.startDate ? toISOString(options.startDate) : null,
        end: options.endDate ? toISOString(options.endDate) : null,
      },
      filters: {
        analystId: options.analystId,
        findingId: options.findingId,
        types: options.types,
      },
    }
  }
}

/**
 * Main export function that routes to appropriate format
 */
export async function exportAuditTrail(
  supabase: SupabaseClient<Database>,
  dealId: string,
  userId: string,
  options: AuditExportOptions
): Promise<AuditExportResult> {
  if (options.format === 'json') {
    return exportToJSON(supabase, dealId, userId, options)
  }
  return exportToCSV(supabase, dealId, userId, options)
}

/**
 * Generate a streaming response for large exports
 * Use this for API routes to avoid memory issues
 */
export function createExportStream(
  supabase: SupabaseClient<Database>,
  dealId: string,
  options: AuditExportOptions
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        // Query all feedback
        const result = await queryAllFeedback(supabase, dealId, {
          startDate: options.startDate,
          endDate: options.endDate,
          analystId: options.analystId,
          findingId: options.findingId,
          types: options.types,
          limit: MAX_EXPORT_RECORDS,
          offset: 0,
          orderDir: 'desc',
        })

        if (options.format === 'json') {
          // Stream JSON export
          const exportData: AuditExportJSON = {
            exportedAt: new Date().toISOString(),
            exportedBy: '',
            dateRange: {
              start: options.startDate ? toISOString(options.startDate) : null,
              end: options.endDate ? toISOString(options.endDate) : null,
            },
            filters: {
              analystId: options.analystId,
              findingId: options.findingId,
              types: options.types,
            },
            totalRecords: result.data.length,
            records: result.data,
          }
          controller.enqueue(encoder.encode(JSON.stringify(exportData, null, 2)))
        } else {
          // Stream CSV export
          // Add BOM
          controller.enqueue(encoder.encode(UTF8_BOM))

          // Add headers
          const headerLine = AUDIT_CSV_HEADERS.join(',') + '\n'
          controller.enqueue(encoder.encode(headerLine))

          // Stream each row
          for (const entry of result.data) {
            const row = auditEntryToCsvRow(entry)
            const values = AUDIT_CSV_HEADERS.map(h => {
              const val = row[h] || ''
              // Escape and quote values
              if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val.replace(/"/g, '""')}"`
              }
              return val
            })
            controller.enqueue(encoder.encode(values.join(',') + '\n'))
          }
        }

        controller.close()
      } catch (err) {
        console.error('[audit-export] Stream error:', err)
        controller.error(err)
      }
    },
  })
}

/**
 * Helper to convert date to ISO string
 */
function toISOString(date: Date | string | undefined): string | null {
  if (!date) return null
  if (date instanceof Date) return date.toISOString()
  return date
}

/**
 * Get estimated export size in bytes
 */
export async function estimateExportSize(
  supabase: SupabaseClient<Database>,
  dealId: string,
  options: AuditExportOptions
): Promise<number> {
  const result = await queryAllFeedback(supabase, dealId, {
    startDate: options.startDate,
    endDate: options.endDate,
    analystId: options.analystId,
    findingId: options.findingId,
    types: options.types,
    limit: 1,
    offset: 0,
  })

  // Estimate ~500 bytes per record for CSV, ~800 for JSON
  const bytesPerRecord = options.format === 'json' ? 800 : 500

  return result.total * bytesPerRecord
}