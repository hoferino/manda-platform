/**
 * Agent System v2.0 - Workflow Router Middleware
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #1, #3, #4, #6)
 *
 * Sets the system prompt based on workflow mode:
 * - 'chat' → general assistant prompt with deal context
 * - 'cim'  → CIM builder workflow prompt (phase-specific)
 * - 'irl'  → IRL builder placeholder prompt
 *
 * This middleware transforms state but does NOT call the LLM.
 * The supervisor node reads state.systemPrompt and uses it.
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Context Engineering Strategy]
 * - [Source: lib/agent/prompts.ts] - getSystemPromptWithContext
 * - [Source: lib/agent/cim/prompts.ts] - getCIMSystemPrompt
 */

import type { AgentStateType } from '../state'
import { getSystemPromptWithContext } from '@/lib/agent/prompts'
import { getCIMSystemPrompt } from '@/lib/agent/cim/prompts'
import type { CIMPhase } from '@/lib/types/cim'

// =============================================================================
// IRL System Prompt (Placeholder - AC: #1)
// =============================================================================

/**
 * Get IRL (Information Request List) Builder system prompt.
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #1)
 *
 * Placeholder implementation for the IRL Builder workflow.
 * Will be expanded in future stories when IRL workflow is implemented.
 *
 * @param dealName - Optional deal name for context
 * @returns IRL system prompt string
 *
 * @example
 * ```typescript
 * const prompt = getIRLSystemPrompt('Acme Corp')
 * // Returns prompt with "Acme Corp" context included
 * ```
 */
export function getIRLSystemPrompt(dealName?: string): string {
  const base = `You are an IRL (Information Request List) Builder Assistant helping M&A professionals create and manage information request lists for due diligence.

## Core Responsibilities
1. Help structure information requests by category
2. Track which items have been received vs outstanding
3. Prioritize requests based on deal phase and urgency
4. Generate professional request language for client communication

## Response Style
- Be structured and organized
- Use clear category headers
- Include deadlines and priorities where relevant
- DON'T use hedging or filler phrases ("I think", "Let me", "Sure, I can")
- Confirm actions concisely: "Added to IRL: [item]. Outstanding items: N."`

  return dealName
    ? `${base}\n\n## Current Deal Context\nYou are building an IRL for: "${dealName}"`
    : base
}

// =============================================================================
// Workflow Router Middleware (AC: #1, #3, #4, #6)
// =============================================================================

/**
 * Workflow router middleware - sets system prompt based on workflow mode.
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #1, #3, #4, #6)
 *
 * This middleware:
 * - Reads state.workflowMode to determine which prompt to use
 * - Sets state.systemPrompt for the supervisor node
 * - Does NOT modify state.messages (AC: #3)
 * - Does NOT call the LLM (AC: #5)
 *
 * Edge Cases (AC: #6):
 * - null/undefined workflowMode → defaults to 'chat' with warning
 * - null cimState in CIM mode → defaults to 'persona' phase with warning
 *
 * @param state - Current agent state
 * @returns Updated state with systemPrompt set
 *
 * @example
 * ```typescript
 * const state = createInitialState('chat', 'deal-123')
 * const updatedState = workflowRouterMiddleware(state)
 * // updatedState.systemPrompt is now set to chat prompt
 * ```
 */
export function workflowRouterMiddleware(state: AgentStateType): AgentStateType {
  const dealName = state.dealContext?.dealName || undefined

  // Handle null/undefined workflowMode (AC: #6)
  if (!state.workflowMode) {
    console.warn('[workflow-router] workflowMode is null/undefined, defaulting to chat')
    return { ...state, systemPrompt: getSystemPromptWithContext(dealName) }
  }

  switch (state.workflowMode) {
    case 'chat':
      // Chat mode: use general assistant prompt (AC: #1, #3)
      return { ...state, systemPrompt: getSystemPromptWithContext(dealName) }

    case 'cim': {
      // CIM mode: use phase-specific prompt (AC: #1, #4)
      // Handle null cimState gracefully (AC: #6)
      const phase: CIMPhase = state.cimState?.currentPhase ?? 'persona'
      if (!state.cimState) {
        console.warn('[workflow-router] CIM mode but cimState is null, defaulting to persona phase')
      }

      // CIMPhase is now unified - no mapping needed
      return { ...state, systemPrompt: getCIMSystemPrompt(phase, dealName) }
    }

    case 'irl':
      // IRL mode: use placeholder prompt (AC: #1)
      return { ...state, systemPrompt: getIRLSystemPrompt(dealName) }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = state.workflowMode
      console.warn(`[workflow-router] Unknown workflowMode: ${_exhaustive}, defaulting to chat`)
      return { ...state, systemPrompt: getSystemPromptWithContext(dealName) }
    }
  }
}
