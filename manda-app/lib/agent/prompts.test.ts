/**
 * Prompt Tests
 *
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 *
 * Tests:
 * - System prompt includes Q&A suggestion guidance
 * - Tool usage prompt includes add_qa_item guidance
 * - Prompts require user confirmation
 */

import { describe, it, expect } from 'vitest'
import { AGENT_SYSTEM_PROMPT, TOOL_USAGE_PROMPT, getSystemPrompt } from './prompts'

describe('AGENT_SYSTEM_PROMPT', () => {
  describe('Q&A Suggestion Flow Section (AC #1, #2, #3, #4)', () => {
    it('should include Q&A Suggestion Flow section', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('## Q&A Suggestion Flow')
    })

    it('should define when to suggest Q&A items (AC #1)', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### When to Suggest Q&A Items')
      expect(AGENT_SYSTEM_PROMPT).toContain('Knowledge Base Miss')
      expect(AGENT_SYSTEM_PROMPT).toContain('Unresolvable Contradictions')
      expect(AGENT_SYSTEM_PROMPT).toContain('Incomplete Information')
    })

    it('should include suggestion flow steps', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### The Suggestion Flow')
      expect(AGENT_SYSTEM_PROMPT).toContain('Detect the gap')
      expect(AGENT_SYSTEM_PROMPT).toContain('Explain clearly')
      expect(AGENT_SYSTEM_PROMPT).toContain('Draft a good question')
      expect(AGENT_SYSTEM_PROMPT).toContain('Ask for confirmation')
    })

    it('should include question drafting guidance (AC #2)', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### Drafting Good Questions')
      expect(AGENT_SYSTEM_PROMPT).toContain('Be Specific')
      expect(AGENT_SYSTEM_PROMPT).toContain('Be Professional')
      expect(AGENT_SYSTEM_PROMPT).toContain('Be Actionable')
    })

    it('should include time period guidance (AC #2)', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('time period')
      expect(AGENT_SYSTEM_PROMPT).toContain('past 3 years')
    })

    it('should include good question examples (AC #2)', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('Examples of Good Questions')
      expect(AGENT_SYSTEM_PROMPT).toContain('historical customer churn rate')
      expect(AGENT_SYSTEM_PROMPT).toContain('litigation matters')
    })

    it('should include bad question examples (AC #2)', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('Examples of Bad Questions')
      expect(AGENT_SYSTEM_PROMPT).toContain('Too vague')
      expect(AGENT_SYSTEM_PROMPT).toContain('Not a question')
    })

    it('should include category selection guidance (AC #2)', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### Category Selection')
      expect(AGENT_SYSTEM_PROMPT).toContain('Financials')
      expect(AGENT_SYSTEM_PROMPT).toContain('Legal')
      expect(AGENT_SYSTEM_PROMPT).toContain('Operations')
      expect(AGENT_SYSTEM_PROMPT).toContain('Market')
      expect(AGENT_SYSTEM_PROMPT).toContain('Technology')
      expect(AGENT_SYSTEM_PROMPT).toContain('HR')
    })

    it('should include category keyword mappings', () => {
      // Financial keywords
      expect(AGENT_SYSTEM_PROMPT).toContain('Revenue')
      expect(AGENT_SYSTEM_PROMPT).toContain('EBITDA')
      // Legal keywords
      expect(AGENT_SYSTEM_PROMPT).toContain('Contracts')
      expect(AGENT_SYSTEM_PROMPT).toContain('litigation')
      // Operations keywords
      expect(AGENT_SYSTEM_PROMPT).toContain('churn')
      expect(AGENT_SYSTEM_PROMPT).toContain('Customers')
    })
  })

  describe('User Confirmation Requirement (AC #3)', () => {
    it('should require user confirmation before add_qa_item', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('confirmation')
      expect(AGENT_SYSTEM_PROMPT).toContain('CRITICAL: Never call add_qa_item without explicit user confirmation')
    })

    it('should include confirmation phrase examples', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### Confirmation Phrases')
      expect(AGENT_SYSTEM_PROMPT).toContain('"Yes"')
      expect(AGENT_SYSTEM_PROMPT).toContain('"Sure"')
      expect(AGENT_SYSTEM_PROMPT).toContain('"Go ahead"')
    })
  })

  describe('Decline Handling (AC #4)', () => {
    it('should describe how to handle user decline', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('user declines')
      expect(AGENT_SYSTEM_PROMPT).toContain('"No"')
      expect(AGENT_SYSTEM_PROMPT).toContain('Continue the conversation without adding to Q&A')
    })

    it('should include decline example flow', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### Example Flow (User Declines)')
    })
  })

  describe('Example Flows', () => {
    it('should include good example flow', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('### Example Flow (Good)')
      expect(AGENT_SYSTEM_PROMPT).toContain("User: \"What's the customer churn rate?\"")
      expect(AGENT_SYSTEM_PROMPT).toContain('User: "Yes, add it"')
      expect(AGENT_SYSTEM_PROMPT).toContain('add_qa_item')
    })

    it('should show the complete flow: detect → explain → suggest → confirm → add', () => {
      const goodFlowSection = AGENT_SYSTEM_PROMPT.substring(
        AGENT_SYSTEM_PROMPT.indexOf('### Example Flow (Good)'),
        AGENT_SYSTEM_PROMPT.indexOf('### Example Flow (User Declines)')
      )
      expect(goodFlowSection).toContain('searches knowledge base')
      expect(goodFlowSection).toContain("couldn't find")
      expect(goodFlowSection).toContain('Would you like')
      expect(goodFlowSection).toContain('add_qa_item')
    })
  })
})

describe('TOOL_USAGE_PROMPT', () => {
  describe('add_qa_item Tool Guidance (AC #1, #2)', () => {
    it('should include add_qa_item in tool list', () => {
      expect(TOOL_USAGE_PROMPT).toContain('**add_qa_item**')
    })

    it('should distinguish suggest_questions from add_qa_item', () => {
      expect(TOOL_USAGE_PROMPT).toContain('### Q&A Tool Usage')
      expect(TOOL_USAGE_PROMPT).toContain('suggest_questions vs add_qa_item')
    })

    it('should explain when to use suggest_questions', () => {
      expect(TOOL_USAGE_PROMPT).toContain('Use **suggest_questions** for exploratory Q&A generation')
    })

    it('should explain when to use add_qa_item', () => {
      expect(TOOL_USAGE_PROMPT).toContain('Use **add_qa_item** for adding a specific question')
      expect(TOOL_USAGE_PROMPT).toContain('ONLY after user explicitly confirms')
    })

    it('should include category mapping guidance (AC #2)', () => {
      expect(TOOL_USAGE_PROMPT).toContain('Category mapping for add_qa_item')
      expect(TOOL_USAGE_PROMPT).toContain('| Query Topic | Category |')
    })

    it('should include priority selection guidance', () => {
      expect(TOOL_USAGE_PROMPT).toContain('**Priority selection:**')
      expect(TOOL_USAGE_PROMPT).toContain('**high**')
      expect(TOOL_USAGE_PROMPT).toContain('**medium**')
      expect(TOOL_USAGE_PROMPT).toContain('**low**')
    })

    it('should emphasize confirmation requirement (AC #3)', () => {
      expect(TOOL_USAGE_PROMPT).toContain('IMPORTANT:')
      expect(TOOL_USAGE_PROMPT).toContain('Never call add_qa_item without explicit user confirmation')
    })
  })
})

describe('getSystemPrompt', () => {
  it('should combine AGENT_SYSTEM_PROMPT and TOOL_USAGE_PROMPT', () => {
    const fullPrompt = getSystemPrompt()
    expect(fullPrompt).toContain(AGENT_SYSTEM_PROMPT)
    expect(fullPrompt).toContain(TOOL_USAGE_PROMPT)
  })

  it('should include Q&A suggestion flow from AGENT_SYSTEM_PROMPT', () => {
    const fullPrompt = getSystemPrompt()
    expect(fullPrompt).toContain('## Q&A Suggestion Flow')
  })

  it('should include Q&A tool usage from TOOL_USAGE_PROMPT', () => {
    const fullPrompt = getSystemPrompt()
    expect(fullPrompt).toContain('### Q&A Tool Usage')
  })
})

describe('Prompt Content Quality', () => {
  it('should not expose internal tool names to users in example responses', () => {
    // The examples should show [Uses query_knowledge_base...] but
    // actual agent output should not mention tool names
    expect(AGENT_SYSTEM_PROMPT).toContain('Never expose internal workings')
  })

  it('should maintain P2 compliance (no confidence scores)', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('Never show confidence scores')
    expect(AGENT_SYSTEM_PROMPT).toContain('CRITICAL: NEVER show confidence scores as numbers')
  })

  it('should follow existing prompt structure conventions', () => {
    // Headers use ##
    expect(AGENT_SYSTEM_PROMPT).toContain('## Q&A Suggestion Flow')
    expect(AGENT_SYSTEM_PROMPT).toContain('### When to Suggest Q&A Items')

    // Uses markdown formatting
    expect(AGENT_SYSTEM_PROMPT).toContain('**')
    expect(AGENT_SYSTEM_PROMPT).toContain('|')
  })
})
