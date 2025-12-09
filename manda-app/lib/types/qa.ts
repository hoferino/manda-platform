/**
 * Q&A Types
 *
 * TypeScript interfaces for Q&A Co-Creation Workflow
 * Story: E8.1 - Q&A Data Model and CRUD API
 *
 * Q&A items are questions sent to the CLIENT to answer (not AI-generated answers).
 * Used during document analysis when gaps/inconsistencies cannot be resolved from knowledge base.
 * Status is derived from date_answered (NULL = pending, NOT NULL = answered).
 */

import { z } from 'zod'

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * Q&A item categories matching M&A domain areas
 */
export const QA_CATEGORIES = [
  'Financials',
  'Legal',
  'Operations',
  'Market',
  'Technology',
  'HR',
] as const
export type QACategory = (typeof QA_CATEGORIES)[number]

/**
 * Q&A item priority levels
 */
export const QA_PRIORITIES = ['high', 'medium', 'low'] as const
export type QAPriority = (typeof QA_PRIORITIES)[number]

// ============================================================================
// Core Types
// ============================================================================

/**
 * A Q&A item stored in the database
 */
export interface QAItem {
  id: string
  dealId: string
  question: string
  category: QACategory
  priority: QAPriority
  answer: string | null
  comment: string | null
  sourceFindingId: string | null
  createdBy: string | null
  dateAdded: string
  dateAnswered: string | null
  updatedAt: string
}

/**
 * Input for creating a new Q&A item
 * AC: #1 - POST /qa with valid input returns 201
 */
export interface CreateQAItemInput {
  question: string
  category: QACategory
  priority?: QAPriority
  sourceFindingId?: string
  comment?: string
}

/**
 * Input for updating an existing Q&A item
 * AC: #3, #4 - PUT with updated_at for optimistic locking
 */
export interface UpdateQAItemInput {
  question?: string
  category?: QACategory
  priority?: QAPriority
  answer?: string | null
  comment?: string | null
  dateAnswered?: string | null
  updatedAt: string // Required for optimistic locking
}

/**
 * Conflict error returned when optimistic locking fails
 * AC: #4 - PUT with stale updated_at returns 409 Conflict
 */
export interface QAConflictError {
  type: 'conflict'
  message: string
  currentItem: QAItem
  yourChanges: Partial<UpdateQAItemInput>
}

/**
 * Filters for querying Q&A items
 * AC: #2 - GET /qa returns list filtered by category, priority, status
 */
export interface QAFilters {
  category?: QACategory
  priority?: QAPriority
  status?: 'pending' | 'answered'
  limit?: number
  offset?: number
}

/**
 * Summary statistics for Q&A items
 * AC: #7 - GET /qa/summary returns aggregate stats
 */
export interface QASummary {
  total: number
  pending: number
  answered: number
  byCategory: Record<QACategory, number>
  byPriority: Record<QAPriority, number>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a Q&A item is pending (not yet answered)
 */
export function isPending(item: QAItem): boolean {
  return item.dateAnswered === null
}

/**
 * Check if a Q&A item has been answered
 */
export function isAnswered(item: QAItem): boolean {
  return item.dateAnswered !== null
}

/**
 * Get the status of a Q&A item based on dateAnswered
 */
export function getQAItemStatus(item: QAItem): 'pending' | 'answered' {
  return isPending(item) ? 'pending' : 'answered'
}

/**
 * Check if an error is a QAConflictError
 */
export function isQAConflictError(error: unknown): error is QAConflictError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as QAConflictError).type === 'conflict'
  )
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for validating Q&A category
 */
export const QACategorySchema = z.enum(QA_CATEGORIES)

/**
 * Schema for validating Q&A priority
 */
export const QAPrioritySchema = z.enum(QA_PRIORITIES)

/**
 * Schema for creating a Q&A item
 */
export const CreateQAItemInputSchema = z.object({
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(2000, 'Question must be 2000 characters or less'),
  category: QACategorySchema,
  priority: QAPrioritySchema.default('medium'),
  sourceFindingId: z.string().uuid().optional(),
  comment: z.string().max(2000, 'Comment must be 2000 characters or less').optional(),
})

/**
 * Schema for updating a Q&A item with optimistic locking
 */
export const UpdateQAItemInputSchema = z.object({
  question: z
    .string()
    .min(10, 'Question must be at least 10 characters')
    .max(2000, 'Question must be 2000 characters or less')
    .optional(),
  category: QACategorySchema.optional(),
  priority: QAPrioritySchema.optional(),
  answer: z.string().max(10000, 'Answer must be 10000 characters or less').nullable().optional(),
  comment: z.string().max(2000, 'Comment must be 2000 characters or less').nullable().optional(),
  dateAnswered: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime({ message: 'updatedAt is required for optimistic locking' }),
})

/**
 * Schema for Q&A filters
 */
export const QAFiltersSchema = z.object({
  category: QACategorySchema.optional(),
  priority: QAPrioritySchema.optional(),
  status: z.enum(['pending', 'answered']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ============================================================================
// Display Configuration
// ============================================================================

/**
 * Category display configuration with colors
 */
export const QA_CATEGORY_CONFIG: Record<QACategory, { label: string; color: string }> = {
  Financials: { label: 'Financials', color: 'bg-green-500 text-white' },
  Legal: { label: 'Legal', color: 'bg-purple-500 text-white' },
  Operations: { label: 'Operations', color: 'bg-blue-500 text-white' },
  Market: { label: 'Market', color: 'bg-amber-500 text-white' },
  Technology: { label: 'Technology', color: 'bg-cyan-500 text-white' },
  HR: { label: 'HR', color: 'bg-pink-500 text-white' },
}

/**
 * Priority display configuration with colors
 */
export const QA_PRIORITY_CONFIG: Record<QAPriority, { label: string; color: string }> = {
  high: { label: 'High', color: 'bg-red-500 text-white' },
  medium: { label: 'Medium', color: 'bg-yellow-500 text-white' },
  low: { label: 'Low', color: 'bg-gray-500 text-white' },
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: QACategory) {
  return QA_CATEGORY_CONFIG[category] || { label: category, color: 'bg-gray-500 text-white' }
}

/**
 * Get priority display info
 */
export function getPriorityInfo(priority: QAPriority) {
  return QA_PRIORITY_CONFIG[priority] || { label: priority, color: 'bg-gray-500 text-white' }
}

// ============================================================================
// Database Row Mapping
// ============================================================================

/**
 * Database row type matching Supabase generated types
 * Some fields are nullable in the database schema
 */
export interface QAItemDbRow {
  id: string
  deal_id: string
  question: string
  category: string
  priority: string | null
  answer: string | null
  comment: string | null
  source_finding_id: string | null
  created_by: string | null
  date_added: string | null
  date_answered: string | null
  updated_at: string | null
}

/**
 * Map database row to QAItem interface
 * Handles snake_case to camelCase conversion and nullable defaults
 */
export function mapDbRowToQAItem(row: QAItemDbRow): QAItem {
  return {
    id: row.id,
    dealId: row.deal_id,
    question: row.question,
    category: row.category as QACategory,
    priority: (row.priority as QAPriority) ?? 'medium',
    answer: row.answer,
    comment: row.comment,
    sourceFindingId: row.source_finding_id,
    createdBy: row.created_by,
    dateAdded: row.date_added ?? new Date().toISOString(),
    dateAnswered: row.date_answered,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

/**
 * Map QAItem to database insert format
 */
export function mapQAItemToDbInsert(input: CreateQAItemInput, dealId: string, userId?: string) {
  return {
    deal_id: dealId,
    question: input.question,
    category: input.category,
    priority: input.priority ?? 'medium',
    source_finding_id: input.sourceFindingId ?? null,
    comment: input.comment ?? null,
    created_by: userId ?? null,
  }
}

/**
 * Map UpdateQAItemInput to database update format
 * Excludes updatedAt as it's managed by trigger
 */
export function mapQAItemToDbUpdate(input: Omit<UpdateQAItemInput, 'updatedAt'>) {
  const update: Record<string, unknown> = {}

  if (input.question !== undefined) update.question = input.question
  if (input.category !== undefined) update.category = input.category
  if (input.priority !== undefined) update.priority = input.priority
  if (input.answer !== undefined) update.answer = input.answer
  if (input.comment !== undefined) update.comment = input.comment
  if (input.dateAnswered !== undefined) update.date_answered = input.dateAnswered

  return update
}

/**
 * Calculate summary stats from Q&A items
 */
export function calculateQASummary(items: QAItem[]): QASummary {
  const summary: QASummary = {
    total: items.length,
    pending: 0,
    answered: 0,
    byCategory: {
      Financials: 0,
      Legal: 0,
      Operations: 0,
      Market: 0,
      Technology: 0,
      HR: 0,
    },
    byPriority: {
      high: 0,
      medium: 0,
      low: 0,
    },
  }

  for (const item of items) {
    // Count by status
    if (isPending(item)) {
      summary.pending++
    } else {
      summary.answered++
    }

    // Count by category
    if (item.category in summary.byCategory) {
      summary.byCategory[item.category]++
    }

    // Count by priority
    if (item.priority in summary.byPriority) {
      summary.byPriority[item.priority]++
    }
  }

  return summary
}