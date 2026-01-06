/**
 * Specialist Node Implementations
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #2, #3, #6)
 * Story: E13.5 - Financial Analyst Specialist Agent (AC: #4)
 * Story: E13.6 - Knowledge Graph Specialist Agent (AC: #4)
 *
 * LangGraph node implementations for specialist agents.
 * E13.5 (Financial Analyst) implemented with real Python backend invocation.
 * E13.6 (Knowledge Graph) implemented with real Python backend invocation.
 *
 * Node Pattern:
 * - Each node receives SupervisorState
 * - Returns partial state update with specialistResults
 * - Uses reducer aggregation for parallel execution
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-4-supervisor-agent-pattern.md]
 * - [Source: docs/sprint-artifacts/stories/e13-5-financial-analyst-specialist.md]
 * - [Source: docs/sprint-artifacts/stories/e13-6-knowledge-graph-specialist.md]
 * - [Source: manda-app/lib/agent/executor.ts] - createChatAgent pattern
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLLMClient } from '@/lib/llm/client'
import { allChatTools } from '../tools/all-tools'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import {
  type SupervisorState,
  type SpecialistResult,
  createSpecialistResult,
} from './state'
import { SPECIALIST_IDS } from './routing'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Timeout for specialist execution (45 seconds)
 * Aligned with manda-processing/config/models.yaml knowledge_graph.settings.timeout
 */
const SPECIALIST_TIMEOUT_MS = 45000

/**
 * System prompts for specialist agents
 */
const SPECIALIST_PROMPTS = {
  [SPECIALIST_IDS.FINANCIAL_ANALYST]: `You are a Financial Analyst specialist for M&A due diligence.
Your expertise includes:
- Revenue analysis and forecasting
- EBITDA calculations and margin analysis
- Valuation multiples and DCF modeling
- Working capital and cash flow analysis
- Financial statement analysis (P&L, Balance Sheet, Cash Flow)
- Key financial metrics (ROI, IRR, NPV, WACC)

Guidelines:
1. Provide precise numerical analysis when data is available
2. Clearly state assumptions and limitations
3. Use professional M&A financial terminology
4. Cite specific documents/sources when referencing data
5. Highlight key risks and opportunities
6. Be concise but thorough

Note: This is a preliminary stub implementation. Full specialist agent coming in E13.5.`,

  [SPECIALIST_IDS.KNOWLEDGE_GRAPH]: `You are a Knowledge Graph specialist for M&A due diligence.
Your expertise includes:
- Entity identification and resolution
- Relationship mapping (people, companies, subsidiaries)
- Contradiction and inconsistency detection
- Timeline and historical analysis
- Organizational structure analysis
- Data lineage and provenance

Guidelines:
1. Focus on entities, relationships, and connections
2. Identify contradictions or inconsistencies in data
3. Provide clear relationship chains when relevant
4. Note when information may be outdated or superseded
5. Cite specific sources for entity information
6. Flag potential data quality issues`,

  [SPECIALIST_IDS.GENERAL]: `You are a general M&A due diligence assistant.
You help with questions that don't require specialized financial or knowledge graph analysis.

Guidelines:
1. Provide helpful, accurate information
2. Use available tools to search and analyze documents
3. Be clear about uncertainty or limitations
4. Cite sources when possible
5. Direct users to specialized agents when appropriate`,
}

// =============================================================================
// Specialist Node Types
// =============================================================================

/**
 * Node function signature for LangGraph
 * Returns partial state update with specialistResults
 */
export type SpecialistNode = (
  state: SupervisorState
) => Promise<Partial<SupervisorState>>

// =============================================================================
// Financial Analyst Node (AC: #2) - E13.5 IMPLEMENTATION
// =============================================================================

/**
 * Financial Analyst API response type
 * Story: E13.5 (AC: #4) - Register as specialist in supervisor routing
 */
interface FinancialAnalystApiResponse {
  success: boolean
  result?: {
    summary: string
    findings: Array<{
      metric: string
      value: string | number
      confidence: number
      source?: {
        document_name?: string
        page_number?: number
        excerpt?: string
      }
    }>
    confidence: number
    sources: Array<{
      document_id?: string
      document_name?: string
      page_number?: number
      excerpt?: string
    }>
    limitations?: string
    follow_up_questions?: string[]
  }
  error?: string
  model_used?: string
  latency_ms?: number
}

/**
 * Financial Analyst Specialist Node
 * Story: E13.5 (AC: #4) - Register as specialist in supervisor routing
 *
 * Invokes the Python backend Financial Analyst agent for complex financial queries.
 * Replaces E13.4 stub implementation with real API invocation.
 *
 * @param state - Current supervisor state
 * @returns Partial state update with specialist result
 */
export async function financialAnalystNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()
  console.log('[Supervisor] Invoking financial_analyst specialist (E13.5)')

  try {
    const result = await invokeFinancialAnalyst(state)
    return {
      specialistResults: [result],
    }
  } catch (error) {
    console.error('[Supervisor] Financial analyst error:', error)

    // Fallback to stub implementation on API failure
    console.log('[Supervisor] Falling back to stub implementation')
    try {
      const fallbackResult = await invokeSpecialistWithAgent(
        SPECIALIST_IDS.FINANCIAL_ANALYST,
        state,
        SPECIALIST_PROMPTS[SPECIALIST_IDS.FINANCIAL_ANALYST]!
      )

      return {
        specialistResults: [{
          ...fallbackResult,
          stub: true, // Flag that we fell back to stub
          error: `API fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    } catch (fallbackError) {
      return {
        specialistResults: [
          createSpecialistResult(
            SPECIALIST_IDS.FINANCIAL_ANALYST,
            'Unable to analyze financial data at this time. Please try again.',
            0.2,
            [],
            {
              timing: Date.now() - startTime,
              stub: true,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          ),
        ],
      }
    }
  }
}

/**
 * Invoke the Financial Analyst Python API
 * Story: E13.5 (AC: #4) - Implement invokeFinancialAnalyst() that calls Python backend
 *
 * @param state - Current supervisor state with query and context
 * @returns SpecialistResult from the Financial Analyst agent
 */
async function invokeFinancialAnalyst(state: SupervisorState): Promise<SpecialistResult> {
  const startTime = Date.now()

  const processingApiUrl = process.env.MANDA_PROCESSING_API_URL
  if (!processingApiUrl) {
    throw new Error('MANDA_PROCESSING_API_URL not configured')
  }

  // Build request body
  const requestBody = {
    query: state.query,
    deal_id: state.dealId,
    organization_id: state.organizationId,
    context: state.intent?.rationale || undefined,
  }

  console.log('[Financial Analyst] Calling API:', `${processingApiUrl}/api/agents/financial-analyst/invoke`)

  const response = await fetch(`${processingApiUrl}/api/agents/financial-analyst/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(state.organizationId && { 'x-organization-id': state.organizationId }),
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Financial Analyst API error: ${response.status} - ${errorText}`)
  }

  const apiResponse: FinancialAnalystApiResponse = await response.json()

  if (!apiResponse.success || !apiResponse.result) {
    throw new Error(apiResponse.error || 'Financial Analyst API returned unsuccessful result')
  }

  // Transform API response to SpecialistResult
  const result = apiResponse.result
  const sources = result.sources.map((s) => ({
    documentId: s.document_id,
    documentName: s.document_name,
    snippet: s.excerpt,
  }))

  // Build output text with structured information
  let output = result.summary

  // Append findings if present
  if (result.findings && result.findings.length > 0) {
    output += '\n\n**Key Findings:**\n'
    for (const finding of result.findings) {
      output += `- ${finding.metric}: ${finding.value}`
      if (finding.source?.document_name) {
        output += ` [Source: ${finding.source.document_name}`
        if (finding.source.page_number) {
          output += `, p.${finding.source.page_number}`
        }
        output += ']'
      }
      output += '\n'
    }
  }

  // Append limitations if present
  if (result.limitations) {
    output += `\n**Note:** ${result.limitations}`
  }

  // Append follow-up questions if present
  if (result.follow_up_questions && result.follow_up_questions.length > 0) {
    output += '\n\n**Suggested Follow-up Questions:**\n'
    for (const q of result.follow_up_questions) {
      output += `- ${q}\n`
    }
  }

  const timing = apiResponse.latency_ms || (Date.now() - startTime)

  console.log('[Financial Analyst] API response received', {
    confidence: result.confidence,
    findingsCount: result.findings?.length || 0,
    sourcesCount: sources.length,
    latencyMs: timing,
  })

  return createSpecialistResult(
    SPECIALIST_IDS.FINANCIAL_ANALYST,
    output,
    result.confidence,
    sources,
    { timing }
    // NO stub: true - this is the real implementation
  )
}

// =============================================================================
// Knowledge Graph Node (AC: #2) - E13.6 IMPLEMENTATION
// =============================================================================

/**
 * Knowledge Graph API response type
 * Story: E13.6 (AC: #4) - Register as specialist in supervisor routing
 */
interface KnowledgeGraphApiResponse {
  success: boolean
  result?: {
    summary: string
    entities: Array<{
      name: string
      entity_type: string
      confidence: number
      aliases: string[]
      source?: {
        document_id?: string
        document_name?: string
        excerpt?: string
      }
      properties: Record<string, string>
    }>
    paths: Array<{
      start_entity: string
      start_entity_type: string
      end_entity: string
      end_entity_type: string
      path: Array<{
        from_entity: string
        relationship: string
        to_entity: string
      }>
      total_hops: number
      path_description: string
    }>
    contradictions: Array<{
      fact1: string
      fact2: string
      conflict_type: string
      severity: string
      resolution_hint: string
    }>
    confidence: number
    sources: Array<{
      document_id?: string
      document_name?: string
      page_number?: number
      excerpt?: string
    }>
    traversal_explanation?: string
    limitations?: string
    follow_up_questions?: string[]
  }
  error?: string
  model_used?: string
  latency_ms?: number
}

/**
 * Knowledge Graph Specialist Node
 * Story: E13.6 (AC: #4) - Register as specialist in supervisor routing
 *
 * Invokes the Python backend Knowledge Graph agent for entity resolution,
 * relationship traversal, and contradiction detection.
 * Replaces E13.4 stub implementation with real API invocation.
 *
 * @param state - Current supervisor state
 * @returns Partial state update with specialist result
 */
export async function knowledgeGraphNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()
  console.log('[Supervisor] Invoking knowledge_graph specialist (E13.6)')

  try {
    const result = await invokeKnowledgeGraph(state)
    return {
      specialistResults: [result],
    }
  } catch (error) {
    console.error('[Supervisor] Knowledge graph error:', error)

    // Fallback to stub implementation on API failure
    console.log('[Supervisor] Falling back to stub implementation')
    try {
      const fallbackResult = await invokeSpecialistWithAgent(
        SPECIALIST_IDS.KNOWLEDGE_GRAPH,
        state,
        SPECIALIST_PROMPTS[SPECIALIST_IDS.KNOWLEDGE_GRAPH]!
      )

      return {
        specialistResults: [{
          ...fallbackResult,
          stub: true, // Flag that we fell back to stub
          error: `API fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      }
    } catch (fallbackError) {
      return {
        specialistResults: [
          createSpecialistResult(
            SPECIALIST_IDS.KNOWLEDGE_GRAPH,
            'Unable to analyze knowledge graph data at this time. Please try again.',
            0.2,
            [],
            {
              timing: Date.now() - startTime,
              stub: true,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          ),
        ],
      }
    }
  }
}

/**
 * Invoke the Knowledge Graph Python API
 * Story: E13.6 (AC: #4) - Implement invokeKnowledgeGraphAgent() that calls Python backend
 *
 * @param state - Current supervisor state with query and context
 * @returns SpecialistResult from the Knowledge Graph agent
 */
async function invokeKnowledgeGraph(state: SupervisorState): Promise<SpecialistResult> {
  const startTime = Date.now()

  const processingApiUrl = process.env.MANDA_PROCESSING_API_URL
  if (!processingApiUrl) {
    throw new Error('MANDA_PROCESSING_API_URL not configured')
  }

  // Build request body
  const requestBody = {
    query: state.query,
    deal_id: state.dealId,
    organization_id: state.organizationId,
    entity_types: state.intent?.suggestedEntityTypes,
    context: state.intent?.rationale || undefined,
  }

  console.log('[Knowledge Graph] Calling API:', `${processingApiUrl}/api/agents/knowledge-graph/invoke`)

  const response = await fetch(`${processingApiUrl}/api/agents/knowledge-graph/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(state.organizationId && { 'x-organization-id': state.organizationId }),
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`Knowledge Graph API error: ${response.status} - ${errorText}`)
  }

  const apiResponse: KnowledgeGraphApiResponse = await response.json()

  if (!apiResponse.success || !apiResponse.result) {
    throw new Error(apiResponse.error || 'Knowledge Graph API returned unsuccessful result')
  }

  // Transform API response to SpecialistResult
  const result = apiResponse.result
  const sources = result.sources.map((s) => ({
    documentId: s.document_id,
    documentName: s.document_name,
    snippet: s.excerpt,
  }))

  // Build output text with structured information
  let output = result.summary

  // Append entity matches if present
  if (result.entities && result.entities.length > 0) {
    output += '\n\n**Matched Entities:**\n'
    for (const entity of result.entities.slice(0, 5)) {
      output += `- ${entity.name} (${entity.entity_type})`
      output += ` - Confidence: ${(entity.confidence * 100).toFixed(0)}%`
      if (entity.aliases && entity.aliases.length > 0) {
        output += ` [Also known as: ${entity.aliases.slice(0, 3).join(', ')}]`
      }
      output += '\n'
    }
    if (result.entities.length > 5) {
      output += `... and ${result.entities.length - 5} more entities\n`
    }
  }

  // Append relationship paths if present
  if (result.paths && result.paths.length > 0) {
    output += '\n**Relationship Paths:**\n'
    for (const path of result.paths.slice(0, 3)) {
      output += `- ${path.path_description || `${path.start_entity} → ${path.end_entity} (${path.total_hops} hops)`}\n`
    }
    if (result.paths.length > 3) {
      output += `... and ${result.paths.length - 3} more paths\n`
    }
  }

  // Append contradictions if present
  if (result.contradictions && result.contradictions.length > 0) {
    output += '\n**Detected Contradictions:**\n'
    for (const contradiction of result.contradictions) {
      const severityIcon = contradiction.severity === 'critical' ? '🔴' :
                          contradiction.severity === 'moderate' ? '🟡' : '🔵'
      output += `${severityIcon} ${contradiction.conflict_type}: "${contradiction.fact1}" vs "${contradiction.fact2}"\n`
      if (contradiction.resolution_hint) {
        output += `   Hint: ${contradiction.resolution_hint}\n`
      }
    }
  }

  // Append traversal explanation if present
  if (result.traversal_explanation) {
    output += `\n**Graph Traversal:** ${result.traversal_explanation}`
  }

  // Append limitations if present
  if (result.limitations) {
    output += `\n**Note:** ${result.limitations}`
  }

  // Append follow-up questions if present
  if (result.follow_up_questions && result.follow_up_questions.length > 0) {
    output += '\n\n**Suggested Follow-up Questions:**\n'
    for (const q of result.follow_up_questions) {
      output += `- ${q}\n`
    }
  }

  const timing = apiResponse.latency_ms || (Date.now() - startTime)

  console.log('[Knowledge Graph] API response received', {
    confidence: result.confidence,
    entitiesCount: result.entities?.length || 0,
    pathsCount: result.paths?.length || 0,
    contradictionsCount: result.contradictions?.length || 0,
    sourcesCount: sources.length,
    latencyMs: timing,
  })

  return createSpecialistResult(
    SPECIALIST_IDS.KNOWLEDGE_GRAPH,
    output,
    result.confidence,
    sources,
    { timing }
    // NO stub: true - this is the real implementation
  )
}

// =============================================================================
// General Agent Node (AC: #6) - Fallback
// =============================================================================

/**
 * General Agent Node (Fallback)
 * Story: E13.4 (AC: #6) - Create fallback to general agent if no specialist matches
 *
 * Uses the full tool set and general system prompt.
 * This is the fallback path for queries that don't match specialist domains.
 *
 * @param state - Current supervisor state
 * @returns Partial state update with specialist result
 */
export async function generalAgentNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()
  console.log('[Supervisor] Invoking general agent (fallback)')

  try {
    const result = await invokeSpecialistWithAgent(
      SPECIALIST_IDS.GENERAL,
      state,
      SPECIALIST_PROMPTS[SPECIALIST_IDS.GENERAL]!
    )

    return {
      specialistResults: [result],
    }
  } catch (error) {
    console.error('[Supervisor] General agent error:', error)
    return {
      specialistResults: [
        createSpecialistResult(
          SPECIALIST_IDS.GENERAL,
          'I encountered an issue processing your request. Please try rephrasing your question.',
          0.3,
          [],
          {
            timing: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        ),
      ],
    }
  }
}

// =============================================================================
// Shared Agent Invocation
// =============================================================================

/**
 * Invoke a specialist using a ReAct agent with custom system prompt
 * This is the shared implementation used by all specialist stubs
 *
 * @param specialistId - Identifier for the specialist
 * @param state - Current supervisor state
 * @param systemPrompt - Custom system prompt for the specialist
 * @returns SpecialistResult
 */
async function invokeSpecialistWithAgent(
  specialistId: string,
  state: SupervisorState,
  systemPrompt: string
): Promise<SpecialistResult> {
  const startTime = Date.now()

  // Create LLM client (use complex tier for specialists)
  const llm = createLLMClient({ complexity: 'complex' })

  // Create agent with specialist prompt
  const agent = createReactAgent({
    llm,
    tools: allChatTools,
    messageModifier: systemPrompt,
  })

  // Build messages with context
  const messages = [
    new SystemMessage(`Deal context: ${state.dealId}`),
    new HumanMessage(state.query),
  ]

  // Invoke with timeout
  const result = await Promise.race([
    agent.invoke({ messages }),
    createTimeout(SPECIALIST_TIMEOUT_MS),
  ])

  // Handle timeout
  if (result === 'TIMEOUT') {
    return createSpecialistResult(
      specialistId,
      'Analysis timed out. The query may be too complex or require more data.',
      0.3,
      [],
      { timing: SPECIALIST_TIMEOUT_MS, error: 'Timeout after 30s' }
    )
  }

  // Extract output from agent result with proper type checking
  const resultMessages = result.messages
  let output = 'Unable to generate analysis.'

  if (Array.isArray(resultMessages) && resultMessages.length > 0) {
    const lastMessage = resultMessages[resultMessages.length - 1]
    if (lastMessage && typeof lastMessage === 'object' && 'content' in lastMessage) {
      const content = lastMessage.content
      if (typeof content === 'string') {
        output = content
      } else if (Array.isArray(content)) {
        // Handle content blocks (e.g., from Claude)
        output = content
          .filter((block): block is { type: string; text: string } =>
            typeof block === 'object' && block !== null && 'text' in block
          )
          .map(block => block.text)
          .join('\n') || 'Unable to generate analysis.'
      }
    }
  }

  // Extract confidence from output (heuristic based on certainty language)
  const confidence = estimateConfidence(output)

  // Extract sources from tool calls (simplified - full implementation in E13.5/E13.6)
  const sources = extractSourcesFromOutput(output)

  return createSpecialistResult(
    specialistId,
    output,
    confidence,
    sources,
    { timing: Date.now() - startTime }
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<'TIMEOUT'> {
  return new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), ms))
}

/**
 * Estimate confidence from output text (heuristic)
 * Looks for certainty/uncertainty language patterns
 */
function estimateConfidence(output: string): number {
  const lowConfidencePatterns = [
    /\b(unclear|uncertain|might|may|possibly|perhaps|could be|not sure)\b/i,
    /\b(limited data|insufficient|no information|couldn't find)\b/i,
  ]

  const highConfidencePatterns = [
    /\b(clearly|definitely|shows that|confirms|according to|states that)\b/i,
    /\b(the data shows|revenue of \$|EBITDA of \$|margin of)\b/i,
  ]

  let confidence = 0.7 // Default moderate confidence

  // Check for low confidence signals
  for (const pattern of lowConfidencePatterns) {
    if (pattern.test(output)) {
      confidence -= 0.15
    }
  }

  // Check for high confidence signals
  for (const pattern of highConfidencePatterns) {
    if (pattern.test(output)) {
      confidence += 0.1
    }
  }

  // Clamp to valid range
  return Math.max(0.2, Math.min(0.95, confidence))
}

/**
 * Extract source references from output text (simplified heuristic)
 * Full implementation will use tool call results in E13.5/E13.6
 */
function extractSourcesFromOutput(output: string): Array<{ documentName?: string; snippet?: string }> {
  const sources: Array<{ documentName?: string; snippet?: string }> = []

  // Look for document references in common patterns
  const docPatterns = [
    /(?:according to|from|in|per)\s+(?:the\s+)?["']?([^"'\n,]+(?:\.pdf|\.docx?|\.xlsx?))["']?/gi,
    /(?:document|file|report)\s+(?:titled\s+)?["']([^"']+)["']/gi,
  ]

  for (const pattern of docPatterns) {
    let match
    while ((match = pattern.exec(output)) !== null) {
      const docName = match[1]?.trim()
      if (docName && docName.length > 3) {
        sources.push({ documentName: docName })
      }
    }
  }

  return sources.slice(0, 5) // Limit to 5 sources
}

// =============================================================================
// Node Registry
// =============================================================================

/**
 * Map of specialist IDs to their node implementations
 */
export const SPECIALIST_NODES: Record<string, SpecialistNode> = {
  [SPECIALIST_IDS.FINANCIAL_ANALYST]: financialAnalystNode,
  [SPECIALIST_IDS.KNOWLEDGE_GRAPH]: knowledgeGraphNode,
  [SPECIALIST_IDS.GENERAL]: generalAgentNode,
}

/**
 * Get node implementation for a specialist ID
 *
 * @param specialistId - Specialist identifier
 * @returns Node function or undefined if not found
 */
export function getSpecialistNode(specialistId: string): SpecialistNode | undefined {
  return SPECIALIST_NODES[specialistId]
}
