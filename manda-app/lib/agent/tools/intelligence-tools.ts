/**
 * Intelligence Tools
 *
 * Tools for detecting contradictions and finding gaps in knowledge.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Tools:
 * - detect_contradictions (AC: #2) - Query Neo4j for CONTRADICTS relationships
 * - find_gaps (AC: #4) - Analyze coverage against IRL requirements
 */

import { tool } from '@langchain/core/tools'
import { createClient } from '@/lib/supabase/server'
import {
  DetectContradictionsInputSchema,
  FindGapsInputSchema,
  type ContradictionOutput,
  type GapOutput,
  type FindingWithSource,
  type SourceCitation,
} from '../schemas'
import {
  formatToolResponse,
  handleToolError,
  formatTemporalContext,
} from './utils'

/**
 * detect_contradictions
 *
 * Detects contradictions in the knowledge base for a given topic.
 * Per P1 spec: Only flags conflicts if same period + no SUPERSEDES + diff docs.
 *
 * AC: #2 - Returns conflicting findings side-by-side with temporal context
 */
export const detectContradictionsTool = tool(
  async (input) => {
    try {
      const { topic, includeResolved } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Query contradictions table with joined findings
      // Using select('*') with type assertions to handle schema variations
      let query = supabase
        .from('contradictions')
        .select(`
          id,
          confidence,
          status,
          detected_at,
          finding_a_id,
          finding_b_id,
          finding_a:findings!contradictions_finding_a_id_fkey (
            id,
            text,
            confidence,
            domain,
            status,
            source_document,
            document_id,
            page_number,
            created_at
          ),
          finding_b:findings!contradictions_finding_b_id_fkey (
            id,
            text,
            confidence,
            domain,
            status,
            source_document,
            document_id,
            page_number,
            created_at
          )
        `)

      // Filter by status if not including resolved
      if (!includeResolved) {
        query = query.eq('status', 'unresolved')
      }

      const { data: contradictions, error: queryError } = await query.limit(20)

      if (queryError) {
        console.error('[detect_contradictions] Query error:', queryError)
        return formatToolResponse(false, 'Failed to query contradictions')
      }

      if (!contradictions || contradictions.length === 0) {
        return formatToolResponse(true, {
          message: `No contradictions found${topic ? ` for topic "${topic}"` : ''}.`,
          contradictions: [],
          total: 0,
        })
      }

      // Filter by topic if provided (search in finding text)
      const topicLower = topic.toLowerCase()
      const filteredContradictions = contradictions.filter((c) => {
        const findingA = c.finding_a as { text?: string } | null
        const findingB = c.finding_b as { text?: string } | null
        return (
          findingA?.text?.toLowerCase().includes(topicLower) ||
          findingB?.text?.toLowerCase().includes(topicLower)
        )
      })

      // Transform to output format
      type FindingData = {
        id: string
        text: string
        confidence: number | null
        domain: string | null
        status: string | null
        source_document: string | null
        document_id: string | null
        page_number: number | null
        created_at: string | null
      }

      const output: ContradictionOutput[] = filteredContradictions.map((c) => {
        const findingA = c.finding_a as unknown as FindingData | null
        const findingB = c.finding_b as unknown as FindingData | null

        const createFinding = (f: FindingData | null): FindingWithSource => ({
          id: f?.id || '',
          text: f?.text || 'Unknown finding',
          confidence: f?.confidence || null,
          domain: (f?.domain as FindingWithSource['domain']) || null,
          status: (f?.status as FindingWithSource['status']) || 'pending',
          source: {
            documentId: f?.document_id || '',
            documentName: f?.source_document || 'Unknown document',
            location: f?.page_number ? `Page ${f.page_number}` : 'Unknown',
          },
          dateReferenced: f?.created_at || null,
        })

        // Determine temporal context
        const dateA = findingA?.created_at
        const dateB = findingB?.created_at
        let temporalContext = ''
        if (dateA && dateB) {
          const periodA = formatTemporalContext(dateA)
          const periodB = formatTemporalContext(dateB)
          if (periodA === periodB) {
            temporalContext = `Both from ${periodA}`
          } else {
            temporalContext = `${periodA} vs ${periodB}`
          }
        }

        return {
          id: c.id,
          findingA: createFinding(findingA),
          findingB: createFinding(findingB),
          confidence: c.confidence,
          status: (c.status as ContradictionOutput['status']) || 'unresolved',
          temporalContext: temporalContext || undefined,
        }
      })

      // Format response per P3 spec (Due Diligence Check behavior)
      const responseMessage = output.length === 0
        ? `No contradictions found for topic "${topic}".`
        : `Found ${output.length} contradiction(s) for "${topic}":\n\n` +
          output.map((c, i) =>
            `**${i + 1}. ${c.findingA.text.slice(0, 100)}...**\n` +
            `   vs: ${c.findingB.text.slice(0, 100)}...\n` +
            `   Sources: ${c.findingA.source.documentName} vs ${c.findingB.source.documentName}` +
            (c.temporalContext ? `\n   ${c.temporalContext}` : '')
          ).join('\n\n')

      return formatToolResponse(true, {
        message: responseMessage,
        contradictions: output,
        total: output.length,
      })
    } catch (err) {
      return handleToolError(err, 'detect_contradictions')
    }
  },
  {
    name: 'detect_contradictions',
    description: `Detect contradictions in the knowledge base for a given topic.
Returns conflicting findings side-by-side with temporal context.
Use this when the user asks about "red flags", "concerns", "conflicts", or inconsistencies.`,
    schema: DetectContradictionsInputSchema,
  }
)

/**
 * find_gaps
 *
 * Identifies gaps in knowledge coverage against IRL requirements.
 * Analyzes missing IRL items and domain coverage.
 *
 * AC: #4 - Returns gap analysis grouped by domain
 */
export const findGapsTool = tool(
  async (input) => {
    try {
      const { category } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      const gaps: GapOutput[] = []

      // 1. Check IRL gaps (required items that are not received)
      if (category === 'irl_missing' || category === 'all') {
        // Query IRL items - they reference their IRL via irl_id
        // Items are "missing" if marked as required - the status tracking
        // happens at the IRL level or via separate tables
        const { data: irlItems, error: irlError } = await supabase
          .from('irl_items')
          .select(`
            id,
            name,
            category,
            required
          `)
          .eq('required', true)
          .limit(50)

        if (!irlError && irlItems) {
          // Type assertion for safety
          type IrlItem = {
            id: string
            name: string
            category: string
            required: boolean | null
          }
          for (const item of irlItems as IrlItem[]) {
            gaps.push({
              id: `irl-${item.id}`,
              category: 'irl_missing',
              description: `Missing: ${item.name} (${item.category})`,
              priority: 'high', // Required IRL items are high priority
              domain: mapCategoryToDomain(item.category),
              suggestedAction: `Request ${item.name} from the target company`,
            })
          }
        }
      }

      // 2. Check information gaps (domains with low finding coverage)
      if (category === 'information_gap' || category === 'all') {
        // Get finding counts by domain
        const { data: domainCounts, error: countError } = await supabase
          .from('findings')
          .select('domain')

        if (!countError && domainCounts) {
          // Count findings per domain
          const counts: Record<string, number> = {
            financial: 0,
            operational: 0,
            market: 0,
            legal: 0,
            technical: 0,
          }

          for (const finding of domainCounts) {
            const domain = finding.domain as keyof typeof counts | null
            if (domain && counts[domain] !== undefined) {
              const current = counts[domain]
              counts[domain] = current + 1
            }
          }

          // Identify domains with low coverage (< 5 findings)
          const minExpected = 5
          for (const [domain, count] of Object.entries(counts)) {
            if (count < minExpected) {
              gaps.push({
                id: `gap-${domain}`,
                category: 'information_gap',
                description: `Low coverage in ${domain} domain (${count}/${minExpected} findings)`,
                priority: count === 0 ? 'high' : 'medium',
                domain: domain as GapOutput['domain'],
                suggestedAction: `Upload more ${domain} documents or add findings manually`,
              })
            }
          }
        }
      }

      // Sort gaps by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

      // Group gaps by category for the response message
      const irlGaps = gaps.filter((g) => g.category === 'irl_missing')
      const infoGaps = gaps.filter((g) => g.category === 'information_gap')

      let message = ''
      if (gaps.length === 0) {
        message = 'No significant gaps identified in the current knowledge base.'
      } else {
        message = `Found ${gaps.length} gap(s):\n\n`

        if (irlGaps.length > 0) {
          message += `**IRL Items Not Received (${irlGaps.length}):**\n`
          message += irlGaps.map((g) => `• ${g.description}`).join('\n')
          message += '\n\n'
        }

        if (infoGaps.length > 0) {
          message += `**Information Gaps (${infoGaps.length}):**\n`
          message += infoGaps.map((g) => `• ${g.description}`).join('\n')
        }

        message += '\n\nWould you like me to generate Q&A items for the missing information?'
      }

      return formatToolResponse(true, {
        message,
        gaps,
        total: gaps.length,
        irlGaps: irlGaps.length,
        infoGaps: infoGaps.length,
      })
    } catch (err) {
      return handleToolError(err, 'find_gaps')
    }
  },
  {
    name: 'find_gaps',
    description: `Identify gaps in knowledge coverage against IRL requirements.
Analyzes missing IRL items and domain coverage.
Use this when the user asks "what's missing", "gaps", or wants to know IRL coverage.`,
    schema: FindGapsInputSchema,
  }
)

/**
 * Map IRL category to finding domain
 */
function mapCategoryToDomain(category: string | null): GapOutput['domain'] {
  if (!category) return null

  const mapping: Record<string, GapOutput['domain']> = {
    'financial': 'financial',
    'financials': 'financial',
    'accounting': 'financial',
    'legal': 'legal',
    'contracts': 'legal',
    'compliance': 'legal',
    'operations': 'operational',
    'operational': 'operational',
    'hr': 'operational',
    'market': 'market',
    'commercial': 'market',
    'sales': 'market',
    'technology': 'technical',
    'technical': 'technical',
    'it': 'technical',
  }

  const lowerCategory = category.toLowerCase()
  for (const [key, domain] of Object.entries(mapping)) {
    if (lowerCategory.includes(key)) {
      return domain
    }
  }

  return null
}
