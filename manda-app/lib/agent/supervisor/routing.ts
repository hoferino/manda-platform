/**
 * Supervisor Routing Logic
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #2, #6)
 *
 * Routes user queries to appropriate specialist agents based on intent and keywords.
 * Supports single-specialist, multi-specialist (parallel), and fallback routing.
 *
 * Routing Matrix:
 * - financial_analyst: Revenue, EBITDA, valuation, margins, financial metrics
 * - knowledge_graph: Entity resolution, contradictions, relationships, history
 * - general: Fallback for unmatched queries
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-4-supervisor-agent-pattern.md]
 * - [Source: manda-app/lib/agent/intent.ts] - Intent classification
 */

import type { EnhancedIntentResult } from '../intent'
import { createSupervisorDecision, type SupervisorDecision } from './state'

// =============================================================================
// Specialist IDs
// =============================================================================

/**
 * Available specialist agent identifiers
 */
export const SPECIALIST_IDS = {
  FINANCIAL_ANALYST: 'financial_analyst',
  KNOWLEDGE_GRAPH: 'knowledge_graph',
  GENERAL: 'general',
} as const

export type SpecialistId = typeof SPECIALIST_IDS[keyof typeof SPECIALIST_IDS]

// =============================================================================
// Routing Matrix (AC: #2)
// =============================================================================

/**
 * Keyword-based routing matrix for specialist selection
 * Story: E13.4 (AC: #2) - Implement routing logic to specialist agents
 *
 * Keywords are matched against the lowercase query.
 * Multiple matches result in multi-specialist routing.
 */
export const SPECIALIST_ROUTING: Record<string, string[]> = {
  // Financial Analyst (E13.5 - stub for now)
  // Routes to: EBITDA, revenue, valuation, working capital queries
  [SPECIALIST_IDS.FINANCIAL_ANALYST]: [
    'revenue',
    'ebitda',
    'margin',
    'profit',
    'loss',
    'valuation',
    'working capital',
    'cash flow',
    'debt',
    'equity',
    'multiple',
    'financial',
    'earnings',
    'forecast',
    'projection',
    'budget',
    'cost',
    'expense',
    'income',
    'balance sheet',
    'p&l',
    'profit and loss',
    'roi',
    'irr',
    'npv',
    'dcf',
    'wacc',
    'capex',
    'opex',
    'gross margin',
    'net margin',
    'operating margin',
    'leverage',
    'liquidity',
    'solvency',
  ],

  // Knowledge Graph Specialist (E13.6 - stub for now)
  // Routes to: Entity resolution, contradiction detection, relationship traversal
  [SPECIALIST_IDS.KNOWLEDGE_GRAPH]: [
    'entity',
    'relationship',
    'contradiction',
    'conflict',
    'supersede',
    'connected',
    'related',
    'who works',
    'company structure',
    'org chart',
    'timeline',
    'history',
    'change',
    'update',
    'correct',
    'person',
    'people',
    'employee',
    'executive',
    'ceo',
    'cfo',
    'board',
    'shareholder',
    'owner',
    'subsidiary',
    'parent company',
    'acquisition',
    'merger',
    'spin-off',
    'divestiture',
    'inconsistent',
    'discrepancy',
    'outdated',
    'superseded',
  ],
}

// =============================================================================
// Intent-Based Routing Signals
// =============================================================================

/**
 * Intent type to specialist affinity mapping
 * Enhances keyword matching with intent classification signals
 */
const INTENT_SPECIALIST_AFFINITY: Record<string, SpecialistId[]> = {
  // Analytical intent likely involves financial analysis
  analytical: [SPECIALIST_IDS.FINANCIAL_ANALYST],
  // Correction/update intent likely involves knowledge graph
  correction: [SPECIALIST_IDS.KNOWLEDGE_GRAPH],
  // Task intent could be either based on content
  task: [SPECIALIST_IDS.FINANCIAL_ANALYST, SPECIALIST_IDS.KNOWLEDGE_GRAPH],
  // Factual queries default to knowledge graph for entity lookup
  factual: [SPECIALIST_IDS.KNOWLEDGE_GRAPH],
}

// =============================================================================
// Routing Result Type
// =============================================================================

/**
 * Result of routing decision
 */
export interface RoutingResult {
  /** Selected specialist IDs */
  specialists: SpecialistId[]
  /** Whether multiple specialists should run in parallel */
  isParallel: boolean
  /** Reasoning for the routing decision */
  rationale: string
  /** Keywords that triggered routing */
  matchedKeywords: string[]
}

// =============================================================================
// Main Routing Function (AC: #2, #6)
// =============================================================================

/**
 * Route a query to appropriate specialists based on intent and keywords
 * Story: E13.4 (AC: #2) - Implement routing logic to specialist agents
 * Story: E13.4 (AC: #6) - Create fallback to general agent if no specialist matches
 *
 * Routing Strategy:
 * 1. Match keywords against SPECIALIST_ROUTING matrix
 * 2. Consider intent type as additional signal
 * 3. Support multi-specialist routing for cross-domain queries
 * 4. Fall back to general agent if no specialist matches
 *
 * @param intent - Enhanced intent classification result from E13.1
 * @param query - Original user query (optional, extracted from intent if available)
 * @returns RoutingResult with specialists and rationale
 *
 * @example
 * ```typescript
 * const result = routeToSpecialists(intent)
 * // { specialists: ['financial_analyst'], isParallel: false, rationale: '...' }
 *
 * const multiResult = routeToSpecialists(intentWithCrossQuery)
 * // { specialists: ['financial_analyst', 'knowledge_graph'], isParallel: true, ... }
 * ```
 */
export function routeToSpecialists(
  intent: EnhancedIntentResult,
  query?: string
): RoutingResult {
  // Use provided query or try to extract from intent metadata
  const queryText = (query ?? '').toLowerCase().trim()

  if (!queryText) {
    // No query to analyze - fallback to general
    return {
      specialists: [SPECIALIST_IDS.GENERAL],
      isParallel: false,
      rationale: 'No query text available for routing analysis',
      matchedKeywords: [],
    }
  }

  const matchedSpecialists = new Set<SpecialistId>()
  const matchedKeywords: string[] = []
  const matchDetails: Record<string, string[]> = {}

  // Step 1: Keyword matching against routing matrix
  for (const [specialist, keywords] of Object.entries(SPECIALIST_ROUTING)) {
    const specialistMatches: string[] = []

    for (const keyword of keywords) {
      // Use word boundary matching for better precision
      const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i')
      if (pattern.test(queryText)) {
        specialistMatches.push(keyword)
      }
    }

    if (specialistMatches.length > 0) {
      matchedSpecialists.add(specialist as SpecialistId)
      matchedKeywords.push(...specialistMatches)
      matchDetails[specialist] = specialistMatches
    }
  }

  // Step 2: Consider intent type as additional signal
  // Only boost if keyword matching was inconclusive
  if (matchedSpecialists.size === 0 && intent.intent) {
    const affinitySpecialists = INTENT_SPECIALIST_AFFINITY[intent.intent]
    if (affinitySpecialists && affinitySpecialists.length > 0) {
      // Add first affinity specialist as a weak signal
      matchedSpecialists.add(affinitySpecialists[0]!)
      matchDetails[affinitySpecialists[0]!] = [`intent:${intent.intent}`]
    }
  }

  // Step 3: Apply fallback if no specialists matched (AC: #6)
  if (matchedSpecialists.size === 0) {
    return {
      specialists: [SPECIALIST_IDS.GENERAL],
      isParallel: false,
      rationale: `No specialist keywords matched in query. Falling back to general agent.`,
      matchedKeywords: [],
    }
  }

  // Step 4: Build routing result
  const specialists = [...matchedSpecialists] as SpecialistId[]
  const isParallel = specialists.length > 1

  // Build detailed rationale
  const rationaleDetails = Object.entries(matchDetails)
    .map(([specialist, keywords]) => `${specialist}: [${keywords.join(', ')}]`)
    .join('; ')

  const rationale = isParallel
    ? `Multi-specialist routing for cross-domain query. Matches: ${rationaleDetails}`
    : `Single specialist routing. Matches: ${rationaleDetails}`

  return {
    specialists,
    isParallel,
    rationale,
    matchedKeywords: [...new Set(matchedKeywords)], // Deduplicate
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get human-readable rationale for a routing decision
 * Story: E13.4 (AC: #5) - Log routing decisions with rationale
 *
 * @param result - Routing result to generate rationale for
 * @returns Human-readable explanation of the routing decision
 */
export function getRoutingRationale(result: RoutingResult): string {
  if (result.specialists.includes(SPECIALIST_IDS.GENERAL)) {
    return 'Routing to general agent (no specialist match)'
  }

  const specialistNames = result.specialists.map(s => {
    switch (s) {
      case SPECIALIST_IDS.FINANCIAL_ANALYST:
        return 'Financial Analyst'
      case SPECIALIST_IDS.KNOWLEDGE_GRAPH:
        return 'Knowledge Graph Specialist'
      default:
        return s
    }
  })

  if (result.isParallel) {
    return `Parallel routing to: ${specialistNames.join(' + ')}`
  }

  return `Routing to: ${specialistNames[0]}`
}

/**
 * Create a SupervisorDecision from a routing result
 *
 * @param result - Routing result from routeToSpecialists
 * @param intent - Original intent classification
 * @returns SupervisorDecision for state update
 */
export function createDecisionFromRouting(
  result: RoutingResult,
  intent: EnhancedIntentResult
): SupervisorDecision {
  return createSupervisorDecision(
    result.specialists,
    result.rationale,
    result.isParallel,
    {
      type: intent.intent,
      complexity: intent.complexity,
      keywords: result.matchedKeywords,
    }
  )
}

/**
 * Check if a specialist should be routed to based on query
 * Useful for testing and debugging
 *
 * @param specialist - Specialist ID to check
 * @param query - Query text to analyze
 * @returns true if query should route to this specialist
 */
export function shouldRouteToSpecialist(
  specialist: SpecialistId,
  query: string
): boolean {
  const keywords = SPECIALIST_ROUTING[specialist]
  if (!keywords) return false

  const queryLower = query.toLowerCase()
  return keywords.some(keyword => {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i')
    return pattern.test(queryLower)
  })
}

/**
 * Get all keywords for a specialist
 *
 * @param specialist - Specialist ID
 * @returns Array of routing keywords
 */
export function getSpecialistKeywords(specialist: SpecialistId): string[] {
  return SPECIALIST_ROUTING[specialist] ?? []
}
