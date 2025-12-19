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
 * Result of intent classification with confidence score
 */
export interface IntentClassificationResult {
  intent: IntentType
  confidence: number
  method: 'semantic' | 'regex' | 'default'
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
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
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
export async function classifyIntentAsync(message: string): Promise<IntentClassificationResult> {
  // Try semantic classification first
  const semanticResult = await classifyIntentSemantic(message)

  if (semanticResult && semanticResult.confidence >= 0.6) {
    return semanticResult
  }

  // Fall back to regex if semantic unavailable or low confidence
  const regexResult = classifyIntentRegex(message)

  // If semantic had a result but low confidence, use it if it matches regex
  if (semanticResult && semanticResult.intent === regexResult.intent) {
    return {
      intent: semanticResult.intent,
      confidence: Math.max(semanticResult.confidence, regexResult.confidence),
      method: 'semantic',
    }
  }

  return regexResult
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
 * Determine if knowledge retrieval should be performed for an intent
 *
 * @param intent - The classified intent
 * @returns boolean - True if retrieval should be performed
 */
export function shouldRetrieve(intent: IntentType): boolean {
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
