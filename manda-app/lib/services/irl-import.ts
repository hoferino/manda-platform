/**
 * IRL Import Service
 *
 * Handles Excel/CSV import for Information Request Lists (IRLs).
 * Story: E6.X - IRL Import from Excel/CSV
 *
 * Features:
 * - Parse Excel files (.xlsx) with ExcelJS
 * - Parse CSV files
 * - Support category-grouped format (matching export format)
 * - Extract categories, items, descriptions, priorities, subcategories
 * - Create IRL and IRL items in database
 * - Auto-generate folder structure from imported IRL
 */

import ExcelJS from 'exceljs'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'

// Type alias for Supabase client with our database types
type SupabaseClientTyped = SupabaseClient<Database>

// ============================================================================
// Constants
// ============================================================================

/** Maximum rows allowed per import */
export const MAX_IMPORT_ROWS = 500

/** Maximum file size in bytes (10MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** MIME types accepted for import */
export const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]

/** Priority label mapping */
const PRIORITY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  h: 'high',
  m: 'medium',
  l: 'low',
}

// ============================================================================
// Types
// ============================================================================

export interface ImportedIRLItem {
  category: string
  subcategory?: string | null
  itemName: string
  description?: string | null
  priority: 'high' | 'medium' | 'low'
  fulfilled: boolean
  notes?: string | null
}

export interface IRLImportPreview {
  totalItems: number
  categories: string[]
  subcategories: string[]
  items: ImportedIRLItem[]
  warnings: string[]
}

export interface IRLImportResult {
  success: boolean
  irlId?: string
  itemsCreated?: number
  foldersCreated?: number
  error?: string
}

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
}

/**
 * Parse priority from text
 */
function parsePriority(text: string): 'high' | 'medium' | 'low' {
  const normalized = normalizeText(text).toLowerCase()
  return PRIORITY_MAP[normalized] || 'medium'
}

/**
 * Parse boolean status from text
 */
function parseStatus(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase()
  return (
    normalized === 'done' ||
    normalized === 'fulfilled' ||
    normalized === 'complete' ||
    normalized === 'yes' ||
    normalized === 'true' ||
    normalized === '✓' ||
    normalized === 'x'
  )
}

// ============================================================================
// Excel Parsing
// ============================================================================

/**
 * Detect column structure intelligently by analyzing header row
 */
interface ColumnMapping {
  categoryLevel1?: number // e.g., "Category Level 1" or "Category"
  categoryLevel2?: number // e.g., "Category Level 2" or "Subcategory"
  item: number // Item name/description column
  status?: number
  description?: number
  priority?: number
  notes?: number
}

/**
 * Intelligently detect column mapping from header row
 */
function detectColumnMapping(headerRow: ExcelJS.Row): ColumnMapping {
  const mapping: ColumnMapping = {
    item: -1, // Will be set to a default if not found
  }

  // Analyze each cell in the header row
  for (let colNum = 1; colNum <= headerRow.cellCount; colNum++) {
    const cell = headerRow.getCell(colNum)
    const header = cell.value?.toString().toLowerCase().trim() || ''

    // Category Level 1 detection
    if (
      header.includes('category level 1') ||
      header.includes('category l1') ||
      (header.includes('category') && header.includes('1'))
    ) {
      mapping.categoryLevel1 = colNum
    }
    // Category Level 2 detection (subcategory)
    else if (
      header.includes('category level 2') ||
      header.includes('category l2') ||
      (header.includes('category') && header.includes('2')) ||
      header.includes('subcategory') ||
      header.includes('sub-category')
    ) {
      mapping.categoryLevel2 = colNum
    }
    // Single category column (if no level 1/2)
    else if (header === 'category' && !mapping.categoryLevel1) {
      mapping.categoryLevel1 = colNum
    }
    // Item/Document/Information column
    else if (
      header.includes('item') ||
      header.includes('document') ||
      header.includes('information') ||
      header.includes('required') ||
      header.includes('name')
    ) {
      mapping.item = colNum
    }
    // Status column
    else if (header.includes('status') || header.includes('fulfilled')) {
      mapping.status = colNum
    }
    // Description/Comments/Details column
    else if (
      header.includes('description') ||
      header.includes('comment') ||
      header.includes('detail') ||
      header.includes('note')
    ) {
      if (!mapping.description) {
        mapping.description = colNum
      } else if (!mapping.notes) {
        mapping.notes = colNum
      }
    }
    // Priority column
    else if (header.includes('priority')) {
      mapping.priority = colNum
    }
  }

  // Fallback: if no item column detected, use column 4 (common for "Document/Information Required")
  if (mapping.item === -1) {
    mapping.item = 4
  }

  return mapping
}

/**
 * Parse Excel file and extract IRL items
 *
 * INTELLIGENT PARSER - Supports multiple formats:
 * 1. Hierarchical format: Category Level 1, Category Level 2, Item
 * 2. Flat format: Category, Item, Subcategory
 * 3. Auto-detects column mapping from headers
 *
 * @param buffer - Excel file buffer
 * @returns Preview of imported items
 */
export async function parseExcelIRL(buffer: Buffer): Promise<IRLImportPreview> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file')
  }

  const items: ImportedIRLItem[] = []
  const categories = new Set<string>()
  const subcategories = new Set<string>()
  const warnings: string[] = []

  let headerRow: ExcelJS.Row | null = null
  let headerRowNumber = 0
  let columnMapping: ColumnMapping | null = null

  // Find header row (look for "Category" or "Item" or "Document")
  worksheet.eachRow((row, rowNumber) => {
    if (headerRow) return // Already found header

    const rowText = row.values
      ?.toString()
      .toLowerCase()

    if (
      rowText?.includes('category') ||
      rowText?.includes('item') ||
      rowText?.includes('document') ||
      rowText?.includes('information')
    ) {
      headerRow = row
      headerRowNumber = rowNumber
    }
  })

  if (!headerRow) {
    warnings.push('Could not find header row. Using default column mapping.')
    headerRowNumber = 1 // Default to row 1
    // Create a basic mapping
    columnMapping = {
      categoryLevel1: 2,
      categoryLevel2: 3,
      item: 4,
      status: 5,
      notes: 6,
    }
  } else {
    // Detect column mapping from header
    columnMapping = detectColumnMapping(headerRow)
    warnings.push(
      `Detected columns: Category1=${columnMapping.categoryLevel1 || 'N/A'}, ` +
        `Category2=${columnMapping.categoryLevel2 || 'N/A'}, ` +
        `Item=${columnMapping.item}`
    )
  }

  // Track current category for grouped formats
  let currentCategoryL1 = ''
  let currentCategoryL2 = ''

  // Parse data rows
  let rowsProcessed = 0
  worksheet.eachRow((row, rowNumber) => {
    // Skip header and rows before it
    if (rowNumber <= headerRowNumber) return

    // Skip empty rows (check item column)
    const itemCell = row.getCell(columnMapping.item).value
    if (!itemCell) return

    // Limit rows
    if (rowsProcessed >= MAX_IMPORT_ROWS) {
      warnings.push(`Import limited to ${MAX_IMPORT_ROWS} rows`)
      return
    }

    rowsProcessed++

    // Extract values based on detected column mapping
    const categoryL1Value = columnMapping.categoryLevel1
      ? row.getCell(columnMapping.categoryLevel1).value?.toString().trim() || ''
      : ''
    const categoryL2Value = columnMapping.categoryLevel2
      ? row.getCell(columnMapping.categoryLevel2).value?.toString().trim() || ''
      : ''
    const itemValue = row.getCell(columnMapping.item).value?.toString().trim() || ''
    const statusValue = columnMapping.status
      ? row.getCell(columnMapping.status).value?.toString().trim() || ''
      : ''
    const descriptionValue = columnMapping.description
      ? row.getCell(columnMapping.description).value?.toString().trim() || ''
      : ''
    const priorityValue = columnMapping.priority
      ? row.getCell(columnMapping.priority).value?.toString().trim() || ''
      : ''
    const notesValue = columnMapping.notes
      ? row.getCell(columnMapping.notes).value?.toString().trim() || ''
      : ''

    // Update current categories if provided (for grouped format)
    if (categoryL1Value) {
      currentCategoryL1 = categoryL1Value
    }
    if (categoryL2Value) {
      currentCategoryL2 = categoryL2Value
    }

    // Skip if no item name
    if (!itemValue) {
      warnings.push(`Row ${rowNumber}: Skipping row with no item name`)
      return
    }

    // Clean up category names (remove numbering like "1.", "2.", etc.)
    const cleanCategory = currentCategoryL1.replace(/^[\d.]+\s*/, '').trim()
    const cleanSubcategory = currentCategoryL2.replace(/^[\d.]+\s*/, '').trim()

    // Add to categories set
    if (cleanCategory) {
      categories.add(cleanCategory)
    }

    // Add to subcategories set
    if (cleanSubcategory) {
      subcategories.add(cleanSubcategory)
    }

    // Parse and add item
    items.push({
      category: cleanCategory || 'Uncategorized',
      subcategory: cleanSubcategory || null,
      itemName: itemValue,
      description: descriptionValue || null,
      priority: parsePriority(priorityValue),
      fulfilled: parseStatus(statusValue),
      notes: notesValue || null,
    })
  })

  if (items.length === 0) {
    throw new Error('No items found in Excel file')
  }

  return {
    totalItems: items.length,
    categories: Array.from(categories),
    subcategories: Array.from(subcategories),
    items,
    warnings,
  }
}

/**
 * Parse CSV file and extract IRL items
 *
 * @param buffer - CSV file buffer
 * @returns Preview of imported items
 */
export async function parseCSVIRL(buffer: Buffer): Promise<IRLImportPreview> {
  const content = buffer.toString('utf-8')
  const lines = content.split(/\r?\n/)

  const items: ImportedIRLItem[] = []
  const categories = new Set<string>()
  const subcategories = new Set<string>()
  const warnings: string[] = []

  let headerRow = 0
  let currentCategory = ''

  // Find header row
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const lowercaseLine = line.toLowerCase()
    if (lowercaseLine.includes('category') || lowercaseLine.includes('item')) {
      headerRow = i
      break
    }
  }

  if (headerRow === 0) {
    warnings.push('Could not find header row. Using default column mapping.')
    headerRow = 2 // Default to row 3 (index 2)
  }

  // Parse data rows
  for (let i = headerRow + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue

    // Parse CSV row (simple split - doesn't handle quoted commas)
    const cells = line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim())

    const categoryValue = cells[0] || ''
    const itemValue = cells[1] || ''
    const statusValue = cells[2] || ''
    const descriptionValue = cells[3] || ''
    const priorityValue = cells[4] || ''
    const subcategoryValue = cells[5] || ''
    const notesValue = cells[6] || ''

    // Update current category if provided
    if (categoryValue) {
      currentCategory = categoryValue
    }

    // Skip if no item name
    if (!itemValue) {
      warnings.push(`Row ${i + 1}: Skipping row with no item name`)
      continue
    }

    // Add to categories set
    if (currentCategory) {
      categories.add(currentCategory)
    }

    // Add to subcategories set
    if (subcategoryValue) {
      subcategories.add(subcategoryValue)
    }

    // Parse and add item
    items.push({
      category: currentCategory || 'Uncategorized',
      subcategory: subcategoryValue || null,
      itemName: itemValue,
      description: descriptionValue || null,
      priority: parsePriority(priorityValue),
      fulfilled: parseStatus(statusValue),
      notes: notesValue || null,
    })

    // Limit rows
    if (items.length >= MAX_IMPORT_ROWS) {
      warnings.push(`Import limited to ${MAX_IMPORT_ROWS} rows`)
      break
    }
  }

  if (items.length === 0) {
    throw new Error('No items found in CSV file')
  }

  return {
    totalItems: items.length,
    categories: Array.from(categories),
    subcategories: Array.from(subcategories),
    items,
    warnings,
  }
}

// ============================================================================
// Import to Database
// ============================================================================

/**
 * Import IRL from preview data
 *
 * Creates IRL record, IRL items, and optionally generates folder structure
 *
 * @param supabase - Supabase client
 * @param dealId - Deal ID
 * @param userId - User ID
 * @param preview - Preview data from parse
 * @param irlName - Name for the IRL
 * @param generateFolders - Whether to auto-generate folders
 * @returns Import result with IRL ID and counts
 */
export async function importIRL(
  supabase: SupabaseClientTyped,
  dealId: string,
  userId: string,
  preview: IRLImportPreview,
  irlName: string,
  generateFolders: boolean = true
): Promise<IRLImportResult> {
  try {
    // 1. Create IRL record
    const sectionsData = preview.categories.map(category => ({
      name: category,
      items: preview.items
        .filter(item => item.category === category)
        .map(item => ({
          name: item.itemName,
          description: item.description || '',
          priority: item.priority,
          status: item.fulfilled ? 'fulfilled' : 'not_started',
          subcategory: item.subcategory,
        })),
    }))

    const { data: irl, error: irlError } = await supabase
      .from('irls')
      .insert({
        deal_id: dealId,
        user_id: userId,
        name: irlName,
        template_type: 'custom',
        sections: sectionsData,
        progress_percent: 0,
      })
      .select()
      .single()

    if (irlError || !irl) {
      console.error('[IRL Import] Failed to create IRL:', irlError)
      return { success: false, error: irlError?.message || 'Failed to create IRL' }
    }

    // 2. Create IRL items
    const irlItems = preview.items.map((item, index) => ({
      irl_id: irl.id,
      category: item.category,
      subcategory: item.subcategory,
      item_name: item.itemName,
      description: item.description,
      priority: item.priority,
      status: item.fulfilled ? ('fulfilled' as const) : ('not_started' as const),
      notes: item.notes,
      sort_order: index,
    }))

    const { error: itemsError } = await supabase.from('irl_items').insert(irlItems)

    if (itemsError) {
      console.error('[IRL Import] Failed to create IRL items:', itemsError)
      // Continue anyway - IRL is created, items can be added manually
    }

    // 3. Optionally generate folders
    let foldersCreated = 0
    if (generateFolders) {
      try {
        const { createFoldersFromIRL } = await import('./folders')
        const folderResult = await createFoldersFromIRL(supabase, dealId, irl.id)
        foldersCreated = folderResult.created

        console.log(
          `[IRL Import] Generated ${folderResult.created} folders from IRL ` +
            `(skipped ${folderResult.skipped} existing)`
        )
      } catch (folderError) {
        console.error('[IRL Import] Failed to generate folders:', folderError)
        // Don't fail import if folder generation fails
      }
    }

    return {
      success: true,
      irlId: irl.id,
      itemsCreated: irlItems.length,
      foldersCreated,
    }
  } catch (error) {
    console.error('[IRL Import] Error importing IRL:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import IRL',
    }
  }
}

/**
 * Validate file for IRL import
 *
 * @param file - File to validate
 * @returns Validation result
 */
export function validateIRLFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    }
  }

  // Check MIME type
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Please upload an Excel (.xlsx) or CSV (.csv) file`,
    }
  }

  return { valid: true }
}
