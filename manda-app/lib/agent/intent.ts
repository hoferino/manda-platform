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
 * Uses fast regex patterns (no LLM call needed) for minimal latency.
 */

/**
 * Intent types for classification
 */
export type IntentType = 'greeting' | 'meta' | 'factual' | 'task'

/**
 * Configurable patterns for intent classification
 * Patterns that match will skip knowledge retrieval
 */
export const SKIP_RETRIEVAL_PATTERNS = {
  /**
   * Greeting patterns - casual greetings, thanks, goodbyes
   * These don't need knowledge retrieval
   */
  greeting: [
    /^(hi|hello|hey|thanks|thank you|bye|goodbye|good morning|good evening|good afternoon|good night)/i,
    /^(howdy|greetings|yo|sup|hiya|cheers)/i,
  ],

  /**
   * Meta patterns - questions about the agent or conversation
   * These are about capabilities/conversation, not deal facts
   */
  meta: [
    /^(what can you|help me understand|how do you|tell me about yourself)/i, // About agent
    /^(summarize|recap|what did we|review our|remind me what we)/i, // About conversation
    /^(can you|could you|would you) (help|assist|explain how)/i, // Requests about capabilities
    /^(what (are|is) your|do you have|are you able)/i, // Agent capability questions
  ],
} as const

/**
 * Classify the intent of a user message
 *
 * @param message - User message to classify
 * @returns IntentType - The classified intent
 *
 * @example
 * ```typescript
 * classifyIntent('Hello!') // 'greeting'
 * classifyIntent('What can you do?') // 'meta'
 * classifyIntent('What was Q3 revenue?') // 'factual'
 * classifyIntent('Summarize the EBITDA trends') // 'task'
 * ```
 */
export function classifyIntent(message: string): IntentType {
  const trimmed = message.trim()

  // Check greeting patterns first
  for (const pattern of SKIP_RETRIEVAL_PATTERNS.greeting) {
    if (pattern.test(trimmed)) {
      return 'greeting'
    }
  }

  // Check task patterns BEFORE meta patterns
  // This ensures "Summarize the deal structure" is classified as task
  // while "Summarize our conversation" is classified as meta
  const taskPatterns = [
    /^(analyze|compare|calculate|compute|create|generate|list|find|identify|extract)/i,
    // "summarize the X" where X is deal-related data is a task
    /^summarize the /i,
    /^(can you|could you|would you|please) (analyze|compare|calculate|create|generate|find|summarize)/i,
  ]

  for (const pattern of taskPatterns) {
    if (pattern.test(trimmed)) {
      return 'task'
    }
  }

  // Check meta patterns - about agent capabilities or conversation
  for (const pattern of SKIP_RETRIEVAL_PATTERNS.meta) {
    if (pattern.test(trimmed)) {
      return 'meta'
    }
  }

  // Default: assume factual intent - retrieve knowledge
  // This is the safe default to avoid hallucinations
  return 'factual'
}

/**
 * Determine if knowledge retrieval should be performed for an intent
 *
 * @param intent - The classified intent
 * @returns boolean - True if retrieval should be performed
 *
 * @example
 * ```typescript
 * shouldRetrieve('greeting') // false
 * shouldRetrieve('meta') // false
 * shouldRetrieve('factual') // true
 * shouldRetrieve('task') // true
 * ```
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
