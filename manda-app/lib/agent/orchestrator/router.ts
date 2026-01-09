/**
 * Lightweight Intent Router
 *
 * Simple keyword/regex-based routing to determine which path to take.
 * Designed for speed (<5ms) - no LLM calls, no embeddings.
 *
 * Three paths:
 * 1. vanilla - General chat, greetings, off-topic (default)
 * 2. retrieval - Questions about deal/documents
 * 3. analysis - Complex analysis requiring subagents
 */

export type RoutePath = 'vanilla' | 'retrieval' | 'analysis'

export interface RouterResult {
  path: RoutePath
  confidence: number
  matchedKeywords: string[]
  reason: string
}

// =============================================================================
// Keyword Patterns
// =============================================================================

/**
 * Greeting patterns - route to vanilla
 */
const GREETING_PATTERNS = [
  /^(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening))[\s!.,?]*$/i,
  /^(thanks|thank\s*you|thx|ty)[\s!.,?]*$/i,
  /^(bye|goodbye|see\s*you|later)[\s!.,?]*$/i,
  /^(ok|okay|got\s*it|understood|sure|yes|no|yep|nope)[\s!.,?]*$/i,
]

/**
 * Meta/capability questions - route to vanilla
 */
const META_PATTERNS = [
  /what\s+(can|do)\s+you\s+(do|help)/i,
  /how\s+do\s+you\s+work/i,
  /what\s+are\s+you/i,
  /who\s+are\s+you/i,
  /tell\s+me\s+about\s+yourself/i,
  /what\s+is\s+your\s+(name|purpose)/i,
]

/**
 * General knowledge questions (not deal-specific) - route to vanilla
 */
const GENERAL_KNOWLEDGE_PATTERNS = [
  /what\s+is\s+(a|an|the)?\s*(m&a|merger|acquisition|due\s*diligence|ebitda|revenue|cap\s*table)/i,
  /explain\s+(what|how|why)/i,
  /define\s+/i,
  /^how\s+(do|does|to)\s+/i, // "How do I...", "How does X work"
  /what\s+does\s+.*\s+mean/i,
]

/**
 * Document/deal-specific keywords - route to retrieval
 */
const RETRIEVAL_KEYWORDS = [
  // Company-specific
  'company', 'target', 'business', 'organization',
  // People
  'ceo', 'cfo', 'cto', 'founder', 'management', 'team', 'employee', 'executive',
  // Financials (specific queries)
  'revenue', 'ebitda', 'margin', 'profit', 'loss', 'cost', 'expense',
  'q1', 'q2', 'q3', 'q4', 'fy', 'fiscal', 'annual', 'quarterly',
  // Documents
  'document', 'file', 'uploaded', 'data room', 'cim', 'presentation',
  // Deal-specific
  'deal', 'transaction', 'acquisition', 'investment',
  // Specifics
  'customer', 'client', 'contract', 'agreement', 'supplier', 'vendor',
  'product', 'service', 'market', 'competitor',
]

/**
 * Retrieval trigger patterns - explicit questions about deal content
 */
const RETRIEVAL_PATTERNS = [
  /what\s+(is|are|was|were)\s+(the|their|its)/i,  // "What is the revenue?"
  /who\s+(is|are|was|were)/i,                      // "Who is the CEO?"
  /how\s+(much|many)\s+(is|are|do|does)/i,         // "How much revenue?"
  /tell\s+me\s+about\s+(the|their)/i,              // "Tell me about their customers"
  /show\s+me/i,                                     // "Show me the financials"
  /find\s+(the|all|any)/i,                         // "Find all contracts"
  /list\s+(the|all)/i,                             // "List all employees"
  /give\s+me\s+(the|a)/i,                          // "Give me the overview"
  /what\s+do\s+(we|the\s+documents)\s+know/i,      // "What do we know about X?"
]

/**
 * Analysis keywords - route to analysis path
 */
const ANALYSIS_KEYWORDS = [
  // Analysis actions
  'analyze', 'analysis', 'evaluate', 'assess', 'review',
  // Comparisons
  'compare', 'comparison', 'versus', 'vs', 'difference', 'differ',
  // Trends
  'trend', 'growth', 'decline', 'change', 'pattern',
  // Risk/Issues
  'risk', 'red flag', 'concern', 'issue', 'problem', 'warning',
  'contradiction', 'inconsistent', 'conflict', 'discrepancy',
  // Gaps
  'gap', 'missing', 'incomplete', 'lack',
  // Synthesis
  'summarize', 'summary', 'overview', 'synthesis', 'insight',
  // Deep dive
  'breakdown', 'break down', 'deep dive', 'drill down', 'detail',
  // Projections
  'forecast', 'projection', 'predict', 'estimate',
]

/**
 * Analysis trigger patterns
 */
const ANALYSIS_PATTERNS = [
  /walk\s+me\s+through/i,                          // "Walk me through the financials"
  /break\s*(down|it\s+down)/i,                     // "Break down the revenue"
  /what\s+(are\s+the|potential)\s+(risks?|issues?|concerns?|red\s*flags?)/i,
  /any\s+(risks?|issues?|concerns?|problems?)/i,
  /identify\s+(all|any|the)/i,
  /find\s+(all|any)\s+(issues?|risks?|gaps?)/i,
  /compare\s+.+\s+(to|with|versus|vs)/i,
  /(year|quarter)\s*over\s*(year|quarter)/i,       // YoY, QoQ
  /how\s+does?\s+.+\s+compare/i,
]

// =============================================================================
// Router Implementation
// =============================================================================

/**
 * Route a message to the appropriate path
 *
 * @param message - User message to route
 * @returns RouterResult with path, confidence, and reasoning
 */
export function routeMessage(message: string): RouterResult {
  const normalized = message.trim().toLowerCase()
  const words = normalized.split(/\s+/)

  // Check greeting patterns first (highest priority for vanilla)
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(message)) {
      return {
        path: 'vanilla',
        confidence: 0.95,
        matchedKeywords: [],
        reason: 'Greeting detected',
      }
    }
  }

  // Check meta/capability patterns
  for (const pattern of META_PATTERNS) {
    if (pattern.test(message)) {
      return {
        path: 'vanilla',
        confidence: 0.9,
        matchedKeywords: [],
        reason: 'Meta question about capabilities',
      }
    }
  }

  // Check general knowledge patterns (vanilla)
  for (const pattern of GENERAL_KNOWLEDGE_PATTERNS) {
    if (pattern.test(message)) {
      // But check if it also has deal-specific keywords
      const hasRetrievalKeywords = RETRIEVAL_KEYWORDS.some(kw =>
        normalized.includes(kw) && !['revenue', 'ebitda', 'm&a', 'merger', 'acquisition', 'due diligence', 'cap table'].includes(kw)
      )
      if (!hasRetrievalKeywords) {
        return {
          path: 'vanilla',
          confidence: 0.8,
          matchedKeywords: [],
          reason: 'General knowledge question',
        }
      }
    }
  }

  // Check analysis patterns (before retrieval - analysis is more specific)
  const analysisMatches: string[] = []
  for (const pattern of ANALYSIS_PATTERNS) {
    if (pattern.test(message)) {
      return {
        path: 'analysis',
        confidence: 0.9,
        matchedKeywords: [],
        reason: 'Analysis pattern detected',
      }
    }
  }

  // Check analysis keywords
  for (const keyword of ANALYSIS_KEYWORDS) {
    if (normalized.includes(keyword)) {
      analysisMatches.push(keyword)
    }
  }

  // Strong analysis signal (2+ keywords)
  if (analysisMatches.length >= 2) {
    return {
      path: 'analysis',
      confidence: 0.85,
      matchedKeywords: analysisMatches,
      reason: `Multiple analysis keywords: ${analysisMatches.join(', ')}`,
    }
  }

  // Check retrieval patterns
  for (const pattern of RETRIEVAL_PATTERNS) {
    if (pattern.test(message)) {
      const retrievalMatches = RETRIEVAL_KEYWORDS.filter(kw => normalized.includes(kw))
      return {
        path: 'retrieval',
        confidence: 0.85,
        matchedKeywords: retrievalMatches,
        reason: 'Document query pattern detected',
      }
    }
  }

  // Check retrieval keywords
  const retrievalMatches = RETRIEVAL_KEYWORDS.filter(kw => normalized.includes(kw))
  if (retrievalMatches.length >= 1) {
    // Single analysis keyword bumps to analysis path
    if (analysisMatches.length === 1) {
      return {
        path: 'analysis',
        confidence: 0.7,
        matchedKeywords: [...analysisMatches, ...retrievalMatches],
        reason: `Analysis keyword with context: ${analysisMatches[0]}`,
      }
    }

    return {
      path: 'retrieval',
      confidence: 0.75,
      matchedKeywords: retrievalMatches,
      reason: `Document keywords: ${retrievalMatches.slice(0, 3).join(', ')}`,
    }
  }

  // Default to vanilla for anything else
  return {
    path: 'vanilla',
    confidence: 0.6,
    matchedKeywords: [],
    reason: 'No specific patterns matched - defaulting to vanilla',
  }
}

/**
 * Check if a message is a simple greeting
 */
export function isGreeting(message: string): boolean {
  return GREETING_PATTERNS.some(pattern => pattern.test(message.trim()))
}

/**
 * Check if a message is asking about capabilities
 */
export function isMetaQuestion(message: string): boolean {
  return META_PATTERNS.some(pattern => pattern.test(message))
}

/**
 * Get routing metadata for logging/tracing
 */
export function getRoutingMetadata(result: RouterResult): Record<string, unknown> {
  return {
    path: result.path,
    confidence: result.confidence,
    matchedKeywords: result.matchedKeywords,
    reason: result.reason,
    timestamp: new Date().toISOString(),
  }
}
