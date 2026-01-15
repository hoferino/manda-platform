/**
 * Dynamic CIM Query Generator
 *
 * Generates retrieval queries dynamically based on graph schema and buyer persona.
 * Uses Claude Haiku for fast, cheap generation with caching for efficiency.
 *
 * Story: E14-S4 Dynamic CIM Query Generator
 */

import { ChatAnthropic } from '@langchain/anthropic'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { PromptTemplate } from '@langchain/core/prompts'

// =============================================================================
// Types
// =============================================================================

/**
 * Graph schema returned from the backend schema endpoint
 */
export interface GraphSchema {
  entity_types: string[]
  relationship_types: string[]
  entity_counts: Record<string, number>
  total_entities?: number
  total_relationships?: number
}

/**
 * Input for dynamic query generation
 */
export interface QueryGeneratorInput {
  projectId: string
  section: string
  sectionDescription: string
  graphSchema: GraphSchema
  buyerPersona?: string
  userFocus?: string
}

/**
 * Result from query generation with metadata
 */
export interface QueryGenerationResult {
  query: string
  source: 'dynamic' | 'static' | 'fallback'
  cached: boolean
  latencyMs?: number
}

// =============================================================================
// Cache
// =============================================================================

interface CacheEntry {
  query: string
  timestamp: number
}

// In-memory cache (consider Redis for production multi-instance deployments)
const queryCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Build cache key from input parameters
 * Includes projectId to prevent cache collisions between different projects
 */
function buildCacheKey(input: QueryGeneratorInput): string {
  const parts = [
    input.projectId,
    input.section,
    input.buyerPersona || 'default',
    input.userFocus || 'default',
    // Include top 5 entity types to vary cache by schema changes
    ...input.graphSchema.entity_types.slice(0, 5),
  ]
  return parts.join(':')
}

/**
 * Get cached query if valid
 */
function getCachedQuery(key: string): string | null {
  const cached = queryCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.query
  }
  return null
}

/**
 * Cache a generated query
 */
function cacheQuery(key: string, query: string): void {
  queryCache.set(key, { query, timestamp: Date.now() })
}

/**
 * Invalidate cached queries
 *
 * @param projectId - If provided, invalidate all queries for this project
 *                    If not provided, clear the entire cache
 */
export function invalidateQueryCache(projectId?: string): void {
  if (projectId) {
    // Invalidate all queries for this project (cache key starts with projectId)
    for (const key of queryCache.keys()) {
      if (key.startsWith(`${projectId}:`)) {
        queryCache.delete(key)
      }
    }
  } else {
    queryCache.clear()
  }
}

// =============================================================================
// Query Generation Prompt
// =============================================================================

const QUERY_GENERATION_PROMPT = PromptTemplate.fromTemplate(`You are generating a search query for a CIM (Confidential Information Memorandum) section.

**Section:** {section}
**Section Description:** {sectionDescription}

**Available Entity Types in this Deal's Knowledge Graph:**
{entityTypes}

**Entity Counts (top entities):**
{entityCounts}

**Available Relationship Types:**
{relationshipTypes}

**Buyer Persona:** {buyerPersona}
**User Focus:** {userFocus}

Generate a natural language search query that will retrieve the most relevant information for this CIM section.

The query should:
1. Reference entity types that exist in this deal's graph (use the exact type names)
2. Be specific to what a {buyerPersona} buyer would want to know
3. Cover the key aspects of {section}
4. Be a single, comprehensive query string (20-50 words)
5. Include relevant relationship context when appropriate

Output ONLY the query string, nothing else.`)

// =============================================================================
// Schema Fetching with Caching
// =============================================================================

const PROCESSING_API_URL = process.env.PROCESSING_API_URL || 'http://localhost:8000'

// Schema cache to avoid redundant network calls
interface SchemaCacheEntry {
  schema: GraphSchema
  timestamp: number
}
const schemaCache = new Map<string, SchemaCacheEntry>()
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes (schema changes less frequently)

/**
 * Get cached schema if valid
 */
function getCachedSchema(projectId: string): GraphSchema | null {
  const cached = schemaCache.get(projectId)
  if (cached && Date.now() - cached.timestamp < SCHEMA_CACHE_TTL_MS) {
    return cached.schema
  }
  return null
}

/**
 * Invalidate schema cache for a project
 */
export function invalidateSchemaCache(projectId?: string): void {
  if (projectId) {
    schemaCache.delete(projectId)
  } else {
    schemaCache.clear()
  }
}

/**
 * Fetch graph schema from the backend introspection endpoint
 * Uses caching to avoid redundant network calls
 *
 * @param projectId - The project/deal ID to fetch schema for
 * @returns Graph schema or null if fetch fails
 */
export async function fetchGraphSchema(projectId: string): Promise<GraphSchema | null> {
  // Validate input
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    console.warn('[query-generator] fetchGraphSchema called with invalid projectId')
    return null
  }

  const trimmedProjectId = projectId.trim()

  // Check schema cache first
  const cachedSchema = getCachedSchema(trimmedProjectId)
  if (cachedSchema) {
    console.log(`[query-generator] Schema cache hit for project: ${trimmedProjectId}`)
    return cachedSchema
  }

  try {
    const url = `${PROCESSING_API_URL}/api/search/schema/${trimmedProjectId}`
    console.log(`[query-generator] Fetching schema from: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout after 5 seconds
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      console.warn(`[query-generator] Schema fetch failed: ${response.status} ${response.statusText}`)
      return null
    }

    const schema: GraphSchema = await response.json()

    // Validate schema has meaningful data
    if (!schema.entity_types || schema.entity_types.length === 0) {
      console.warn('[query-generator] Schema has no entity types')
      return null
    }

    // Cache the schema
    schemaCache.set(trimmedProjectId, { schema, timestamp: Date.now() })

    console.log(
      `[query-generator] Schema loaded: ${schema.entity_types.length} entity types, ` +
        `${schema.relationship_types?.length || 0} relationship types, ` +
        `${schema.total_entities || 0} total entities`
    )

    return schema
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.warn('[query-generator] Schema fetch timed out')
    } else {
      console.error('[query-generator] Failed to fetch graph schema:', error)
    }
    return null
  }
}

// =============================================================================
// Query Generation
// =============================================================================

/**
 * Format entity counts for prompt
 */
function formatEntityCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => `- ${type}: ${count}`)
    .join('\n')
}

/**
 * Format relationship types for prompt
 */
function formatRelationshipTypes(types: string[]): string {
  if (!types || types.length === 0) {
    return 'None available'
  }
  return types.slice(0, 15).join(', ')
}

/**
 * Internal query generation without caching
 * Used by getQueryForSection which handles caching at a higher level
 */
async function generateDynamicQueryInternal(
  input: QueryGeneratorInput
): Promise<string | null> {
  try {
    const startTime = Date.now()

    const model = new ChatAnthropic({
      model: 'claude-3-haiku-20240307',
      temperature: 0, // Deterministic for caching consistency
      maxTokens: 200,
    })

    const chain = QUERY_GENERATION_PROMPT.pipe(model).pipe(new StringOutputParser())

    const query = await chain.invoke({
      section: input.section,
      sectionDescription: input.sectionDescription,
      entityTypes: input.graphSchema.entity_types.join(', '),
      entityCounts: formatEntityCounts(input.graphSchema.entity_counts),
      relationshipTypes: formatRelationshipTypes(input.graphSchema.relationship_types),
      buyerPersona: input.buyerPersona || 'strategic acquirer',
      userFocus: input.userFocus || 'general due diligence',
    })

    const latencyMs = Date.now() - startTime
    const trimmedQuery = query.trim()

    console.log(
      `[query-generator] Generated query for ${input.section} in ${latencyMs}ms: "${trimmedQuery.substring(0, 80)}..."`
    )

    return trimmedQuery
  } catch (error) {
    console.error(`[query-generator] Query generation failed for ${input.section}:`, error)
    return null
  }
}

/**
 * Generate a dynamic query using Claude Haiku
 * Public API with caching - use getQueryForSection for the full flow with schema fetching
 *
 * @param input - Query generation input with section, schema, and context
 * @returns Generated query string or null if generation fails
 */
export async function generateDynamicQuery(
  input: QueryGeneratorInput
): Promise<string | null> {
  const cacheKey = buildCacheKey(input)

  // Check cache first
  const cachedQuery = getCachedQuery(cacheKey)
  if (cachedQuery) {
    console.log(`[query-generator] Cache hit for section: ${input.section}`)
    return cachedQuery
  }

  const result = await generateDynamicQueryInternal(input)

  if (result) {
    // Cache the result
    cacheQuery(cacheKey, result)
  }

  return result
}

// =============================================================================
// Section Descriptions (for query context)
// =============================================================================

/**
 * Standard CIM section descriptions for query generation context
 */
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  // Executive summary
  executive_summary:
    'High-level overview of the company, its mission, and key investment highlights for potential acquirers',

  // Company overview
  company_overview:
    'Company history, founding story, headquarters, employee count, mission, and corporate identity',
  'company_overview.history': 'Company founding story, origin, milestones, and historical development',
  'company_overview.mission_vision': 'Mission statement, vision, core values, and corporate culture',
  'company_overview.milestones': 'Key achievements, milestones, awards, and significant company events',

  // Management team
  management_team:
    'Leadership team backgrounds, experience, expertise, and organizational structure',
  'management_team.executives': 'CEO, CFO, CTO, and other C-suite executives with backgrounds',

  // Products & services
  products_services:
    'Product portfolio, service offerings, technology platform, and solution capabilities',

  // Market opportunity
  market_opportunity:
    'Market size (TAM/SAM/SOM), growth trends, competitive dynamics, and market positioning',
  'market_opportunity.market_size': 'Total addressable market, serviceable market, and growth rates',
  'market_opportunity.growth_drivers': 'Market tailwinds, growth drivers, and industry trends',
  'market_opportunity.target_segments': 'Target customer segments, ideal customer profile, and verticals',

  // Business model
  business_model:
    'Revenue model, pricing strategy, customer acquisition, and monetization approach',
  'business_model.revenue_model': 'Revenue streams, recurring vs one-time, subscription models',
  'business_model.pricing': 'Pricing strategy, tiers, packages, and competitive positioning',
  'business_model.unit_economics': 'LTV, CAC, payback period, gross margin, and contribution margin',

  // Financial performance
  financial_performance:
    'Historical financials, revenue growth, profitability, margins, and key financial metrics',
  'financial_performance.revenue': 'Revenue, ARR, MRR, and revenue growth trajectory',
  'financial_performance.profitability': 'EBITDA, net income, gross margin, and profitability trends',
  'financial_performance.growth_metrics': 'YoY growth, MoM growth, and growth rate trends',

  // Competitive landscape
  competitive_landscape:
    'Competitor analysis, competitive advantages, market positioning, and differentiation',
  'competitive_landscape.competitors': 'Direct and indirect competitors, market alternatives',
  'competitive_landscape.competitive_advantages': 'Moats, differentiation, unique capabilities',
  'competitive_landscape.market_position': 'Market share, industry ranking, and positioning',

  // Growth strategy
  growth_strategy:
    'Expansion plans, growth initiatives, strategic roadmap, and future opportunities',

  // Risk factors
  risk_factors:
    'Key risks, challenges, concerns, mitigations, and potential obstacles',

  // Geographic footprint
  geographic_footprint:
    'Office locations, geographic presence, regional distribution, and expansion geography',
  'geographic_footprint.locations': 'Headquarters, offices, facilities, and physical presence',
  'geographic_footprint.employee_distribution': 'Headcount by region, team distribution',
}

/**
 * Get section description for query generation
 *
 * @param sectionPath - Section path (e.g., "financial_performance.revenue")
 * @returns Description string or generic fallback
 */
export function getSectionDescription(sectionPath: string): string {
  // Try exact match
  if (SECTION_DESCRIPTIONS[sectionPath]) {
    return SECTION_DESCRIPTIONS[sectionPath]
  }

  // Try parent section
  const parts = sectionPath.split('.')
  if (parts.length > 1 && parts[0]) {
    const parentDescription = SECTION_DESCRIPTIONS[parts[0]]
    if (parentDescription) {
      return parentDescription
    }
  }

  // Generic fallback
  return `Information about ${sectionPath.replace(/_/g, ' ').replace(/\./g, ' - ')}`
}

// =============================================================================
// High-Level Query Function
// =============================================================================

/**
 * Get a retrieval query for a CIM section, with dynamic generation and fallback
 * This is the primary entry point - handles caching to avoid duplicate lookups
 *
 * @param projectId - Deal/project ID for schema lookup
 * @param section - CIM section path
 * @param options - Additional options (buyer persona, user focus, static fallback)
 * @returns Query generation result with source metadata
 */
export async function getQueryForSection(
  projectId: string,
  section: string,
  options: {
    buyerPersona?: string
    userFocus?: string
    staticFallback?: string
    useDynamicQueries?: boolean
  } = {}
): Promise<QueryGenerationResult> {
  const { buyerPersona, userFocus, staticFallback, useDynamicQueries = true } = options
  const startTime = Date.now()

  // Validate projectId
  if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
    console.warn('[query-generator] getQueryForSection called with invalid projectId')
    return {
      query: staticFallback || section.replace(/_/g, ' '),
      source: 'fallback',
      cached: false,
      latencyMs: Date.now() - startTime,
    }
  }

  // If dynamic queries disabled, use static fallback immediately
  if (!useDynamicQueries) {
    return {
      query: staticFallback || section.replace(/_/g, ' '),
      source: 'static',
      cached: false,
      latencyMs: Date.now() - startTime,
    }
  }

  try {
    // Fetch graph schema (uses schema cache internally)
    const schema = await fetchGraphSchema(projectId)

    if (schema && schema.entity_types.length > 0) {
      const input: QueryGeneratorInput = {
        projectId,
        section,
        sectionDescription: getSectionDescription(section),
        graphSchema: schema,
        buyerPersona,
        userFocus,
      }

      const cacheKey = buildCacheKey(input)

      // Check query cache - single lookup here, not in generateDynamicQuery
      const cachedQuery = getCachedQuery(cacheKey)
      if (cachedQuery) {
        return {
          query: cachedQuery,
          source: 'dynamic',
          cached: true,
          latencyMs: Date.now() - startTime,
        }
      }

      // Generate dynamic query (skipCache=true to avoid double lookup)
      const dynamicQuery = await generateDynamicQueryInternal(input)

      if (dynamicQuery) {
        // Cache the result
        cacheQuery(cacheKey, dynamicQuery)

        return {
          query: dynamicQuery,
          source: 'dynamic',
          cached: false,
          latencyMs: Date.now() - startTime,
        }
      }
    }
  } catch (error) {
    console.warn(`[query-generator] Dynamic query generation failed for ${section}:`, error)
  }

  // Fall back to static query
  const fallbackQuery = staticFallback || section.replace(/_/g, ' ')
  return {
    query: fallbackQuery,
    source: 'fallback',
    cached: false,
    latencyMs: Date.now() - startTime,
  }
}
