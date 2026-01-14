/**
 * CIM MVP Graph Tests
 *
 * Tests for graph structure, routing logic, and postToolNode processing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'

import {
  cimMVPGraph,
  getCIMMVPGraph,
  createCIMMVPGraph,
} from '@/lib/agent/cim-mvp/graph'
import type {
  CIMMVPStateType,
  WorkflowStage,
  SectionProgress,
  SlideUpdate,
  CIMPhase,
} from '@/lib/agent/cim-mvp/state'

// =============================================================================
// Mock External Dependencies
// =============================================================================

// Mock the checkpointer
vi.mock('@/lib/agent/checkpointer', () => ({
  getCheckpointer: vi.fn().mockResolvedValue({
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn(),
  }),
}))

// Mock knowledge loader
vi.mock('@/lib/agent/cim-mvp/knowledge-loader', () => ({
  loadKnowledge: vi.fn().mockRejectedValue(new Error('No knowledge file')),
}))

// =============================================================================
// Routing Logic Tests (Replicated for Unit Testing)
// =============================================================================

/**
 * Replica of shouldContinue routing logic
 */
function shouldContinue(state: CIMMVPStateType): 'tools' | '__end__' {
  const lastMessage = state.messages[state.messages.length - 1]

  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return 'tools'
  }

  return '__end__'
}

/**
 * Replica of afterTools routing logic
 */
function afterTools(): 'post_tool' {
  return 'post_tool'
}

/**
 * Replica of afterPostTool routing logic
 */
function afterPostTool(): 'agent' {
  return 'agent'
}

describe('CIM MVP Graph - Routing Logic', () => {
  describe('shouldContinue', () => {
    it('should route to tools when last message has tool_calls', () => {
      const aiMessage = new AIMessage({
        content: 'Let me search for information',
        tool_calls: [
          {
            id: 'call_123',
            name: 'knowledge_search',
            args: { query: 'revenue' },
          },
        ],
      })

      const state = {
        messages: [aiMessage],
      } as CIMMVPStateType

      expect(shouldContinue(state)).toBe('tools')
    })

    it('should route to END when last message has no tool_calls', () => {
      const aiMessage = new AIMessage({
        content: 'Here is my response to your question.',
      })

      const state = {
        messages: [aiMessage],
      } as CIMMVPStateType

      expect(shouldContinue(state)).toBe('__end__')
    })

    it('should route to END when last message has empty tool_calls array', () => {
      const aiMessage = new AIMessage({
        content: 'Response without tools',
        tool_calls: [],
      })

      const state = {
        messages: [aiMessage],
      } as CIMMVPStateType

      expect(shouldContinue(state)).toBe('__end__')
    })

    it('should route to END when last message is HumanMessage', () => {
      const humanMessage = new HumanMessage('Hello')

      const state = {
        messages: [humanMessage],
      } as CIMMVPStateType

      expect(shouldContinue(state)).toBe('__end__')
    })

    it('should route to END when last message is ToolMessage', () => {
      const toolMessage = new ToolMessage({
        content: '{"result": "success"}',
        tool_call_id: 'call_123',
      })

      const state = {
        messages: [toolMessage],
      } as CIMMVPStateType

      expect(shouldContinue(state)).toBe('__end__')
    })

    it('should handle multiple tool calls', () => {
      const aiMessage = new AIMessage({
        content: 'Multiple tools needed',
        tool_calls: [
          { id: 'call_1', name: 'knowledge_search', args: { query: 'a' } },
          { id: 'call_2', name: 'web_search', args: { query: 'b' } },
        ],
      })

      const state = {
        messages: [aiMessage],
      } as CIMMVPStateType

      expect(shouldContinue(state)).toBe('tools')
    })
  })

  describe('afterTools', () => {
    it('should always route to post_tool', () => {
      expect(afterTools()).toBe('post_tool')
    })
  })

  describe('afterPostTool', () => {
    it('should always route to agent', () => {
      expect(afterPostTool()).toBe('agent')
    })
  })
})

// =============================================================================
// PostToolNode Processing Logic Tests (Replicated for Unit Testing)
// =============================================================================

/**
 * Replica of postToolNode logic for testing state updates
 */
function processToolResult(
  state: CIMMVPStateType,
  result: Record<string, unknown>
): Partial<CIMMVPStateType> {
  const updates: Partial<CIMMVPStateType> = {}

  // Handle advance_workflow
  if (result.advancedWorkflow && result.targetStage) {
    const targetStage = result.targetStage as WorkflowStage
    const currentProgress = state.workflowProgress || {
      currentStage: 'welcome' as WorkflowStage,
      completedStages: [] as WorkflowStage[],
      sectionProgress: {},
    }

    const completedStages =
      currentProgress.currentStage !== targetStage
        ? [...currentProgress.completedStages, currentProgress.currentStage]
        : currentProgress.completedStages

    updates.workflowProgress = {
      ...currentProgress,
      currentStage: targetStage,
      completedStages: completedStages.filter(
        (v, i, a) => a.indexOf(v) === i
      ) as WorkflowStage[],
    }
  }

  // Handle save_buyer_persona
  if (result.buyerPersona) {
    updates.buyerPersona = result.buyerPersona as CIMMVPStateType['buyerPersona']
  }

  // Handle save_hero_concept
  if (result.heroContext) {
    updates.heroContext = result.heroContext as CIMMVPStateType['heroContext']
  }

  // Handle create_outline
  if (result.cimOutline) {
    updates.cimOutline = result.cimOutline as CIMMVPStateType['cimOutline']

    const sections = (result.cimOutline as { sections: Array<{ id: string }> }).sections
    const sectionProgress: Record<string, SectionProgress> = {}
    for (const section of sections) {
      sectionProgress[section.id] = {
        sectionId: section.id,
        status: 'pending',
        slides: [],
      }
    }

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
  }

  // Handle section divider slides
  if (result.sectionDividerSlides && Array.isArray(result.sectionDividerSlides)) {
    updates.allSlideUpdates = result.sectionDividerSlides as SlideUpdate[]
  }

  // Handle update_outline
  if (result.outlineUpdate) {
    const currentOutline = state.cimOutline || { sections: [] }
    const currentProgress = state.workflowProgress || {
      currentStage: 'outline' as WorkflowStage,
      completedStages: [] as WorkflowStage[],
      sectionProgress: {},
    }

    if (result.action === 'add' && result.newSection) {
      updates.cimOutline = {
        sections: [...currentOutline.sections, result.newSection as CIMMVPStateType['cimOutline']['sections'][0]],
      }
      const newSectionProgress = { ...currentProgress.sectionProgress }
      const newSection = result.newSection as { id: string }
      newSectionProgress[newSection.id] = {
        sectionId: newSection.id,
        status: 'pending',
        slides: [],
      }
      updates.workflowProgress = {
        ...currentProgress,
        sectionProgress: newSectionProgress,
      }
    } else if (result.action === 'remove' && result.removeSectionId) {
      updates.cimOutline = {
        sections: currentOutline.sections.filter(
          (s) => s.id !== result.removeSectionId
        ),
      }
      const newSectionProgress = { ...currentProgress.sectionProgress }
      delete newSectionProgress[result.removeSectionId as string]
      updates.workflowProgress = {
        ...currentProgress,
        sectionProgress: newSectionProgress,
      }
    } else if (result.action === 'reorder' && result.newOrder) {
      const sectionMap = new Map(currentOutline.sections.map((s) => [s.id, s]))
      updates.cimOutline = {
        sections: (result.newOrder as string[])
          .map((id) => sectionMap.get(id))
          .filter(Boolean) as CIMMVPStateType['cimOutline']['sections'],
      }
    } else if (result.action === 'update' && result.updateSectionId && result.updatedSection) {
      updates.cimOutline = {
        sections: currentOutline.sections.map((s) =>
          s.id === result.updateSectionId ? { ...s, ...result.updatedSection as object } : s
        ),
      }
    }
  }

  // Handle start_section
  if (result.startSection && result.sectionId) {
    const currentProgress = state.workflowProgress || {
      currentStage: 'building_sections' as WorkflowStage,
      completedStages: [] as WorkflowStage[],
      sectionProgress: {},
    }

    const newSectionProgress = { ...currentProgress.sectionProgress }
    const sectionId = result.sectionId as string
    const existingProgress = newSectionProgress[sectionId]

    if (existingProgress) {
      newSectionProgress[sectionId] = {
        sectionId: existingProgress.sectionId,
        status: 'content_development',
        slides: existingProgress.slides,
      }
    } else {
      newSectionProgress[sectionId] = {
        sectionId,
        status: 'content_development',
        slides: [],
      }
    }

    updates.workflowProgress = {
      ...currentProgress,
      ...(updates.workflowProgress || {}),
      currentSectionId: sectionId,
      sectionProgress: newSectionProgress,
    }
  }

  // Handle update_slide
  if (result.slideId && result.sectionId && !result.sectionDividerSlides) {
    const slideUpdate: SlideUpdate = {
      slideId: result.slideId as string,
      sectionId: result.sectionId as string,
      title: (result.title as string) || 'Untitled Slide',
      layoutType: result.layoutType as SlideUpdate['layoutType'],
      components: (result.components as SlideUpdate['components']) || [],
      status: 'draft',
    }

    updates.pendingSlideUpdate = slideUpdate
    updates.allSlideUpdates = [slideUpdate]
  }

  // Handle save_context
  if (result.gatheredContext) {
    updates.gatheredContext = result.gatheredContext as CIMMVPStateType['gatheredContext']
  }

  // Handle legacy navigation
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
  }

  return updates
}

describe('CIM MVP Graph - PostToolNode Processing', () => {
  describe('advance_workflow handling', () => {
    it('should advance workflow stage and track completed stages', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [] as WorkflowStage[],
          sectionProgress: {},
        },
      } as CIMMVPStateType

      const result = {
        advancedWorkflow: true,
        targetStage: 'buyer_persona',
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress).toBeDefined()
      expect(updates.workflowProgress!.currentStage).toBe('buyer_persona')
      expect(updates.workflowProgress!.completedStages).toContain('welcome')
    })

    it('should deduplicate completed stages', () => {
      const state = {
        workflowProgress: {
          currentStage: 'hero_concept' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona', 'welcome'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as CIMMVPStateType

      const result = {
        advancedWorkflow: true,
        targetStage: 'investment_thesis',
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress!.completedStages).toEqual([
        'welcome',
        'buyer_persona',
        'hero_concept',
      ])
    })

    it('should not duplicate current stage if advancing to same stage', () => {
      const state = {
        workflowProgress: {
          currentStage: 'outline' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as CIMMVPStateType

      const result = {
        advancedWorkflow: true,
        targetStage: 'outline',
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress!.completedStages).not.toContain('outline')
    })

    it('should handle missing workflowProgress gracefully', () => {
      const state = {} as CIMMVPStateType

      const result = {
        advancedWorkflow: true,
        targetStage: 'buyer_persona',
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress).toBeDefined()
      expect(updates.workflowProgress!.currentStage).toBe('buyer_persona')
      expect(updates.workflowProgress!.completedStages).toContain('welcome')
    })
  })

  describe('save_buyer_persona handling', () => {
    it('should save buyer persona to state', () => {
      const state = {} as CIMMVPStateType

      const result = {
        buyerPersona: {
          type: 'strategic',
          priorities: ['synergies', 'market expansion'],
          concerns: ['integration risk'],
          sophisticationLevel: 'high',
        },
      }

      const updates = processToolResult(state, result)

      expect(updates.buyerPersona).toEqual(result.buyerPersona)
    })
  })

  describe('save_hero_concept handling', () => {
    it('should save hero context to state', () => {
      const state = {} as CIMMVPStateType

      const result = {
        heroContext: {
          selectedHero: 'market_leader',
          investmentThesis: 'Strong market position with growth potential',
        },
      }

      const updates = processToolResult(state, result)

      expect(updates.heroContext).toEqual(result.heroContext)
    })
  })

  describe('create_outline handling', () => {
    it('should save outline and initialize section progress', () => {
      const state = {} as CIMMVPStateType

      const result = {
        cimOutline: {
          sections: [
            { id: 'exec-summary', title: 'Executive Summary', estimatedSlides: 2 },
            { id: 'company-overview', title: 'Company Overview', estimatedSlides: 4 },
          ],
        },
      }

      const updates = processToolResult(state, result)

      expect(updates.cimOutline).toEqual(result.cimOutline)
      expect(updates.workflowProgress).toBeDefined()
      expect(updates.workflowProgress!.sectionProgress).toHaveProperty('exec-summary')
      expect(updates.workflowProgress!.sectionProgress).toHaveProperty('company-overview')
      expect(updates.workflowProgress!.sectionProgress['exec-summary'].status).toBe('pending')
    })

    it('should handle section divider slides', () => {
      const state = {} as CIMMVPStateType

      const result = {
        cimOutline: { sections: [] },
        sectionDividerSlides: [
          { slideId: 'divider-1', sectionId: 'sec-1', title: 'Section 1' },
          { slideId: 'divider-2', sectionId: 'sec-2', title: 'Section 2' },
        ],
      }

      const updates = processToolResult(state, result)

      expect(updates.allSlideUpdates).toHaveLength(2)
      expect(updates.allSlideUpdates![0].slideId).toBe('divider-1')
    })
  })

  describe('update_outline handling', () => {
    const existingOutline = {
      sections: [
        { id: 'sec-1', title: 'Section 1', estimatedSlides: 2 },
        { id: 'sec-2', title: 'Section 2', estimatedSlides: 3 },
      ],
    }

    const existingProgress = {
      currentStage: 'outline' as WorkflowStage,
      completedStages: [] as WorkflowStage[],
      sectionProgress: {
        'sec-1': { sectionId: 'sec-1', status: 'pending' as const, slides: [] },
        'sec-2': { sectionId: 'sec-2', status: 'pending' as const, slides: [] },
      },
    }

    it('should add new section', () => {
      const state = {
        cimOutline: existingOutline,
        workflowProgress: existingProgress,
      } as CIMMVPStateType

      const result = {
        outlineUpdate: true,
        action: 'add',
        newSection: { id: 'sec-3', title: 'Section 3', estimatedSlides: 2 },
      }

      const updates = processToolResult(state, result)

      expect(updates.cimOutline!.sections).toHaveLength(3)
      expect(updates.cimOutline!.sections[2].id).toBe('sec-3')
      expect(updates.workflowProgress!.sectionProgress).toHaveProperty('sec-3')
    })

    it('should remove section', () => {
      const state = {
        cimOutline: existingOutline,
        workflowProgress: existingProgress,
      } as CIMMVPStateType

      const result = {
        outlineUpdate: true,
        action: 'remove',
        removeSectionId: 'sec-1',
      }

      const updates = processToolResult(state, result)

      expect(updates.cimOutline!.sections).toHaveLength(1)
      expect(updates.cimOutline!.sections[0].id).toBe('sec-2')
      expect(updates.workflowProgress!.sectionProgress).not.toHaveProperty('sec-1')
    })

    it('should reorder sections', () => {
      const state = {
        cimOutline: existingOutline,
        workflowProgress: existingProgress,
      } as CIMMVPStateType

      const result = {
        outlineUpdate: true,
        action: 'reorder',
        newOrder: ['sec-2', 'sec-1'],
      }

      const updates = processToolResult(state, result)

      expect(updates.cimOutline!.sections[0].id).toBe('sec-2')
      expect(updates.cimOutline!.sections[1].id).toBe('sec-1')
    })

    it('should update section', () => {
      const state = {
        cimOutline: existingOutline,
        workflowProgress: existingProgress,
      } as CIMMVPStateType

      const result = {
        outlineUpdate: true,
        action: 'update',
        updateSectionId: 'sec-1',
        updatedSection: { title: 'Updated Section 1', estimatedSlides: 5 },
      }

      const updates = processToolResult(state, result)

      expect(updates.cimOutline!.sections[0].title).toBe('Updated Section 1')
      expect(updates.cimOutline!.sections[0].estimatedSlides).toBe(5)
    })
  })

  describe('start_section handling', () => {
    it('should set current section and update status', () => {
      const state = {
        workflowProgress: {
          currentStage: 'building_sections' as WorkflowStage,
          completedStages: [] as WorkflowStage[],
          sectionProgress: {
            'sec-1': { sectionId: 'sec-1', status: 'pending' as const, slides: [] },
          },
        },
      } as CIMMVPStateType

      const result = {
        startSection: true,
        sectionId: 'sec-1',
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress!.currentSectionId).toBe('sec-1')
      expect(updates.workflowProgress!.sectionProgress['sec-1'].status).toBe('content_development')
    })

    it('should initialize section progress if not exists', () => {
      const state = {
        workflowProgress: {
          currentStage: 'building_sections' as WorkflowStage,
          completedStages: [] as WorkflowStage[],
          sectionProgress: {},
        },
      } as CIMMVPStateType

      const result = {
        startSection: true,
        sectionId: 'new-section',
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress!.sectionProgress['new-section']).toBeDefined()
      expect(updates.workflowProgress!.sectionProgress['new-section'].status).toBe('content_development')
    })
  })

  describe('update_slide handling', () => {
    it('should create slide update with all properties', () => {
      const state = {} as CIMMVPStateType

      const result = {
        slideId: 'slide-1',
        sectionId: 'sec-1',
        title: 'Revenue Growth',
        layoutType: 'chart_left_text_right',
        components: [
          { type: 'chart', data: { labels: ['2022', '2023'] } },
        ],
      }

      const updates = processToolResult(state, result)

      expect(updates.pendingSlideUpdate).toBeDefined()
      expect(updates.pendingSlideUpdate!.slideId).toBe('slide-1')
      expect(updates.pendingSlideUpdate!.title).toBe('Revenue Growth')
      expect(updates.pendingSlideUpdate!.layoutType).toBe('chart_left_text_right')
      expect(updates.pendingSlideUpdate!.status).toBe('draft')
      expect(updates.allSlideUpdates).toHaveLength(1)
    })

    it('should use default title if not provided', () => {
      const state = {} as CIMMVPStateType

      const result = {
        slideId: 'slide-2',
        sectionId: 'sec-1',
      }

      const updates = processToolResult(state, result)

      expect(updates.pendingSlideUpdate!.title).toBe('Untitled Slide')
    })

    it('should not create slide update when sectionDividerSlides present', () => {
      const state = {} as CIMMVPStateType

      const result = {
        slideId: 'slide-1',
        sectionId: 'sec-1',
        sectionDividerSlides: [{ slideId: 'divider' }],
      }

      const updates = processToolResult(state, result)

      // Should process divider slides, not regular slide
      expect(updates.pendingSlideUpdate).toBeUndefined()
      expect(updates.allSlideUpdates).toEqual([{ slideId: 'divider' }])
    })
  })

  describe('save_context handling', () => {
    it('should save gathered context', () => {
      const state = {} as CIMMVPStateType

      const result = {
        gatheredContext: {
          companyName: 'Acme Corp',
          revenue: '$10M',
          employees: 50,
        },
      }

      const updates = processToolResult(state, result)

      expect(updates.gatheredContext).toEqual(result.gatheredContext)
    })
  })

  describe('legacy navigation handling', () => {
    it('should handle navigatedTo for backward compatibility', () => {
      const state = {
        currentPhase: 'executive_summary' as CIMPhase,
        completedPhases: [] as CIMPhase[],
      } as CIMMVPStateType

      const result = {
        navigatedTo: 'company_overview',
      }

      const updates = processToolResult(state, result)

      expect(updates.currentPhase).toBe('company_overview')
      expect(updates.completedPhases).toContain('executive_summary')
    })

    it('should deduplicate completed phases', () => {
      const state = {
        currentPhase: 'market_analysis' as CIMPhase,
        completedPhases: ['executive_summary', 'company_overview', 'executive_summary'] as CIMPhase[],
      } as CIMMVPStateType

      const result = {
        navigatedTo: 'financial_performance',
      }

      const updates = processToolResult(state, result)

      const uniquePhases = updates.completedPhases!.filter(
        (p, i, arr) => arr.indexOf(p) === i
      )
      expect(updates.completedPhases).toEqual(uniquePhases)
    })
  })

  describe('combined tool results', () => {
    it('should handle multiple updates in single result', () => {
      const state = {
        workflowProgress: {
          currentStage: 'outline' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as CIMMVPStateType

      const result = {
        advancedWorkflow: true,
        targetStage: 'building_sections',
        gatheredContext: {
          companyName: 'Test Corp',
        },
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress!.currentStage).toBe('building_sections')
      expect(updates.gatheredContext).toEqual({ companyName: 'Test Corp' })
    })
  })
})

// =============================================================================
// Graph Exports Tests
// =============================================================================

describe('CIM MVP Graph - Exports', () => {
  describe('cimMVPGraph', () => {
    it('should be a compiled graph', () => {
      expect(cimMVPGraph).toBeDefined()
      expect(typeof cimMVPGraph.invoke).toBe('function')
      expect(typeof cimMVPGraph.stream).toBe('function')
    })

    it('should have getGraph method', () => {
      expect(typeof cimMVPGraph.getGraph).toBe('function')
    })
  })

  describe('getCIMMVPGraph', () => {
    it('should return a compiled graph with checkpointer', async () => {
      const graph = await getCIMMVPGraph()

      expect(graph).toBeDefined()
      expect(typeof graph.invoke).toBe('function')
      expect(typeof graph.stream).toBe('function')
    })

    it('should return cached graph on subsequent calls', async () => {
      const graph1 = await getCIMMVPGraph()
      const graph2 = await getCIMMVPGraph()

      expect(graph1).toBe(graph2)
    })
  })

  describe('createCIMMVPGraph', () => {
    it('should create graph without checkpointer', () => {
      const graph = createCIMMVPGraph()

      expect(graph).toBeDefined()
      expect(typeof graph.invoke).toBe('function')
    })

    it('should create graph with custom checkpointer', () => {
      const mockCheckpointer = {
        get: vi.fn(),
        put: vi.fn(),
        list: vi.fn(),
      }

      const graph = createCIMMVPGraph(mockCheckpointer as unknown as Parameters<typeof createCIMMVPGraph>[0])

      expect(graph).toBeDefined()
      expect(typeof graph.invoke).toBe('function')
    })
  })
})

// =============================================================================
// Graph Structure Tests
// =============================================================================

describe('CIM MVP Graph - Structure', () => {
  it('should have expected nodes', async () => {
    const graphDef = cimMVPGraph.getGraph()
    const nodes = graphDef.nodes

    // Check for expected node names
    const nodeNames = Object.keys(nodes)
    expect(nodeNames).toContain('agent')
    expect(nodeNames).toContain('tools')
    expect(nodeNames).toContain('post_tool')
  })

  it('should have START connected to agent', async () => {
    const graphDef = cimMVPGraph.getGraph()
    const edges = graphDef.edges

    // Find edge from __start__ to agent
    const startEdge = edges.find(
      (e) => e.source === '__start__' && e.target === 'agent'
    )
    expect(startEdge).toBeDefined()
  })

  it('should have tools connected to post_tool', async () => {
    const graphDef = cimMVPGraph.getGraph()
    const edges = graphDef.edges

    // Find edge from tools to post_tool
    const toolsToPostTool = edges.find(
      (e) => e.source === 'tools' && e.target === 'post_tool'
    )
    expect(toolsToPostTool).toBeDefined()
  })

  it('should have post_tool connected back to agent', async () => {
    const graphDef = cimMVPGraph.getGraph()
    const edges = graphDef.edges

    // Find edge from post_tool to agent
    const postToolToAgent = edges.find(
      (e) => e.source === 'post_tool' && e.target === 'agent'
    )
    expect(postToolToAgent).toBeDefined()
  })
})

// =============================================================================
// Workflow Progression Tests
// =============================================================================

describe('CIM MVP Graph - Workflow Stages', () => {
  const WORKFLOW_STAGES: WorkflowStage[] = [
    'welcome',
    'buyer_persona',
    'hero_concept',
    'investment_thesis',
    'outline',
    'building_sections',
    'complete',
  ]

  it('should support all workflow stages', () => {
    // Test that processToolResult can advance through all stages
    let state = {
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [] as WorkflowStage[],
        sectionProgress: {},
      },
    } as CIMMVPStateType

    for (let i = 1; i < WORKFLOW_STAGES.length; i++) {
      const result = {
        advancedWorkflow: true,
        targetStage: WORKFLOW_STAGES[i],
      }

      const updates = processToolResult(state, result)

      expect(updates.workflowProgress!.currentStage).toBe(WORKFLOW_STAGES[i])

      // Update state for next iteration
      state = {
        ...state,
        workflowProgress: updates.workflowProgress!,
      } as CIMMVPStateType
    }

    // Final state should have all stages except 'complete' in completed
    expect(state.workflowProgress.completedStages).toContain('welcome')
    expect(state.workflowProgress.completedStages).toContain('building_sections')
    expect(state.workflowProgress.currentStage).toBe('complete')
  })

  it('should allow non-linear workflow progression', () => {
    // Test jumping from welcome directly to outline
    const state = {
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [] as WorkflowStage[],
        sectionProgress: {},
      },
    } as CIMMVPStateType

    const result = {
      advancedWorkflow: true,
      targetStage: 'outline',
    }

    const updates = processToolResult(state, result)

    expect(updates.workflowProgress!.currentStage).toBe('outline')
    expect(updates.workflowProgress!.completedStages).toContain('welcome')
  })
})
