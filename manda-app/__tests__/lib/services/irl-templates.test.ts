/**
 * IRL Template Service Tests
 *
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 * ACs: 1, 2, 3, 4, 5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  listTemplates,
  getTemplate,
  templateExists,
  getTemplateIds,
  getTemplateSummary,
  clearTemplateCache,
} from '@/lib/services/irl-templates'
import { IRLTemplateSchema } from '@/lib/types/irl'

describe('irl-templates service', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearTemplateCache()
  })

  describe('listTemplates', () => {
    it('should return all templates from the templates directory', async () => {
      const templates = await listTemplates()

      expect(templates).toBeInstanceOf(Array)
      expect(templates.length).toBeGreaterThanOrEqual(4) // At least 4 base templates
    })

    it('should return templates sorted by name', async () => {
      const templates = await listTemplates()

      const names = templates.map(t => t.name)
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b))

      expect(names).toEqual(sortedNames)
    })

    it('should include Tech M&A, Industrial, Pharma, and Financial Services templates (AC1)', async () => {
      const templates = await listTemplates()
      const ids = templates.map(t => t.id)

      expect(ids).toContain('tech-ma')
      expect(ids).toContain('industrial')
      expect(ids).toContain('pharma')
      expect(ids).toContain('financial-services')
    })

    it('should return cached results on subsequent calls', async () => {
      const templates1 = await listTemplates()
      const templates2 = await listTemplates()

      expect(templates1).toBe(templates2) // Same reference
    })
  })

  describe('getTemplate', () => {
    it('should return a template by ID', async () => {
      const template = await getTemplate('tech-ma')

      expect(template).not.toBeNull()
      expect(template?.id).toBe('tech-ma')
      expect(template?.name).toBe('Tech M&A')
    })

    it('should return null for non-existent template', async () => {
      const template = await getTemplate('non-existent')

      expect(template).toBeNull()
    })

    it('should validate template structure against schema (AC3)', async () => {
      const template = await getTemplate('tech-ma')

      const result = IRLTemplateSchema.safeParse(template)
      expect(result.success).toBe(true)
    })
  })

  describe('template structure validation (AC2, AC3)', () => {
    it('each template should have 5-10 items per category (AC2)', async () => {
      const templates = await listTemplates()

      for (const template of templates) {
        for (const category of template.categories) {
          expect(category.items.length).toBeGreaterThanOrEqual(5)
          expect(category.items.length).toBeLessThanOrEqual(10)
        }
      }
    })

    it('each template should have required fields (AC3)', async () => {
      const templates = await listTemplates()

      for (const template of templates) {
        // Template level
        expect(template).toHaveProperty('id')
        expect(template).toHaveProperty('name')
        expect(template).toHaveProperty('description')
        expect(template).toHaveProperty('dealType')
        expect(template).toHaveProperty('categories')

        // Categories
        expect(template.categories.length).toBeGreaterThan(0)

        for (const category of template.categories) {
          expect(category).toHaveProperty('name')
          expect(category).toHaveProperty('items')

          // Items
          for (const item of category.items) {
            expect(item).toHaveProperty('name')
            expect(item).toHaveProperty('priority')
            expect(['high', 'medium', 'low']).toContain(item.priority)
          }
        }
      }
    })

    it('each template should have valid dealType', async () => {
      const templates = await listTemplates()
      const validDealTypes = ['tech_ma', 'industrial', 'pharma', 'financial', 'custom']

      for (const template of templates) {
        expect(validDealTypes).toContain(template.dealType)
      }
    })
  })

  describe('templateExists', () => {
    it('should return true for existing template', async () => {
      const exists = await templateExists('tech-ma')
      expect(exists).toBe(true)
    })

    it('should return false for non-existent template', async () => {
      const exists = await templateExists('fake-template')
      expect(exists).toBe(false)
    })
  })

  describe('getTemplateIds', () => {
    it('should return array of template IDs', () => {
      const ids = getTemplateIds()

      expect(ids).toBeInstanceOf(Array)
      expect(ids).toContain('tech-ma')
      expect(ids).toContain('industrial')
      expect(ids).toContain('pharma')
      expect(ids).toContain('financial-services')
    })
  })

  describe('getTemplateSummary', () => {
    it('should return summary for valid template', async () => {
      const summary = await getTemplateSummary('tech-ma')

      expect(summary).not.toBeNull()
      expect(summary?.id).toBe('tech-ma')
      expect(summary?.name).toBe('Tech M&A')
      expect(summary?.totalItems).toBeGreaterThan(0)
      expect(summary?.categoryCount).toBe(5)
    })

    it('should return null for non-existent template', async () => {
      const summary = await getTemplateSummary('fake-template')
      expect(summary).toBeNull()
    })

    it('should accurately count items', async () => {
      const template = await getTemplate('tech-ma')
      const summary = await getTemplateSummary('tech-ma')

      const expectedTotal = template?.categories.reduce(
        (sum, cat) => sum + cat.items.length,
        0
      )

      expect(summary?.totalItems).toBe(expectedTotal)
    })
  })

  describe('clearTemplateCache', () => {
    it('should clear the cache', async () => {
      // Populate cache
      const templates1 = await listTemplates()

      // Clear cache
      clearTemplateCache()

      // Should reload from disk
      const templates2 = await listTemplates()

      // Different reference means cache was cleared
      expect(templates1).not.toBe(templates2)
      // But same content
      expect(templates1.length).toBe(templates2.length)
    })
  })

  describe('dynamic template discovery (AC5)', () => {
    // Note: This test verifies the mechanism works but doesn't actually add files
    // In real usage, adding a JSON file to the templates folder will make it available

    it('should discover templates from the filesystem', async () => {
      const templatesDir = path.join(process.cwd(), 'packages/shared/templates/irls')

      // Verify the directory exists
      expect(fs.existsSync(templatesDir)).toBe(true)

      // Get file count
      const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'))

      // Get template count
      const templates = await listTemplates()

      // Should have same count (assuming all files are valid)
      expect(templates.length).toBe(files.length)
    })
  })
})
