/**
 * CIM MVP Tools
 *
 * Tool definitions for the workflow-based CIM agent.
 * Tools for workflow progression, context saving, outline management, and slide creation.
 *
 * Story: CIM MVP Workflow Fix
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { searchKnowledge, getFindingsForSection, getCompanyMetadata } from './knowledge-loader'
import type { IKnowledgeService, KnowledgeSearchResult } from './knowledge-service'

// =============================================================================
// Global Knowledge Service (Story: CIM Knowledge Toggle)
// =============================================================================
//
// ARCHITECTURE NOTE: This uses a global singleton pattern for the knowledge service.
// This approach was chosen because LangChain tools don't have access to LangGraph's
// configurable state during execution. The service is set by the API route before
// invoking the graph, and tools read from it during execution.
//
// RACE CONDITION CAVEAT: In a high-concurrency serverless environment, concurrent
// requests could potentially overwrite each other's knowledge service. However:
// 1. Next.js API routes run in isolated invocations in production (Vercel)
// 2. Each request sets the service before graph execution and reads within same tick
// 3. For truly concurrent scenarios, consider request-scoped context or AsyncLocalStorage
//
// Future improvement: Pass KnowledgeService via LangGraph's RunnableConfig.configurable
// when LangChain supports custom configurable fields in tool execution context.
// =============================================================================

let globalKnowledgeService: IKnowledgeService | null = null

/**
 * Set the global knowledge service for tools to use.
 * Called by API route before graph execution.
 *
 * @param service - KnowledgeService instance or null to clear
 */
export function setGlobalKnowledgeService(service: IKnowledgeService | null): void {
  globalKnowledgeService = service
}

/**
 * Get the global knowledge service.
 * Returns null if not set (tools will fall back to JSON loader).
 */
export function getGlobalKnowledgeService(): IKnowledgeService | null {
  return globalKnowledgeService
}
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
 * Searches the knowledge base extracted from deal documents.
 * Supports both JSON file (dev) and Graphiti/Neo4j (production) modes.
 *
 * Story: CIM Knowledge Toggle - uses KnowledgeService when available
 */
export const knowledgeSearchTool = tool(
  async ({ query, section }): Promise<string> => {
    try {
      // Use KnowledgeService if available, otherwise fall back to legacy JSON loader
      if (globalKnowledgeService) {
        const mode = globalKnowledgeService.getMode()
        console.log(`[knowledgeSearchTool] Using KnowledgeService in ${mode} mode`)

        const results = await globalKnowledgeService.search(query, { section, limit: 10 })

        if (results.length === 0) {
          return JSON.stringify({
            success: true,
            found: false,
            message: `No findings matching "${query}"${section ? ` in section ${section}` : ''}`,
            suggestion: 'Try a different search term or check the data gaps.',
            mode,
          })
        }

        return JSON.stringify({
          success: true,
          found: true,
          count: results.length,
          findings: results.map((r: KnowledgeSearchResult) => ({
            content: r.content,
            source: r.source,
            section: r.section,
            relevance: r.relevance,
          })),
          mode,
        })
      }

      // Legacy fallback: use JSON knowledge loader directly
      console.log('[knowledgeSearchTool] Using legacy JSON loader (no KnowledgeService)')
      const results = searchKnowledge(query, section)

      if (results.length === 0) {
        return JSON.stringify({
          success: true,
          found: false,
          message: `No findings matching "${query}"${section ? ` in section ${section}` : ''}`,
          suggestion: 'Try a different search term or check the data gaps.',
          mode: 'json',
        })
      }

      return JSON.stringify({
        success: true,
        found: true,
        count: results.length,
        findings: results.slice(0, 10),
        mode: 'json',
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
 *
 * Story: CIM Knowledge Toggle - uses KnowledgeService when available
 */
export const getSectionContextTool = tool(
  async ({ sectionPath }): Promise<string> => {
    try {
      // Use KnowledgeService if available, otherwise fall back to legacy JSON loader
      if (globalKnowledgeService) {
        const mode = globalKnowledgeService.getMode()
        console.log(`[getSectionContextTool] Using KnowledgeService in ${mode} mode for section: ${sectionPath}`)

        const findings = await globalKnowledgeService.getSection(sectionPath)
        const metadata = await globalKnowledgeService.getMetadata()

        if (findings.length === 0) {
          return JSON.stringify({
            success: true,
            section: sectionPath,
            found: false,
            company: metadata.companyName,
            message: `No findings available for section: ${sectionPath}`,
            mode,
          })
        }

        return JSON.stringify({
          success: true,
          section: sectionPath,
          found: true,
          company: metadata.companyName,
          count: findings.length,
          findings: findings.map((f: KnowledgeSearchResult) => ({
            id: f.metadata?.id,
            content: f.content,
            source: f.source,
            confidence: f.metadata?.confidence,
            relevance: f.relevance,
          })),
          mode,
        })
      }

      // Legacy fallback: use JSON knowledge loader directly
      console.log('[getSectionContextTool] Using legacy JSON loader (no KnowledgeService)')
      const findings = getFindingsForSection(sectionPath)
      const metadata = getCompanyMetadata()

      if (findings.length === 0) {
        return JSON.stringify({
          success: true,
          section: sectionPath,
          found: false,
          company: metadata?.company_name,
          message: `No findings available for section: ${sectionPath}`,
          mode: 'json',
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
        mode: 'json',
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
 *
 * HITL Validation: This tool should only be called after BOTH:
 * 1. Content has been approved by user (Step 2)
 * 2. Visual design has been approved by user (Step 3)
 * The prompt instructs this, and postToolNode can validate state.
 */
export const updateSlideTool = tool(
  async ({ sectionId, slideId: existingSlideId, title, layoutType, components }): Promise<string> => {
    // Log for HITL debugging - if this is called without proper approval flow,
    // it will be visible in traces
    console.log(`[updateSlideTool] HITL checkpoint - saving slide "${title}" for section ${sectionId}`)
    console.log(`[updateSlideTool] NOTE: This should only be called after content AND visual approval`)

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

/**
 * Workflow stage order for validation
 */
const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  'welcome',
  'buyer_persona',
  'hero_concept',
  'investment_thesis',
  'outline',
  'building_sections',
  'complete',
]

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
 * Navigate to Stage Tool (Story 3: Stage Navigation)
 *
 * Allows users to navigate backward to previously completed stages
 * to revise decisions (buyer persona, hero concept, outline, etc.)
 *
 * Validation rules:
 * - Can only navigate to stages that have been completed
 * - Cannot navigate forward (use advance_workflow for that)
 * - Cannot navigate to 'welcome' (no meaningful work to revise there)
 * - Cannot navigate to 'complete' (use advance_workflow)
 */
export const navigateToStageTool = tool(
  async ({ targetStage, reason }): Promise<string> => {
    console.log(`[navigateToStageTool] Navigating to ${targetStage}: ${reason}`)

    // Determine what may need re-evaluation based on target stage
    const cascadeWarnings: Record<string, string[]> = {
      buyer_persona: [
        'Hero concept may need adjustment for new buyer type',
        'Investment thesis framing may need revision',
        'Outline sections may need reordering for new audience',
        'Existing slides may need content adjustments',
      ],
      hero_concept: [
        'Investment thesis may need revision',
        'Outline narrative flow may need adjustment',
        'Slide messaging may need updates',
      ],
      investment_thesis: [
        'Outline may need structural changes',
        'Existing slides may need messaging updates',
      ],
      outline: [
        'Section order or content may need adjustment',
        'Slides may need reorganization',
      ],
      building_sections: [
        'Current slide progress preserved - you can continue or revise',
      ],
    }

    const warnings = cascadeWarnings[targetStage] || []

    return JSON.stringify({
      navigatedToStage: true,
      targetStage,
      reason,
      cascadeWarnings: warnings,
      message: `Navigated to ${targetStage.replace(/_/g, ' ')} stage for revision.`,
    })
  },
  {
    name: 'navigate_to_stage',
    description:
      'Navigate backward to a previously completed stage to revise decisions. Use when the user wants to change buyer persona, hero concept, outline, etc. Can only navigate to stages that have been completed. Stages: buyer_persona, hero_concept, investment_thesis, outline, building_sections.',
    schema: z.object({
      targetStage: z.enum([
        'buyer_persona',
        'hero_concept',
        'investment_thesis',
        'outline',
        'building_sections',
      ]).describe('Target stage to navigate to (must be previously completed)'),
      reason: z.string().describe('Why the user wants to go back to this stage'),
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
 *
 * HITL Validation: This tool should only be called after the agent
 * has presented the outline structure and received user approval.
 * The prompt instructs this, but we add state validation as a safety net.
 */
export const createOutlineTool = tool(
  async ({ sections }): Promise<string> => {
    // Note: Full HITL validation would check state.workflowProgress.currentStage === 'outline'
    // and that the agent has presented structure to user. Since we don't have access to
    // full state in the tool, we rely on prompt instructions + postToolNode validation.
    // This log helps with debugging if HITL is bypassed.
    console.log(`[createOutlineTool] HITL checkpoint - creating outline with ${sections.length} sections`)

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
 * All CIM MVP tools
 *
 * Organized by category:
 * - Research tools: web search, knowledge search, section context
 * - Workflow tools: advance workflow, navigate, save persona, save hero, create/update outline, start section
 * - Output tools: update slide, save context
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
