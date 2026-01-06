/**
 * Intent Classification Module
 *
 * Classifies user messages to determine if knowledge retrieval is needed.
 * Story: E11.4 - Intent-Aware Knowledge Retrieval (AC: #1, #2)
 *
 * Intent Types:
 * - greeting: Greetings, thanks, goodbyes - skip retrieval
 * - meta: Questions about the agent or conversation - skip retrieval
 * - factual: Questions requiring knowledge lookup - retrieve
 * - task: Action requests requiring knowledge - retrieve
 *
 * Architecture:
 * - Primary: Semantic similarity router using embeddings (accurate, ~50ms)
 * - Fallback: Fast regex patterns when embeddings unavailable
 *
 * TODO (Future Enhancement):
 * - Add LLM-based classification for ambiguous cases (confidence < 0.7)
 * - Fine-tune embedding model on M&A-specific intents
 * - Add intent confidence score to retrieval decisions
 */

import { VoyageAIClient } from 'voyageai'

/**
 * Intent types for classification
 */
export type IntentType = 'greeting' | 'meta' | 'factual' | 'task'

/**
 * Complexity levels for query routing
 * Story: E13.1 - Enhanced Intent Classification (AC: #1)
 */
export type ComplexityLevel = 'simple' | 'medium' | 'complex'

/**
 * Result of intent classification with confidence score
 */
export interface IntentClassificationResult {
  intent: IntentType
  confidence: number
  method: 'semantic' | 'regex' | 'default'
}

/**
 * Enhanced result with complexity classification
 * Story: E13.1 - Enhanced Intent Classification (AC: #1)
 *
 * Extends IntentClassificationResult with optional complexity fields
 * to maintain backward compatibility with existing callers.
 */
export interface EnhancedIntentResult extends IntentClassificationResult {
  /** Query complexity tier: simple, medium, or complex */
  complexity?: ComplexityLevel
  /** Confidence score (0-1) for complexity classification */
  complexityConfidence?: number
  /** Pre-selected tools based on complexity tier */
  suggestedTools?: string[]
  /** Recommended model based on complexity tier */
  suggestedModel?: string
}

/**
 * Intent examples for semantic similarity matching
 * These serve as "anchors" for each intent category
 */
export const INTENT_EXAMPLES: Record<IntentType, string[]> = {
  greeting: [
    'Hello!',
    'Hi there',
    'Hey',
    'Good morning',
    'Good afternoon',
    'Good evening',
    'Thanks',
    'Thank you',
    'Thanks for your help',
    'Bye',
    'Goodbye',
    'See you later',
    'Cheers',
    'Howdy',
  ],
  meta: [
    'What can you do?',
    'What are your capabilities?',
    'Help me understand what you can do',
    'How do you work?',
    'Tell me about yourself',
    'What features do you have?',
    'Summarize our conversation',
    'Recap what we discussed',
    'What did we talk about?',
    'Remind me what we covered',
    'Can you help me?',
    'How can you assist me?',
  ],
  factual: [
    'What was the Q3 revenue?',
    'What is the EBITDA margin?',
    'How many employees does the company have?',
    'When did they acquire the subsidiary?',
    'What are the key risks?',
    'Tell me about the company',
    'What do we know about revenue?',
    'What is the valuation?',
    'Who are the key executives?',
    'What markets do they operate in?',
    'What about Q4?',
    'And the margins?',
    'Hi, what was the revenue?', // Compound query - should be factual
    'Hello, tell me about the financials', // Compound query
  ],
  task: [
    'Analyze the revenue trend',
    'Compare Q3 vs Q4 performance',
    'Summarize the deal structure',
    'Summarize the financials',
    'Summarize the EBITDA trends',
    'Find any red flags',
    'Calculate the growth rate',
    'Generate a summary',
    'Create a comparison',
    'List the key findings',
    'Identify the risks',
    'Extract the financial metrics',
    'Can you analyze the revenue?',
    'Please summarize the deal',
  ],
}

// =============================================================================
// Complexity Classification Constants (E13.1)
// =============================================================================

/**
 * Complexity signal patterns for query classification
 * Story: E13.1 - Enhanced Intent Classification (AC: #3)
 *
 * Pattern matching order: complex → medium → simple (most specific first)
 * Word count is used as fallback only when no patterns match
 */
export const COMPLEXITY_SIGNALS = {
  // Check complex FIRST (most specific patterns)
  complex: {
    patterns: [
      /\b(analyze|analyse|across all|contradiction|inconsistenc|discrepanc)/i,
      /\b(financial|revenue|ebitda|margin).*\b(\d{4}|\d{1,2}\/\d{2}|Q[1-4])/i,
      /\b(trend|correlation|correlate|impact|implications?|risk assessment)\b/i,
      /\byear[- ]over[- ]year\b/i,
      /\b(pattern|anomal|outlier)\b/i,
      /\bidentify\s+\w*\s*pattern/i,
    ],
  },
  // Then medium
  medium: {
    patterns: [
      /\b(compare|summarize|summarise|find all|list|explain|describe)\b/i,
      /\b(document|file|report)\s+(#?\d+|named|called)\b/i,
      /\b(vs\.?|versus)\b/i,
      /\bfind\s+\w*\s*(parties|related)/i,
    ],
  },
  // Simple is default when no patterns match AND word count < 10
  simple: {
    patterns: [
      /^(hi|hello|hey|thanks|thank you|bye|goodbye)/i,
      /^(what|who|where|when) (is|are|was|were) [a-z]{1,20}(\?|$)/i,
    ],
    maxWords: 10,
  },
} as const

/**
 * Word count boundaries for complexity fallback
 * Only used when no pattern matches
 */
export const WORD_COUNT_FALLBACK = {
  simple: 10, // <10 words = simple
  medium: 30, // 10-30 words = medium, >30 = complex
} as const

/**
 * Tools available per complexity tier
 * Story: E13.1 - Enhanced Intent Classification (AC: #1)
 */
export const TOOLS_BY_COMPLEXITY: Record<ComplexityLevel, string[] | 'all'> = {
  simple: [], // No tools - direct LLM response
  medium: [
    'query_knowledge_base',
    'get_document_info',
    'search_knowledge_graph',
    'get_finding',
    'get_qa_item',
  ],
  complex: 'all', // Full tool access or route to specialist
}

/**
 * Model recommendations per complexity tier
 * Story: E13.1 - Enhanced Intent Classification (AC: #1)
 */
export const MODEL_BY_COMPLEXITY: Record<ComplexityLevel, string> = {
  simple: 'gemini-2.0-flash-lite',
  medium: 'gemini-2.5-pro',
  complex: 'claude-sonnet-4-20250514',
}

/**
 * Fallback regex patterns for intent classification
 * Used when semantic classification is unavailable
 */
export const FALLBACK_PATTERNS = {
  greeting: [
    /^(hi|hello|hey|thanks|thank you|bye|goodbye|good morning|good evening|good afternoon|good night)(\s|!|,|$)/i,
    /^(howdy|greetings|yo|sup|hiya|cheers)(\s|!|,|$)/i,
  ],
  meta: [
    /^(what can you|help me understand|how do you|tell me about yourself)/i,
    /^(summarize|recap|what did we|review our|remind me what we)\s+(our |the )?(conversation|discussion|chat)/i,
    /^(can you|could you|would you) (help|assist)(\s|$|\?)/i,
    /^(what (are|is) your|do you have|are you able)/i,
  ],
  task: [
    /^(analyze|compare|calculate|compute|create|generate|list|find|identify|extract)/i,
    /^summarize the /i,
    /^(can you|could you|would you|please) (analyze|compare|calculate|create|generate|find|summarize)/i,
  ],
}

/**
 * Alias for backward compatibility with tests
 * @deprecated Use FALLBACK_PATTERNS instead
 */
export const SKIP_RETRIEVAL_PATTERNS = FALLBACK_PATTERNS

// =============================================================================
// Complexity Classification Functions (E13.1)
// =============================================================================

/**
 * Result of complexity classification
 */
interface ComplexityResult {
  complexity: ComplexityLevel
  confidence: number
}

/**
 * Classify query complexity using pattern matching and word count
 * Story: E13.1 - Enhanced Intent Classification (AC: #2, #3)
 *
 * Pattern matching takes precedence over word count.
 * Order: complex → medium → simple (most specific first)
 *
 * @param message - User message to classify
 * @returns ComplexityResult with complexity level and confidence
 */
export function classifyComplexity(message: string): ComplexityResult {
  const trimmed = message.trim().toLowerCase()
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length

  // Check complex patterns FIRST (most specific)
  for (const pattern of COMPLEXITY_SIGNALS.complex.patterns) {
    if (pattern.test(trimmed)) {
      return { complexity: 'complex', confidence: 0.9 }
    }
  }

  // Check medium patterns
  for (const pattern of COMPLEXITY_SIGNALS.medium.patterns) {
    if (pattern.test(trimmed)) {
      return { complexity: 'medium', confidence: 0.85 }
    }
  }

  // Check simple patterns (greetings, simple questions)
  for (const pattern of COMPLEXITY_SIGNALS.simple.patterns) {
    if (pattern.test(trimmed)) {
      // Only simple if word count is also low
      if (wordCount <= COMPLEXITY_SIGNALS.simple.maxWords) {
        return { complexity: 'simple', confidence: 0.9 }
      }
      // Pattern matched but too many words - could be compound query
      break
    }
  }

  // Fallback to word count heuristic
  if (wordCount < WORD_COUNT_FALLBACK.simple) {
    return { complexity: 'simple', confidence: 0.6 }
  } else if (wordCount <= WORD_COUNT_FALLBACK.medium) {
    return { complexity: 'medium', confidence: 0.6 }
  } else {
    return { complexity: 'complex', confidence: 0.6 }
  }
}

/**
 * Check if a complexity level has unrestricted tool access
 * Story: E13.1 - Enhanced Intent Classification
 *
 * @param complexity - The complexity level to check
 * @returns true if all tools should be available (complex queries)
 *
 * @example
 * ```typescript
 * if (hasAllToolsAccess('complex')) {
 *   // Load all 17 tools
 * } else {
 *   // Load only suggested tools
 * }
 * ```
 */
export function hasAllToolsAccess(complexity: ComplexityLevel): boolean {
  return TOOLS_BY_COMPLEXITY[complexity] === 'all'
}

/**
 * Get suggested tools for a complexity level
 * Story: E13.1 - Enhanced Intent Classification
 *
 * Returns specific tool list for simple/medium, empty array for complex.
 * Use `hasAllToolsAccess()` to check if complex query needs all tools.
 *
 * @param complexity - The complexity level
 * @returns Array of tool names (empty for simple or complex)
 *
 * @example
 * ```typescript
 * const tools = getSuggestedTools('medium')
 * // ['query_knowledge_base', 'get_document_info', ...]
 *
 * const complexTools = getSuggestedTools('complex')
 * // [] - use hasAllToolsAccess() to check if all tools needed
 * ```
 */
export function getSuggestedTools(complexity: ComplexityLevel): string[] {
  const tools = TOOLS_BY_COMPLEXITY[complexity]
  return tools === 'all' ? [] : tools
}

/**
 * Get suggested model for a complexity level
 * Story: E13.1 - Enhanced Intent Classification
 *
 * @param complexity - The complexity level
 * @returns Model identifier string
 *
 * @example
 * ```typescript
 * getSuggestedModel('simple')  // 'gemini-2.0-flash-lite'
 * getSuggestedModel('medium')  // 'gemini-2.5-pro'
 * getSuggestedModel('complex') // 'claude-sonnet-4-20250514'
 * ```
 */
export function getSuggestedModel(complexity: ComplexityLevel): string {
  return MODEL_BY_COMPLEXITY[complexity]
}

// =============================================================================
// Embedding Cache for Semantic Router
// =============================================================================

interface EmbeddingCache {
  examples: Record<IntentType, number[][]>
  initialized: boolean
  lastError?: string
}

const embeddingCache: EmbeddingCache = {
  examples: {
    greeting: [],
    meta: [],
    factual: [],
    task: [],
  },
  initialized: false,
}

/**
 * Get Voyage AI client (lazy initialization)
 */
function getVoyageClient(): VoyageAIClient | null {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    return null
  }
  return new VoyageAIClient({ apiKey })
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i]!
    const bVal = b[i]!
    dotProduct += aVal * bVal
    normA += aVal * aVal
    normB += bVal * bVal
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

/**
 * Initialize embedding cache with intent examples
 * Called lazily on first semantic classification request
 */
async function initializeEmbeddingCache(): Promise<boolean> {
  if (embeddingCache.initialized) return true

  const client = getVoyageClient()
  if (!client) {
    embeddingCache.lastError = 'VOYAGE_API_KEY not set'
    return false
  }

  try {
    // Generate embeddings for all intent examples
    for (const intent of Object.keys(INTENT_EXAMPLES) as IntentType[]) {
      const examples = INTENT_EXAMPLES[intent]
      const response = await client.embed({
        input: examples,
        model: 'voyage-3-lite', // Fast, cheap model for intent classification
      })

      embeddingCache.examples[intent] = response.data?.map((d) => d.embedding ?? []) ?? []
    }

    embeddingCache.initialized = true
    console.log('[intent] Semantic router initialized with Voyage embeddings')
    return true
  } catch (error) {
    embeddingCache.lastError = error instanceof Error ? error.message : 'Unknown error'
    console.warn('[intent] Failed to initialize semantic router:', embeddingCache.lastError)
    return false
  }
}

/**
 * Classify intent using semantic similarity
 *
 * @param message - User message to classify
 * @returns Classification result with confidence, or null if unavailable
 */
async function classifyIntentSemantic(message: string): Promise<IntentClassificationResult | null> {
  // Ensure cache is initialized
  if (!embeddingCache.initialized) {
    const success = await initializeEmbeddingCache()
    if (!success) return null
  }

  const client = getVoyageClient()
  if (!client) return null

  try {
    // Generate embedding for the input message
    const response = await client.embed({
      input: [message],
      model: 'voyage-3-lite',
    })

    const messageEmbedding = response.data?.[0]?.embedding
    if (!messageEmbedding) return null

    // Find best matching intent
    let bestIntent: IntentType = 'factual'
    let bestScore = 0

    for (const intent of Object.keys(embeddingCache.examples) as IntentType[]) {
      const exampleEmbeddings = embeddingCache.examples[intent]

      for (const exampleEmbedding of exampleEmbeddings) {
        const similarity = cosineSimilarity(messageEmbedding, exampleEmbedding)
        if (similarity > bestScore) {
          bestScore = similarity
          bestIntent = intent
        }
      }
    }

    return {
      intent: bestIntent,
      confidence: bestScore,
      method: 'semantic',
    }
  } catch (error) {
    console.warn('[intent] Semantic classification failed:', error)
    return null
  }
}

/**
 * Classify intent using regex patterns (fast fallback)
 *
 * @param message - User message to classify
 * @returns Classification result
 */
function classifyIntentRegex(message: string): IntentClassificationResult {
  const trimmed = message.trim()

  // Check if message contains a question - compound queries should favor factual/task
  const hasQuestion = trimmed.includes('?')

  // Check greeting patterns - but only if there's no question mark
  // This handles compound queries like "Hi, what was the revenue?"
  if (!hasQuestion) {
    for (const pattern of FALLBACK_PATTERNS.greeting) {
      if (pattern.test(trimmed)) {
        return { intent: 'greeting', confidence: 0.8, method: 'regex' }
      }
    }
  }

  // Check task patterns BEFORE meta patterns
  for (const pattern of FALLBACK_PATTERNS.task) {
    if (pattern.test(trimmed)) {
      return { intent: 'task', confidence: 0.8, method: 'regex' }
    }
  }

  // Check meta patterns
  for (const pattern of FALLBACK_PATTERNS.meta) {
    if (pattern.test(trimmed)) {
      return { intent: 'meta', confidence: 0.8, method: 'regex' }
    }
  }

  // Default: assume factual intent - retrieve knowledge
  return { intent: 'factual', confidence: 0.5, method: 'default' }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Classify the intent of a user message (async version with semantic routing)
 *
 * Uses semantic similarity for accurate classification, falls back to regex if unavailable.
 *
 * @param message - User message to classify
 * @returns Promise<IntentClassificationResult> - Classification with confidence
 *
 * @example
 * ```typescript
 * const result = await classifyIntentAsync('Hello!')
 * // { intent: 'greeting', confidence: 0.92, method: 'semantic' }
 *
 * const result = await classifyIntentAsync('Hi, what was the revenue?')
 * // { intent: 'factual', confidence: 0.85, method: 'semantic' }
 * ```
 */
export async function classifyIntentAsync(message: string): Promise<EnhancedIntentResult> {
  // Try semantic classification first
  const semanticResult = await classifyIntentSemantic(message)

  let baseResult: IntentClassificationResult

  if (semanticResult && semanticResult.confidence >= 0.6) {
    baseResult = semanticResult
  } else {
    // Fall back to regex if semantic unavailable or low confidence
    const regexResult = classifyIntentRegex(message)

    // If semantic had a result but low confidence, use it if it matches regex
    if (semanticResult && semanticResult.intent === regexResult.intent) {
      baseResult = {
        intent: semanticResult.intent,
        confidence: Math.max(semanticResult.confidence, regexResult.confidence),
        method: 'semantic',
      }
    } else {
      baseResult = regexResult
    }
  }

  // Add complexity classification (E13.1 AC: #1, #5)
  const complexityResult = classifyComplexity(message)
  const suggestedTools = getSuggestedTools(complexityResult.complexity)
  const suggestedModel = getSuggestedModel(complexityResult.complexity)

  const result: EnhancedIntentResult = {
    ...baseResult,
    complexity: complexityResult.complexity,
    complexityConfidence: complexityResult.confidence,
    suggestedTools: suggestedTools.length > 0 ? suggestedTools : undefined,
    suggestedModel,
  }

  // E13.1 AC: #7 - Log complexity classification for LangSmith traces
  // LangSmith captures structured JSON logs from stdout when LANGCHAIN_TRACING_V2=true
  // This provides observability without requiring direct LangSmith SDK integration
  // For deeper integration, use getIntentTraceMetadata() with LangChain callbacks
  if (process.env.LANGCHAIN_TRACING_V2 === 'true' || process.env.NODE_ENV === 'development') {
    console.log(
      JSON.stringify({
        event: 'intent_classification',
        intent: result.intent,
        intentConfidence: result.confidence,
        intentMethod: result.method,
        complexity: result.complexity,
        complexityConfidence: result.complexityConfidence,
        suggestedModel: result.suggestedModel,
        suggestedToolsCount: result.suggestedTools?.length ?? 0,
        hasAllTools: hasAllToolsAccess(result.complexity!),
        timestamp: new Date().toISOString(),
      })
    )
  }

  return result
}

/**
 * Extract trace metadata from an intent classification result
 * Story: E13.1 - Enhanced Intent Classification (AC: #7)
 *
 * Use this to add intent/complexity metadata to LangChain/LangSmith traces.
 *
 * @param result - The classification result to extract metadata from
 * @returns Structured metadata object for trace integration
 *
 * @example
 * ```typescript
 * const result = await classifyIntentAsync(message)
 * const metadata = getIntentTraceMetadata(result)
 * // Add to LangChain callback: { metadata }
 * ```
 */
export function getIntentTraceMetadata(result: EnhancedIntentResult): Record<string, unknown> {
  return {
    intent: result.intent,
    intentConfidence: result.confidence,
    intentMethod: result.method,
    complexity: result.complexity,
    complexityConfidence: result.complexityConfidence,
    suggestedModel: result.suggestedModel,
    suggestedToolsCount: result.suggestedTools?.length ?? 0,
    hasAllTools: result.complexity ? hasAllToolsAccess(result.complexity) : false,
  }
}

/**
 * Classify the intent of a user message (sync version for backwards compatibility)
 *
 * @deprecated Use classifyIntentAsync for accurate semantic classification
 *
 * @param message - User message to classify
 * @returns IntentType - The classified intent
 */
export function classifyIntent(message: string): IntentType {
  return classifyIntentRegex(message).intent
}

/**
 * Classify the intent of a user message with complexity (sync version)
 * Story: E13.1 - Enhanced Intent Classification (AC: #6)
 *
 * Returns same shape as async version for consistency.
 * Uses regex-only classification (no API calls).
 *
 * @param message - User message to classify
 * @returns EnhancedIntentResult with complexity classification
 */
export function classifyIntentWithComplexity(message: string): EnhancedIntentResult {
  const regexResult = classifyIntentRegex(message)
  const complexityResult = classifyComplexity(message)
  const suggestedTools = getSuggestedTools(complexityResult.complexity)
  const suggestedModel = getSuggestedModel(complexityResult.complexity)

  return {
    ...regexResult,
    complexity: complexityResult.complexity,
    complexityConfidence: complexityResult.confidence,
    suggestedTools: suggestedTools.length > 0 ? suggestedTools : undefined,
    suggestedModel,
  }
}

/**
 * Determine if knowledge retrieval should be performed for an intent
 *
 * @param intent - The classified intent
 * @returns boolean - True if retrieval should be performed
 */
export function shouldRetrieve(intent: IntentType, complexity?: ComplexityLevel): boolean {
  // E13.1 AC: #5 - Complexity override: medium/complex always retrieves
  // Example: "Hello, analyze revenue trends" → intent=greeting, complexity=complex → RETRIEVE
  if (complexity === 'medium' || complexity === 'complex') {
    return true
  }
  // Original logic for backward compatibility when complexity not provided
  return intent === 'factual' || intent === 'task'
}

/**
 * Get human-readable description of an intent
 *
 * @param intent - The intent type
 * @returns string - Description of the intent
 */
export function getIntentDescription(intent: IntentType): string {
  switch (intent) {
    case 'greeting':
      return 'Greeting or pleasantry'
    case 'meta':
      return 'Question about agent capabilities or conversation'
    case 'factual':
      return 'Information-seeking question requiring knowledge'
    case 'task':
      return 'Action request requiring knowledge'
  }
}

/**
 * Check if semantic router is available
 */
export function isSemanticRouterAvailable(): boolean {
  return !!process.env.VOYAGE_API_KEY
}

/**
 * Get semantic router status for debugging
 */
export function getSemanticRouterStatus(): {
  available: boolean
  initialized: boolean
  error?: string
} {
  return {
    available: isSemanticRouterAvailable(),
    initialized: embeddingCache.initialized,
    error: embeddingCache.lastError,
  }
}
