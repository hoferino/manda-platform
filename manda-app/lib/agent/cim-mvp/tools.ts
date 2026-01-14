/**
 * CIM MVP Tools
 *
 * Tool definitions for the workflow-based CIM agent.
 * Tools for workflow progression, context saving, outline management, and slide creation.
 *
 * ## Overview
 *
 * This module defines all LangChain tools available to the CIM Builder agent.
 * Tools are organized into three categories:
 *
 * ### Research Tools
 * - `web_search` - Search external sources for market data, competitors
 * - `knowledge_search` - Search the uploaded document knowledge base
 * - `get_section_context` - Get all findings for a CIM section
 *
 * ### Workflow Tools
 * - `advance_workflow` - Move to the next workflow stage
 * - `navigate_to_stage` - Jump back to a previous stage (non-linear navigation)
 * - `save_buyer_persona` - Save buyer type, motivations, concerns
 * - `save_hero_concept` - Save hero concept and investment thesis
 * - `create_outline` - Create the CIM section structure
 * - `update_outline` - Modify outline (add/remove/reorder sections)
 * - `start_section` - Begin working on a specific section
 *
 * ### Output Tools
 * - `update_slide` - Create/update slides with layouts and components
 * - `save_context` - Save gathered company information to memory
 *
 * ## Tool Result Handling
 *
 * Tool results are processed by the `postToolNode` in graph.ts which:
 * - Parses JSON responses from tools
 * - Updates state based on result fields (e.g., `advancedWorkflow`, `buyerPersona`)
 * - Handles special cases like navigation vs. advancement
 *
 * ## Exported Constants
 *
 * - `WORKFLOW_STAGE_ORDER` - Ordered array of all workflow stages
 * - `NAVIGABLE_STAGES` - Stages that can be navigated to (excludes welcome/complete)
 * - `cimMVPTools` - Array of all tool instances for binding to the model
 *
 * ## Usage
 *
 * ```typescript
 * import { cimMVPTools, WORKFLOW_STAGE_ORDER } from './tools'
 *
 * // Bind tools to model
 * const modelWithTools = baseModel.bindTools(cimMVPTools)
 *
 * // Check valid stages
 * if (WORKFLOW_STAGE_ORDER.includes(targetStage)) { ... }
 * ```
 *
 * @module cim-mvp/tools
 * @see {@link ./graph.ts} for tool result processing in postToolNode
 * @see {@link ./prompts.ts} for tool documentation in system prompt
 * @see {@link ./state.ts} for state types updated by tools
 *
 * Story: CIM MVP Workflow Fix
 * Enhancement: Added navigate_to_stage for non-linear workflow
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { searchKnowledge, getFindingsForSection, getCompanyMetadata } from './knowledge-loader'
import type {
  SlideComponent,
  SlideUpdate,
  CIMPhase,
  GatheredContext,
  WorkflowStage,
  BuyerPersona,
  HeroContext,
  CIMOutline,
  CIMSection,
  LayoutType,
  ComponentType,
  ComponentPosition,
  ComponentStyle,
} from './state'

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
        findings: results.slice(0, MAX_KNOWLEDGE_SEARCH_RESULTS),
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
 * Enhanced with layoutType and component positioning for wireframe design.
 */
export const updateSlideTool = tool(
  async ({ sectionId, slideId: existingSlideId, title, layoutType, components }): Promise<string> => {
    const slideId = existingSlideId || `slide-${sectionId}-${nanoid()}`

    const slideUpdate: SlideUpdate = {
      slideId,
      sectionId,
      title,
      layoutType: layoutType as LayoutType | undefined,
      components: components.map((c, i) => ({
        id: c.id || `${slideId}-comp-${i}`,
        type: c.type as ComponentType,
        content: c.content,
        data: c.data,
        position: c.position as ComponentPosition | undefined,
        style: c.style as ComponentStyle | undefined,
        icon: c.icon,
        label: c.label,
      })),
      status: 'draft',
    }

    console.log(`[updateSlideTool] Created slide: ${slideId} for section: ${sectionId} with ${slideUpdate.components.length} components, layout: ${layoutType || 'default'}`)

    // Return full slide data so postToolNode can capture it for state
    return JSON.stringify({
      success: true,
      slideId,
      sectionId,
      title,
      layoutType: layoutType || null,
      components: slideUpdate.components,
      componentCount: slideUpdate.components.length,
      status: 'draft',
      message: 'Slide created successfully. User can review in the preview panel.',
    })
  },
  {
    name: 'update_slide',
    description:
      'Create or update a CIM slide with layout and visual components. Use this when you have gathered enough information to create slide content. The slide will appear in the preview panel for user review.',
    schema: z.object({
      sectionId: z
        .string()
        .describe('CIM section ID from the outline'),
      slideId: z
        .string()
        .optional()
        .describe('Existing slide ID to update, or omit to create new slide'),
      title: z.string().describe('Slide title displayed at the top'),
      layoutType: z
        .enum([
          'full', 'title-only', 'title-content',
          'split-horizontal', 'split-horizontal-weighted', 'split-vertical',
          'quadrant', 'thirds-horizontal', 'thirds-vertical', 'six-grid',
          'sidebar-left', 'sidebar-right', 'hero-with-details',
          'comparison', 'pyramid', 'hub-spoke'
        ])
        .optional()
        .describe('Slide layout type for visual arrangement'),
      components: z
        .array(
          z.object({
            id: z.string().optional().describe('Component ID (auto-generated if not provided)'),
            type: z
              .enum([
                // Text
                'title', 'subtitle', 'heading', 'text', 'bullet_list', 'numbered_list', 'quote',
                // Charts
                'bar_chart', 'horizontal_bar_chart', 'stacked_bar_chart', 'line_chart',
                'area_chart', 'pie_chart', 'waterfall_chart', 'combo_chart', 'scatter_plot',
                // Data
                'table', 'comparison_table', 'metric', 'metric_group', 'gauge', 'progress_bar', 'sparkline',
                // Process
                'timeline', 'milestone_timeline', 'flowchart', 'funnel', 'pipeline',
                'process_steps', 'cycle', 'gantt_chart',
                // Organizational
                'org_chart', 'team_grid', 'hierarchy',
                // Comparison
                'swot', 'matrix', 'venn', 'versus', 'pros_cons', 'feature_comparison',
                // Geographic
                'map', 'location_list',
                // Visual
                'image', 'image_placeholder', 'logo_grid', 'icon_grid', 'screenshot', 'diagram',
                // Callouts
                'callout', 'callout_group', 'stat_highlight', 'key_takeaway', 'annotation',
                // Financial
                'financial_table', 'revenue_breakdown', 'unit_economics', 'growth_trajectory', 'valuation_summary'
              ])
              .describe('Component type'),
            content: z.union([z.string(), z.array(z.string()), z.any()])
              .describe('Component content (string, array for lists, or object for complex data)'),
            data: z.any().optional().describe('Optional structured data for tables/charts'),
            position: z.object({
              region: z.enum(['left', 'right', 'top', 'bottom', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'full']),
              weight: z.number().optional()
            }).optional().describe('Position in the layout'),
            style: z.object({
              emphasis: z.enum(['primary', 'secondary', 'muted', 'accent', 'success', 'warning', 'danger']).optional(),
              size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
              alignment: z.enum(['left', 'center', 'right']).optional()
            }).optional().describe('Visual styling'),
            icon: z.string().optional().describe('Icon name for callouts'),
            label: z.string().optional().describe('Optional label/caption'),
          })
        )
        .describe('Slide components with positioning and styling'),
    }),
  }
)

// =============================================================================
// Workflow Tools (Story 2: CIM MVP Workflow Fix)
// =============================================================================
//
// These tools manage the CIM creation workflow:
// - Stage progression (advance_workflow, navigate_to_stage)
// - Context capture (save_buyer_persona, save_hero_concept, save_context)
// - Structure management (create_outline, update_outline, start_section)
//
// Tool results are JSON objects that postToolNode parses to update state.
// Key result fields:
// - advancedWorkflow + targetStage → updates workflowProgress.currentStage
// - navigatedToStage → indicates backward navigation (preserves completed stages)
// - buyerPersona → updates state.buyerPersona
// - heroContext → updates state.heroContext
// - cimOutline → updates state.cimOutline
// - gatheredContext → merges into state.gatheredContext
// =============================================================================

/**
 * Maximum number of search results to return from knowledge search.
 * Limits response size to keep context manageable.
 */
const MAX_KNOWLEDGE_SEARCH_RESULTS = 10

/**
 * Workflow stage order for validation
 * Exported for use in other modules (e.g., prompts.ts)
 */
export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  'welcome',
  'buyer_persona',
  'hero_concept',
  'investment_thesis',
  'outline',
  'building_sections',
  'complete',
]

/**
 * Navigable stages - stages that can be jumped to via navigate_to_stage
 * Excludes 'welcome' (starting point) and 'complete' (end state)
 */
export const NAVIGABLE_STAGES = [
  'buyer_persona',
  'hero_concept',
  'investment_thesis',
  'outline',
  'building_sections',
] as const

/**
 * Navigate to Stage Tool
 *
 * Allows jumping to a previous workflow stage to revise decisions.
 * Supports non-linear workflow navigation per v3 spec.
 *
 * @remarks
 * - Cannot navigate to 'welcome' (starting point only)
 * - Cannot navigate to 'complete' (must advance through workflow)
 * - Previous work is preserved when navigating backward
 */
export const navigateToStageTool = tool(
  async ({ targetStage, reason }): Promise<string> => {
    // Note: Schema validation via z.enum already ensures valid stage,
    // but we keep this check for runtime safety and better error messages
    if (!NAVIGABLE_STAGES.includes(targetStage as typeof NAVIGABLE_STAGES[number])) {
      console.error(`[navigateToStageTool] Invalid target stage: ${targetStage}`)
      return JSON.stringify({
        success: false,
        error: `Invalid stage: ${targetStage}`,
        validStages: NAVIGABLE_STAGES,
      })
    }

    console.log(`[navigateToStageTool] Navigating to ${targetStage}: ${reason}`)

    const formattedStageName = targetStage.replace(/_/g, ' ')
    return JSON.stringify({
      navigatedToStage: true,
      targetStage,
      reason,
      message: `Navigated to ${formattedStageName} stage. Previous work is preserved - you can revise and continue from here.`,
      // This triggers state update in postToolNode
      advancedWorkflow: true,
    })
  },
  {
    name: 'navigate_to_stage',
    description:
      'Jump to a previous workflow stage to revise decisions. Use when user wants to go back and change buyer persona, hero concept, thesis, or outline. Previous work is preserved.',
    schema: z.object({
      targetStage: z.enum([
        'buyer_persona',
        'hero_concept',
        'investment_thesis',
        'outline',
        'building_sections',
      ]).describe('Target stage to navigate to (cannot go to welcome or complete via navigation)'),
      reason: z.string().describe('Why we are revisiting this stage'),
    }),
  }
)

/**
 * Advance Workflow Tool
 *
 * Moves to the next stage in the CIM workflow checklist.
 * Can only move forward or stay at current stage.
 */
export const advanceWorkflowTool = tool(
  async ({ targetStage, reason }): Promise<string> => {
    console.log(`[advanceWorkflowTool] Advancing to ${targetStage}: ${reason}`)

    return JSON.stringify({
      advancedWorkflow: true,
      targetStage,
      reason,
      message: `Workflow advanced to ${targetStage.replace(/_/g, ' ')} stage.`,
    })
  },
  {
    name: 'advance_workflow',
    description:
      'Move to the next stage in the CIM workflow. Use when current stage objectives are complete. Stages: welcome → buyer_persona → hero_concept → investment_thesis → outline → building_sections → complete',
    schema: z.object({
      targetStage: z.enum([
        'welcome',
        'buyer_persona',
        'hero_concept',
        'investment_thesis',
        'outline',
        'building_sections',
        'complete',
      ]).describe('Target workflow stage'),
      reason: z.string().describe('Why we are advancing to this stage'),
    }),
  }
)

/**
 * Save Buyer Persona Tool
 *
 * Saves the buyer persona context after discussing with user.
 */
export const saveBuyerPersonaTool = tool(
  async ({ type, motivations, concerns }): Promise<string> => {
    const buyerPersona: BuyerPersona = { type, motivations, concerns }

    console.log(`[saveBuyerPersonaTool] Saved buyer persona: ${type}`)

    return JSON.stringify({
      buyerPersona,
      message: `Buyer persona saved: ${type} buyer with ${motivations.length} motivations and ${concerns.length} concerns.`,
    })
  },
  {
    name: 'save_buyer_persona',
    description:
      'Save the buyer persona context. Call after discussing buyer type with user. This helps tailor the CIM narrative.',
    schema: z.object({
      type: z.string().describe('Buyer type: strategic, financial, public_company, competitor, or mixed'),
      motivations: z.array(z.string()).describe('Primary motivations for acquisition'),
      concerns: z.array(z.string()).describe('Key concerns to address proactively in the CIM'),
    }),
  }
)

/**
 * Save Hero Concept Tool
 *
 * Saves the hero concept and investment thesis after user selection.
 */
export const saveHeroConceptTool = tool(
  async ({ selectedHero, asset, timing, opportunity }): Promise<string> => {
    const heroContext: HeroContext = {
      selectedHero,
      investmentThesis: { asset, timing, opportunity },
    }

    console.log(`[saveHeroConceptTool] Saved hero concept: ${selectedHero}`)

    return JSON.stringify({
      heroContext,
      message: `Hero concept saved: "${selectedHero}" with investment thesis components.`,
    })
  },
  {
    name: 'save_hero_concept',
    description:
      'Save the hero concept and investment thesis. Call after user selects/refines the story hook. The investment thesis has 3 parts: Asset (what makes this valuable), Timing (why now), Opportunity (what the buyer gains).',
    schema: z.object({
      selectedHero: z.string().describe('The chosen story hook/hero concept for the CIM'),
      asset: z.string().describe('Investment thesis - Asset: What makes this company valuable'),
      timing: z.string().describe('Investment thesis - Timing: Why is now the right time'),
      opportunity: z.string().describe('Investment thesis - Opportunity: What the buyer gains'),
    }),
  }
)

/**
 * Create Outline Tool
 *
 * Creates the CIM outline structure with auto-generated section IDs.
 * Also creates section divider slides.
 */
export const createOutlineTool = tool(
  async ({ sections }): Promise<string> => {
    const sectionsWithIds: CIMSection[] = sections.map((s) => ({
      id: nanoid(),
      title: s.title,
      description: s.description,
    }))

    // Create section divider slides
    const sectionDividerSlides: SlideUpdate[] = sectionsWithIds.map((s) => ({
      slideId: `divider-${s.id}`,
      sectionId: s.id,
      title: s.title,
      layoutType: 'title-only' as LayoutType,
      components: [
        {
          id: nanoid(),
          type: 'title' as ComponentType,
          content: s.title,
          position: { region: 'center' as const },
        },
      ],
      status: 'draft' as const,
    }))

    const cimOutline: CIMOutline = { sections: sectionsWithIds }

    console.log(`[createOutlineTool] Created outline with ${sectionsWithIds.length} sections`)

    return JSON.stringify({
      cimOutline,
      sectionDividerSlides,
      message: `Outline created with ${sectionsWithIds.length} sections and divider slides.`,
    })
  },
  {
    name: 'create_outline',
    description:
      'Create the CIM outline structure. Call after user approves the proposed outline. This generates section IDs and creates section divider slides.',
    schema: z.object({
      sections: z.array(
        z.object({
          title: z.string().describe('Section title (e.g., "Executive Summary", "Financial Performance")'),
          description: z.string().describe('Brief description of what this section covers'),
        })
      ).describe('Ordered list of CIM sections'),
    }),
  }
)

/**
 * Update Outline Tool
 *
 * Modifies the existing CIM outline (add, remove, reorder, or update sections).
 */
export const updateOutlineTool = tool(
  async ({ action, sectionId, section, newOrder }): Promise<string> => {
    console.log(`[updateOutlineTool] Action: ${action}${sectionId ? ` on section ${sectionId}` : ''}`)

    // Return data for postToolNode to process
    const result: Record<string, unknown> = {
      outlineUpdate: true,
      action,
    }

    if (action === 'add' && section) {
      result.newSection = {
        id: nanoid(),
        title: section.title,
        description: section.description,
      }
      result.message = `Added new section: ${section.title}`
    } else if (action === 'remove' && sectionId) {
      result.removeSectionId = sectionId
      result.message = `Removed section: ${sectionId}`
    } else if (action === 'reorder' && newOrder) {
      result.newOrder = newOrder
      result.message = `Reordered sections`
    } else if (action === 'update' && sectionId && section) {
      result.updateSectionId = sectionId
      result.updatedSection = section
      result.message = `Updated section: ${sectionId}`
    } else {
      result.success = false
      result.error = 'Invalid action or missing required parameters'
    }

    return JSON.stringify(result)
  },
  {
    name: 'update_outline',
    description:
      'Modify the existing CIM outline. Use to add, remove, reorder, or update sections.',
    schema: z.object({
      action: z.enum(['add', 'remove', 'reorder', 'update']).describe('Type of outline modification'),
      sectionId: z.string().optional().describe('Section ID for remove/update actions'),
      section: z.object({
        title: z.string(),
        description: z.string(),
      }).optional().describe('Section data for add/update actions'),
      newOrder: z.array(z.string()).optional().describe('New section ID order for reorder action'),
    }),
  }
)

/**
 * Start Section Tool
 *
 * Begins working on a specific section, initializing its progress tracking.
 */
export const startSectionTool = tool(
  async ({ sectionId }): Promise<string> => {
    console.log(`[startSectionTool] Starting section: ${sectionId}`)

    return JSON.stringify({
      startSection: true,
      sectionId,
      sectionProgress: {
        sectionId,
        status: 'content_development',
        slides: [],
      },
      message: `Started working on section: ${sectionId}`,
    })
  },
  {
    name: 'start_section',
    description:
      'Begin working on a specific CIM section. Call when moving to a new section in the building_sections stage.',
    schema: z.object({
      sectionId: z.string().describe('The section ID from the outline to start working on'),
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
 * All CIM MVP tools exported as an array for model binding.
 *
 * ## Tool Categories
 *
 * ### Research Tools (3)
 * | Tool | Purpose |
 * |------|---------|
 * | `web_search` | External web search via Tavily API |
 * | `knowledge_search` | Search uploaded document knowledge base |
 * | `get_section_context` | Get all findings for a CIM section |
 *
 * ### Workflow Tools (7)
 * | Tool | Purpose |
 * |------|---------|
 * | `advance_workflow` | Move to next stage |
 * | `navigate_to_stage` | Jump to previous stage |
 * | `save_buyer_persona` | Save buyer context |
 * | `save_hero_concept` | Save hero and thesis |
 * | `create_outline` | Create CIM structure |
 * | `update_outline` | Modify CIM structure |
 * | `start_section` | Begin section work |
 *
 * ### Output Tools (2)
 * | Tool | Purpose |
 * |------|---------|
 * | `update_slide` | Create/update slide content |
 * | `save_context` | Save gathered information |
 *
 * ## Usage
 *
 * ```typescript
 * import { cimMVPTools } from './tools'
 *
 * const model = new ChatAnthropic({ ... })
 * const modelWithTools = model.bindTools(cimMVPTools)
 * ```
 *
 * @see {@link ./graph.ts} postToolNode for result processing
 */
export const cimMVPTools = [
  // Research
  webSearchTool,
  knowledgeSearchTool,
  getSectionContextTool,
  // Workflow progression
  advanceWorkflowTool,
  navigateToStageTool,
  saveBuyerPersonaTool,
  saveHeroConceptTool,
  createOutlineTool,
  updateOutlineTool,
  startSectionTool,
  // Output
  updateSlideTool,
  saveContextTool,
]
