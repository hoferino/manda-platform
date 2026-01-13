/**
 * IRL Template Service
 * Provides predefined IRL templates for different deal types
 */

// Re-export canonical types from lib/types/irl
export type {
  IRLTemplate,
  IRLTemplateCategory,
  IRLTemplateItem,
  IRLDealType,
  IRLPriority,
} from '@/lib/types/irl'

import type { IRLTemplate } from '@/lib/types/irl'

const TECH_MA_TEMPLATE: IRLTemplate = {
  id: 'tech-ma',
  name: 'Tech M&A',
  description: 'Information request list for technology company acquisitions',
  dealType: 'tech_ma',
  categories: [
    {
      name: 'Financial',
      items: [
        { name: 'Balance Sheet (Last 3 Years)', priority: 'high', subcategory: 'Statements' },
        { name: 'P&L Statements (Last 3 Years)', priority: 'high', subcategory: 'Statements' },
        { name: 'Cash Flow Statements', priority: 'high', subcategory: 'Statements' },
        { name: 'Tax Returns', priority: 'medium', subcategory: 'Tax' },
        { name: 'Audit Reports', priority: 'medium', subcategory: 'Audit' },
        { name: 'Revenue Breakdown by Product/Service', priority: 'high', subcategory: 'Revenue' },
        { name: 'ARR/MRR Details (if SaaS)', priority: 'high', subcategory: 'Revenue' },
      ],
    },
    {
      name: 'Legal',
      items: [
        { name: 'Articles of Incorporation', priority: 'high', subcategory: 'Corporate' },
        { name: 'Cap Table', priority: 'high', subcategory: 'Corporate' },
        { name: 'Shareholder Agreements', priority: 'high', subcategory: 'Corporate' },
        { name: 'Material Contracts', priority: 'high', subcategory: 'Contracts' },
        { name: 'IP Assignment Agreements', priority: 'high', subcategory: 'IP' },
      ],
    },
    {
      name: 'Technical',
      items: [
        { name: 'Product Roadmap', priority: 'medium', subcategory: 'Product' },
        { name: 'Technology Stack Documentation', priority: 'medium', subcategory: 'Architecture' },
        { name: 'Security Certifications', priority: 'high', subcategory: 'Security' },
      ],
    },
    {
      name: 'Commercial',
      items: [
        { name: 'Customer List (Top 20)', priority: 'high', subcategory: 'Customers' },
        { name: 'Sales Pipeline', priority: 'medium', subcategory: 'Sales' },
        { name: 'Customer Acquisition Cost', priority: 'high', subcategory: 'Metrics' },
      ],
    },
  ],
}

const INDUSTRIAL_TEMPLATE: IRLTemplate = {
  id: 'industrial',
  name: 'Industrial',
  description: 'Information request list for industrial deals',
  dealType: 'industrial',
  categories: [
    {
      name: 'Financial',
      items: [
        { name: 'Balance Sheet (Last 3 Years)', priority: 'high' },
        { name: 'P&L Statements (Last 3 Years)', priority: 'high' },
        { name: 'Working Capital Analysis', priority: 'high' },
      ],
    },
    {
      name: 'Operations',
      items: [
        { name: 'Facility Leases', priority: 'high' },
        { name: 'Equipment List', priority: 'high' },
      ],
    },
  ],
}

const PHARMA_TEMPLATE: IRLTemplate = {
  id: 'pharma',
  name: 'Pharma',
  description: 'Information request list for pharma deals',
  dealType: 'pharma',
  categories: [
    {
      name: 'Financial',
      items: [
        { name: 'Balance Sheet (Last 3 Years)', priority: 'high' },
        { name: 'R&D Spend Breakdown', priority: 'high' },
      ],
    },
    {
      name: 'Regulatory',
      items: [
        { name: 'FDA Approvals', priority: 'high' },
        { name: 'Clinical Trial Data', priority: 'high' },
        { name: 'Patent Portfolio', priority: 'high' },
      ],
    },
  ],
}

const FINANCIAL_TEMPLATE: IRLTemplate = {
  id: 'financial',
  name: 'Financial Services',
  description: 'Information request list for financial services deals',
  dealType: 'financial',
  categories: [
    {
      name: 'Financial',
      items: [
        { name: 'Balance Sheet (Last 3 Years)', priority: 'high' },
        { name: 'AUM Details', priority: 'high' },
      ],
    },
    {
      name: 'Regulatory',
      items: [
        { name: 'Licenses and Registrations', priority: 'high' },
        { name: 'Compliance Audit Reports', priority: 'high' },
      ],
    },
  ],
}

const CUSTOM_TEMPLATE: IRLTemplate = {
  id: 'custom',
  name: 'General M&A',
  description: 'Basic information request list for general deals',
  dealType: 'custom',
  categories: [
    {
      name: 'Financial',
      items: [
        { name: 'Balance Sheet (Last 3 Years)', priority: 'high' },
        { name: 'P&L Statements (Last 3 Years)', priority: 'high' },
      ],
    },
    {
      name: 'Legal',
      items: [
        { name: 'Articles of Incorporation', priority: 'high' },
        { name: 'Cap Table', priority: 'high' },
      ],
    },
  ],
}

const TEMPLATES: Record<string, IRLTemplate> = {
  'tech-ma': TECH_MA_TEMPLATE,
  industrial: INDUSTRIAL_TEMPLATE,
  pharma: PHARMA_TEMPLATE,
  financial: FINANCIAL_TEMPLATE,
  custom: CUSTOM_TEMPLATE,
}

export function getTemplate(templateId: string): IRLTemplate | null {
  return TEMPLATES[templateId] || null
}

export function getAllTemplates(): IRLTemplate[] {
  return Object.values(TEMPLATES)
}

export function getTemplateIds(): string[] {
  return Object.keys(TEMPLATES)
}

/**
 * Alias for getAllTemplates for backward compatibility
 * Returns a Promise for async compatibility with callers expecting async
 */
export async function listTemplates(): Promise<IRLTemplate[]> {
  return getAllTemplates()
}

/**
 * Check if a template exists by ID
 */
export function templateExists(templateId: string): boolean {
  return templateId in TEMPLATES
}

/**
 * Get a summary of a template (id, name, totalItems, categoryCount)
 */
export function getTemplateSummary(
  templateId: string
): { id: string; name: string; totalItems: number; categoryCount: number } | null {
  const template = TEMPLATES[templateId]
  if (!template) return null
  const totalItems = template.categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  )
  return {
    id: template.id,
    name: template.name,
    totalItems,
    categoryCount: template.categories.length,
  }
}

// Template cache for performance (no-op for in-memory templates)
let cacheCleared = false

/**
 * Clear the template cache (no-op for in-memory templates, but useful for testing)
 */
export function clearTemplateCache(): void {
  cacheCleared = true
}
