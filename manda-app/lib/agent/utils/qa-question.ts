/**
 * Q&A Question Drafting Utility
 *
 * Helps draft professional, client-facing questions for the Q&A list.
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 *
 * AC: #2 - The AI drafts a well-formed question based on the conversation context
 *
 * Design Notes:
 * - Questions should be specific, professional, and actionable
 * - Include time periods and context when available
 * - The LLM will ultimately refine the question, but this provides structure
 */

import type { QACategory } from '../../types/qa'

/**
 * Options for drafting a Q&A question
 */
export interface DraftQuestionOptions {
  /** The original query or topic */
  query: string
  /** Specific topic or subject matter */
  topic?: string
  /** Time period to request (e.g., "past 3 years", "2024") */
  timePeriod?: string
  /** Additional context that might help frame the question */
  context?: string
  /** The inferred category for domain-specific phrasing */
  category?: QACategory
}

/**
 * Result of drafting a question
 */
export interface DraftedQuestion {
  /** The formatted question */
  question: string
  /** Suggested priority based on topic */
  suggestedPriority: 'high' | 'medium' | 'low'
  /** Whether this is a standard template or custom */
  isTemplated: boolean
}

/**
 * Standard question templates by category
 * These provide professional phrasing for common M&A topics
 */
const QUESTION_TEMPLATES: Record<string, { template: string; priority: 'high' | 'medium' | 'low' }> =
  {
    // Financial templates
    revenue: {
      template:
        'Please provide historical revenue data {{timePeriod}}, including any breakdown by product line, customer segment, or geography.',
      priority: 'high',
    },
    ebitda: {
      template:
        'What is the EBITDA {{timePeriod}}? Please include any adjustments made and the rationale for each.',
      priority: 'high',
    },
    'cash flow': {
      template:
        'Please provide cash flow statements {{timePeriod}}, including operating, investing, and financing activities.',
      priority: 'high',
    },
    margin: {
      template:
        'What are the gross and operating margin trends {{timePeriod}}? Please explain any significant changes.',
      priority: 'high',
    },
    costs: {
      template:
        'Please provide a detailed breakdown of operating costs {{timePeriod}}, categorized by fixed vs. variable.',
      priority: 'medium',
    },

    // Legal templates
    litigation: {
      template:
        'Please provide a summary of all pending, threatened, or resolved litigation matters {{timePeriod}}, including potential exposure amounts.',
      priority: 'high',
    },
    contracts: {
      template:
        'Please provide a summary of all material contracts, including key terms, counterparties, and renewal dates.',
      priority: 'high',
    },
    ip: {
      template:
        'Please provide a complete inventory of intellectual property assets, including patents, trademarks, and trade secrets.',
      priority: 'high',
    },
    compliance: {
      template:
        'Please describe your current regulatory compliance status, including any pending audits or known gaps.',
      priority: 'medium',
    },

    // Operations templates
    churn: {
      template:
        'What is the historical customer churn rate (monthly and annual) {{timePeriod}}, including any breakdown by customer segment or product line?',
      priority: 'high',
    },
    customers: {
      template:
        'Please provide details on your top 20 customers by revenue, including contract terms, tenure, and any concentration risks.',
      priority: 'high',
    },
    suppliers: {
      template:
        'Please provide details on key suppliers and vendors, including any single-source dependencies or critical supplier relationships.',
      priority: 'medium',
    },

    // Market templates
    'market share': {
      template:
        'What is your estimated market share in your primary markets? Please include the basis for these estimates.',
      priority: 'medium',
    },
    competitors: {
      template:
        'Please identify your top 5 competitors and describe your competitive positioning relative to each.',
      priority: 'medium',
    },

    // Technology templates
    'tech stack': {
      template:
        'Please provide an overview of your technology stack, including core systems, cloud infrastructure, and any technical debt.',
      priority: 'medium',
    },
    security: {
      template:
        'Please describe your cybersecurity measures, including any recent security audits, certifications (SOC 2, ISO 27001), and incident history.',
      priority: 'high',
    },

    // HR templates
    headcount: {
      template:
        'Please provide current headcount by department and location, including any planned changes.',
      priority: 'medium',
    },
    'key employees': {
      template:
        'Please identify key employees critical to business operations, including their roles, tenure, and any retention arrangements.',
      priority: 'high',
    },
    compensation: {
      template:
        'Please provide an overview of compensation structure, including salary ranges, bonus programs, and equity arrangements.',
      priority: 'medium',
    },
  }

/**
 * Draft a professional Q&A question from a query
 *
 * @param options - Options for drafting the question
 * @returns A formatted question with suggested priority
 *
 * @example
 * draftQAQuestion({ query: "What's the churn rate?", timePeriod: "past 3 years" })
 * // { question: "What is the historical customer churn rate...", suggestedPriority: "high", isTemplated: true }
 */
export function draftQAQuestion(options: DraftQuestionOptions): DraftedQuestion {
  const { query, topic, timePeriod, context, category } = options

  // Normalize the query for template matching
  const normalizedQuery = (topic || query).toLowerCase().trim()

  // Try to find a matching template
  for (const [key, { template, priority }] of Object.entries(QUESTION_TEMPLATES)) {
    if (normalizedQuery.includes(key)) {
      const formattedTimePeriod = timePeriod ? `for ${timePeriod}` : 'for the past 3 years'
      const question = template.replace('{{timePeriod}}', formattedTimePeriod)

      return {
        question,
        suggestedPriority: priority,
        isTemplated: true,
      }
    }
  }

  // No template match - create a custom question
  return createCustomQuestion(options)
}

/**
 * Create a custom question when no template matches
 */
function createCustomQuestion(options: DraftQuestionOptions): DraftedQuestion {
  const { query, topic, timePeriod, context, category } = options

  const subject = topic || extractSubject(query)
  const timeClause = timePeriod ? ` for ${timePeriod}` : ''
  const contextClause = context ? ` ${context}` : ''

  // Build the question based on the category
  let question: string
  let priority: 'high' | 'medium' | 'low' = 'medium'

  switch (category) {
    case 'Financials':
      question = `Please provide detailed financial data on ${subject}${timeClause}, including any relevant breakdowns and explanations.${contextClause}`
      priority = 'high'
      break

    case 'Legal':
      question = `Please provide documentation and details regarding ${subject}${timeClause}, including any material issues or pending matters.${contextClause}`
      priority = 'high'
      break

    case 'Operations':
      question = `Please describe ${subject}${timeClause}, including any metrics, trends, and significant changes.${contextClause}`
      break

    case 'Market':
      question = `Please provide information about ${subject}${timeClause}, including supporting data or analysis.${contextClause}`
      break

    case 'Technology':
      question = `Please describe ${subject}, including current state, any known issues, and planned changes.${contextClause}`
      break

    case 'HR':
      question = `Please provide details on ${subject}${timeClause}, including current status and any planned changes.${contextClause}`
      break

    default:
      question = `Please provide information about ${subject}${timeClause}.${contextClause}`
  }

  return {
    question: cleanQuestion(question),
    suggestedPriority: priority,
    isTemplated: false,
  }
}

/**
 * Extract the main subject from a query
 */
function extractSubject(query: string): string {
  // Remove common question words and phrases
  const cleanedQuery = query
    .replace(
      /^(what is|what are|what's|tell me about|can you tell me|do you know|how much|how many|is there|are there)\s+/i,
      ''
    )
    .replace(/\?$/g, '')
    .trim()

  // Capitalize first letter
  return cleanedQuery.charAt(0).toLowerCase() + cleanedQuery.slice(1)
}

/**
 * Clean up a question for professional formatting
 */
function cleanQuestion(question: string): string {
  return question
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\s+\./g, '.') // Fix space before period
    .replace(/\.\s*\./g, '.') // Fix double periods
    .trim()
}

/**
 * Enhance a user's question to make it more professional
 *
 * @param rawQuestion - The user's raw question
 * @param category - Optional category for context
 * @returns Enhanced professional question
 */
export function enhanceQuestion(rawQuestion: string, category?: QACategory): string {
  let enhanced = rawQuestion.trim()

  // Ensure it ends with a question mark or period
  if (!enhanced.endsWith('?') && !enhanced.endsWith('.')) {
    enhanced += '?'
  }

  // Capitalize first letter
  enhanced = enhanced.charAt(0).toUpperCase() + enhanced.slice(1)

  // Add professional context if missing
  if (!enhanced.toLowerCase().includes('please') && !enhanced.toLowerCase().includes('could')) {
    enhanced = 'Could you ' + enhanced.charAt(0).toLowerCase() + enhanced.slice(1)
  }

  return enhanced
}

/**
 * Suggest a default time period based on the topic
 */
export function suggestTimePeriod(topic: string): string {
  const lowerTopic = topic.toLowerCase()

  // Financial metrics typically need 3 years of history
  if (
    lowerTopic.includes('revenue') ||
    lowerTopic.includes('ebitda') ||
    lowerTopic.includes('profit') ||
    lowerTopic.includes('margin') ||
    lowerTopic.includes('financial')
  ) {
    return 'the past 3 years'
  }

  // Customer metrics may need longer history
  if (lowerTopic.includes('churn') || lowerTopic.includes('retention')) {
    return 'the past 3 years'
  }

  // Legal matters typically look back 5 years
  if (lowerTopic.includes('litigation') || lowerTopic.includes('lawsuit')) {
    return 'the past 5 years'
  }

  // Default to current state + recent history
  return 'the current period and past 2 years'
}
