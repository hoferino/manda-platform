/**
 * CIM MVP Graph
 *
 * LangGraph StateGraph for workflow-based CIM conversations.
 * Handles workflow progression, context saving, outline management, and slide creation.
 *
 * ## Architecture
 *
 * The graph implements a simple agent loop with post-processing:
 *
 * ```
 * START → agent → [tools] → post_tool → agent → ... → END
 *           ↓         ↓
 *         (no tools)  ↓
 *           ↓         ↓
 *          END    (process tool results)
 * ```
 *
 * ### Nodes
 *
 * 1. **agent** - Main reasoning node
 *    - Loads knowledge on first run (if available)
 *    - Builds system prompt from current state
 *    - Invokes Claude model with tools
 *
 * 2. **tools** - LangGraph ToolNode
 *    - Executes tool calls from agent
 *    - Returns tool results as messages
 *
 * 3. **post_tool** - State update node
 *    - Parses JSON tool results
 *    - Updates state based on result fields
 *    - Handles: workflow progression, buyer persona, hero context,
 *      outline management, section tracking, slide updates, gathered context
 *
 * ### Routing
 *
 * - `shouldContinue`: agent → tools (if tool calls) or END
 * - `afterTools`: tools → post_tool (always)
 * - `afterPostTool`: post_tool → agent (always, continues loop)
 *
 * ## State Management
 *
 * State is managed via LangGraph Annotations (see state.ts).
 * Key state fields updated by this graph:
 *
 * | Field | Updated By |
 * |-------|------------|
 * | `messages` | agentNode (model responses) |
 * | `workflowProgress` | postToolNode (advance_workflow, navigate_to_stage) |
 * | `buyerPersona` | postToolNode (save_buyer_persona) |
 * | `heroContext` | postToolNode (save_hero_concept) |
 * | `cimOutline` | postToolNode (create_outline, update_outline) |
 * | `gatheredContext` | postToolNode (save_context) |
 * | `pendingSlideUpdate` | postToolNode (update_slide) |
 *
 * ## Persistence
 *
 * The graph supports checkpointing for conversation persistence:
 *
 * ```typescript
 * // Get graph with persistence
 * const graph = await getCIMMVPGraph()
 *
 * // Or create with custom checkpointer
 * const graph = createCIMMVPGraph(myCheckpointer)
 * ```
 *
 * ## Exports
 *
 * - `cimMVPGraph` - Compiled graph without persistence
 * - `getCIMMVPGraph()` - Get graph with default checkpointer (cached)
 * - `createCIMMVPGraph(checkpointer?)` - Create graph with optional checkpointer
 *
 * @module cim-mvp/graph
 * @see {@link ./state.ts} for state type definitions
 * @see {@link ./tools.ts} for tool definitions
 * @see {@link ./prompts.ts} for system prompt construction
 *
 * Story: CIM MVP Workflow Fix
 * Enhancement: Added navigation support in postToolNode
 */

import { StateGraph, START, END } from '@langchain/langgraph'
import { ChatAnthropic } from '@langchain/anthropic'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { AIMessage } from '@langchain/core/messages'

import {
  CIMMVPState,
  type CIMMVPStateType,
  type CIMPhase,
  type WorkflowStage,
  type WorkflowProgress,
  type SectionProgress,
  type SlideUpdate,
  type LayoutType,
} from './state'
import { cimMVPTools } from './tools'
import { getSystemPrompt } from './prompts'
import { loadKnowledge } from './knowledge-loader'
import { getCheckpointer, type Checkpointer } from '@/lib/agent/checkpointer'

// =============================================================================
// Constants
// =============================================================================

/**
 * Default workflow stage when none is set
 */
const DEFAULT_WORKFLOW_STAGE: WorkflowStage = 'welcome'

/**
 * Default slide status for newly created slides
 */
const DEFAULT_SLIDE_STATUS = 'draft' as const

// =============================================================================
// LLM Configuration
// =============================================================================

const baseModel = new ChatAnthropic({
  model: 'claude-haiku-4-5-20251001',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
  maxTokens: 4096,
})

// Bind tools and add config
const model = baseModel.bindTools(cimMVPTools).withConfig({
  runName: 'cim-mvp-agent',
  tags: ['cim-mvp', 'claude-haiku-4.5'],
  metadata: {
    graph: 'cim-mvp',
    version: '1.1.0',
  },
})

// =============================================================================
// Graph Nodes
// =============================================================================

/**
 * Agent node - Main reasoning node that processes messages and decides on tool calls.
 *
 * This node:
 * 1. Attempts to load knowledge base on first invocation (if not already attempted)
 * 2. Builds a dynamic system prompt based on current state
 * 3. Invokes the Claude model with conversation history
 * 4. Returns the model response and any state updates
 *
 * Knowledge loading is non-blocking - if no knowledge file exists, the agent
 * continues in "chat mode" where it gathers information through conversation.
 *
 * @param state - Current CIM MVP state
 * @returns Partial state update with new message and knowledge status
 *
 * @example
 * ```typescript
 * // Called automatically by the graph
 * const updates = await agentNode(state)
 * // updates.messages contains the model response
 * // updates.knowledgeLoaded indicates if knowledge was loaded
 * ```
 */
async function agentNode(
  state: CIMMVPStateType
): Promise<Partial<CIMMVPStateType>> {
  // Try to load knowledge if not yet attempted
  let knowledgeLoaded = state.knowledgeLoaded
  let companyName = state.companyName

  if (!knowledgeLoaded && !state.knowledgeAttempted) {
    try {
      const knowledgePath = state.knowledgePath || undefined
      const knowledge = await loadKnowledge(knowledgePath)
      knowledgeLoaded = true
      companyName = knowledge.metadata.company_name
      console.log(`[CIM-MVP] Knowledge loaded for: ${companyName}`)
    } catch {
      // Knowledge not available - that's OK, continue without it
      console.log('[CIM-MVP] No knowledge file found - continuing in chat mode')
    }
  }

  // Build system prompt with current state
  const systemPrompt = getSystemPrompt({
    ...state,
    knowledgeLoaded,
    companyName,
  })

  // Debug: Log message count
  console.log(`[CIM-MVP] Agent node invoked with ${state.messages.length} messages`)

  // Invoke the model with system prompt and conversation history
  // Claude handles LangChain messages natively
  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    ...state.messages,
  ])

  console.log(`[CIM-MVP] Model response received, tool_calls: ${response.tool_calls?.length || 0}`)

  return {
    messages: [response],
    knowledgeLoaded,
    companyName,
    knowledgeAttempted: true,
  }
}

/**
 * Tool execution node
 */
const toolNode = new ToolNode(cimMVPTools)

/**
 * Post-tool processing node - Handles tool results that affect state.
 *
 * This node parses JSON tool results and updates state accordingly.
 * It's the bridge between tool execution and state management.
 *
 * ## Handled Tool Results
 *
 * | Result Field | Tool | State Update |
 * |--------------|------|--------------|
 * | `advancedWorkflow` + `targetStage` | advance_workflow | workflowProgress.currentStage |
 * | `navigatedToStage` + `targetStage` | navigate_to_stage | workflowProgress.currentStage (preserves completed) |
 * | `buyerPersona` | save_buyer_persona | buyerPersona |
 * | `heroContext` | save_hero_concept | heroContext |
 * | `cimOutline` | create_outline | cimOutline, workflowProgress.sectionProgress |
 * | `sectionDividerSlides` | create_outline | allSlideUpdates |
 * | `outlineUpdate` | update_outline | cimOutline (add/remove/reorder/update) |
 * | `startSection` | start_section | workflowProgress.currentSectionId |
 * | `slideId` + `sectionId` | update_slide | pendingSlideUpdate, allSlideUpdates |
 * | `gatheredContext` | save_context | gatheredContext (merged) |
 *
 * ## Navigation vs. Advancement
 *
 * When processing workflow stage changes:
 * - **Advancement** (advance_workflow): Adds current stage to completedStages
 * - **Navigation** (navigate_to_stage): Preserves completedStages, only changes currentStage
 *
 * @param state - Current CIM MVP state with tool result messages
 * @returns Partial state update based on tool results
 *
 * Story: CIM MVP Workflow Fix (Story 4)
 * Enhancement: Added navigate_to_stage handling
 */
async function postToolNode(
  state: CIMMVPStateType
): Promise<Partial<CIMMVPStateType>> {
  const lastMessage = state.messages[state.messages.length - 1]

  if (lastMessage && 'content' in lastMessage) {
    const content = lastMessage.content
    if (typeof content === 'string') {
      try {
        const result = JSON.parse(content)
        const updates: Partial<CIMMVPStateType> = {}

        // =========================================
        // 4.1: Handle advance_workflow AND navigate_to_stage
        // =========================================
        if (result.advancedWorkflow && result.targetStage) {
          const targetStage = result.targetStage as WorkflowStage
          const currentProgress: WorkflowProgress = state.workflowProgress || {
            currentStage: DEFAULT_WORKFLOW_STAGE,
            completedStages: [],
            sectionProgress: {},
          }

          // Check if this is a navigation (going backward) vs advance (going forward)
          const isNavigation = result.navigatedToStage === true

          if (isNavigation) {
            // Navigation: Don't add current to completed, just move to target
            // This allows revisiting stages without losing the "completed" status of later stages
            updates.workflowProgress = {
              ...currentProgress,
              currentStage: targetStage,
              // Keep completedStages as-is - we're revisiting, not invalidating
            }
            console.log(`[postToolNode] Navigated back to: ${targetStage} (from ${currentProgress.currentStage})`)
          } else {
            // Normal advance: Add current stage to completed
            const completedStages = currentProgress.currentStage !== targetStage
              ? [...currentProgress.completedStages, currentProgress.currentStage]
              : currentProgress.completedStages

            updates.workflowProgress = {
              ...currentProgress,
              currentStage: targetStage,
              completedStages: completedStages.filter(
                (v, i, a) => a.indexOf(v) === i
              ) as WorkflowStage[], // dedupe
            }
            console.log(`[postToolNode] Workflow advanced: ${currentProgress.currentStage} → ${targetStage}`)
          }
        }

        // =========================================
        // 4.2: Handle save_buyer_persona
        // =========================================
        if (result.buyerPersona) {
          updates.buyerPersona = result.buyerPersona
          console.log(`[postToolNode] Buyer persona saved: ${result.buyerPersona.type}`)
        }

        // =========================================
        // 4.3: Handle save_hero_concept
        // =========================================
        if (result.heroContext) {
          updates.heroContext = result.heroContext
          console.log(`[postToolNode] Hero context saved: ${result.heroContext.selectedHero}`)
        }

        // =========================================
        // 4.4: Handle create_outline
        // =========================================
        if (result.cimOutline) {
          updates.cimOutline = result.cimOutline

          // Initialize section progress for each section
          const sectionProgress: Record<string, SectionProgress> = {}
          for (const section of result.cimOutline.sections) {
            sectionProgress[section.id] = {
              sectionId: section.id,
              status: 'pending',
              slides: [],
            }
          }

          // Merge with existing workflowProgress
          const currentProgress: WorkflowProgress = state.workflowProgress || {
            currentStage: 'outline',
            completedStages: [],
            sectionProgress: {},
          }

          updates.workflowProgress = {
            ...currentProgress,
            ...(updates.workflowProgress || {}),
            sectionProgress,
          }

          console.log(`[postToolNode] Outline created with ${result.cimOutline.sections.length} sections`)
        }

        // Handle section divider slides from create_outline
        if (result.sectionDividerSlides && Array.isArray(result.sectionDividerSlides)) {
          updates.allSlideUpdates = result.sectionDividerSlides
          console.log(`[postToolNode] Created ${result.sectionDividerSlides.length} section divider slides`)
        }

        // =========================================
        // 4.5: Handle update_outline
        // =========================================
        if (result.outlineUpdate) {
          const currentOutline = state.cimOutline || { sections: [] }
          const currentProgress: WorkflowProgress = state.workflowProgress || {
            currentStage: 'outline',
            completedStages: [],
            sectionProgress: {},
          }

          if (result.action === 'add' && result.newSection) {
            // Add new section
            updates.cimOutline = {
              sections: [...currentOutline.sections, result.newSection],
            }
            // Initialize progress for new section
            const newSectionProgress = { ...currentProgress.sectionProgress }
            newSectionProgress[result.newSection.id] = {
              sectionId: result.newSection.id,
              status: 'pending',
              slides: [],
            }
            updates.workflowProgress = {
              ...currentProgress,
              sectionProgress: newSectionProgress,
            }
            console.log(`[postToolNode] Added section: ${result.newSection.title}`)
          } else if (result.action === 'remove' && result.removeSectionId) {
            // Remove section
            updates.cimOutline = {
              sections: currentOutline.sections.filter(
                (s) => s.id !== result.removeSectionId
              ),
            }
            // Remove from progress
            const newSectionProgress = { ...currentProgress.sectionProgress }
            delete newSectionProgress[result.removeSectionId]
            updates.workflowProgress = {
              ...currentProgress,
              sectionProgress: newSectionProgress,
            }
            console.log(`[postToolNode] Removed section: ${result.removeSectionId}`)
          } else if (result.action === 'reorder' && result.newOrder) {
            // Reorder sections
            const sectionMap = new Map(
              currentOutline.sections.map((s) => [s.id, s])
            )
            updates.cimOutline = {
              sections: result.newOrder
                .map((id: string) => sectionMap.get(id))
                .filter(Boolean),
            }
            console.log(`[postToolNode] Reordered sections`)
          } else if (result.action === 'update' && result.updateSectionId && result.updatedSection) {
            // Update section
            updates.cimOutline = {
              sections: currentOutline.sections.map((s) =>
                s.id === result.updateSectionId
                  ? { ...s, ...result.updatedSection }
                  : s
              ),
            }
            console.log(`[postToolNode] Updated section: ${result.updateSectionId}`)
          }
        }

        // =========================================
        // 4.6: Handle start_section
        // =========================================
        if (result.startSection && result.sectionId) {
          const currentProgress: WorkflowProgress = state.workflowProgress || {
            currentStage: 'building_sections',
            completedStages: [],
            sectionProgress: {},
          }

          // Update current section and section status
          const newSectionProgress = { ...currentProgress.sectionProgress }
          const existingProgress = newSectionProgress[result.sectionId]
          if (existingProgress) {
            newSectionProgress[result.sectionId] = {
              sectionId: existingProgress.sectionId,
              status: 'content_development',
              slides: existingProgress.slides,
            }
          } else {
            // Initialize if not exists
            newSectionProgress[result.sectionId] = {
              sectionId: result.sectionId,
              status: 'content_development',
              slides: [],
            }
          }

          updates.workflowProgress = {
            ...currentProgress,
            ...(updates.workflowProgress || {}),
            currentSectionId: result.sectionId,
            sectionProgress: newSectionProgress,
          }

          console.log(`[postToolNode] Started section: ${result.sectionId}`)
        }

        // =========================================
        // 4.7: Handle update_slide (enhanced with layouts)
        // =========================================
        if (result.slideId && result.sectionId && !result.sectionDividerSlides) {
          const slideLayoutType = result.layoutType as LayoutType | undefined
          const slideUpdate: SlideUpdate = {
            slideId: result.slideId,
            sectionId: result.sectionId,
            title: result.title || 'Untitled Slide',
            layoutType: slideLayoutType,
            components: result.components || [],
            status: DEFAULT_SLIDE_STATUS,
          }

          updates.pendingSlideUpdate = slideUpdate
          updates.allSlideUpdates = [slideUpdate]

          const layoutDescription = slideLayoutType || 'default'
          console.log(`[postToolNode] Slide updated: ${result.slideId} (layout: ${layoutDescription})`)
        }

        // =========================================
        // Handle save_context (existing functionality)
        // =========================================
        if (result.gatheredContext) {
          updates.gatheredContext = result.gatheredContext
          console.log('[postToolNode] Gathered context merged')
        }

        // =========================================
        // Legacy: Handle navigation (backward compat)
        // =========================================
        if (result.navigatedTo) {
          const newPhase = result.navigatedTo as CIMPhase
          const completedPhases =
            state.currentPhase !== newPhase
              ? [...(state.completedPhases || []), state.currentPhase]
              : state.completedPhases || []

          updates.currentPhase = newPhase
          updates.completedPhases = completedPhases.filter(
            (p, i, arr) => arr.indexOf(p) === i
          )
          console.log(`[postToolNode] Legacy navigation: → ${newPhase}`)
        }

        // Return updates if any
        if (Object.keys(updates).length > 0) {
          return updates
        }
      } catch (parseError) {
        // Not valid JSON - this is expected for non-tool-result messages
        // Only log if it looks like it should have been JSON (starts with { or [)
        if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
          console.debug('[postToolNode] Failed to parse JSON-like content:', parseError)
        }
      }
    }
  }

  return {}
}

// =============================================================================
// Routing Logic
// =============================================================================

function shouldContinue(state: CIMMVPStateType): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1]

  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return 'tools'
  }

  return END
}

function afterTools(): 'post_tool' {
  return 'post_tool'
}

function afterPostTool(): 'agent' {
  return 'agent'
}

// =============================================================================
// Graph Definition
// =============================================================================

const workflow = new StateGraph(CIMMVPState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addNode('post_tool', postToolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addConditionalEdges('tools', afterTools, {
    post_tool: 'post_tool',
  })
  .addConditionalEdges('post_tool', afterPostTool, {
    agent: 'agent',
  })

/**
 * Compiled CIM MVP graph (without persistence).
 *
 * Use this for one-off executions where conversation state doesn't need to persist.
 * For persistent conversations, use `getCIMMVPGraph()` or `createCIMMVPGraph()`.
 */
export const cimMVPGraph = workflow.compile()

// Cached graph with checkpointer (singleton pattern)
let cachedGraphWithCheckpointer: ReturnType<typeof workflow.compile> | null = null

/**
 * Get CIM MVP graph with default persistence checkpointer.
 *
 * Uses a cached singleton pattern - subsequent calls return the same instance.
 * The checkpointer is retrieved from the shared checkpointer module.
 *
 * @returns Promise resolving to the compiled graph with persistence
 *
 * @example
 * ```typescript
 * const graph = await getCIMMVPGraph()
 *
 * // Use with thread ID for persistence
 * const result = await graph.invoke(state, {
 *   configurable: { thread_id: 'conversation-123' }
 * })
 * ```
 */
export async function getCIMMVPGraph() {
  if (cachedGraphWithCheckpointer) {
    return cachedGraphWithCheckpointer
  }

  const checkpointer = await getCheckpointer()

  cachedGraphWithCheckpointer = workflow.compile({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    checkpointer: checkpointer as any,
  })

  return cachedGraphWithCheckpointer
}

/**
 * Create a new CIM MVP graph instance with optional custom checkpointer.
 *
 * Unlike `getCIMMVPGraph()`, this creates a fresh instance each call.
 * Use this when you need a custom checkpointer or isolated graph instances.
 *
 * @param checkpointer - Optional LangGraph checkpointer for persistence
 * @returns Compiled graph instance
 *
 * @example
 * ```typescript
 * // Without persistence
 * const graph = createCIMMVPGraph()
 *
 * // With custom checkpointer
 * const myCheckpointer = new SqliteSaver(':memory:')
 * const graph = createCIMMVPGraph(myCheckpointer)
 * ```
 */
export function createCIMMVPGraph(checkpointer?: Checkpointer) {
  if (checkpointer) {
    return workflow.compile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checkpointer: checkpointer as any,
    })
  }
  return workflow.compile()
}
