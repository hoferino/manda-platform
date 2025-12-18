/**
 * Intent Classification Unit Tests
 *
 * Story: E11.4 - Intent-Aware Knowledge Retrieval (AC: #1, #2)
 * Tests for the intent classification module that determines if knowledge retrieval is needed.
 */

import { describe, it, expect } from 'vitest'
import {
  classifyIntent,
  shouldRetrieve,
  getIntentDescription,
  SKIP_RETRIEVAL_PATTERNS,
  type IntentType,
} from '@/lib/agent/intent'

// ============================================================================
// Greeting Intent Tests (AC: #2 - Skip retrieval for greetings)
// ============================================================================

describe('Intent Classification - Greeting', () => {
  const greetingMessages = [
    'Hi',
    'Hello',
    'Hey',
    'Thanks',
    'Thank you',
    'Thanks for the help',
    'Bye',
    'Goodbye',
    'Good morning',
    'Good evening',
    'Good afternoon',
    'Good night',
    'Howdy',
    'Greetings',
    'Yo',
    'Sup',
    'Hiya',
    'Cheers',
    'HELLO',
    'Hello there!',
    'Hi, how are you?',
    'Thank you so much!',
  ]

  it.each(greetingMessages)('should classify "%s" as greeting', (message) => {
    expect(classifyIntent(message)).toBe('greeting')
  })

  it('should skip retrieval for greeting intent', () => {
    expect(shouldRetrieve('greeting')).toBe(false)
  })

  it('should trim whitespace before classification', () => {
    expect(classifyIntent('  Hello  ')).toBe('greeting')
    expect(classifyIntent('\n\tHi\n')).toBe('greeting')
  })
})

// ============================================================================
// Meta Intent Tests (AC: #2 - Skip retrieval for meta questions)
// ============================================================================

describe('Intent Classification - Meta', () => {
  const metaMessages = [
    'What can you do?',
    'What can you help me with?',
    'Help me understand your capabilities',
    'How do you work?',
    'Tell me about yourself',
    'Summarize our conversation',
    'Recap what we discussed',
    'What did we talk about?',
    'Review our conversation',
    'Remind me what we discussed',
    'Can you help me?',
    'Could you assist me?',
    'Would you help me understand?',
    'What are your capabilities?',
    'What is your purpose?',
    'Do you have access to the internet?',
    'Are you able to search the web?',
    'Can you explain how you work?',
  ]

  it.each(metaMessages)('should classify "%s" as meta', (message) => {
    expect(classifyIntent(message)).toBe('meta')
  })

  it('should skip retrieval for meta intent', () => {
    expect(shouldRetrieve('meta')).toBe(false)
  })
})

// ============================================================================
// Factual Intent Tests (AC: #1 - Retrieve for factual questions)
// ============================================================================

describe('Intent Classification - Factual', () => {
  const factualMessages = [
    'What was Q3 revenue?',
    'Tell me about the EBITDA margins',
    'What is the company valuation?',
    'How many employees does the company have?',
    'What are the key risks?',
    'Describe the competitive landscape',
    'What contracts are in place?',
    'Who are the major customers?',
    'What is the debt structure?',
    'When was the company founded?',
    'Where is the headquarters located?',
    'What products do they sell?',
    'How much cash do they have?',
    'What was the growth rate last year?',
    'Are there any pending lawsuits?',
    'What intellectual property do they own?',
  ]

  it.each(factualMessages)('should classify "%s" as factual', (message) => {
    expect(classifyIntent(message)).toBe('factual')
  })

  it('should retrieve for factual intent', () => {
    expect(shouldRetrieve('factual')).toBe(true)
  })
})

// ============================================================================
// Task Intent Tests (AC: #1 - Retrieve for task requests)
// ============================================================================

describe('Intent Classification - Task', () => {
  const taskMessages = [
    'Analyze the financial statements',
    'Compare Q1 and Q2 performance',
    'Calculate the EBITDA margin',
    'Compute the debt-to-equity ratio',
    'Create a summary of the risks',
    'Generate a list of key findings',
    'List all the contracts',
    'Summarize the deal structure',
    'Find inconsistencies in the data',
    'Identify potential red flags',
    'Extract the key terms from the contract',
    'Can you analyze the revenue trends?',
    'Could you compare these two documents?',
    'Would you calculate the growth rate?',
    'Please analyze the customer base',
  ]

  it.each(taskMessages)('should classify "%s" as task', (message) => {
    expect(classifyIntent(message)).toBe('task')
  })

  it('should retrieve for task intent', () => {
    expect(shouldRetrieve('task')).toBe(true)
  })
})

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Intent Classification - Edge Cases', () => {
  it('should handle empty string', () => {
    expect(classifyIntent('')).toBe('factual') // Default
  })

  it('should handle whitespace only', () => {
    expect(classifyIntent('   ')).toBe('factual') // Default
  })

  it('should handle mixed case', () => {
    expect(classifyIntent('HELLO')).toBe('greeting')
    expect(classifyIntent('HeLLo')).toBe('greeting')
    expect(classifyIntent('WHAT CAN YOU DO?')).toBe('meta')
  })

  it('should default to factual for ambiguous messages', () => {
    // These don't match any skip patterns, so default to factual (safe)
    expect(classifyIntent('I need some information')).toBe('factual')
    expect(classifyIntent('Show me the details')).toBe('factual')
    expect(classifyIntent('Please help')).toBe('factual')
  })

  it('should not misclassify mid-sentence greetings as greeting intent', () => {
    // "Hello" at start = greeting, but factual questions starting with other words
    expect(classifyIntent('The company said hello to investors')).toBe('factual')
    expect(classifyIntent('Revenue was good thanks to new customers')).toBe('factual')
  })
})

// ============================================================================
// Pattern Configuration Tests
// ============================================================================

describe('SKIP_RETRIEVAL_PATTERNS', () => {
  it('should have greeting patterns array', () => {
    expect(SKIP_RETRIEVAL_PATTERNS.greeting).toBeDefined()
    expect(Array.isArray(SKIP_RETRIEVAL_PATTERNS.greeting)).toBe(true)
    expect(SKIP_RETRIEVAL_PATTERNS.greeting.length).toBeGreaterThan(0)
  })

  it('should have meta patterns array', () => {
    expect(SKIP_RETRIEVAL_PATTERNS.meta).toBeDefined()
    expect(Array.isArray(SKIP_RETRIEVAL_PATTERNS.meta)).toBe(true)
    expect(SKIP_RETRIEVAL_PATTERNS.meta.length).toBeGreaterThan(0)
  })

  it('should have all patterns as RegExp objects', () => {
    for (const pattern of SKIP_RETRIEVAL_PATTERNS.greeting) {
      expect(pattern).toBeInstanceOf(RegExp)
    }
    for (const pattern of SKIP_RETRIEVAL_PATTERNS.meta) {
      expect(pattern).toBeInstanceOf(RegExp)
    }
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getIntentDescription', () => {
  it('should return description for greeting', () => {
    const desc = getIntentDescription('greeting')
    expect(desc).toBe('Greeting or pleasantry')
  })

  it('should return description for meta', () => {
    const desc = getIntentDescription('meta')
    expect(desc).toContain('agent')
  })

  it('should return description for factual', () => {
    const desc = getIntentDescription('factual')
    expect(desc).toContain('knowledge')
  })

  it('should return description for task', () => {
    const desc = getIntentDescription('task')
    expect(desc).toContain('Action')
  })
})

describe('shouldRetrieve', () => {
  const testCases: Array<[IntentType, boolean]> = [
    ['greeting', false],
    ['meta', false],
    ['factual', true],
    ['task', true],
  ]

  it.each(testCases)('shouldRetrieve(%s) should return %s', (intent, expected) => {
    expect(shouldRetrieve(intent)).toBe(expected)
  })
})
