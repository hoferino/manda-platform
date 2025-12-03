/**
 * IRL (Information Request List) Types
 *
 * TypeScript interfaces for IRL management and templates
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 */

import { z } from 'zod'

// ============================================================================
// Enums and Constants
// ============================================================================

export const IRL_DEAL_TYPES = ['tech_ma', 'industrial', 'pharma', 'financial', 'custom'] as const
export type IRLDealType = (typeof IRL_DEAL_TYPES)[number]

export const IRL_PRIORITIES = ['high', 'medium', 'low'] as const
export type IRLPriority = (typeof IRL_PRIORITIES)[number]

export const IRL_ITEM_STATUSES = ['not_started', 'pending', 'received', 'complete'] as const
export type IRLItemStatus = (typeof IRL_ITEM_STATUSES)[number]

// ============================================================================
// Template Types (Static JSON files)
// ============================================================================

/**
 * A single item in an IRL template
 */
export interface IRLTemplateItem {
  name: string
  description?: string
  priority: IRLPriority
}

/**
 * A category in an IRL template containing items
 */
export interface IRLTemplateCategory {
  name: string
  items: IRLTemplateItem[]
}

/**
 * An IRL template loaded from JSON
 */
export interface IRLTemplate {
  id: string
  name: string
  description: string
  dealType: IRLDealType
  categories: IRLTemplateCategory[]
}

// ============================================================================
// Database Types (PostgreSQL)
// ============================================================================

/**
 * An IRL record stored in the database
 */
export interface IRL {
  id: string
  dealId: string
  title: string
  templateType?: string
  sourceFileName?: string
  createdAt: string
  updatedAt: string
}

/**
 * An IRL item record stored in the database
 */
export interface IRLItem {
  id: string
  irlId: string
  category: string
  subcategory?: string
  itemName: string
  description?: string
  priority: IRLPriority
  status: IRLItemStatus
  fulfilled: boolean
  notes?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * A folder record stored in the database
 */
export interface Folder {
  id: string
  dealId: string
  parentId?: string
  name: string
  gcsPath: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  children?: Folder[]
}

// ============================================================================
// Progress and Statistics
// ============================================================================

/**
 * Progress tracking for an IRL (legacy status-based)
 */
export interface IRLProgress {
  total: number
  notStarted: number
  pending: number
  received: number
  complete: number
  percentComplete: number
}

/**
 * Calculate progress from IRL items (legacy status-based)
 */
export function calculateIRLProgress(items: IRLItem[]): IRLProgress {
  const total = items.length
  const notStarted = items.filter(i => i.status === 'not_started').length
  const pending = items.filter(i => i.status === 'pending').length
  const received = items.filter(i => i.status === 'received').length
  const complete = items.filter(i => i.status === 'complete').length
  const percentComplete = total > 0 ? Math.round((complete / total) * 100) : 0

  return { total, notStarted, pending, received, complete, percentComplete }
}

/**
 * Progress tracking for an IRL (binary fulfilled-based)
 * Used for the manual checklist in Data Room sidebar
 */
export interface IRLFulfilledProgress {
  total: number
  fulfilled: number
  unfulfilled: number
  percentComplete: number
}

/**
 * Progress tracking for a single IRL category
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 */
export interface IRLProgressByCategory {
  category: string
  fulfilled: number
  total: number
  percentComplete: number
}

/**
 * Extended progress with category-level breakdown
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 */
export interface IRLFulfilledProgressWithCategories extends IRLFulfilledProgress {
  byCategory: IRLProgressByCategory[]
}

/**
 * Calculate progress from IRL items based on fulfilled boolean
 * Used for the manual checklist in Data Room sidebar
 */
export function calculateIRLFulfilledProgress(items: IRLItem[]): IRLFulfilledProgress {
  const total = items.length
  const fulfilled = items.filter(i => i.fulfilled).length
  const unfulfilled = total - fulfilled
  const percentComplete = total > 0 ? Math.round((fulfilled / total) * 100) : 0

  return { total, fulfilled, unfulfilled, percentComplete }
}

/**
 * Calculate progress by category from IRL items
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 */
export function calculateIRLProgressByCategory(items: IRLItem[]): IRLProgressByCategory[] {
  // Group items by category
  const categoryMap: Record<string, IRLItem[]> = {}
  for (const item of items) {
    if (!categoryMap[item.category]) {
      categoryMap[item.category] = []
    }
    categoryMap[item.category]!.push(item)
  }

  // Calculate progress for each category
  return Object.entries(categoryMap).map(([category, categoryItems]) => {
    const total = categoryItems.length
    const fulfilled = categoryItems.filter(i => i.fulfilled).length
    const percentComplete = total > 0 ? Math.round((fulfilled / total) * 100) : 0

    return { category, fulfilled, total, percentComplete }
  })
}

/**
 * Calculate overall progress with category-level breakdown
 * Story: E6.7 - Build IRL Checklist Progress Visualization
 */
export function calculateIRLFulfilledProgressWithCategories(
  items: IRLItem[]
): IRLFulfilledProgressWithCategories {
  const overall = calculateIRLFulfilledProgress(items)
  const byCategory = calculateIRLProgressByCategory(items)

  return { ...overall, byCategory }
}

// ============================================================================
// Display Configuration
// ============================================================================

/**
 * Deal type display configuration
 */
export const IRL_DEAL_TYPE_CONFIG: Record<IRLDealType, { label: string; color: string }> = {
  tech_ma: { label: 'Tech M&A', color: 'bg-blue-500' },
  industrial: { label: 'Industrial', color: 'bg-slate-500' },
  pharma: { label: 'Pharma', color: 'bg-green-500' },
  financial: { label: 'Financial Services', color: 'bg-amber-500' },
  custom: { label: 'Custom', color: 'bg-purple-500' },
}

/**
 * Priority display configuration
 */
export const IRL_PRIORITY_CONFIG: Record<IRLPriority, { label: string; color: string }> = {
  high: { label: 'High', color: 'bg-red-500 text-white' },
  medium: { label: 'Medium', color: 'bg-yellow-500 text-white' },
  low: { label: 'Low', color: 'bg-green-500 text-white' },
}

/**
 * Status display configuration with icons
 */
export const IRL_STATUS_CONFIG: Record<
  IRLItemStatus,
  { label: string; icon: string; color: string }
> = {
  not_started: { label: 'Not Started', icon: '○', color: 'text-gray-400' },
  pending: { label: 'Pending', icon: '⏱', color: 'text-yellow-500' },
  received: { label: 'Received', icon: '✓', color: 'text-blue-500' },
  complete: { label: 'Complete', icon: '✅', color: 'text-green-500' },
}

/**
 * Get deal type display info
 */
export function getDealTypeInfo(dealType: IRLDealType) {
  return IRL_DEAL_TYPE_CONFIG[dealType] || { label: dealType, color: 'bg-gray-500' }
}

/**
 * Get priority display info
 */
export function getPriorityInfo(priority: IRLPriority) {
  return IRL_PRIORITY_CONFIG[priority] || { label: priority, color: 'bg-gray-500' }
}

/**
 * Get status display info
 */
export function getStatusInfo(status: IRLItemStatus) {
  return IRL_STATUS_CONFIG[status] || { label: status, icon: '?', color: 'text-gray-500' }
}

/**
 * Count total items across all categories in a template
 */
export function countTemplateItems(template: IRLTemplate): number {
  return template.categories.reduce((sum, cat) => sum + cat.items.length, 0)
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Template item schema
 */
export const IRLTemplateItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  priority: z.enum(IRL_PRIORITIES),
})

/**
 * Template category schema
 */
export const IRLTemplateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  items: z.array(IRLTemplateItemSchema).min(1, 'Category must have at least one item'),
})

/**
 * Full template schema (for validating JSON files)
 */
export const IRLTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  dealType: z.enum(IRL_DEAL_TYPES),
  categories: z.array(IRLTemplateCategorySchema).min(1, 'Template must have at least one category'),
})

/**
 * IRL creation request schema
 */
export const CreateIRLRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less'),
  templateId: z.string().optional(),
})
export type CreateIRLRequest = z.infer<typeof CreateIRLRequestSchema>

/**
 * IRL update request schema
 */
export const UpdateIRLRequestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
})
export type UpdateIRLRequest = z.infer<typeof UpdateIRLRequestSchema>

/**
 * IRL item creation schema
 */
export const CreateIRLItemRequestSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().optional(),
  itemName: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  priority: z.enum(IRL_PRIORITIES).default('medium'),
  notes: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
})
export type CreateIRLItemRequest = z.infer<typeof CreateIRLItemRequestSchema>

/**
 * IRL item update schema
 */
export const UpdateIRLItemRequestSchema = z.object({
  category: z.string().min(1).optional(),
  subcategory: z.string().nullable().optional(),
  itemName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(IRL_PRIORITIES).optional(),
  status: z.enum(IRL_ITEM_STATUSES).optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})
export type UpdateIRLItemRequest = z.infer<typeof UpdateIRLItemRequestSchema>

/**
 * IRL item status update schema
 */
export const UpdateIRLItemStatusRequestSchema = z.object({
  status: z.enum(IRL_ITEM_STATUSES),
})
export type UpdateIRLItemStatusRequest = z.infer<typeof UpdateIRLItemStatusRequestSchema>

/**
 * IRL item fulfilled update schema (binary toggle for checklist)
 */
export const UpdateIRLItemFulfilledRequestSchema = z.object({
  fulfilled: z.boolean(),
})
export type UpdateIRLItemFulfilledRequest = z.infer<typeof UpdateIRLItemFulfilledRequestSchema>

/**
 * IRL items reorder request schema
 */
export const ReorderIRLItemsRequestSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
      category: z.string().optional(), // For cross-category drag
    })
  ).min(1, 'At least one item required'),
})
export type ReorderIRLItemsRequest = z.infer<typeof ReorderIRLItemsRequestSchema>

/**
 * Add category request schema
 */
export const AddCategoryRequestSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Category name too long'),
})
export type AddCategoryRequest = z.infer<typeof AddCategoryRequestSchema>

/**
 * Rename category request schema
 */
export const RenameCategoryRequestSchema = z.object({
  oldName: z.string().min(1),
  newName: z.string().min(1, 'New category name is required').max(100, 'Category name too long'),
})
export type RenameCategoryRequest = z.infer<typeof RenameCategoryRequestSchema>

// ============================================================================
// Response Types
// ============================================================================

/**
 * IRL with its items included
 */
export interface IRLWithItems extends IRL {
  items: IRLItem[]
}

/**
 * Template list response
 */
export interface TemplatesResponse {
  templates: IRLTemplate[]
}

/**
 * IRL list response
 */
export interface IRLsResponse {
  irls: IRL[]
}

/**
 * IRL creation response
 */
export interface CreateIRLResponse {
  irl: IRL
  items?: IRLItem[]
}
