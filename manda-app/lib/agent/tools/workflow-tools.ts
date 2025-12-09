/**
 * Workflow Tools
 *
 * Tools for Q&A generation, IRL management, and workflow support.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 *
 * Tools:
 * - suggest_questions (AC: #7) - Generate Q&A suggestions (max 10)
 * - add_to_qa (AC: #8) - Store Q&A item with sources and priority
 * - create_irl (AC: #8) - Create IRL structure (stub until Epic 6)
 * - generate_irl_suggestions (E6.3) - AI-generated IRL suggestions
 * - add_to_irl (E6.3) - Add item to IRL
 */

// Re-export IRL tools from irl-tools.ts
export { generateIRLSuggestionsTool, addToIRLTool } from './irl-tools'

import { tool } from '@langchain/core/tools'
import { createClient } from '@/lib/supabase/server'
import { createLLMClient } from '@/lib/llm/client'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { PromptTemplate } from '@langchain/core/prompts'
import {
  SuggestQuestionsInputSchema,
  AddToQAInputSchema,
  CreateIRLInputSchema,
  type QASuggestion,
} from '../schemas'
import {
  formatToolResponse,
  handleToolError,
} from './utils'

/**
 * suggest_questions
 *
 * Generates M&A-relevant Q&A suggestions for a given topic.
 * Uses LLM to generate contextually appropriate questions.
 *
 * AC: #7 - Hard cap of 10 questions, returns M&A-relevant questions
 */
export const suggestQuestionsTool = tool(
  async (input) => {
    try {
      const { topic, maxCount } = input

      // Hard cap at 10 per AC #7
      const questionCount = Math.min(maxCount, 10)

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Create LLM for question generation
      const llm = createLLMClient({
        temperature: 0.7,
        maxTokens: 1000,
      })

      // Generate questions using LLM
      const questionPrompt = PromptTemplate.fromTemplate(`
You are an M&A due diligence expert. Generate {count} targeted questions for the following topic that an analyst would ask during due diligence.

Topic: {topic}

Requirements:
- Questions should be specific and actionable
- Focus on data that would typically come from the target company
- Include questions about historical data, trends, and risks
- Mix of financial, operational, and strategic questions where relevant
- Questions should help identify gaps in current information

Output format: Return only the questions, one per line, numbered 1-{count}.
`)

      const chain = questionPrompt.pipe(llm).pipe(new StringOutputParser())

      let questionsText: string
      try {
        questionsText = await chain.invoke({
          topic,
          count: questionCount,
        })
      } catch (llmError) {
        console.error('[suggest_questions] LLM error:', llmError)
        // Fall back to template questions if LLM fails
        questionsText = generateFallbackQuestions(topic, questionCount)
      }

      // Parse the questions from the LLM output
      const questions: QASuggestion[] = parseQuestionsFromText(questionsText, topic)

      // Limit to requested count
      const limitedQuestions = questions.slice(0, questionCount)

      const message =
        `Generated ${limitedQuestions.length} question(s) for "${topic}":\n\n` +
        limitedQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n') +
        '\n\nWould you like me to add any of these to the Q&A list?'

      return formatToolResponse(true, {
        message,
        questions: limitedQuestions,
        total: limitedQuestions.length,
        topic,
      })
    } catch (err) {
      return handleToolError(err, 'suggest_questions')
    }
  },
  {
    name: 'suggest_questions',
    description: `Generate M&A due diligence questions for a given topic.
Returns up to 10 targeted questions that analysts would ask during due diligence.
Use this when the user needs help identifying what questions to ask the target company.`,
    schema: SuggestQuestionsInputSchema,
  }
)

/**
 * add_to_qa
 *
 * @deprecated Use add_qa_item from qa-tools.ts instead.
 * This legacy tool stores Q&A pairs (question + answer).
 * The new add_qa_item tool creates questions for the CLIENT to answer
 * (matching the qa_items table schema from Epic 8).
 *
 * Stores a Q&A item with question, answer, sources, and priority.
 *
 * AC: #8 - Stores Q&A item with sources and priority
 */
export const addToQATool = tool(
  async (input) => {
    try {
      const { question, answer, dealId, sources, priority } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Insert Q&A item into qa_lists table
      const { data: qaItem, error: insertError } = await supabase
        .from('qa_lists')
        .insert({
          user_id: user.id,
          deal_id: dealId,
          question,
          answer,
          sources: sources || [],
          priority,
          status: 'active',
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[add_to_qa] Insert error:', insertError)
        return formatToolResponse(false, 'Failed to store Q&A item')
      }

      return formatToolResponse(true, {
        message: `Q&A item added successfully.`,
        qaId: qaItem.id,
        priority,
        sourceCount: sources?.length || 0,
      })
    } catch (err) {
      return handleToolError(err, 'add_to_qa')
    }
  },
  {
    name: 'add_to_qa',
    description: `Store a question-answer pair in the Q&A list.
Include sources for attribution and set priority (high/medium/low).
Use this to capture questions that need to be asked to the target company.`,
    schema: AddToQAInputSchema,
  }
)

/**
 * create_irl
 *
 * Creates an Information Request List (IRL) structure.
 * This is a stub until Epic 6 implementation.
 *
 * AC: #8 - Returns IRL structure (stub until Epic 6)
 */
export const createIRLTool = tool(
  async (input) => {
    try {
      const { dealType } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Stub response until Epic 6
      // Return a template IRL structure based on deal type
      const irlTemplate = generateIRLTemplate(dealType || 'general')

      return formatToolResponse(true, {
        message:
          `IRL template generated for ${dealType || 'general'} deal type.\n\n` +
          `**Categories:**\n` +
          irlTemplate.categories.map((c) => `• ${c.name} (${c.items.length} items)`).join('\n') +
          `\n\nNote: Full IRL management coming in Epic 6.`,
        irl: irlTemplate,
        dealType: dealType || 'general',
        stub: true,
      })
    } catch (err) {
      return handleToolError(err, 'create_irl')
    }
  },
  {
    name: 'create_irl',
    description: `Create an Information Request List (IRL) structure for due diligence.
Returns a template IRL based on the deal type.
Note: Full IRL management coming in Epic 6 - this provides a template structure.`,
    schema: CreateIRLInputSchema,
  }
)

/**
 * Parse questions from LLM text output
 */
function parseQuestionsFromText(text: string, topic: string): QASuggestion[] {
  const lines = text.split('\n').filter((line) => line.trim())
  const questions: QASuggestion[] = []

  for (const line of lines) {
    // Remove numbering (1., 1), etc.)
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').trim()

    if (cleaned && cleaned.length > 10) {
      questions.push({
        question: cleaned,
        relevance: topic,
        priority: inferQuestionPriority(cleaned),
      })
    }
  }

  return questions
}

/**
 * Generate fallback questions when LLM fails
 */
function generateFallbackQuestions(topic: string, count: number): string {
  const templates = [
    `What are the key ${topic} metrics for the past 3 years?`,
    `Are there any outstanding ${topic} issues or concerns?`,
    `What is the ${topic} structure and how has it evolved?`,
    `What are the main risks related to ${topic}?`,
    `How does the ${topic} compare to industry benchmarks?`,
    `What documentation exists for ${topic}?`,
    `Who is responsible for ${topic} and what is their background?`,
    `What are the key contracts related to ${topic}?`,
    `What changes are planned for ${topic} in the next year?`,
    `Are there any pending ${topic} matters that could affect valuation?`,
  ]

  return templates.slice(0, count).map((q, i) => `${i + 1}. ${q}`).join('\n')
}

/**
 * Infer priority from question content
 */
function inferQuestionPriority(question: string): 'high' | 'medium' | 'low' {
  const highPriorityKeywords = [
    'risk',
    'liability',
    'lawsuit',
    'litigation',
    'pending',
    'outstanding',
    'breach',
    'violation',
    'audit',
    'compliance',
    'regulatory',
    'material',
    'significant',
  ]

  const lowerQuestion = question.toLowerCase()

  for (const keyword of highPriorityKeywords) {
    if (lowerQuestion.includes(keyword)) {
      return 'high'
    }
  }

  return 'medium'
}

/**
 * Generate IRL template based on deal type
 */
function generateIRLTemplate(dealType: string): {
  id: string
  name: string
  dealType: string
  categories: Array<{
    name: string
    items: Array<{ name: string; required: boolean }>
  }>
} {
  // Common categories for all deal types
  const commonCategories = [
    {
      name: 'Corporate & Legal',
      items: [
        { name: 'Certificate of Incorporation', required: true },
        { name: 'Bylaws', required: true },
        { name: 'Shareholder Agreements', required: true },
        { name: 'Board Minutes (last 3 years)', required: false },
        { name: 'Litigation Summary', required: true },
      ],
    },
    {
      name: 'Financial',
      items: [
        { name: 'Audited Financial Statements (3 years)', required: true },
        { name: 'Management Accounts (current year)', required: true },
        { name: 'Budget and Forecast', required: true },
        { name: 'Debt Schedule', required: true },
        { name: 'Cap Table', required: true },
      ],
    },
    {
      name: 'Operational',
      items: [
        { name: 'Org Chart', required: true },
        { name: 'Employee Census', required: true },
        { name: 'Key Customer List', required: true },
        { name: 'Vendor Contracts', required: false },
        { name: 'Insurance Policies', required: true },
      ],
    },
    {
      name: 'Technology',
      items: [
        { name: 'System Architecture', required: false },
        { name: 'IP Portfolio', required: true },
        { name: 'Third-Party Software Licenses', required: false },
        { name: 'Security Audit Reports', required: false },
      ],
    },
  ]

  // Add deal-type specific categories
  if (dealType.toLowerCase().includes('tech') || dealType.toLowerCase().includes('software')) {
    commonCategories.push({
      name: 'Technology Deep Dive',
      items: [
        { name: 'Source Code Access', required: true },
        { name: 'Technical Debt Assessment', required: true },
        { name: 'Cloud Infrastructure Summary', required: true },
        { name: 'Data Privacy Compliance', required: true },
      ],
    })
  }

  return {
    id: `irl-template-${Date.now()}`,
    name: `${dealType} IRL Template`,
    dealType,
    categories: commonCategories,
  }
}
