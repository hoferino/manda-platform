/**
 * IRL Tools
 *
 * Agent tools for IRL (Information Request List) management and AI-assisted suggestions.
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 *
 * Tools:
 * - generate_irl_suggestions (AC: #1, #2, #4, #5) - Generate IRL suggestions based on deal context
 * - add_to_irl (AC: #3) - Add a suggested item to an IRL
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createLLMClient } from '@/lib/llm/client'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { PromptTemplate } from '@langchain/core/prompts'
import {
  GenerateIRLSuggestionsInputSchema,
  AddToIRLInputSchema,
  IRLSuggestionSchema,
  type IRLSuggestion,
} from '../schemas'
import { formatToolResponse, handleToolError } from './utils'
import { listTemplates, getTemplate } from '@/lib/services/irl-templates'
import { getIRLWithItems, createIRLItem } from '@/lib/services/irls'
import type { IRLTemplate, IRLTemplateItem, IRLItem } from '@/lib/types/irl'

/**
 * Context gathered for IRL suggestions
 */
interface DealContext {
  dealId: string
  dealType: string | null
  industry: string | null
  currentIRLItems: IRLItem[]
  uploadedDocuments: Array<{
    id: string
    name: string
    type: string
    folder_path: string | null
  }>
  templateItems: IRLTemplateItem[]
}

/**
 * Gather deal context for IRL suggestions
 * Implements Task 2: Deal context gathering (AC: #4, #5)
 */
async function gatherDealContext(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  dealId: string,
  currentIRLId?: string,
  dealType?: string
): Promise<DealContext> {
  // Fetch deal metadata
  const { data: deal } = await supabase
    .from('deals')
    .select('id, name, irl_template, industry')
    .eq('id', dealId)
    .single()

  const resolvedDealType = dealType || deal?.irl_template || null
  const industry = deal?.industry || null

  // Fetch current IRL items if IRL ID provided
  let currentIRLItems: IRLItem[] = []
  if (currentIRLId) {
    const irl = await getIRLWithItems(supabase, currentIRLId)
    if (irl) {
      currentIRLItems = irl.items
    }
  }

  // Fetch uploaded documents for this deal
  const { data: documents } = await supabase
    .from('documents')
    .select('id, name, mime_type, folder_path')
    .eq('deal_id', dealId)

  const uploadedDocuments = (documents || []).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.mime_type || 'unknown',
    folder_path: d.folder_path,
  }))

  // Load template items for the deal type
  let templateItems: IRLTemplateItem[] = []
  if (resolvedDealType) {
    const templateId = mapDealTypeToTemplateId(resolvedDealType)
    if (templateId) {
      const template = await getTemplate(templateId)
      if (template) {
        templateItems = template.categories.flatMap((cat) =>
          cat.items.map((item) => ({ ...item, category: cat.name }))
        ) as (IRLTemplateItem & { category: string })[]
      }
    }
  }

  return {
    dealId,
    dealType: resolvedDealType,
    industry,
    currentIRLItems,
    uploadedDocuments,
    templateItems,
  }
}

/**
 * Map deal type string to template ID
 */
function mapDealTypeToTemplateId(dealType: string): string | null {
  const mapping: Record<string, string> = {
    tech_ma: 'tech-ma',
    tech: 'tech-ma',
    software: 'tech-ma',
    saas: 'tech-ma',
    industrial: 'industrial',
    manufacturing: 'industrial',
    pharma: 'pharma',
    healthcare: 'pharma',
    biotech: 'pharma',
    financial: 'financial-services',
    financial_services: 'financial-services',
    fintech: 'financial-services',
    banking: 'financial-services',
  }

  const normalized = dealType.toLowerCase().replace(/[^a-z_]/g, '_')
  return mapping[normalized] || null
}

/**
 * Compare template items against current IRL items
 * Implements Task 4: IRL template comparison (AC: #4)
 */
function findMissingTemplateItems(
  templateItems: (IRLTemplateItem & { category?: string })[],
  currentIRLItems: IRLItem[]
): (IRLTemplateItem & { category: string })[] {
  const currentItemNames = new Set(
    currentIRLItems.map((item) => item.itemName.toLowerCase().trim())
  )

  // Also check for partial matches (e.g., "Financial Statements" matches "Audited Financial Statements")
  const isItemCovered = (templateItemName: string): boolean => {
    const normalizedTemplateName = templateItemName.toLowerCase().trim()

    // Exact match
    if (currentItemNames.has(normalizedTemplateName)) return true

    // Partial match - check if any current item contains the key terms
    for (const currentName of currentItemNames) {
      // Check if significant words overlap
      const templateWords = normalizedTemplateName.split(/\s+/).filter((w) => w.length > 3)
      const currentWords = currentName.split(/\s+/).filter((w) => w.length > 3)

      const matchCount = templateWords.filter((tw) =>
        currentWords.some((cw) => cw.includes(tw) || tw.includes(cw))
      ).length

      if (matchCount >= Math.ceil(templateWords.length * 0.5)) {
        return true
      }
    }

    return false
  }

  return templateItems
    .filter((item) => !isItemCovered(item.name))
    .map((item) => ({
      ...item,
      category: item.category || 'General',
    }))
}

/**
 * Analyze uploaded documents to understand coverage
 * Implements Task 2: Gap analysis consideration (AC: #5)
 */
function analyzeDocumentCoverage(
  documents: DealContext['uploadedDocuments']
): {
  coveredCategories: Set<string>
  documentSummary: string
} {
  const coveredCategories = new Set<string>()

  // Infer categories from document names and types
  const categoryPatterns: Record<string, RegExp[]> = {
    Financial: [/financ/i, /revenue/i, /p&l/i, /income/i, /balance/i, /cash.?flow/i, /budget/i],
    Legal: [/contract/i, /agreement/i, /legal/i, /litigation/i, /incorporat/i, /bylaw/i],
    Technical: [/tech/i, /architecture/i, /system/i, /security/i, /code/i, /api/i],
    Operational: [/org/i, /employee/i, /hr/i, /insurance/i, /policy/i, /procedure/i],
    Commercial: [/customer/i, /sales/i, /pipeline/i, /marketing/i, /pricing/i],
  }

  for (const doc of documents) {
    const docName = doc.name.toLowerCase()
    const folderPath = (doc.folder_path || '').toLowerCase()

    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      if (patterns.some((p) => p.test(docName) || p.test(folderPath))) {
        coveredCategories.add(category)
      }
    }
  }

  const documentSummary = documents.length > 0
    ? `${documents.length} documents uploaded covering: ${Array.from(coveredCategories).join(', ') || 'various categories'}`
    : 'No documents uploaded yet'

  return { coveredCategories, documentSummary }
}

/**
 * Generate IRL suggestion prompt
 * Implements Task 3: Gap analysis prompt (AC: #5)
 */
function buildSuggestionPrompt(context: DealContext): string {
  const { coveredCategories, documentSummary } = analyzeDocumentCoverage(context.uploadedDocuments)

  const currentItemsList = context.currentIRLItems.length > 0
    ? context.currentIRLItems.map((i) => `- ${i.category}: ${i.itemName}`).join('\n')
    : 'No items in current IRL'

  return `You are an M&A due diligence expert. Analyze the current IRL (Information Request List) and uploaded documents to identify missing items that should be requested.

## Deal Context
- Deal Type: ${context.dealType || 'General M&A'}
- Industry: ${context.industry || 'Not specified'}

## Documents Already Uploaded
${documentSummary}

## Current IRL Items
${currentItemsList}

## Task
Identify 5-10 important items that are missing from the IRL based on:
1. Standard due diligence requirements for ${context.dealType || 'M&A'} deals
2. Gaps not covered by uploaded documents
3. Items that experienced analysts typically request

For each suggestion, provide:
1. Category (e.g., Financial, Legal, Technical, Operational, Commercial)
2. Item name (specific document or information)
3. Priority (high/medium/low based on importance for deal evaluation)
4. Rationale (1-2 sentences explaining why this is important)

Output format (JSON array):
[
  {
    "category": "Category Name",
    "itemName": "Specific Item Name",
    "priority": "high|medium|low",
    "rationale": "Why this is important for the deal"
  }
]

Return ONLY the JSON array, no other text.`
}

/**
 * Parse LLM response to suggestions
 */
function parseSuggestionsFromResponse(response: string): IRLSuggestion[] {
  try {
    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[generate_irl_suggestions] No JSON array found in response')
      return []
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (!Array.isArray(parsed)) {
      console.error('[generate_irl_suggestions] Parsed response is not an array')
      return []
    }

    // Validate and map each suggestion
    const suggestions: IRLSuggestion[] = []
    for (const item of parsed) {
      const result = IRLSuggestionSchema.safeParse(item)
      if (result.success) {
        suggestions.push(result.data)
      } else {
        // Try to salvage partially valid items
        if (item.category && item.itemName) {
          suggestions.push({
            category: String(item.category),
            itemName: String(item.itemName),
            priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
            rationale: item.rationale ? String(item.rationale) : 'Recommended for due diligence completeness',
          })
        }
      }
    }

    return suggestions
  } catch (error) {
    console.error('[generate_irl_suggestions] Error parsing suggestions:', error)
    return []
  }
}

/**
 * Generate fallback suggestions based on template comparison
 */
function generateFallbackSuggestions(context: DealContext): IRLSuggestion[] {
  const missingItems = findMissingTemplateItems(
    context.templateItems as (IRLTemplateItem & { category?: string })[],
    context.currentIRLItems
  )

  // Sort by priority and take top 10
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sorted = missingItems.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  return sorted.slice(0, 10).map((item) => ({
    category: item.category,
    itemName: item.name,
    priority: item.priority,
    rationale: item.description || `Standard ${context.dealType || 'M&A'} due diligence requirement`,
  }))
}

/**
 * generate_irl_suggestions
 *
 * Generates IRL item suggestions based on deal context, uploaded documents,
 * and deal type templates.
 *
 * AC: #1 - "What else should I request?" triggers suggestions
 * AC: #2 - Suggestions include category, name, priority, rationale
 * AC: #4 - Suggestions tailored to deal type
 * AC: #5 - Gap analysis considers uploaded documents
 */
export const generateIRLSuggestionsTool = tool(
  async (input) => {
    try {
      const { dealId, currentIRLId, dealType } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Verify user has access to this deal
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('id, name')
        .eq('id', dealId)
        .single()

      if (dealError || !deal) {
        return formatToolResponse(false, 'Deal not found or access denied')
      }

      // Gather context
      const context = await gatherDealContext(supabase, dealId, currentIRLId, dealType)

      // Try LLM-based suggestions first
      let suggestions: IRLSuggestion[] = []

      try {
        const llm = createLLMClient({
          temperature: 0.7,
          maxTokens: 2000,
        })

        const prompt = buildSuggestionPrompt(context)
        const response = await llm.invoke(prompt)
        const responseText = typeof response === 'string'
          ? response
          : response.content?.toString() || ''

        suggestions = parseSuggestionsFromResponse(responseText)
      } catch (llmError) {
        console.error('[generate_irl_suggestions] LLM error, using fallback:', llmError)
      }

      // If LLM failed or returned no suggestions, use template-based fallback
      if (suggestions.length === 0) {
        suggestions = generateFallbackSuggestions(context)
      }

      // Filter out items already in IRL (double-check)
      const currentNames = new Set(
        context.currentIRLItems.map((i) => i.itemName.toLowerCase().trim())
      )
      suggestions = suggestions.filter(
        (s) => !currentNames.has(s.itemName.toLowerCase().trim())
      )

      // Limit to 10 suggestions
      suggestions = suggestions.slice(0, 10)

      if (suggestions.length === 0) {
        return formatToolResponse(true, {
          message: 'Your IRL appears comprehensive! No additional items are recommended at this time.',
          suggestions: [],
          total: 0,
          dealType: context.dealType,
        })
      }

      // Format response message
      const message =
        `Based on the ${context.dealType || 'M&A'} deal context and current documents, here are ${suggestions.length} recommended IRL items:\n\n` +
        suggestions
          .map(
            (s, i) =>
              `${i + 1}. **${s.itemName}** (${s.category}, ${s.priority} priority)\n   ${s.rationale}`
          )
          .join('\n\n') +
        '\n\nWould you like me to add any of these to your IRL? Just say "Add that to my IRL" or specify which items.'

      return formatToolResponse(true, {
        message,
        suggestions,
        total: suggestions.length,
        dealType: context.dealType,
        documentsAnalyzed: context.uploadedDocuments.length,
        currentIRLItemCount: context.currentIRLItems.length,
      })
    } catch (err) {
      return handleToolError(err, 'generate_irl_suggestions')
    }
  },
  {
    name: 'generate_irl_suggestions',
    description: `Generate IRL (Information Request List) item suggestions based on deal context.
Analyzes the deal type, uploaded documents, and current IRL to identify missing items.
Use when the user asks "What else should I request?" or wants IRL recommendations.
Returns suggestions with category, item name, priority, and rationale.`,
    schema: GenerateIRLSuggestionsInputSchema,
  }
)

/**
 * add_to_irl
 *
 * Adds a suggested item to the user's IRL.
 *
 * AC: #3 - "Add that to my IRL" adds the suggested item
 */
export const addToIRLTool = tool(
  async (input) => {
    try {
      const { irlId, category, itemName, priority, description } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Verify IRL exists and user has access
      const { data: irl, error: irlError } = await supabase
        .from('irls')
        .select('id, deal_id, name')
        .eq('id', irlId)
        .single()

      if (irlError || !irl) {
        return formatToolResponse(
          false,
          'IRL not found. Please create an IRL first or provide a valid IRL ID.'
        )
      }

      // Verify user has access to the deal
      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('id')
        .eq('id', irl.deal_id)
        .single()

      if (dealError || !deal) {
        return formatToolResponse(false, 'Access denied to this IRL')
      }

      // Get max sort order for the category
      const { data: existingItems } = await supabase
        .from('irl_items')
        .select('sort_order')
        .eq('irl_id', irlId)
        .eq('category', category)
        .order('sort_order', { ascending: false })
        .limit(1)

      const maxSortOrder = existingItems?.[0]?.sort_order ?? -1
      const newSortOrder = maxSortOrder + 1

      // Create the IRL item
      const newItem = await createIRLItem(supabase, irlId, {
        category,
        itemName,
        priority,
        description,
        sortOrder: newSortOrder,
      })

      if (!newItem) {
        return formatToolResponse(false, 'Failed to add item to IRL')
      }

      return formatToolResponse(true, {
        message: `Added "${itemName}" to your IRL under ${category} with ${priority} priority.`,
        itemId: newItem.id,
        category,
        itemName,
        priority,
      })
    } catch (err) {
      return handleToolError(err, 'add_to_irl')
    }
  },
  {
    name: 'add_to_irl',
    description: `Add an item to an Information Request List (IRL).
Use when the user wants to add a suggested item to their IRL.
Requires the IRL ID, category, item name, and priority.`,
    schema: AddToIRLInputSchema,
  }
)
