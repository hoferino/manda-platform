/**
 * Q&A Category Inference Utility
 *
 * Maps query keywords to Q&A categories for the conversational Q&A flow.
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 *
 * AC: #2 - The AI drafts a well-formed question based on the conversation context
 *
 * Design Notes:
 * - The LLM ultimately decides the category, but this utility provides guidance
 * - Keywords are matched case-insensitively
 * - If no keywords match, returns null (let LLM decide)
 * - Prioritizes more specific matches over generic ones
 */

import type { QACategory } from '../../types/qa'

/**
 * Keyword patterns for each Q&A category
 * Ordered from most specific to most general within each category
 */
const CATEGORY_KEYWORDS: Record<QACategory, string[]> = {
  Financials: [
    // Specific financial terms
    'ebitda',
    'ebit',
    'revenue',
    'profit',
    'margin',
    'cash flow',
    'cashflow',
    'balance sheet',
    'income statement',
    'p&l',
    'pnl',
    'profit and loss',
    // Financial metrics
    'arr',
    'mrr',
    'gross margin',
    'net income',
    'operating income',
    'working capital',
    'capex',
    'opex',
    // General financial terms
    'cost',
    'costs',
    'expense',
    'expenses',
    'budget',
    'forecast',
    'financial',
    'financials',
    'accounting',
    'audit',
    'tax',
    'taxes',
    'debt',
    'loan',
    'valuation',
  ],
  Legal: [
    // Specific legal terms
    'contract',
    'contracts',
    'agreement',
    'agreements',
    'litigation',
    'lawsuit',
    'lawsuits',
    'lawsuit',
    // IP-related
    'intellectual property',
    'ip',
    'patent',
    'patents',
    'trademark',
    'trademarks',
    'copyright',
    'copyrights',
    'license',
    'licenses',
    'licensing',
    // Compliance and regulatory
    'compliance',
    'regulatory',
    'regulation',
    'regulations',
    'gdpr',
    'soc2',
    'soc 2',
    'hipaa',
    // General legal
    'legal',
    'lawyer',
    'attorney',
    'dispute',
    'disputes',
    'claim',
    'claims',
    'liability',
    'liabilities',
    'warranty',
    'warranties',
    'indemnity',
    'insurance',
  ],
  Operations: [
    // Customer-related
    'customer',
    'customers',
    'client',
    'clients',
    'churn',
    'retention',
    'acquisition',
    'nps',
    'csat',
    'customer satisfaction',
    // Operations-specific
    'operation',
    'operations',
    'process',
    'processes',
    'workflow',
    'workflows',
    'procedure',
    'procedures',
    // Supply chain
    'supply chain',
    'supplier',
    'suppliers',
    'vendor',
    'vendors',
    'procurement',
    'inventory',
    'logistics',
    'manufacturing',
    'production',
    // General operational
    'sla',
    'service level',
    'delivery',
    'fulfillment',
    'capacity',
    'efficiency',
    'kpi',
    'metrics',
  ],
  Market: [
    // Competition
    'competitor',
    'competitors',
    'competition',
    'competitive',
    'market share',
    'marketshare',
    // Market positioning
    'market',
    'markets',
    'positioning',
    'differentiation',
    'tam',
    'sam',
    'som',
    'addressable market',
    // Industry
    'industry',
    'sector',
    'segment',
    'segments',
    'trend',
    'trends',
    // Growth
    'growth',
    'expansion',
    'geographic',
    'geography',
    'region',
    'regions',
    'international',
  ],
  Technology: [
    // Tech stack
    'tech stack',
    'technology stack',
    'stack',
    'architecture',
    'infrastructure',
    'platform',
    // Software-specific
    'software',
    'application',
    'applications',
    'system',
    'systems',
    'database',
    'databases',
    'api',
    'apis',
    'integration',
    'integrations',
    // Development
    'development',
    'engineering',
    'code',
    'codebase',
    'repository',
    'deployment',
    'ci/cd',
    'devops',
    // Security
    'security',
    'cybersecurity',
    'cyber security',
    'encryption',
    'authentication',
    // Cloud
    'cloud',
    'aws',
    'azure',
    'gcp',
    'hosting',
    'server',
    'servers',
    'scalability',
    'uptime',
    'availability',
  ],
  HR: [
    // Team-related
    'team',
    'teams',
    'employee',
    'employees',
    'staff',
    'headcount',
    'fte',
    'full-time',
    'part-time',
    // Organization
    'org structure',
    'organization',
    'organizational',
    'hierarchy',
    'reporting',
    'management',
    // HR-specific
    'hr',
    'human resources',
    'hiring',
    'recruitment',
    'retention',
    'turnover',
    'attrition',
    // Compensation
    'compensation',
    'salary',
    'salaries',
    'benefits',
    'equity',
    'stock options',
    'bonus',
    'bonuses',
    // Culture
    'culture',
    'values',
    'training',
    'development',
    'onboarding',
    'performance',
    'review',
    'reviews',
  ],
}

/**
 * Infer Q&A category from a query string
 *
 * @param query - The user's query text
 * @returns The inferred category or null if no clear match
 *
 * @example
 * inferQACategoryFromQuery("What's the customer churn rate?") // "Operations"
 * inferQACategoryFromQuery("Tell me about revenue") // "Financials"
 * inferQACategoryFromQuery("Any lawsuits?") // "Legal"
 */
export function inferQACategoryFromQuery(query: string): QACategory | null {
  if (!query || typeof query !== 'string') {
    return null
  }

  const lowerQuery = query.toLowerCase()

  // Count matches per category
  const matchCounts: Record<QACategory, number> = {
    Financials: 0,
    Legal: 0,
    Operations: 0,
    Market: 0,
    Technology: 0,
    HR: 0,
  }

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      // Match whole words or phrases (not partial matches)
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
      if (regex.test(lowerQuery)) {
        matchCounts[category as QACategory]++
      }
    }
  }

  // Find the category with the most matches
  let bestCategory: QACategory | null = null
  let bestCount = 0

  for (const [category, count] of Object.entries(matchCounts)) {
    if (count > bestCount) {
      bestCount = count
      bestCategory = category as QACategory
    }
  }

  return bestCategory
}

/**
 * Get all matching categories for a query (sorted by match count)
 *
 * @param query - The user's query text
 * @returns Array of categories with match counts, sorted by count descending
 */
export function getAllMatchingCategories(
  query: string
): Array<{ category: QACategory; matchCount: number }> {
  if (!query || typeof query !== 'string') {
    return []
  }

  const lowerQuery = query.toLowerCase()
  const results: Array<{ category: QACategory; matchCount: number }> = []

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let matchCount = 0
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
      if (regex.test(lowerQuery)) {
        matchCount++
      }
    }
    if (matchCount > 0) {
      results.push({ category: category as QACategory, matchCount })
    }
  }

  // Sort by match count descending
  return results.sort((a, b) => b.matchCount - a.matchCount)
}

/**
 * Check if a query matches a specific category
 *
 * @param query - The user's query text
 * @param category - The category to check
 * @returns True if the query matches the category
 */
export function queryMatchesCategory(query: string, category: QACategory): boolean {
  if (!query || typeof query !== 'string') {
    return false
  }

  const keywords = CATEGORY_KEYWORDS[category]
  if (!keywords) {
    return false
  }

  const lowerQuery = query.toLowerCase()

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i')
    if (regex.test(lowerQuery)) {
      return true
    }
  }

  return false
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Export the keyword mappings for reference/testing
 */
export const QA_CATEGORY_KEYWORDS = CATEGORY_KEYWORDS
