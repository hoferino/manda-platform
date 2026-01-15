/**
 * CIM MVP Graph
 *
 * LangGraph StateGraph for workflow-based CIM conversations.
 * Handles workflow progression, context saving, outline management, and slide creation.
 *
 * Story: CIM MVP Workflow Fix
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
import { getSystemPromptForCaching } from './prompts'
import { loadKnowledge } from './knowledge-loader'
import { getCheckpointer, type Checkpointer } from '@/lib/agent/checkpointer'

// =============================================================================
// LLM Configuration with Prompt Caching (Story 5)
// =============================================================================

/**
 * Enable Anthropic prompt caching for cost optimization.
 *
 * Cache structure:
 * - Stable content (tools, base prompts) is cached with 1-hour TTL
 * - Dynamic content (conversation history) is not cached
 *
 * Expected savings: 60-80% cost reduction on subsequent requests
 *
 * Min cacheable prefix (Anthropic docs 2025):
 * - Claude Sonnet 4.5: 1,024 tokens
 * - Claude Haiku 4.5: 4,096 tokens
 *
 * See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */
const baseModel = new ChatAnthropic({
  model: 'claude-haiku-4-5-20251001',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
  maxTokens: 4096,
  // Enable prompt caching with extended TTL (1 hour)
  // See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
  clientOptions: {
    defaultHeaders: {
      'anthropic-beta': 'prompt-caching-2024-07-31,extended-cache-ttl-2025-04-11',
    },
  },
})

// Bind tools and add config
const model = baseModel.bindTools(cimMVPTools).withConfig({
  runName: 'cim-mvp-agent',
  tags: ['cim-mvp', 'claude-haiku-4.5', 'prompt-caching'],
  metadata: {
    graph: 'cim-mvp',
    version: '1.2.0', // Bumped for prompt caching
  },
})

// =============================================================================
// Graph Nodes
// =============================================================================

/**
 * Agent node
 *
 * Main reasoning node that processes messages and decides on tool calls.
 * Tries to load knowledge on first run, but continues even if unavailable.
 *
 * Story 5: Uses prompt caching to reduce costs by 60-80%
 * - Static prompt (tools, rules) is cached with 1-hour TTL
 * - Dynamic prompt (state, progress) is not cached
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

  // Build system prompt with caching support (Story 5)
  const { staticPrompt, dynamicPrompt } = getSystemPromptForCaching({
    ...state,
    knowledgeLoaded,
    companyName,
  })

  // Debug: Log message count and caching info
  console.log(`[CIM-MVP] Agent node invoked with ${state.messages.length} messages`)
  console.log(`[CIM-MVP] Static prompt: ${staticPrompt.length} chars (cached), Dynamic: ${dynamicPrompt.length} chars`)

  // Invoke the model with cached system prompt structure
  // Static content gets cache_control for 1-hour TTL
  // Dynamic content follows without caching
  // See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
  const response = await model.invoke([
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: staticPrompt,
          // Cache the static portion with 1-hour TTL (extended caching beta)
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
        {
          type: 'text',
          text: dynamicPrompt,
          // No cache_control - this changes per request
        },
      ],
    },
    ...state.messages,
  ])

  // Log cache metrics on EVERY request for debugging
  // This helps identify if caching is working or if static prompt is below threshold
  const usageMetadata = response.usage_metadata
  if (usageMetadata) {
    const inputDetails = usageMetadata.input_token_details as { cache_read?: number; cache_creation?: number } | undefined
    const cacheRead = inputDetails?.cache_read || 0
    const cacheWrite = inputDetails?.cache_creation || 0
    const totalInput = usageMetadata.input_tokens || 0
    const uncachedInput = totalInput - cacheRead

    console.log(`[CIM-MVP] Token usage - total_input: ${totalInput}, cache_read: ${cacheRead}, cache_write: ${cacheWrite}, uncached: ${uncachedInput}`)

    // Warn if no caching is happening (may indicate static prompt below threshold)
    if (cacheRead === 0 && cacheWrite === 0 && totalInput > 5000) {
      console.warn(`[CIM-MVP] WARNING: No cache activity detected with ${totalInput} input tokens. Check if static prompt exceeds 4096 tokens for Haiku.`)
    }
  }

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
 * Post-tool processing node
 *
 * Handles tool results that affect state:
 * - Workflow progression (advance_workflow)
 * - Context saving (save_buyer_persona, save_hero_concept, save_context)
 * - Outline management (create_outline, update_outline)
 * - Section tracking (start_section)
 * - Slide updates (update_slide)
 *
 * HITL Validation (Belt-and-Suspenders):
 * This node also performs state-based validation to catch cases where the LLM
 * might bypass prompt-based HITL instructions. If a tool is called in an
 * inappropriate state, we log a warning and can optionally reject the action.
 *
 * Story: CIM MVP Workflow Fix (Story 4)
 * Story 1 & 2: Added HITL state validation
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
        // HITL State Validation (Belt-and-Suspenders)
        // =========================================
        const currentStage = state.workflowProgress?.currentStage || 'welcome'

        // Validate create_outline is only called in outline stage
        if (result.cimOutline && currentStage !== 'outline') {
          console.warn(`[postToolNode] HITL WARNING: create_outline called in ${currentStage} stage (expected: outline)`)
          console.warn(`[postToolNode] This may indicate the agent bypassed the approval flow`)
          // We still allow it but log for debugging - in production could reject
        }

        // Validate update_slide is only called in building_sections stage
        if (result.slideId && result.sectionId && !result.sectionDividerSlides) {
          if (currentStage !== 'building_sections') {
            console.warn(`[postToolNode] HITL WARNING: update_slide called in ${currentStage} stage (expected: building_sections)`)
            console.warn(`[postToolNode] This may indicate the agent bypassed the approval flow`)
          }

          // Check if current section is being worked on
          const currentSectionId = state.workflowProgress?.currentSectionId
          if (currentSectionId && result.sectionId !== currentSectionId) {
            console.warn(`[postToolNode] HITL WARNING: update_slide for section ${result.sectionId} but current section is ${currentSectionId}`)
          }
        }

        // =========================================
        // 4.1: Handle advance_workflow
        // =========================================
        if (result.advancedWorkflow && result.targetStage) {
          const targetStage = result.targetStage as WorkflowStage
          const currentProgress = state.workflowProgress || {
            currentStage: 'welcome' as WorkflowStage,
            completedStages: [] as WorkflowStage[],
            sectionProgress: {},
          }

          // HITL Validation: Check stage progression is valid
          const stageOrder: WorkflowStage[] = [
            'welcome', 'buyer_persona', 'hero_concept', 'investment_thesis',
            'outline', 'building_sections', 'complete'
          ]
          const currentIdx = stageOrder.indexOf(currentProgress.currentStage)
          const targetIdx = stageOrder.indexOf(targetStage)

          if (targetIdx < currentIdx) {
            console.warn(`[postToolNode] HITL WARNING: Attempting to go backwards from ${currentProgress.currentStage} to ${targetStage}`)
            // Still allow for now but log - could implement stage navigation tool (Story 3)
          } else if (targetIdx > currentIdx + 1) {
            console.warn(`[postToolNode] HITL WARNING: Skipping stages from ${currentProgress.currentStage} to ${targetStage}`)
          }

          // Special check: outline stage requires outline approval before advancing to building_sections
          if (currentProgress.currentStage === 'outline' && targetStage === 'building_sections') {
            if (!state.cimOutline || state.cimOutline.sections.length === 0) {
              console.warn(`[postToolNode] HITL WARNING: Advancing to building_sections but no outline has been created!`)
            }
          }

          // Add current stage to completed (if not already there)
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

        // =========================================
        // 4.1b: Handle navigate_to_stage (Story 3)
        // =========================================
        if (result.navigatedToStage && result.targetStage) {
          const targetStage = result.targetStage as WorkflowStage
          const currentProgress = state.workflowProgress || {
            currentStage: 'welcome' as WorkflowStage,
            completedStages: [] as WorkflowStage[],
            sectionProgress: {},
          }

          // Validate: can only navigate to completed stages
          const stageOrder: WorkflowStage[] = [
            'welcome', 'buyer_persona', 'hero_concept', 'investment_thesis',
            'outline', 'building_sections', 'complete'
          ]
          const currentIdx = stageOrder.indexOf(currentProgress.currentStage)
          const targetIdx = stageOrder.indexOf(targetStage)

          // Check if target stage was completed
          const wasCompleted = currentProgress.completedStages.includes(targetStage) ||
            (targetIdx < currentIdx) // Current stage implies prior stages were done

          if (!wasCompleted) {
            console.warn(`[postToolNode] NAVIGATION ERROR: Cannot navigate to ${targetStage} - not completed yet`)
            // Don't update state - navigation rejected
          } else if (targetIdx >= currentIdx) {
            console.warn(`[postToolNode] NAVIGATION ERROR: Cannot navigate forward to ${targetStage} - use advance_workflow instead`)
            // Don't update state - navigation rejected
          } else {
            // Valid backward navigation
            // Keep completedStages intact (don't remove them) so user can navigate forward again
            updates.workflowProgress = {
              ...currentProgress,
              currentStage: targetStage,
              // Preserve completedStages - user might just be reviewing
              // Also preserve sectionProgress for slide work
            }

            console.log(`[postToolNode] Navigated backward: ${currentProgress.currentStage} → ${targetStage}`)
            if (result.cascadeWarnings && result.cascadeWarnings.length > 0) {
              console.log(`[postToolNode] Cascade warnings: ${result.cascadeWarnings.join(', ')}`)
            }
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
          const currentProgress = state.workflowProgress || {
            currentStage: 'outline' as WorkflowStage,
            completedStages: [] as WorkflowStage[],
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
          const currentProgress = state.workflowProgress || {
            currentStage: 'outline' as WorkflowStage,
            completedStages: [] as WorkflowStage[],
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
          const currentProgress = state.workflowProgress || {
            currentStage: 'building_sections' as WorkflowStage,
            completedStages: [] as WorkflowStage[],
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
          const slideUpdate: SlideUpdate = {
            slideId: result.slideId,
            sectionId: result.sectionId,
            title: result.title || 'Untitled Slide',
            layoutType: (result.layoutType as LayoutType) || undefined,
            components: result.components || [],
            status: 'draft',
          }

          updates.pendingSlideUpdate = slideUpdate
          updates.allSlideUpdates = [slideUpdate]

          console.log(`[postToolNode] Slide updated: ${result.slideId} (layout: ${result.layoutType || 'default'})`)
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
      } catch {
        // Not JSON, ignore
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
 * Compiled CIM MVP graph
 */
export const cimMVPGraph = workflow.compile()

// Cached graph with checkpointer
let cachedGraphWithCheckpointer: ReturnType<typeof workflow.compile> | null = null

/**
 * Get CIM MVP graph with persistence
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
 * Create a graph instance with custom checkpointer
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
