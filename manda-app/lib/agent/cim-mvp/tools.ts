/**
 * CIM MVP Tools
 *
 * Tool definitions for the simplified CIM workflow agent.
 * Tools: web_search, read_source, update_slide, navigate_phase
 *
 * Story: CIM MVP Fast Track
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { searchKnowledge, getFindingsForSection, getCompanyMetadata } from './knowledge-loader'
import type { SlideComponent, SlideUpdate, CIMPhase, GatheredContext } from './state'

/**
 * Web Search Tool
 *
 * Searches the web for market data, competitor information, industry trends,
 * or other external context not in the documents.
 */
export const webSearchTool = tool(
  async ({ query }): Promise<string> => {
    // Use Tavily for web search if available, otherwise return placeholder
    const tavilyApiKey = process.env.TAVILY_API_KEY

    if (!tavilyApiKey) {
      console.log('[webSearchTool] TAVILY_API_KEY not set, returning mock response')
      return JSON.stringify({
        success: false,
        message: 'Web search not configured. TAVILY_API_KEY environment variable required.',
        query,
        suggestion: 'Configure Tavily API key to enable web search for market data and competitor research.',
      })
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: 'advanced',
          include_answer: true,
          include_raw_content: false,
          max_results: 5,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`)
      }

      const data = await response.json()

      return JSON.stringify({
        success: true,
        answer: data.answer,
        results: data.results?.map((r: { title: string; url: string; content: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
        })),
      })
    } catch (error) {
      console.error('[webSearchTool] Error:', error)
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      })
    }
  },
  {
    name: 'web_search',
    description:
      'Search the web for market data, competitor information, industry trends, or other external context not in the documents. Use this for TAM/SAM data, industry benchmarks, competitor research, and market trends.',
    schema: z.object({
      query: z.string().describe('Search query for market research, competitor info, or industry data'),
    }),
  }
)

/**
 * Knowledge Search Tool
 *
 * Searches the JSON knowledge base extracted from deal documents.
 * More reliable than reading raw documents.
 */
export const knowledgeSearchTool = tool(
  async ({ query, section }): Promise<string> => {
    try {
      const results = searchKnowledge(query, section)

      if (results.length === 0) {
        return JSON.stringify({
          success: true,
          found: false,
          message: `No findings matching "${query}"${section ? ` in section ${section}` : ''}`,
          suggestion: 'Try a different search term or check the data gaps.',
        })
      }

      return JSON.stringify({
        success: true,
        found: true,
        count: results.length,
        findings: results.slice(0, 10), // Limit to top 10
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Knowledge search failed',
      })
    }
  },
  {
    name: 'knowledge_search',
    description:
      'Search the knowledge base extracted from deal documents. Use this to find specific information like financials, team members, product details, or any data from the uploaded documents.',
    schema: z.object({
      query: z.string().describe('Search query to find in the knowledge base'),
      section: z
        .string()
        .optional()
        .describe('Optional section to limit search (e.g., "financial_performance", "management_team")'),
    }),
  }
)

/**
 * Get Section Context Tool
 *
 * Retrieves all findings for a specific CIM section.
 * Use when building a section and need all available data.
 */
export const getSectionContextTool = tool(
  async ({ sectionPath }): Promise<string> => {
    try {
      const findings = getFindingsForSection(sectionPath)
      const metadata = getCompanyMetadata()

      if (findings.length === 0) {
        return JSON.stringify({
          success: true,
          section: sectionPath,
          found: false,
          company: metadata?.company_name,
          message: `No findings available for section: ${sectionPath}`,
        })
      }

      return JSON.stringify({
        success: true,
        section: sectionPath,
        found: true,
        company: metadata?.company_name,
        count: findings.length,
        findings: findings.map((f) => ({
          id: f.id,
          content: f.content,
          source: `${f.source.document}, ${f.source.location}`,
          confidence: f.confidence,
        })),
      })
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get section context',
      })
    }
  },
  {
    name: 'get_section_context',
    description:
      'Get all findings for a specific CIM section. Use when you need comprehensive context before creating slide content. Section paths use dot notation (e.g., "company_overview.history", "financial_performance.revenue").',
    schema: z.object({
      sectionPath: z
        .string()
        .describe(
          'Section path in dot notation (e.g., "executive_summary", "company_overview.history", "financial_performance.revenue")'
        ),
    }),
  }
)

/**
 * Update Slide Tool
 *
 * Creates or updates a CIM slide with structured components.
 * Returns slide data that will be streamed to the UI for real-time preview.
 */
export const updateSlideTool = tool(
  async ({ sectionId, title, components }): Promise<string> => {
    const slideId = `slide-${sectionId}-${Date.now()}`

    const slideUpdate: SlideUpdate = {
      slideId,
      sectionId,
      title,
      components: components.map((c, i) => ({
        id: `${slideId}-comp-${i}`,
        type: c.type as SlideComponent['type'],
        content: c.content,
        data: c.data,
      })),
      status: 'draft',
    }

    console.log(`[updateSlideTool] Created slide: ${slideId} for section: ${sectionId} with ${slideUpdate.components.length} components`)

    // Return full slide data so postToolNode can capture it for state
    return JSON.stringify({
      success: true,
      slideId,
      sectionId,
      title,
      components: slideUpdate.components,  // Include full components for state update
      componentCount: slideUpdate.components.length,
      status: 'draft',
      message: 'Slide created successfully. User can review in the preview panel.',
    })
  },
  {
    name: 'update_slide',
    description:
      'Create or update a CIM slide. Use this when you have gathered enough information to create slide content for a section. The slide will appear in the preview panel for user review.',
    schema: z.object({
      sectionId: z
        .string()
        .describe(
          'CIM section ID (e.g., "executive_summary", "company_overview", "financial_performance")'
        ),
      title: z.string().describe('Slide title displayed at the top'),
      components: z
        .array(
          z.object({
            type: z
              .enum(['heading', 'text', 'bullet_list', 'table', 'chart', 'metric'])
              .describe('Component type'),
            content: z.string().describe('Component content (text, markdown for bullets, JSON for tables/charts)'),
            data: z.unknown().optional().describe('Optional structured data for tables/charts'),
          })
        )
        .describe('Slide components in display order'),
    }),
  }
)

/**
 * Navigate Phase Tool
 *
 * Moves to a different CIM section. Use when the current section is complete
 * or when the user wants to skip ahead or go back.
 */
export const navigatePhaseTool = tool(
  async ({ targetPhase, reason }): Promise<string> => {
    const validPhases: CIMPhase[] = [
      'executive_summary',
      'company_overview',
      'management_team',
      'products_services',
      'market_opportunity',
      'business_model',
      'financial_performance',
      'competitive_landscape',
      'growth_strategy',
      'risk_factors',
      'appendix',
    ]

    if (!validPhases.includes(targetPhase as CIMPhase)) {
      return JSON.stringify({
        success: false,
        error: `Invalid phase: ${targetPhase}`,
        validPhases,
      })
    }

    console.log(`[navigatePhaseTool] Navigating to ${targetPhase}: ${reason}`)

    return JSON.stringify({
      success: true,
      navigatedTo: targetPhase,
      reason,
      message: `Now working on ${targetPhase.replace(/_/g, ' ')} section.`,
    })
  },
  {
    name: 'navigate_phase',
    description:
      'Move to a different CIM section. Use when the user wants to skip ahead, go back, or when the current section is complete.',
    schema: z.object({
      targetPhase: z
        .string()
        .describe(
          'Target CIM phase: executive_summary, company_overview, management_team, products_services, market_opportunity, business_model, financial_performance, competitive_landscape, growth_strategy, risk_factors, appendix'
        ),
      reason: z.string().describe('Brief reason for navigating to this phase'),
    }),
  }
)

/**
 * Save Context Tool
 *
 * Saves gathered information to persistent state. Use this after the user
 * provides company information to ensure it's remembered for future interactions.
 * This is the agent's "short-term memory" for the CIM workflow.
 */
export const saveContextTool = tool(
  async (context: Partial<GatheredContext>): Promise<string> => {
    // Count what was saved for feedback
    const savedFields: string[] = []

    if (context.companyName) savedFields.push('company name')
    if (context.description) savedFields.push('description')
    if (context.foundingYear) savedFields.push('founding year')
    if (context.employeeCount) savedFields.push('employee count')
    if (context.revenue) savedFields.push('revenue')
    if (context.revenueGrowth) savedFields.push('revenue growth')
    if (context.grossMargin) savedFields.push('gross margin')
    if (context.customerCount) savedFields.push('customer count')
    if (context.retentionRate) savedFields.push('retention rate')
    if (context.nrr) savedFields.push('NRR')
    if (context.ltvCac) savedFields.push('LTV/CAC')
    if (context.investmentHighlights?.length) savedFields.push(`${context.investmentHighlights.length} investment highlights`)
    if (context.founders?.length) savedFields.push(`${context.founders.length} founders`)
    if (context.products?.length) savedFields.push(`${context.products.length} products`)
    if (context.competitors?.length) savedFields.push(`${context.competitors.length} competitors`)
    if (context.growthPlans?.length) savedFields.push(`${context.growthPlans.length} growth plans`)
    if (context.risks?.length) savedFields.push(`${context.risks.length} risks`)
    if (context.notes?.length) savedFields.push(`${context.notes.length} notes`)

    console.log(`[saveContextTool] Saving: ${savedFields.join(', ')}`)

    // The actual context is returned and will be merged into state by the graph
    return JSON.stringify({
      success: true,
      savedFields,
      message: `Saved ${savedFields.length} fields to context.`,
      // Return the context so graph can merge it
      gatheredContext: context,
    })
  },
  {
    name: 'save_context',
    description:
      'Save company information gathered from the user to memory. ALWAYS use this after the user provides information about their company (financials, team, products, etc.). This ensures the information is remembered for building the CIM.',
    schema: z.object({
      companyName: z.string().optional().describe('Company name'),
      description: z.string().optional().describe('What the company does'),
      foundingYear: z.number().optional().describe('Year founded'),
      headquarters: z.string().optional().describe('HQ location'),
      employeeCount: z.number().optional().describe('Number of employees'),
      revenue: z.string().optional().describe('Revenue (e.g., "$8.2M ARR")'),
      revenueGrowth: z.string().optional().describe('YoY revenue growth (e.g., "71%")'),
      grossMargin: z.string().optional().describe('Gross margin percentage'),
      ebitda: z.string().optional().describe('EBITDA'),
      burnRate: z.string().optional().describe('Monthly burn rate'),
      runway: z.string().optional().describe('Runway in months'),
      customerCount: z.number().optional().describe('Number of customers'),
      retentionRate: z.string().optional().describe('Gross revenue retention'),
      nrr: z.string().optional().describe('Net revenue retention'),
      ltvCac: z.string().optional().describe('LTV/CAC ratio'),
      paybackMonths: z.number().optional().describe('CAC payback in months'),
      investmentHighlights: z.array(z.string()).optional().describe('Key selling points for investors'),
      founders: z.array(z.object({
        name: z.string(),
        role: z.string(),
        background: z.string().optional(),
      })).optional().describe('Founder information'),
      keyExecutives: z.array(z.object({
        name: z.string(),
        role: z.string(),
        background: z.string().optional(),
      })).optional().describe('Key executive information'),
      products: z.array(z.object({
        name: z.string(),
        description: z.string(),
      })).optional().describe('Products or services'),
      targetMarket: z.string().optional().describe('Target market description'),
      valueProposition: z.string().optional().describe('Core value proposition'),
      tam: z.string().optional().describe('Total Addressable Market'),
      sam: z.string().optional().describe('Serviceable Addressable Market'),
      som: z.string().optional().describe('Serviceable Obtainable Market'),
      marketGrowth: z.string().optional().describe('Market growth rate'),
      competitors: z.array(z.object({
        name: z.string(),
        differentiator: z.string().optional(),
      })).optional().describe('Competitor information'),
      competitiveAdvantages: z.array(z.string()).optional().describe('Competitive advantages/moats'),
      growthPlans: z.array(z.string()).optional().describe('Growth strategy items'),
      risks: z.array(z.object({
        risk: z.string(),
        mitigation: z.string().optional(),
      })).optional().describe('Risks and mitigations'),
      notes: z.array(z.string()).optional().describe('Other relevant notes'),
    }),
  }
)

/**
 * All CIM MVP tools
 */
export const cimMVPTools = [
  webSearchTool,
  knowledgeSearchTool,
  getSectionContextTool,
  updateSlideTool,
  navigatePhaseTool,
  saveContextTool,
]
