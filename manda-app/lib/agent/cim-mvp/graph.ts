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
import { getSystemPrompt } from './prompts'
import { loadKnowledge } from './knowledge-loader'
import { getCheckpointer, type Checkpointer } from '@/lib/agent/checkpointer'

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
 * Agent node
 *
 * Main reasoning node that processes messages and decides on tool calls.
 * Tries to load knowledge on first run, but continues even if unavailable.
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
 * Post-tool processing node
 *
 * Handles tool results that affect state:
 * - Workflow progression (advance_workflow)
 * - Context saving (save_buyer_persona, save_hero_concept, save_context)
 * - Outline management (create_outline, update_outline)
 * - Section tracking (start_section)
 * - Slide updates (update_slide)
 *
 * Story: CIM MVP Workflow Fix (Story 4)
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
        // 4.1: Handle advance_workflow
        // =========================================
        if (result.advancedWorkflow && result.targetStage) {
          const targetStage = result.targetStage as WorkflowStage
          const currentProgress = state.workflowProgress || {
            currentStage: 'welcome' as WorkflowStage,
            completedStages: [] as WorkflowStage[],
            sectionProgress: {},
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
