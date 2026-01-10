/**
 * Agent System v2.0 - Gemini LLM Configuration
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling (AC: #1)
 *
 * Configures Gemini 2.0 Flash via Vertex AI for the supervisor node.
 * Uses EU region (europe-west1) for NFR8 compliance.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Supervisor Node]
 * - [Source: _bmad-output/planning-artifacts/agent-system-epics.md#Story 2.1]
 */

import { ChatVertexAI } from '@langchain/google-vertexai'
import { specialistTools } from '../tools'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Default configuration for the supervisor LLM.
 * Uses Gemini 2.0 Flash for balance of speed and quality.
 */
const DEFAULT_SUPERVISOR_CONFIG = {
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxOutputTokens: 2048,
} as const

// =============================================================================
// LLM Factory Functions
// =============================================================================

/**
 * Create a base supervisor LLM instance without tool bindings.
 *
 * Uses Gemini 2.0 Flash via Vertex AI in EU region for NFR8 compliance.
 * Do NOT bind tools at module level - bind per invocation to allow
 * dynamic tool selection based on workflow mode (Story 4.1 adds this).
 *
 * @returns ChatVertexAI instance configured for supervisor use
 *
 * @example
 * ```typescript
 * const llm = createSupervisorLLM()
 * const response = await llm.invoke(messages)
 * ```
 */
export function createSupervisorLLM(): ChatVertexAI {
  return new ChatVertexAI({
    ...DEFAULT_SUPERVISOR_CONFIG,
    // EU region for NFR8 compliance - MUST use europe-west1
    location: process.env.GOOGLE_VERTEX_LOCATION || 'europe-west1',
  })
}

/**
 * Get LLM with specialist tools bound for supervisor routing.
 *
 * Separated from creation to allow future tool filtering by workflow mode
 * (Story 4.1: Tool Selector Middleware will filter based on workflowMode).
 *
 * @returns ChatVertexAI instance with specialist tools bound
 *
 * @example
 * ```typescript
 * const llm = getSupervisorLLMWithTools()
 * const response = await llm.invoke(messages)
 *
 * // Check for tool calls
 * if (response.tool_calls?.length > 0) {
 *   const toolCall = response.tool_calls[0]
 *   // Route to specialist based on toolCall.name
 * }
 * ```
 */
export function getSupervisorLLMWithTools(): ReturnType<ChatVertexAI['bindTools']> {
  return createSupervisorLLM().bindTools(specialistTools)
}
