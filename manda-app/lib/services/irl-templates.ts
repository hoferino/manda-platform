/**
 * IRL Template Service
 *
 * Loads and manages IRL templates from static JSON files.
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 *
 * Features:
 * - Dynamic template discovery from filesystem
 * - Template validation with Zod schemas
 * - Caching for performance
 * - Type-safe template access
 */

import fs from 'fs'
import path from 'path'
import { IRLTemplate, IRLTemplateSchema } from '@/lib/types/irl'

// Path to templates directory relative to project root
const TEMPLATES_DIR = path.join(process.cwd(), 'packages/shared/templates/irls')

// Module-level cache for templates
let templatesCache: IRLTemplate[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 60 * 1000 // 1 minute cache TTL for dev mode hot reload

/**
 * Clear the template cache
 * Useful for testing or when templates are updated
 */
export function clearTemplateCache(): void {
  templatesCache = null
  cacheTimestamp = 0
}

/**
 * Check if the cache is still valid
 */
function isCacheValid(): boolean {
  if (!templatesCache) return false
  const now = Date.now()
  return now - cacheTimestamp < CACHE_TTL_MS
}

/**
 * Load and validate a single template from a JSON file
 */
function loadTemplateFromFile(filePath: string): IRLTemplate | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)

    // Validate with Zod schema
    const result = IRLTemplateSchema.safeParse(data)

    if (!result.success) {
      console.error(`Invalid template file ${filePath}:`, result.error.format())
      return null
    }

    return result.data
  } catch (error) {
    console.error(`Error loading template ${filePath}:`, error)
    return null
  }
}

/**
 * List all available IRL templates
 * Scans the templates directory for JSON files
 *
 * @returns Array of validated IRL templates
 */
export async function listTemplates(): Promise<IRLTemplate[]> {
  // Return cached templates if still valid
  if (isCacheValid() && templatesCache) {
    return templatesCache
  }

  const templates: IRLTemplate[] = []

  try {
    // Check if directory exists
    if (!fs.existsSync(TEMPLATES_DIR)) {
      console.warn(`Templates directory not found: ${TEMPLATES_DIR}`)
      return templates
    }

    // Read all JSON files from the templates directory
    const files = fs.readdirSync(TEMPLATES_DIR)
      .filter(file => file.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(TEMPLATES_DIR, file)
      const template = loadTemplateFromFile(filePath)

      if (template) {
        templates.push(template)
      }
    }

    // Sort templates by name for consistent ordering
    templates.sort((a, b) => a.name.localeCompare(b.name))

    // Update cache
    templatesCache = templates
    cacheTimestamp = Date.now()

  } catch (error) {
    console.error('Error listing templates:', error)
    throw new Error('Failed to load IRL templates')
  }

  return templates
}

/**
 * Get a single template by ID
 *
 * @param templateId - The template ID to look up
 * @returns The template or null if not found
 */
export async function getTemplate(templateId: string): Promise<IRLTemplate | null> {
  // First try the cache
  const templates = await listTemplates()
  const cached = templates.find(t => t.id === templateId)

  if (cached) {
    return cached
  }

  // Template not found in cache, try loading directly
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`)

  if (fs.existsSync(filePath)) {
    const template = loadTemplateFromFile(filePath)

    if (template) {
      // Add to cache
      if (templatesCache) {
        templatesCache.push(template)
      }
      return template
    }
  }

  return null
}

/**
 * Check if a template exists
 *
 * @param templateId - The template ID to check
 * @returns True if template exists
 */
export async function templateExists(templateId: string): Promise<boolean> {
  const template = await getTemplate(templateId)
  return template !== null
}

/**
 * Get template IDs without loading full templates
 * Useful for quick existence checks
 *
 * @returns Array of template IDs
 */
export function getTemplateIds(): string[] {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      return []
    }

    return fs.readdirSync(TEMPLATES_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'))
  } catch (error) {
    console.error('Error getting template IDs:', error)
    return []
  }
}

/**
 * Get template summary (name and item count) without full category data
 *
 * @param templateId - The template ID
 * @returns Summary with name and total items, or null
 */
export async function getTemplateSummary(templateId: string): Promise<{
  id: string
  name: string
  description: string
  dealType: string
  totalItems: number
  categoryCount: number
} | null> {
  const template = await getTemplate(templateId)

  if (!template) {
    return null
  }

  const totalItems = template.categories.reduce(
    (sum, category) => sum + category.items.length,
    0
  )

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    dealType: template.dealType,
    totalItems,
    categoryCount: template.categories.length,
  }
}
