/**
 * Tool Loader Tests
 *
 * Story: E13.2 - Tier-Based Tool Loading (AC: #6)
 *
 * Tests:
 * - getToolsForComplexity returns correct tools per tier
 * - getToolsForIntent handles EnhancedIntentResult
 * - Backward compatibility with undefined complexity
 * - Escalation logic (getNextTier, canEscalate, isToolNotFoundError)
 * - handleToolEscalation returns correct results
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TOOL_TIERS,
  getToolsForComplexity,
  getToolsForIntent,
  getToolCountForComplexity,
  getNextTier,
  canEscalate,
  isToolNotFoundError,
  handleToolEscalation,
  logToolTierSelection,
} from '@/lib/agent/tools/tool-loader'
import { allChatTools, TOOL_COUNT } from '@/lib/agent/tools/all-tools'
import type { EnhancedIntentResult } from '@/lib/agent/intent'

describe('tool-loader', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('TOOL_TIERS constant', () => {
    it('should define simple tier with no tools', () => {
      expect(TOOL_TIERS.simple).toEqual([])
    })

    it('should define medium tier with 5 specific tools', () => {
      const mediumTools = TOOL_TIERS.medium as string[]
      expect(mediumTools).toHaveLength(5)
      expect(mediumTools).toContain('query_knowledge_base')
      expect(mediumTools).toContain('get_document_info')
      expect(mediumTools).toContain('get_finding_source')
      expect(mediumTools).toContain('validate_finding')
      expect(mediumTools).toContain('add_qa_item')
    })

    it('should define complex tier as "all"', () => {
      expect(TOOL_TIERS.complex).toBe('all')
    })
  })

  describe('getToolsForComplexity', () => {
    it('should return empty array for simple complexity', () => {
      const tools = getToolsForComplexity('simple')
      expect(tools).toHaveLength(0)
      expect(tools).toEqual([])
    })

    it('should return 5 specific tools for medium complexity', () => {
      const tools = getToolsForComplexity('medium')
      expect(tools).toHaveLength(5)

      const names = tools.map((t) => t.name)
      expect(names).toContain('query_knowledge_base')
      expect(names).toContain('get_document_info')
      expect(names).toContain('get_finding_source')
      expect(names).toContain('validate_finding')
      expect(names).toContain('add_qa_item')
    })

    it('should return all 18 tools for complex complexity', () => {
      const tools = getToolsForComplexity('complex')
      expect(tools).toHaveLength(18)
      expect(tools).toHaveLength(TOOL_COUNT)
      expect(tools).toEqual(allChatTools)
    })

    it('should return StructuredToolInterface instances', () => {
      const mediumTools = getToolsForComplexity('medium')
      for (const tool of mediumTools) {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(typeof tool.name).toBe('string')
      }
    })

    it('should log tool selection for debugging', () => {
      getToolsForComplexity('medium')
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ToolLoader] Complexity: medium')
      )
    })
  })

  describe('getToolsForIntent', () => {
    it('should return tools based on intent complexity', () => {
      const intent: EnhancedIntentResult = {
        intent: 'factual',
        confidence: 0.9,
        method: 'semantic',
        complexity: 'medium',
        complexityConfidence: 0.85,
      }

      const tools = getToolsForIntent(intent)
      expect(tools).toHaveLength(5)
    })

    it('should default to all tools when complexity is undefined (backward compatibility)', () => {
      const legacyIntent: EnhancedIntentResult = {
        intent: 'factual',
        confidence: 0.9,
        method: 'semantic',
        // No complexity field - backward compatibility
      }

      const tools = getToolsForIntent(legacyIntent)
      expect(tools).toHaveLength(18)
      expect(tools).toEqual(allChatTools)
    })

    it('should return empty array for simple intent', () => {
      const intent: EnhancedIntentResult = {
        intent: 'greeting',
        confidence: 0.95,
        method: 'regex',
        complexity: 'simple',
        complexityConfidence: 0.9,
      }

      const tools = getToolsForIntent(intent)
      expect(tools).toHaveLength(0)
    })

    it('should return all tools for complex intent', () => {
      const intent: EnhancedIntentResult = {
        intent: 'task',
        confidence: 0.8,
        method: 'semantic',
        complexity: 'complex',
        complexityConfidence: 0.9,
      }

      const tools = getToolsForIntent(intent)
      expect(tools).toHaveLength(18)
    })

    it('should log intent classification details', () => {
      const intent: EnhancedIntentResult = {
        intent: 'factual',
        confidence: 0.9,
        method: 'semantic',
        complexity: 'medium',
        complexityConfidence: 0.85,
      }

      getToolsForIntent(intent)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ToolLoader] Intent: factual')
      )
    })
  })

  describe('getToolCountForComplexity', () => {
    it('should return 0 for simple complexity', () => {
      expect(getToolCountForComplexity('simple')).toBe(0)
    })

    it('should return 5 for medium complexity', () => {
      expect(getToolCountForComplexity('medium')).toBe(5)
    })

    it('should return 18 for complex complexity', () => {
      expect(getToolCountForComplexity('complex')).toBe(18)
      expect(getToolCountForComplexity('complex')).toBe(TOOL_COUNT)
    })
  })

  describe('tier escalation', () => {
    describe('getNextTier', () => {
      it('should escalate simple to medium', () => {
        expect(getNextTier('simple')).toBe('medium')
      })

      it('should escalate medium to complex', () => {
        expect(getNextTier('medium')).toBe('complex')
      })

      it('should keep complex as complex (no further escalation)', () => {
        expect(getNextTier('complex')).toBe('complex')
      })
    })

    describe('canEscalate', () => {
      it('should return true for simple tier', () => {
        expect(canEscalate('simple')).toBe(true)
      })

      it('should return true for medium tier', () => {
        expect(canEscalate('medium')).toBe(true)
      })

      it('should return false for complex tier', () => {
        expect(canEscalate('complex')).toBe(false)
      })
    })

    describe('isToolNotFoundError', () => {
      it('should return true for "tool not found" error', () => {
        const error = new Error('Tool "detect_contradictions" not found')
        expect(isToolNotFoundError(error)).toBe(true)
      })

      it('should return true for "is not a valid tool" error', () => {
        const error = new Error('detect_contradictions is not a valid tool')
        expect(isToolNotFoundError(error)).toBe(true)
      })

      it('should return true for "unknown tool" error', () => {
        const error = new Error('Unknown tool: detect_contradictions')
        expect(isToolNotFoundError(error)).toBe(true)
      })

      it('should return true for "no tool named" error', () => {
        const error = new Error('No tool named "detect_contradictions" found')
        expect(isToolNotFoundError(error)).toBe(true)
      })

      it('should return false for non-Error objects', () => {
        expect(isToolNotFoundError('string error')).toBe(false)
        expect(isToolNotFoundError(null)).toBe(false)
        expect(isToolNotFoundError(undefined)).toBe(false)
        expect(isToolNotFoundError({ message: 'object' })).toBe(false)
      })

      it('should return false for unrelated errors', () => {
        const error = new Error('Network timeout')
        expect(isToolNotFoundError(error)).toBe(false)
      })

      it('should be case-insensitive', () => {
        const error = new Error('TOOL NOT FOUND: detect_contradictions')
        expect(isToolNotFoundError(error)).toBe(true)
      })
    })

    describe('handleToolEscalation', () => {
      it('should escalate from simple to medium on tool not found', () => {
        const error = new Error('Tool "detect_contradictions" not found')
        const result = handleToolEscalation(error, 'simple')

        expect(result.shouldEscalate).toBe(true)
        expect(result.nextTier).toBe('medium')
        expect(result.reason).toContain('simple')
        expect(result.reason).toContain('medium')
      })

      it('should escalate from medium to complex on tool not found', () => {
        const error = new Error('Tool "detect_contradictions" not found')
        const result = handleToolEscalation(error, 'medium')

        expect(result.shouldEscalate).toBe(true)
        expect(result.nextTier).toBe('complex')
        expect(result.reason).toContain('medium')
        expect(result.reason).toContain('complex')
      })

      it('should not escalate when already at complex tier', () => {
        const error = new Error('Tool "some_tool" not found')
        const result = handleToolEscalation(error, 'complex')

        expect(result.shouldEscalate).toBe(false)
        expect(result.nextTier).toBe('complex')
        expect(result.reason).toContain('maximum tier')
      })

      it('should not escalate for non-tool-not-found errors', () => {
        const error = new Error('Network timeout')
        const result = handleToolEscalation(error, 'simple')

        expect(result.shouldEscalate).toBe(false)
        expect(result.nextTier).toBe('simple')
        expect(result.reason).toContain('not a tool-not-found error')
      })

      it('should log escalation warning', () => {
        const error = new Error('Tool "detect_contradictions" not found')
        handleToolEscalation(error, 'simple')

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[ToolLoader] Escalation triggered')
        )
      })
    })
  })

  describe('logToolTierSelection', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should log metadata when LANGSMITH_TRACING is enabled', () => {
      process.env.LANGSMITH_TRACING = 'true'

      logToolTierSelection('medium', 5, false)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[LangSmith] Tool tier metadata')
      )
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"toolTier":"medium"'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"toolCount":5'))
    })

    it('should log metadata when LANGCHAIN_TRACING_V2 is enabled', () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'

      logToolTierSelection('complex', 18, false)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[LangSmith] Tool tier metadata')
      )
    })

    it('should include escalation info when provided', () => {
      process.env.LANGSMITH_TRACING = 'true'

      logToolTierSelection('medium', 5, true, 'simple')

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"wasEscalated":true'))
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"originalTier":"simple"'))
    })

    it('should not log when tracing is disabled', () => {
      delete process.env.LANGSMITH_TRACING
      delete process.env.LANGCHAIN_TRACING_V2

      logToolTierSelection('medium', 5, false)

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('[LangSmith] Tool tier metadata')
      )
    })
  })

  describe('tool tier consistency', () => {
    it('should have all medium tier tools exist in allChatTools', () => {
      const mediumToolNames = TOOL_TIERS.medium as string[]
      const allToolNames = allChatTools.map((t) => t.name)

      for (const toolName of mediumToolNames) {
        expect(allToolNames).toContain(toolName)
      }
    })

    it('should maintain consistent tool counts across functions', () => {
      // Verify getToolsForComplexity and getToolCountForComplexity match
      expect(getToolsForComplexity('simple').length).toBe(getToolCountForComplexity('simple'))
      expect(getToolsForComplexity('medium').length).toBe(getToolCountForComplexity('medium'))
      expect(getToolsForComplexity('complex').length).toBe(getToolCountForComplexity('complex'))
    })

    it('should verify total tool count is 18', () => {
      expect(TOOL_COUNT).toBe(18)
      expect(allChatTools.length).toBe(18)
      expect(getToolsForComplexity('complex').length).toBe(18)
    })
  })

  describe('tool isolation integration (AC6)', () => {
    it('should apply tool isolation to filtered medium tier tools', async () => {
      // Import tool isolation utilities
      const { isolateAllTools, createToolResultCache, DEFAULT_ISOLATION_CONFIG } = await import('@/lib/agent/tool-isolation')

      // Get filtered tools for medium tier
      const mediumTools = getToolsForComplexity('medium')
      expect(mediumTools).toHaveLength(5)

      // Create cache and apply isolation with default config
      const cache = createToolResultCache()
      const isolatedTools = isolateAllTools(mediumTools, cache, { ...DEFAULT_ISOLATION_CONFIG, verbose: false })

      // Verify isolation was applied - tool count should match
      expect(isolatedTools).toHaveLength(5)

      // Verify tool names are preserved
      const isolatedNames = isolatedTools.map((t) => t.name)
      const originalNames = mediumTools.map((t) => t.name)
      expect(isolatedNames.sort()).toEqual(originalNames.sort())
    })

    it('should apply tool isolation to empty simple tier tools', async () => {
      const { isolateAllTools, createToolResultCache, DEFAULT_ISOLATION_CONFIG } = await import('@/lib/agent/tool-isolation')

      // Get filtered tools for simple tier (empty)
      const simpleTools = getToolsForComplexity('simple')
      expect(simpleTools).toHaveLength(0)

      // Apply isolation to empty array should work without errors
      const cache = createToolResultCache()
      const isolatedTools = isolateAllTools(simpleTools, cache, { ...DEFAULT_ISOLATION_CONFIG, verbose: false })

      expect(isolatedTools).toHaveLength(0)
    })

    it('should apply tool isolation to full complex tier tools', async () => {
      const { isolateAllTools, createToolResultCache, DEFAULT_ISOLATION_CONFIG } = await import('@/lib/agent/tool-isolation')

      // Get all tools for complex tier
      const complexTools = getToolsForComplexity('complex')
      expect(complexTools).toHaveLength(18)

      // Apply isolation
      const cache = createToolResultCache()
      const isolatedTools = isolateAllTools(complexTools, cache, { ...DEFAULT_ISOLATION_CONFIG, verbose: false })

      // All 18 tools should be isolated
      expect(isolatedTools).toHaveLength(18)
    })
  })
})
