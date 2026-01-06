/**
 * Tool Loader - Tier-Based Tool Loading
 *
 * Dynamically loads tools based on query complexity.
 * Story: E13.2 - Tier-Based Tool Loading
 *
 * Tool Tiers:
 * - Simple: No tools (direct LLM response)
 * - Medium: 5 essential tools for factual queries
 * - Complex: All 18 tools for analytical queries
 *
 * Token Savings:
 * - Simple: ~3,500 tokens saved (100%)
 * - Medium: ~2,500 tokens saved (~70%)
 * - Complex: 0 tokens saved (baseline)
 */

import type { StructuredToolInterface } from '@langchain/core/tools'
import { allChatTools, getToolByName, TOOL_COUNT } from './all-tools'
import {
  TOOLS_BY_COMPLEXITY,
  type ComplexityLevel,
  type EnhancedIntentResult,
  hasAllToolsAccess,
} from '../intent'

/**
 * Tool tier configuration - re-exports from intent.ts for convenience
 * Story: E13.2 - Tier-Based Tool Loading (AC: #1)
 *
 * Maps complexity levels to tool arrays:
 * - simple: [] (no tools)
 * - medium: 5 essential tools
 * - complex: 'all' (full 18 tools)
 */
export const TOOL_TIERS = TOOLS_BY_COMPLEXITY

/**
 * Get tools for a specific complexity level
 * Story: E13.2 - Tier-Based Tool Loading (AC: #1, #2)
 *
 * @param complexity - The complexity level (simple, medium, complex)
 * @returns Array of tool instances for the tier
 *
 * @example
 * ```typescript
 * const tools = getToolsForComplexity('medium')
 * // Returns 5 tools: query_knowledge_base, get_document_info, etc.
 *
 * const allTools = getToolsForComplexity('complex')
 * // Returns all 18 tools
 *
 * const noTools = getToolsForComplexity('simple')
 * // Returns empty array
 * ```
 */
export function getToolsForComplexity(complexity: ComplexityLevel): StructuredToolInterface[] {
  // Complex tier gets all tools
  if (hasAllToolsAccess(complexity)) {
    console.log(`[ToolLoader] Complexity: ${complexity} → Loading all ${TOOL_COUNT} tools`)
    return allChatTools
  }

  // Get tool names for this tier
  const toolNames = TOOLS_BY_COMPLEXITY[complexity] as string[]

  // Map names to tool instances using existing lookup
  const tools = toolNames
    .map((name) => getToolByName(name))
    .filter((tool): tool is StructuredToolInterface => tool !== undefined)

  // Log tier selection for debugging
  console.log(
    `[ToolLoader] Complexity: ${complexity} → Loading ${tools.length} tools: [${tools.map((t) => t.name).join(', ')}]`
  )

  // Warn if any tools weren't found (indicates config mismatch)
  if (tools.length !== toolNames.length) {
    const foundNames = tools.map((t) => t.name)
    const missing = toolNames.filter((name) => !foundNames.includes(name))
    console.warn(`[ToolLoader] Warning: ${missing.length} tools not found: [${missing.join(', ')}]`)
  }

  return tools
}

/**
 * Get tools for an intent classification result
 * Story: E13.2 - Tier-Based Tool Loading (AC: #2)
 *
 * Uses the complexity field from EnhancedIntentResult to determine
 * which tools to load. Falls back to all tools if complexity is undefined
 * for backward compatibility.
 *
 * @param intent - The intent classification result from E13.1
 * @returns Array of tool instances based on intent complexity
 *
 * @example
 * ```typescript
 * const intent = await classifyIntentAsync(message)
 * const tools = getToolsForIntent(intent)
 * // Returns tools based on intent.complexity
 *
 * // Backward compatibility: undefined complexity → all tools
 * const legacyIntent = { intent: 'factual', confidence: 0.9, method: 'semantic' }
 * const tools = getToolsForIntent(legacyIntent)
 * // Returns all 18 tools
 * ```
 */
export function getToolsForIntent(intent: EnhancedIntentResult): StructuredToolInterface[] {
  // Default to complex (all tools) for backward compatibility
  const complexity = intent.complexity ?? 'complex'

  console.log(
    `[ToolLoader] Intent: ${intent.intent}, Complexity: ${complexity} (confidence: ${intent.complexityConfidence ?? 'N/A'})`
  )

  return getToolsForComplexity(complexity)
}

/**
 * Get tool count for a complexity level (for metadata/tracing)
 * Story: E13.2 - Tier-Based Tool Loading (AC: #4)
 *
 * @param complexity - The complexity level
 * @returns Number of tools that would be loaded
 */
export function getToolCountForComplexity(complexity: ComplexityLevel): number {
  if (hasAllToolsAccess(complexity)) {
    return TOOL_COUNT
  }
  const toolNames = TOOLS_BY_COMPLEXITY[complexity] as string[]
  return toolNames.length
}

/**
 * Tier progression for escalation
 * Story: E13.2 - Tier-Based Tool Loading (AC: #5)
 */
const TIER_PROGRESSION: Record<ComplexityLevel, ComplexityLevel> = {
  simple: 'medium',
  medium: 'complex',
  complex: 'complex', // Already at max
}

/**
 * Get the next tier in progression (for escalation)
 * Story: E13.2 - Tier-Based Tool Loading (AC: #5)
 *
 * @param currentTier - The current complexity tier
 * @returns The next tier in progression
 *
 * @example
 * ```typescript
 * getNextTier('simple')  // 'medium'
 * getNextTier('medium')  // 'complex'
 * getNextTier('complex') // 'complex' (already at max)
 * ```
 */
export function getNextTier(currentTier: ComplexityLevel): ComplexityLevel {
  return TIER_PROGRESSION[currentTier]
}

/**
 * Check if a tier can be escalated
 * Story: E13.2 - Tier-Based Tool Loading (AC: #5)
 *
 * @param currentTier - The current complexity tier
 * @returns True if escalation is possible
 */
export function canEscalate(currentTier: ComplexityLevel): boolean {
  return currentTier !== 'complex'
}

/**
 * Check if an error indicates a tool was not found
 * Story: E13.2 - Tier-Based Tool Loading (AC: #5)
 *
 * LangGraph ReAct agents throw specific errors when attempting
 * to use a tool that isn't in the available tool set.
 *
 * @param error - The error to check
 * @returns True if this is a tool-not-found error
 */
export function isToolNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()

  // LangGraph error patterns for missing tools
  return (
    (message.includes('tool') && message.includes('not found')) ||
    message.includes('is not a valid tool') ||
    message.includes('unknown tool') ||
    message.includes('no tool named')
  )
}

/**
 * Result of tool escalation
 * Story: E13.2 - Tier-Based Tool Loading (AC: #5)
 */
export interface EscalationResult {
  shouldEscalate: boolean
  nextTier: ComplexityLevel
  reason: string
}

/**
 * Handle tool escalation when a tool is not found
 * Story: E13.2 - Tier-Based Tool Loading (AC: #5)
 *
 * @param error - The error that triggered escalation
 * @param currentTier - The current complexity tier
 * @returns Escalation result indicating whether to retry
 *
 * @example
 * ```typescript
 * try {
 *   await agent.invoke({ messages })
 * } catch (error) {
 *   const result = handleToolEscalation(error, 'simple')
 *   if (result.shouldEscalate) {
 *     // Retry with result.nextTier
 *   }
 * }
 * ```
 */
export function handleToolEscalation(
  error: unknown,
  currentTier: ComplexityLevel
): EscalationResult {
  // Check if this is a tool-not-found error
  if (!isToolNotFoundError(error)) {
    return {
      shouldEscalate: false,
      nextTier: currentTier,
      reason: 'Error is not a tool-not-found error',
    }
  }

  // Check if we can escalate
  if (!canEscalate(currentTier)) {
    return {
      shouldEscalate: false,
      nextTier: currentTier,
      reason: 'Already at maximum tier (complex)',
    }
  }

  const nextTier = getNextTier(currentTier)
  const errorMessage = error instanceof Error ? error.message : String(error)

  console.warn(
    `[ToolLoader] Escalation triggered: ${currentTier} → ${nextTier}. Reason: ${errorMessage}`
  )

  return {
    shouldEscalate: true,
    nextTier,
    reason: `Tool not found in ${currentTier} tier, escalating to ${nextTier}`,
  }
}

/**
 * Log tool tier selection for LangSmith tracing
 * Story: E13.2 - Tier-Based Tool Loading (AC: #4)
 *
 * @param complexity - The selected complexity tier
 * @param toolCount - Number of tools loaded
 * @param wasEscalated - Whether this was an escalated request
 * @param originalTier - Original tier if escalated
 */
export function logToolTierSelection(
  complexity: ComplexityLevel,
  toolCount: number,
  wasEscalated: boolean = false,
  originalTier?: ComplexityLevel
): void {
  const metadata = {
    toolTier: complexity,
    toolCount,
    wasEscalated,
    ...(originalTier && { originalTier }),
    timestamp: new Date().toISOString(),
  }

  // Log for LangSmith trace metadata
  if (process.env.LANGSMITH_TRACING === 'true' || process.env.LANGCHAIN_TRACING_V2 === 'true') {
    console.log(`[LangSmith] Tool tier metadata: ${JSON.stringify(metadata)}`)
  }
}
