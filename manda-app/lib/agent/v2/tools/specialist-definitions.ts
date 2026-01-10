/**
 * Agent System v2.0 - Specialist Tool Definitions
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling (AC: #2)
 * Story: 4-2 Implement Specialist Tool Definitions
 *
 * Specialists are defined as tools that the supervisor can call via LLM tool-calling.
 * Each specialist has:
 * - Clear description for LLM understanding
 * - Zod schema for input validation
 * - Kebab-case naming per architecture patterns
 *
 * These are stub implementations - actual specialist logic is in nodes/specialists/.
 * The supervisor binds these tools and routes to the appropriate specialist node.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Specialist Tools]
 * - [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 4.2]
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import type { SourceCitation } from '../types'

// =============================================================================
// Specialist Result Types
// =============================================================================

/**
 * Standard result shape returned by all specialists.
 * Ensures consistent response structure for supervisor synthesis.
 */
export interface SpecialistResult {
  /** The specialist's answer/analysis */
  answer: string
  /** Source citations for attribution */
  sources: SourceCitation[]
  /** Confidence score (0-1) */
  confidence?: number
  /** Structured data (tables, metrics, etc.) */
  data?: unknown
}

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Financial analyst input schema.
 * Accepts financial analysis queries with optional focus areas.
 */
export const FinancialAnalystInputSchema = z.object({
  query: z.string().describe('The financial analysis question or request'),
  focusArea: z
    .enum(['revenue', 'profitability', 'valuation', 'projections', 'comparables', 'general'])
    .optional()
    .default('general')
    .describe('Specific area of financial analysis to focus on'),
  includeCharts: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to include chart/visualization suggestions'),
})

/**
 * Document researcher input schema.
 * Accepts deep document search queries.
 */
export const DocumentResearcherInputSchema = z.object({
  query: z.string().describe('The research question or topic to investigate'),
  documentIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Specific document IDs to search within (optional, searches all if not provided)'),
  searchDepth: z
    .enum(['shallow', 'deep', 'exhaustive'])
    .optional()
    .default('deep')
    .describe('How thoroughly to search documents'),
})

/**
 * Knowledge graph expert input schema.
 * Accepts graph traversal and entity queries.
 */
export const KGExpertInputSchema = z.object({
  query: z.string().describe('The knowledge graph query or entity relationship question'),
  entityTypes: z
    .array(z.string())
    .optional()
    .describe('Specific entity types to focus on (e.g., Company, Person, Metric)'),
  maxHops: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .default(2)
    .describe('Maximum relationship hops for graph traversal'),
})

/**
 * Due diligence specialist input schema.
 * Accepts due diligence analysis requests.
 */
export const DueDiligenceInputSchema = z.object({
  query: z.string().describe('The due diligence question or area to analyze'),
  category: z
    .enum(['financial', 'legal', 'operational', 'commercial', 'technical', 'general'])
    .optional()
    .default('general')
    .describe('Due diligence category to focus on'),
  riskLevel: z
    .enum(['all', 'high', 'medium', 'low'])
    .optional()
    .default('all')
    .describe('Filter by risk level'),
})

// =============================================================================
// Specialist Tool Definitions
// =============================================================================

/**
 * Financial Analyst Specialist
 *
 * Handles deal-specific financial analysis including:
 * - Revenue and profitability analysis
 * - Valuation metrics and comparables
 * - Financial projections review
 * - Key financial statement analysis
 *
 * Story: 4-5 Implement Financial Specialist
 */
export const financialAnalystTool = tool(
  async (input): Promise<string> => {
    // Stub implementation - actual logic in nodes/specialists/financial-analyst.ts
    // The supervisor routes to the specialist node, which executes the full analysis
    const { query, focusArea } = input

    // Return placeholder indicating this is a stub
    // In production, this tool binding triggers routing to the specialist node
    return JSON.stringify({
      _stub: true,
      _message: 'Financial analyst specialist invoked',
      query,
      focusArea,
      // The actual specialist node will return a proper SpecialistResult
    })
  },
  {
    name: 'financial-analyst',
    description: `Delegate to the financial analyst specialist for deal-specific financial analysis.
Use this tool when the user asks about:
- Revenue, EBITDA, margins, or profitability metrics
- Valuation multiples or comparable company analysis
- Financial projections or forecasts
- Balance sheet, income statement, or cash flow analysis
- Financial due diligence findings

The financial analyst has access to deal documents and can perform detailed financial modeling.
Do NOT use for general questions - only for financial analysis requiring document context.`,
    schema: FinancialAnalystInputSchema,
  }
)

/**
 * Document Researcher Specialist
 *
 * Handles deep document search and analysis including:
 * - Multi-document cross-referencing
 * - Detailed content extraction
 * - Theme and pattern identification
 * - Comprehensive document summarization
 *
 * Story: 4-3 Implement Deal Analyst Specialist (document-focused variant)
 */
export const documentResearcherTool = tool(
  async (input): Promise<string> => {
    // Stub implementation - actual logic in nodes/specialists/document-researcher.ts
    const { query, documentIds, searchDepth } = input

    return JSON.stringify({
      _stub: true,
      _message: 'Document researcher specialist invoked',
      query,
      documentIds,
      searchDepth,
    })
  },
  {
    name: 'document-researcher',
    description: `Delegate to the document researcher specialist for deep document analysis.
Use this tool when the user asks about:
- Specific details buried in documents
- Cross-referencing information across multiple documents
- Comprehensive summaries of document sections
- Finding specific clauses, terms, or provisions
- Identifying patterns or themes across documents

The document researcher performs thorough, multi-pass searches and can handle complex research queries.
Use for detailed document analysis that goes beyond simple retrieval.`,
    schema: DocumentResearcherInputSchema,
  }
)

/**
 * Knowledge Graph Expert Specialist
 *
 * Handles knowledge graph queries including:
 * - Entity relationship traversal
 * - Connected entity discovery
 * - Temporal fact queries
 * - Graph-based reasoning
 *
 * Story: 4-2 Implement Specialist Tool Definitions
 */
export const kgExpertTool = tool(
  async (input): Promise<string> => {
    // Stub implementation - actual logic in nodes/specialists/kg-expert.ts
    const { query, entityTypes, maxHops } = input

    return JSON.stringify({
      _stub: true,
      _message: 'Knowledge graph expert specialist invoked',
      query,
      entityTypes,
      maxHops,
    })
  },
  {
    name: 'kg-expert',
    description: `Delegate to the knowledge graph expert for entity and relationship queries.
Use this tool when the user asks about:
- Relationships between entities (companies, people, metrics)
- Connected entities or network analysis
- How entities are related across documents
- Entity timelines and temporal relationships
- Graph-based reasoning about deal structure

The KG expert can traverse the knowledge graph to find non-obvious connections.
Use for relationship queries, not simple fact lookup.`,
    schema: KGExpertInputSchema,
  }
)

/**
 * Due Diligence Specialist
 *
 * Handles due diligence analysis including:
 * - Risk identification and assessment
 * - Due diligence checklist tracking
 * - Red flag detection
 * - Category-specific DD analysis
 *
 * Story: 4-2 Implement Specialist Tool Definitions
 */
export const dueDiligenceTool = tool(
  async (input): Promise<string> => {
    // Stub implementation - actual logic in nodes/specialists/due-diligence.ts
    const { query, category, riskLevel } = input

    return JSON.stringify({
      _stub: true,
      _message: 'Due diligence specialist invoked',
      query,
      category,
      riskLevel,
    })
  },
  {
    name: 'due-diligence',
    description: `Delegate to the due diligence specialist for DD analysis and risk assessment.
Use this tool when the user asks about:
- Due diligence findings or concerns
- Risk assessment across DD categories
- Red flags or areas requiring attention
- DD checklist status or completeness
- Category-specific DD analysis (financial, legal, operational, etc.)

The DD specialist maintains awareness of all due diligence findings and can synthesize risks.
Use for due diligence specific queries and risk analysis.`,
    schema: DueDiligenceInputSchema,
  }
)

// =============================================================================
// Exports
// =============================================================================

/**
 * All specialist tools for binding to the supervisor LLM.
 * Order may affect tool selection when multiple could apply.
 */
export const specialistTools = [
  financialAnalystTool,
  documentResearcherTool,
  kgExpertTool,
  dueDiligenceTool,
]

/**
 * Specialist tool names for reference.
 */
export const SPECIALIST_TOOL_NAMES = {
  FINANCIAL_ANALYST: 'financial-analyst',
  DOCUMENT_RESEARCHER: 'document-researcher',
  KG_EXPERT: 'kg-expert',
  DUE_DILIGENCE: 'due-diligence',
} as const

export type SpecialistToolName = (typeof SPECIALIST_TOOL_NAMES)[keyof typeof SPECIALIST_TOOL_NAMES]
