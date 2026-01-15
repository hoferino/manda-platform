/**
 * Graphiti Knowledge Integration
 *
 * Implements Graphiti backend for the Knowledge Service.
 * Allows CIM to retrieve knowledge from Neo4j instead of JSON file.
 * Reuses the existing callGraphitiSearch infrastructure from Agent v2.
 *
 * Story: CIM Knowledge Toggle - Story 2
 * Story: E14-S5 Replace Static SECTION_QUERIES - Dynamic query generation
 */

import type { KnowledgeSearchResult, KnowledgeSearchOptions, KnowledgeMetadata } from './knowledge-service'
import {
  callGraphitiSearch,
  type HybridSearchResult,
  type SearchMethod,
} from '@/lib/agent/retrieval'
import { getQueryForSection } from './query-generator'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Feature flag for dynamic query generation
 * Set CIM_USE_DYNAMIC_QUERIES=false to disable
 */
const USE_DYNAMIC_QUERIES = process.env.CIM_USE_DYNAMIC_QUERIES !== 'false'

// =============================================================================
// Section Query Mapping (Static Fallback)
// =============================================================================

/**
 * Static section queries used as fallback when dynamic generation fails.
 * These are generic queries that work for any deal type.
 *
 * @deprecated Prefer dynamic queries via query-generator.ts (E14-S4)
 */
const STATIC_SECTION_QUERIES: Record<string, string> = {
  // Executive summary
  'executive_summary': 'company overview key highlights investment opportunity value proposition',

  // Company overview
  'company_overview': 'company history founding team headquarters employees mission vision',
  'company_overview.history': 'company history founding year origin story milestones',
  'company_overview.mission_vision': 'mission vision values purpose company culture',
  'company_overview.milestones': 'milestones achievements key events timeline growth history',

  // Management team
  'management_team': 'leadership team executives founders CEO CFO CTO management',
  'management_team.executives': 'executives leadership team CEO CFO CTO president VP',

  // Products & services
  'products_services': 'products services offerings platform technology solutions',

  // Market opportunity
  'market_opportunity': 'market size TAM SAM SOM opportunity growth drivers trends',
  'market_opportunity.market_size': 'market size TAM SAM total addressable market',
  'market_opportunity.growth_drivers': 'growth drivers market trends tailwinds',
  'market_opportunity.target_segments': 'target market customer segments ICP',

  // Business model
  'business_model': 'business model revenue streams pricing monetization',
  'business_model.revenue_model': 'revenue model streams recurring subscription licensing',
  'business_model.pricing': 'pricing strategy tiers packages plans',
  'business_model.unit_economics': 'unit economics LTV CAC payback margins',

  // Financial performance
  'financial_performance': 'revenue profit EBITDA margins growth financial metrics',
  'financial_performance.revenue': 'revenue sales ARR MRR recurring revenue',
  'financial_performance.profitability': 'profit margin EBITDA net income gross margin',
  'financial_performance.growth_metrics': 'growth rate YoY MoM revenue growth customer growth',

  // Competitive landscape
  'competitive_landscape': 'competitors competitive advantage differentiation market position',
  'competitive_landscape.competitors': 'competitors competition market players alternatives',
  'competitive_landscape.competitive_advantages': 'competitive advantages moat differentiation unique',
  'competitive_landscape.market_position': 'market position share ranking leadership',

  // Growth strategy
  'growth_strategy': 'growth expansion strategy roadmap plans initiatives',

  // Risk factors
  'risk_factors': 'risks challenges concerns threats weaknesses obstacles',

  // Geographic footprint
  'geographic_footprint': 'locations offices geography regions countries markets',
  'geographic_footprint.locations': 'headquarters offices locations addresses',
  'geographic_footprint.employee_distribution': 'employees by region headcount distribution',
}

/**
 * Get static search query for a CIM section path.
 * Falls back to the section path itself if no mapping exists.
 *
 * @deprecated Use getQueryForSection from query-generator.ts for dynamic queries
 */
function getStaticSectionQuery(sectionPath: string): string {
  // Try exact match first
  if (STATIC_SECTION_QUERIES[sectionPath]) {
    return STATIC_SECTION_QUERIES[sectionPath]
  }

  // Try parent section
  const parts = sectionPath.split('.')
  if (parts.length > 1 && parts[0]) {
    const parentPath = parts[0]
    const parentQuery = STATIC_SECTION_QUERIES[parentPath]
    if (parentQuery) {
      return parentQuery
    }
  }

  // Fallback: convert underscores to spaces
  return sectionPath.replace(/_/g, ' ')
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Search Graphiti knowledge graph for CIM content.
 * Uses hybrid search (vector + BM25 + graph) for comprehensive results.
 *
 * Note: Latency is logged by the shared callGraphitiSearch function.
 */
export async function searchGraphiti(
  query: string,
  dealId: string,
  options?: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  try {
    const limit = options?.limit ?? 10
    // Use shared callGraphitiSearch from retrieval.ts (Story: CIM Knowledge Toggle)
    const result = await callGraphitiSearch(query, dealId, 'hybrid', limit)

    if (!result?.results?.length) {
      return []
    }

    // Transform to KnowledgeSearchResult format
    return result.results.map((r: HybridSearchResult) => ({
      content: r.content,
      source: r.citation?.title || 'Unknown source',
      relevance: r.score,
      metadata: {
        documentId: r.citation?.id,
        page: r.citation?.page,
        type: r.citation?.type,
      },
    }))
  } catch (error) {
    console.error('[graphiti-knowledge] Search failed:', error)
    return []
  }
}

/**
 * Options for section retrieval with dynamic queries
 */
export interface SectionRetrievalOptions {
  buyerPersona?: string
  userFocus?: string
  useDynamicQueries?: boolean
  limit?: number
}

/**
 * Get findings for a specific CIM section from Graphiti.
 * Uses dynamic query generation based on graph schema when enabled.
 *
 * Story: E14-S5 - Dynamic query generation integration
 *
 * @param sectionPath - CIM section path (e.g., "financial_performance.revenue")
 * @param dealId - Deal/project ID for knowledge lookup and schema
 * @param options - Optional retrieval options
 * @returns Array of knowledge search results
 */
export async function getSectionGraphiti(
  sectionPath: string,
  dealId: string,
  options: SectionRetrievalOptions = {}
): Promise<KnowledgeSearchResult[]> {
  const {
    buyerPersona,
    userFocus,
    useDynamicQueries = USE_DYNAMIC_QUERIES,
    limit = 15,
  } = options

  let query: string
  let querySource: 'dynamic' | 'static' | 'fallback' = 'static'
  let cached = false

  if (useDynamicQueries) {
    try {
      const result = await getQueryForSection(dealId, sectionPath, {
        buyerPersona,
        userFocus,
        staticFallback: getStaticSectionQuery(sectionPath),
        useDynamicQueries: true,
      })

      query = result.query
      querySource = result.source
      cached = result.cached

      console.log(
        `[graphiti-knowledge] Section: "${sectionPath}" | Source: ${querySource} | ` +
          `Cached: ${cached} | Latency: ${result.latencyMs}ms | Query: "${query.substring(0, 80)}..."`
      )
    } catch (error) {
      console.warn(`[graphiti-knowledge] Dynamic query failed for ${sectionPath}, using static:`, error)
      query = getStaticSectionQuery(sectionPath)
      querySource = 'fallback'
    }
  } else {
    query = getStaticSectionQuery(sectionPath)
    console.log(`[graphiti-knowledge] Section: "${sectionPath}" | Source: static (disabled) | Query: "${query}"`)
  }

  // Execute the search
  const results = await searchGraphiti(query, dealId, { limit })

  // Log retrieval summary for monitoring
  console.log(
    `[graphiti-knowledge] Retrieved ${results.length} results for "${sectionPath}" ` +
      `(query source: ${querySource})`
  )

  return results
}

/**
 * Get metadata about deal knowledge in Graphiti.
 * Used to populate company name, document count, data sufficiency.
 */
export async function getMetadataGraphiti(
  dealId: string
): Promise<KnowledgeMetadata> {
  try {
    // Query for basic company info
    const companyResults = await searchGraphiti('company name business overview', dealId, { limit: 3 })

    // Query to get a sense of data coverage
    const financialResults = await searchGraphiti('revenue EBITDA financial performance', dealId, { limit: 5 })
    const marketResults = await searchGraphiti('market competition industry trends', dealId, { limit: 5 })
    const overviewResults = await searchGraphiti('company history team founders', dealId, { limit: 5 })

    // Calculate data sufficiency score based on coverage
    const totalFindings = financialResults.length + marketResults.length + overviewResults.length
    const dataSufficiencyScore = Math.min(100, Math.round((totalFindings / 15) * 100))

    // Extract company name from results if possible
    const companyName = extractCompanyName(companyResults) || 'Unknown Company'

    return {
      companyName,
      documentCount: totalFindings, // Approximation based on findings
      dataSufficiencyScore,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[graphiti-knowledge] getMetadata failed:', error)
    return {
      companyName: 'Unknown Company',
      documentCount: 0,
      dataSufficiencyScore: 0,
    }
  }
}

/**
 * Try to extract company name from search results.
 */
function extractCompanyName(results: KnowledgeSearchResult[]): string | null {
  if (!results.length) return null

  // Look for company name patterns in content
  for (const result of results) {
    const content = result.content

    // Common patterns for company name mentions
    const patterns = [
      // "Company X is a..."
      /^([A-Z][A-Za-z0-9\s&\-\.]+?)\s+(?:is|was|has been|provides|offers|delivers)/i,
      // "...company called X"
      /(?:company|firm|organization|business)\s+(?:called|named|known as)\s+["']?([A-Z][A-Za-z0-9\s&\-\.]+?)["']?[,.\s]/i,
      // "About X:" or "X Overview"
      /(?:about|overview of)\s*:?\s*([A-Z][A-Za-z0-9\s&\-\.]+)/i,
      // Source citation often contains company name
      /^([A-Z][A-Za-z0-9\s&\-\.]+?)\s+(?:Inc|LLC|Ltd|Corp|Co\.|Company|Group|Holdings)/i,
    ]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match?.[1]) {
        const name = match[1].trim()
        // Filter out generic terms
        if (!['The', 'This', 'Our', 'A'].includes(name) && name.length > 2) {
          return name
        }
      }
    }
  }

  // Fallback: use source name if it looks like a company
  const firstSource = results[0]?.source
  if (firstSource && !firstSource.includes('Unknown') && firstSource.length < 50) {
    const firstPart = firstSource.split(',')[0]
    if (firstPart) {
      return firstPart.trim()
    }
  }

  return null
}

/**
 * Get summary of available data from Graphiti
 */
export async function getDataSummaryGraphiti(dealId: string): Promise<string> {
  const metadata = await getMetadataGraphiti(dealId)

  const lines: string[] = [
    `**Company:** ${metadata.companyName}`,
    `**Data Coverage:** ${metadata.dataSufficiencyScore}%`,
    `**Source:** Neo4j Knowledge Graph`,
    '',
    `*${metadata.documentCount} relevant findings available*`,
  ]

  return lines.join('\n')
}

// =============================================================================
// Exports for Testing and Configuration
// =============================================================================

/**
 * Export static section queries for testing and fallback
 */
export { STATIC_SECTION_QUERIES }

/**
 * Export configuration flag for testing
 */
export { USE_DYNAMIC_QUERIES }
