/**
 * Q&A Export Service
 *
 * Generates professionally formatted Excel exports for Q&A lists.
 * Story: E8.6 - Excel Export
 *
 * Features:
 * - Category-grouped Q&A items (Financials, Legal, Operations, Market, Technology, HR)
 * - Priority color-coding (High=red, Medium=yellow, Low=green)
 * - Professional styling: freeze panes, bold headers, gray background
 * - Empty Answer and Date Answered columns for pending items
 * - Appropriate column widths for readability
 */

import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { QAItem, QACategory, QAPriority, QA_CATEGORIES } from '@/lib/types/qa'

// ============================================================================
// Constants
// ============================================================================

/**
 * Priority color mapping (text colors without #)
 * Match the color scheme used in IRL export and findings export for consistency
 */
const PRIORITY_COLORS: Record<QAPriority, string> = {
  high: 'DC2626', // red-600
  medium: 'F59E0B', // amber-500
  low: '10B981', // emerald-500
}

/**
 * Category header background color
 */
const CATEGORY_HEADER_BG = 'E5E7EB' // gray-200

/**
 * Column header background color
 */
const COLUMN_HEADER_BG = '374151' // gray-700

/**
 * Pending cell background color (light gray for editable cells)
 */
const PENDING_CELL_BG = 'F9FAFB' // gray-50

/**
 * Column specifications per AC #2 and story dev notes
 */
const COLUMN_SPECS = [
  { key: 'question', header: 'Question', width: 60 },
  { key: 'priority', header: 'Priority', width: 12 },
  { key: 'answer', header: 'Answer', width: 50 },
  { key: 'dateAnswered', header: 'Date Answered', width: 18 },
] as const

/**
 * Category order (fixed per AC #3)
 */
const CATEGORY_ORDER: QACategory[] = [
  'Financials',
  'Legal',
  'Operations',
  'Market',
  'Technology',
  'HR',
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Group Q&A items by category, respecting the fixed category order
 * Categories with 0 items are omitted
 */
export function groupQAItemsByCategory(items: QAItem[]): Map<QACategory, QAItem[]> {
  const grouped = new Map<QACategory, QAItem[]>()

  // Initialize with empty arrays for all categories
  for (const category of CATEGORY_ORDER) {
    grouped.set(category, [])
  }

  // Group items
  for (const item of items) {
    const categoryItems = grouped.get(item.category)
    if (categoryItems) {
      categoryItems.push(item)
    }
  }

  // Remove empty categories
  for (const category of CATEGORY_ORDER) {
    const categoryItems = grouped.get(category)
    if (!categoryItems || categoryItems.length === 0) {
      grouped.delete(category)
    }
  }

  return grouped
}

/**
 * Format date for display in Excel
 */
function formatDateForExcel(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

/**
 * Get priority label for display
 */
function getPriorityLabel(priority: QAPriority): string {
  const labels: Record<QAPriority, string> = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
  }
  return labels[priority] || priority.toUpperCase()
}

// ============================================================================
// Excel Generation
// ============================================================================

/**
 * Generate a professionally formatted Excel file for Q&A items
 *
 * @param items - Q&A items to export (already filtered)
 * @param projectName - Project name for the worksheet title
 * @returns Buffer containing the Excel file
 *
 * AC #1: Returns valid .xlsx file
 * AC #2: Columns are Question | Priority | Answer | Date Answered
 * AC #3: Rows grouped by category with styled section headers
 * AC #6: Professional formatting applied
 * AC #7: Empty Answer and Date Answered for pending items
 */
export async function generateQAExcel(
  items: QAItem[],
  projectName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.creator = 'Manda Platform'

  const worksheet = workbook.addWorksheet('Q&A List', {
    views: [{ state: 'frozen', ySplit: 1 }], // Freeze header row (AC #6)
  })

  // Define columns with specified widths (AC #2, AC #6)
  worksheet.columns = COLUMN_SPECS.map((spec) => ({
    header: spec.header,
    key: spec.key,
    width: spec.width,
  }))

  // Style header row (AC #6)
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${COLUMN_HEADER_BG}` },
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 25

  // Group items by category (AC #3)
  const groupedItems = groupQAItemsByCategory(items)

  let currentRow = 2

  // Add items grouped by category
  for (const category of CATEGORY_ORDER) {
    const categoryItems = groupedItems.get(category)
    if (!categoryItems || categoryItems.length === 0) continue

    // Add category header row (AC #3)
    const categoryRow = worksheet.getRow(currentRow)

    // Merge cells for category header
    worksheet.mergeCells(currentRow, 1, currentRow, 4)

    const categoryCell = categoryRow.getCell(1)
    categoryCell.value = `${category} (${categoryItems.length} item${categoryItems.length === 1 ? '' : 's'})`
    categoryCell.font = { bold: true, size: 12, color: { argb: 'FF1F2937' } }
    categoryCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${CATEGORY_HEADER_BG}` },
    }
    categoryCell.alignment = { vertical: 'middle', horizontal: 'left' }
    categoryRow.height = 24

    currentRow++

    // Add items for this category
    for (const item of categoryItems) {
      const dataRow = worksheet.getRow(currentRow)

      // Question cell with text wrap
      const questionCell = dataRow.getCell(1)
      questionCell.value = item.question
      questionCell.alignment = { wrapText: true, vertical: 'top' }

      // Priority cell with color coding (AC #6)
      const priorityCell = dataRow.getCell(2)
      priorityCell.value = getPriorityLabel(item.priority)
      priorityCell.font = {
        bold: true,
        color: { argb: `FF${PRIORITY_COLORS[item.priority]}` },
      }
      priorityCell.alignment = { horizontal: 'center', vertical: 'middle' }

      // Answer cell - empty for pending items (AC #7)
      const answerCell = dataRow.getCell(3)
      if (item.dateAnswered) {
        answerCell.value = item.answer || ''
        answerCell.alignment = { wrapText: true, vertical: 'top' }
      } else {
        // Leave empty with light background for pending items (AC #7)
        answerCell.value = ''
        answerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${PENDING_CELL_BG}` },
        }
        answerCell.alignment = { wrapText: true, vertical: 'top' }
        // Ensure cell is editable (unlocked) - default in Excel
      }

      // Date Answered cell - empty for pending items (AC #7)
      const dateCell = dataRow.getCell(4)
      if (item.dateAnswered) {
        dateCell.value = formatDateForExcel(item.dateAnswered)
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else {
        // Leave empty with light background for pending items (AC #7)
        dateCell.value = ''
        dateCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${PENDING_CELL_BG}` },
        }
        dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
      }

      currentRow++
    }

    // Add blank row after each category section for readability (Task 6.5)
    currentRow++
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Generate filename for Q&A export
 * Pattern: {company_name}_QA_List_{YYYY-MM-DD}.xlsx (AC #5)
 *
 * @param companyName - Company/project name
 * @returns Sanitized filename
 */
export function generateQAExportFilename(companyName: string): string {
  // Sanitize company name: replace special chars with dashes
  const sanitizedName = companyName
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '-')
    .trim() || 'Project'

  const dateStr = format(new Date(), 'yyyy-MM-dd')

  return `${sanitizedName}_QA_List_${dateStr}.xlsx`
}

// ============================================================================
// Export Types
// ============================================================================

export interface QAExportResult {
  buffer: Buffer
  filename: string
  contentType: string
}

/**
 * Generate Q&A export with all metadata
 */
export async function generateQAExport(
  items: QAItem[],
  projectName: string
): Promise<QAExportResult> {
  const buffer = await generateQAExcel(items, projectName)
  const filename = generateQAExportFilename(projectName)

  return {
    buffer,
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}
