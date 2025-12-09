/**
 * Q&A Import Service
 *
 * Handles Excel import with pattern matching for Q&A items.
 * Story: E8.7 - Excel Import with Pattern Matching
 *
 * Features:
 * - Parse Excel files (category-grouped and flat formats)
 * - Exact matching (case-insensitive question text)
 * - Fuzzy matching (>90% Levenshtein similarity)
 * - New item detection (questions not in system)
 * - Bulk import confirmation with transaction safety
 */

import ExcelJS from 'exceljs'
import levenshtein from 'fast-levenshtein'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  QAItem,
  QACategory,
  QAPriority,
  QA_CATEGORIES,
  QA_PRIORITIES,
  ImportedQARow,
  QAExactMatch,
  QAFuzzyMatch,
  QAImportPreview,
  ImportConfirmation,
  ImportConfirmationResult,
  CreateQAItemInput,
  mapDbRowToQAItem,
} from '@/lib/types/qa'

// Type alias for Supabase client with our database types
type SupabaseClientTyped = SupabaseClient<Database>

// ============================================================================
// Constants
// ============================================================================

/** Maximum rows allowed per import (matching export limit) */
export const MAX_IMPORT_ROWS = 500

/** Maximum file size in bytes (10MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Fuzzy match threshold - matches above this are flagged for review */
export const FUZZY_MATCH_THRESHOLD = 0.90

/** MIME types accepted for import */
export const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]

/** Category header detection pattern */
const CATEGORY_HEADER_PATTERN = /^(Financials|Legal|Operations|Market|Technology|HR)\s*\(\d+\s*items?\)/i

/** Priority label to value mapping */
const PRIORITY_MAP: Record<string, QAPriority> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
}

// ============================================================================
// Text Normalization
// ============================================================================

/**
 * Normalize question text for comparison
 * - Trim whitespace
 * - Normalize unicode characters
 * - Convert to lowercase
 *
 * @param text - Raw question text
 * @returns Normalized text for comparison
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Calculate Levenshtein similarity between two strings
 * AC: #3 - >90% Levenshtein similarity ratio
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Similarity ratio between 0 and 1
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const normalized1 = normalizeText(s1)
  const normalized2 = normalizeText(s2)

  if (normalized1 === normalized2) return 1

  const distance = levenshtein.get(normalized1, normalized2)
  const maxLength = Math.max(normalized1.length, normalized2.length)

  if (maxLength === 0) return 1

  return 1 - distance / maxLength
}

// ============================================================================
// Excel Parsing
// ============================================================================

/**
 * Parse priority string from Excel cell
 *
 * @param value - Cell value (string or undefined)
 * @returns QAPriority or null if invalid
 */
function parsePriority(value: unknown): QAPriority | null {
  if (!value || typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return PRIORITY_MAP[normalized] ?? null
}

/**
 * Parse category from Excel row or header
 *
 * @param value - Cell value or header text
 * @returns QACategory or null if invalid
 */
function parseCategory(value: unknown): QACategory | null {
  if (!value || typeof value !== 'string') return null

  // Check for category header pattern first
  const headerMatch = value.match(CATEGORY_HEADER_PATTERN)
  if (headerMatch) {
    const categoryName = headerMatch[1]
    if (QA_CATEGORIES.includes(categoryName as QACategory)) {
      return categoryName as QACategory
    }
  }

  // Check for direct category match
  const normalized = value.trim()
  if (QA_CATEGORIES.includes(normalized as QACategory)) {
    return normalized as QACategory
  }

  return null
}

/**
 * Parse date string from Excel cell
 *
 * @param value - Cell value (Date, string, or undefined)
 * @returns ISO date string or null
 */
function parseDate(value: unknown): string | null {
  if (!value) return null

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    // Try to parse the date string
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return null
}

/**
 * Get cell value as string, handling rich text
 */
function getCellString(cell: ExcelJS.Cell): string {
  const value = cell.value

  if (value === null || value === undefined) return ''

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return (value.richText as { text: string }[])
      .map(rt => rt.text)
      .join('')
  }

  return String(value)
}

/**
 * Parse Q&A data from Excel file buffer
 * AC: #1 - Parse uploaded Excel file
 *
 * Supports two formats:
 * 1. Category-grouped format (from our export): Headers with category rows
 * 2. Flat format: Simple table with all rows
 *
 * @param buffer - Excel file buffer
 * @returns Array of parsed Q&A rows
 */
export async function parseQAExcel(buffer: Buffer | ArrayBuffer): Promise<ImportedQARow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ArrayBuffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Excel file contains no worksheets')
  }

  const rows: ImportedQARow[] = []
  let currentCategory: QACategory | null = null
  let hasHeader = false
  let questionColIndex = 1
  let priorityColIndex = 2
  let answerColIndex = 3
  let dateColIndex = 4

  // First, detect the format by looking at the first few rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Check if first row is a header row
      const firstCell = getCellString(row.getCell(1)).toLowerCase()
      if (firstCell.includes('question')) {
        hasHeader = true

        // Find column indices from header
        row.eachCell((cell, colNumber) => {
          const header = getCellString(cell).toLowerCase()
          if (header.includes('question')) questionColIndex = colNumber
          else if (header.includes('priority')) priorityColIndex = colNumber
          else if (header.includes('answer')) answerColIndex = colNumber
          else if (header.includes('date')) dateColIndex = colNumber
        })
      }
    }
  })

  // Now parse the data rows
  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (hasHeader && rowNumber === 1) return

    // Get cell values
    const firstCellValue = getCellString(row.getCell(1))

    // Check if this is a category header row (merged cells or category pattern)
    const categoryFromHeader = parseCategory(firstCellValue)
    if (categoryFromHeader) {
      // Check if this is a merged cell spanning multiple columns (category header)
      const firstCell = row.getCell(1)
      if (firstCell.isMerged || CATEGORY_HEADER_PATTERN.test(firstCellValue)) {
        currentCategory = categoryFromHeader
        return // Skip this row, it's just a category header
      }
    }

    // Skip empty rows
    if (!firstCellValue.trim()) {
      return
    }

    // Parse data row
    const question = firstCellValue.trim()
    const priority = parsePriority(getCellString(row.getCell(priorityColIndex)))
    const answer = getCellString(row.getCell(answerColIndex)).trim() || null
    const dateAnswered = parseDate(row.getCell(dateColIndex).value)

    // Only add if we have a valid question
    if (question && question.length > 0) {
      rows.push({
        question,
        priority,
        answer,
        dateAnswered,
        category: currentCategory,
        rowNumber,
      })
    }
  })

  // Validate row count
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import exceeds maximum of ${MAX_IMPORT_ROWS} rows. Found ${rows.length} rows.`)
  }

  return rows
}

// ============================================================================
// Matching Logic
// ============================================================================

/**
 * Match imported rows against existing Q&A items
 * AC: #2, #3, #4 - Exact, fuzzy, and new item detection
 *
 * Algorithm:
 * 1. Build a Map of normalized existing questions for O(1) exact matching
 * 2. For each imported row:
 *    a. Check for exact match (case-insensitive)
 *    b. If no exact match, check for fuzzy match (>90% similarity)
 *    c. If no match, mark as new item
 * 3. Handle conflicts: if multiple matches, pick highest similarity
 *
 * @param imported - Parsed imported rows
 * @param existing - Existing Q&A items in the project
 * @returns Import preview with categorized matches
 */
export function matchImportedRows(
  imported: ImportedQARow[],
  existing: QAItem[]
): QAImportPreview {
  const exactMatches: QAExactMatch[] = []
  const fuzzyMatches: QAFuzzyMatch[] = []
  const newItems: ImportedQARow[] = []

  // Build normalized question → item map for O(1) exact matching
  const normalizedMap = new Map<string, QAItem>()
  for (const item of existing) {
    normalizedMap.set(normalizeText(item.question), item)
  }

  // Track which existing items have been matched to avoid duplicates
  const matchedExistingIds = new Set<string>()

  for (const importedRow of imported) {
    const normalizedQuestion = normalizeText(importedRow.question)

    // 1. Check for exact match
    const exactMatch = normalizedMap.get(normalizedQuestion)
    if (exactMatch && !matchedExistingIds.has(exactMatch.id)) {
      exactMatches.push({
        existing: exactMatch,
        imported: importedRow,
      })
      matchedExistingIds.add(exactMatch.id)
      continue
    }

    // 2. Check for fuzzy match (only against unmatched items)
    let bestMatch: { item: QAItem; similarity: number } | null = null

    for (const existingItem of existing) {
      // Skip already matched items
      if (matchedExistingIds.has(existingItem.id)) continue

      const similarity = calculateSimilarity(importedRow.question, existingItem.question)

      if (similarity > FUZZY_MATCH_THRESHOLD) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { item: existingItem, similarity }
        }
      }
    }

    if (bestMatch) {
      fuzzyMatches.push({
        existing: bestMatch.item,
        imported: importedRow,
        similarity: bestMatch.similarity,
      })
      matchedExistingIds.add(bestMatch.item.id)
      continue
    }

    // 3. No match found - mark as new item
    newItems.push(importedRow)
  }

  // Sort fuzzy matches by similarity (highest first)
  fuzzyMatches.sort((a, b) => b.similarity - a.similarity)

  return {
    exactMatches,
    fuzzyMatches,
    newItems,
    stats: {
      totalImported: imported.length,
      exactCount: exactMatches.length,
      fuzzyCount: fuzzyMatches.length,
      newCount: newItems.length,
    },
  }
}

// ============================================================================
// Import Confirmation
// ============================================================================

/**
 * Confirm and execute import
 * AC: #5, #6 - Merge approved items with answer and date_answered
 *
 * @param supabase - Supabase client
 * @param preview - Import preview from matchImportedRows
 * @param confirmation - User's import decisions
 * @returns Result with updated and created items
 */
export async function confirmImport(
  supabase: SupabaseClientTyped,
  preview: QAImportPreview,
  confirmation: ImportConfirmation
): Promise<ImportConfirmationResult> {
  const updatedItems: QAItem[] = []
  const createdItems: QAItem[] = []
  let exactUpdated = 0
  let fuzzyUpdated = 0
  let newCreated = 0
  let skipped = 0

  const importTimestamp = new Date().toISOString()

  // Process exact matches
  const exactMatchesToProcess = preview.exactMatches.filter(
    match => confirmation.exactMatchIds.includes(match.existing.id)
  )

  for (const match of exactMatchesToProcess) {
    // Only update if there's an answer to import
    if (match.imported.answer) {
      const { data, error } = await supabase
        .from('qa_items')
        .update({
          answer: match.imported.answer,
          date_answered: match.imported.dateAnswered || importTimestamp,
        })
        .eq('id', match.existing.id)
        .select('*')
        .single()

      if (error) {
        console.error(`Failed to update exact match ${match.existing.id}:`, error)
        skipped++
        continue
      }

      updatedItems.push(mapDbRowToQAItem(data))
      exactUpdated++
    } else {
      // No answer to import, skip
      skipped++
    }
  }

  // Skip exact matches not in the list
  skipped += preview.exactMatches.length - exactMatchesToProcess.length - skipped

  // Process fuzzy matches based on decisions
  for (const match of preview.fuzzyMatches) {
    const decision = confirmation.fuzzyMatchDecisions[match.existing.id]

    if (decision === 'accept' && match.imported.answer) {
      const { data, error } = await supabase
        .from('qa_items')
        .update({
          answer: match.imported.answer,
          date_answered: match.imported.dateAnswered || importTimestamp,
        })
        .eq('id', match.existing.id)
        .select('*')
        .single()

      if (error) {
        console.error(`Failed to update fuzzy match ${match.existing.id}:`, error)
        skipped++
        continue
      }

      updatedItems.push(mapDbRowToQAItem(data))
      fuzzyUpdated++
    } else {
      skipped++
    }
  }

  // Process new items
  if (confirmation.importNewItems && confirmation.newItemsToImport) {
    for (const newItem of confirmation.newItemsToImport) {
      // Determine category - use imported category or default to 'Operations'
      const category: QACategory = newItem.category || 'Operations'
      const priority: QAPriority = newItem.priority || 'medium'

      const insertData: {
        deal_id: string
        question: string
        category: QACategory
        priority: QAPriority
        answer: string | null
        date_answered: string | null
      } = {
        deal_id: confirmation.projectId,
        question: newItem.question,
        category,
        priority,
        answer: newItem.answer,
        date_answered: newItem.answer ? (newItem.dateAnswered || importTimestamp) : null,
      }

      const { data, error } = await supabase
        .from('qa_items')
        .insert(insertData)
        .select('*')
        .single()

      if (error) {
        console.error(`Failed to create new item:`, error)
        skipped++
        continue
      }

      createdItems.push(mapDbRowToQAItem(data))
      newCreated++
    }
  }

  return {
    updatedItems,
    createdItems,
    stats: {
      exactUpdated,
      fuzzyUpdated,
      newCreated,
      skipped,
      total: exactUpdated + fuzzyUpdated + newCreated,
    },
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate uploaded file
 *
 * @param file - File to validate
 * @throws Error if validation fails
 */
export function validateUploadedFile(file: File): void {
  // Check MIME type
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Please upload an Excel file (.xlsx)')
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  // Check file is not empty
  if (file.size === 0) {
    throw new Error('Uploaded file is empty')
  }
}

/**
 * Validate buffer content
 *
 * @param buffer - Buffer to validate
 * @throws Error if validation fails
 */
export function validateBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty')
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }
}