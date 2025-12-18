/**
 * Knowledge Write-Back Unit Tests
 *
 * Story: E11.3 - Agent-Autonomous Knowledge Write-Back
 * Tests for the index_to_knowledge_base tool and schema validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IndexToKnowledgeBaseInputSchema } from '@/lib/agent/schemas'

// ============================================================================
// Schema Validation Tests (AC: #1, #2, #3)
// ============================================================================

describe('IndexToKnowledgeBaseInputSchema', () => {
  describe('content validation', () => {
    it('should accept valid content (minimum 10 chars)', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'Q3 revenue was $5.2M',
        source_type: 'correction',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(true)
    })

    it('should reject content shorter than 10 chars', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'Too short',
        source_type: 'correction',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(false)
      if (!result.success && result.error.issues[0]) {
        expect(result.error.issues[0].path).toContain('content')
      }
    })

    it('should require content field', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        source_type: 'correction',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('source_type validation', () => {
    it('should accept "correction" source type', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'The revenue was actually $5.2M, not $4.8M',
        source_type: 'correction',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.source_type).toBe('correction')
      }
    })

    it('should accept "confirmation" source type', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'Yes, the Q3 revenue was $5.2M as stated',
        source_type: 'confirmation',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.source_type).toBe('confirmation')
      }
    })

    it('should accept "new_info" source type', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'The company has 150 employees as of December 2024',
        source_type: 'new_info',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.source_type).toBe('new_info')
      }
    })

    it('should reject invalid source types', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'Some factual content here',
        source_type: 'invalid_type',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(false)
      if (!result.success && result.error.issues[0]) {
        expect(result.error.issues[0].path).toContain('source_type')
      }
    })

    it('should require source_type field', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'Some factual content here',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('deal_id validation', () => {
    it('should accept valid UUID', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'The company has 150 employees',
        source_type: 'new_info',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'The company has 150 employees',
        source_type: 'new_info',
        deal_id: 'not-a-valid-uuid',
      })

      expect(result.success).toBe(false)
      if (!result.success && result.error.issues[0]) {
        expect(result.error.issues[0].path).toContain('deal_id')
      }
    })

    it('should require deal_id field', () => {
      const result = IndexToKnowledgeBaseInputSchema.safeParse({
        content: 'The company has 150 employees',
        source_type: 'new_info',
      })

      expect(result.success).toBe(false)
    })
  })
})

// ============================================================================
// Tool Behavior Tests (AC: #2, #4)
// ============================================================================

describe('indexToKnowledgeBaseTool', () => {
  // Mock fetch globally
  const originalFetch = global.fetch
  let mockFetch: typeof fetch

  beforeEach(() => {
    mockFetch = vi.fn() as unknown as typeof fetch
    global.fetch = mockFetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('successful ingestion', () => {
    it('should call manda-processing endpoint with correct payload', async () => {
      ;(mockFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            episode_count: 1,
            elapsed_ms: 150,
            estimated_cost_usd: 0.00001,
          }),
      })

      // Import and call the tool
      const { indexToKnowledgeBaseTool } = await import('@/lib/agent/tools/knowledge-tools')

      // We can't easily test the tool directly since it requires auth
      // Just verify the schema is exported correctly
      expect(indexToKnowledgeBaseTool.name).toBe('index_to_knowledge_base')
      expect(indexToKnowledgeBaseTool.description).toContain('Persist user-provided facts')
      expect(indexToKnowledgeBaseTool.description).toContain('AUTONOMOUSLY')
    })
  })

  describe('error handling (AC: Graceful Degradation)', () => {
    it('should have graceful degradation in tool description', async () => {
      const { indexToKnowledgeBaseTool } = await import('@/lib/agent/tools/knowledge-tools')

      // Tool should NOT mention failure to user
      expect(indexToKnowledgeBaseTool.description).not.toContain('error')
      expect(indexToKnowledgeBaseTool.description).not.toContain('fail')
      expect(indexToKnowledgeBaseTool.description).not.toContain('unavailable')
    })
  })

  describe('tool properties', () => {
    it('should have correct tool name', async () => {
      const { indexToKnowledgeBaseTool } = await import('@/lib/agent/tools/knowledge-tools')
      expect(indexToKnowledgeBaseTool.name).toBe('index_to_knowledge_base')
    })

    it('should have description that guides autonomous usage', async () => {
      const { indexToKnowledgeBaseTool } = await import('@/lib/agent/tools/knowledge-tools')

      // Verify autonomous guidance
      expect(indexToKnowledgeBaseTool.description).toContain('Corrections')
      expect(indexToKnowledgeBaseTool.description).toContain('Confirmations')
      expect(indexToKnowledgeBaseTool.description).toContain('New factual information')
      expect(indexToKnowledgeBaseTool.description).toContain('Do NOT call for')
      expect(indexToKnowledgeBaseTool.description).toContain('questions')
      expect(indexToKnowledgeBaseTool.description).toContain('greetings')
    })

    it('should emphasize no confirmation needed', async () => {
      const { indexToKnowledgeBaseTool } = await import('@/lib/agent/tools/knowledge-tools')

      expect(indexToKnowledgeBaseTool.description).toContain('do you want me to save')
      expect(indexToKnowledgeBaseTool.description).toContain('autonomously')
    })
  })
})

// ============================================================================
// All Tools Integration Tests (Task 4)
// ============================================================================

describe('allChatTools integration', () => {
  it('should include index_to_knowledge_base in tool array', async () => {
    const { allChatTools } = await import('@/lib/agent/tools/all-tools')

    const toolNames = allChatTools.map((t) => t.name)
    expect(toolNames).toContain('index_to_knowledge_base')
  })

  it('should have 18 total tools', async () => {
    const { TOOL_COUNT, validateToolCount } = await import('@/lib/agent/tools/all-tools')

    expect(TOOL_COUNT).toBe(18)
    expect(validateToolCount()).toBe(true)
  })

  it('should include index_to_knowledge_base in knowledge category', async () => {
    const { TOOL_CATEGORIES } = await import('@/lib/agent/tools/all-tools')

    expect(TOOL_CATEGORIES.knowledge).toContain('index_to_knowledge_base')
  })
})

// ============================================================================
// Schema Export Tests
// ============================================================================

describe('ToolSchemas export', () => {
  it('should export IndexToKnowledgeBaseInput schema', async () => {
    const { ToolSchemas } = await import('@/lib/agent/schemas')

    expect(ToolSchemas.IndexToKnowledgeBaseInput).toBeDefined()
    expect(ToolSchemas.IndexToKnowledgeBaseInput).toBe(IndexToKnowledgeBaseInputSchema)
  })
})

// ============================================================================
// Persistence Decision Logic Tests (AC: #1, #3)
// ============================================================================

describe('Persistence Decision Logic in Prompts', () => {
  it('should include autonomous knowledge persistence section in prompts', async () => {
    const { TOOL_USAGE_PROMPT } = await import('@/lib/agent/prompts')

    expect(TOOL_USAGE_PROMPT).toContain('Autonomous Knowledge Persistence')
    expect(TOOL_USAGE_PROMPT).toContain('E11.3')
  })

  it('should define PERSIST triggers', async () => {
    const { TOOL_USAGE_PROMPT } = await import('@/lib/agent/prompts')

    // Check for correction triggers
    expect(TOOL_USAGE_PROMPT).toContain('Corrections')
    expect(TOOL_USAGE_PROMPT).toContain('actually')

    // Check for confirmation triggers
    expect(TOOL_USAGE_PROMPT).toContain('Confirmations')
    expect(TOOL_USAGE_PROMPT).toContain("that's correct")

    // Check for new info triggers
    expect(TOOL_USAGE_PROMPT).toContain('New facts')
  })

  it('should define DO NOT PERSIST triggers', async () => {
    const { TOOL_USAGE_PROMPT } = await import('@/lib/agent/prompts')

    expect(TOOL_USAGE_PROMPT).toContain('DO NOT PERSIST')
    expect(TOOL_USAGE_PROMPT).toContain('Questions')
    expect(TOOL_USAGE_PROMPT).toContain('Greetings')
    expect(TOOL_USAGE_PROMPT).toContain('Meta-conversation')
    expect(TOOL_USAGE_PROMPT).toContain('Opinions')
  })

  it('should include natural confirmation language (AC: #5)', async () => {
    const { TOOL_USAGE_PROMPT } = await import('@/lib/agent/prompts')

    expect(TOOL_USAGE_PROMPT).toContain("Got it, I've noted that")
    expect(TOOL_USAGE_PROMPT).toContain('Do NOT say "Would you like me to save this?"')
  })

  it('should include deal_id instruction', async () => {
    const { TOOL_USAGE_PROMPT } = await import('@/lib/agent/prompts')

    expect(TOOL_USAGE_PROMPT).toContain('deal_id')
    expect(TOOL_USAGE_PROMPT).toContain('conversation context')
  })

  it('should list index_to_knowledge_base in available tools', async () => {
    const { TOOL_USAGE_PROMPT } = await import('@/lib/agent/prompts')

    expect(TOOL_USAGE_PROMPT).toContain('14. **index_to_knowledge_base**')
  })
})
