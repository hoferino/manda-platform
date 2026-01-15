/**
 * Graphiti Knowledge Integration
 *
 * Implements Graphiti backend for the Knowledge Service.
 * Allows CIM to retrieve knowledge from Neo4j instead of JSON file.
 * Reuses the existing callGraphitiSearch infrastructure from Agent v2.
 *
 * Story: CIM Knowledge Toggle - Story 2
 */

import type { KnowledgeSearchResult, KnowledgeSearchOptions, KnowledgeMetadata } from './knowledge-service'
import {
  callGraphitiSearch,
  type HybridSearchResult,
  type SearchMethod,
} from '@/lib/agent/retrieval'

// =============================================================================
// Section Query Mapping
// =============================================================================

/**
 * Maps CIM section paths to Graphiti search queries.
 * These queries are optimized for retrieving section-specific information.
 */
const SECTION_QUERIES: Record<string, string> = {
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
 * Get search query for a CIM section path.
 * Falls back to the section path itself if no mapping exists.
 */
function getSectionQuery(sectionPath: string): string {
  // Try exact match first
  if (SECTION_QUERIES[sectionPath]) {
    return SECTION_QUERIES[sectionPath]
  }

  // Try parent section
  const parts = sectionPath.split('.')
  if (parts.length > 1 && parts[0]) {
    const parentPath = parts[0]
    const parentQuery = SECTION_QUERIES[parentPath]
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
 * Get findings for a specific CIM section from Graphiti.
 * Constructs a section-aware query to retrieve relevant content.
 */
export async function getSectionGraphiti(
  sectionPath: string,
  dealId: string
): Promise<KnowledgeSearchResult[]> {
  const query = getSectionQuery(sectionPath)
  console.log(`[graphiti-knowledge] Section query for "${sectionPath}": "${query}"`)
  return searchGraphiti(query, dealId, { limit: 15 })
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
