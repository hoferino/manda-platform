/**
 * Prompt Tests
 *
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 * Story: 2-4 Implement Professional Response Tone (AC: #1, #2, #4, #5)
 *
 * Tests:
 * - System prompt includes Q&A suggestion guidance
 * - Tool usage prompt includes add_qa_item guidance
 * - Prompts require user confirmation
 * - Professional tone section exists with DO/DON'T examples (Story 2.4)
 * - Hedging phrases are banned via DON'T guidance (Story 2.4)
 * - Operation confirmation patterns present (Story 2.4 FR44)
 */

import { describe, it, expect } from 'vitest'
import { AGENT_SYSTEM_PROMPT, TOOL_USAGE_PROMPT, getSystemPrompt } from './prompts'
import { getIRLSystemPrompt } from './v2/middleware/workflow-router'

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

// =============================================================================
// Story 2.4: Professional Response Tone Tests (AC: #1, #2, #4, #5)
// =============================================================================

describe('Professional Communication Style (Story 2.4)', () => {
  describe('Section Presence (AC: #1)', () => {
    it('should include Professional Communication Style section', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('## Professional Communication Style')
    })

    it('should include DO guidance with confident language examples', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('DO use confident, direct language')
      expect(AGENT_SYSTEM_PROMPT).toContain('Based on available data')
    })

    it('should include DON\'T guidance with hedging to avoid', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain("DON'T use hedging or filler phrases")
    })
  })

  describe('Hedging Phrase Bans (AC: #1, #5)', () => {
    // These tests verify the prompt INSTRUCTS to avoid these phrases
    // (the phrases appear in DON'T examples, which is correct)
    it('should ban "I think" hedging phrase via DON\'T guidance', () => {
      const promptLower = AGENT_SYSTEM_PROMPT.toLowerCase()
      // Must contain it in the DON'T section
      expect(promptLower).toContain('"i think..."')
    })

    it('should ban "I believe" hedging phrase via DON\'T guidance', () => {
      const promptLower = AGENT_SYSTEM_PROMPT.toLowerCase()
      expect(promptLower).toContain('"i believe..."')
    })

    it('should ban "Maybe" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Maybe..."')
    })

    it('should ban "Perhaps" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Perhaps..."')
    })

    it('should ban "Probably" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Probably..."')
    })

    it('should ban "Might be" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Might be..."')
    })

    it('should ban "Could be" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Could be..."')
    })

    it('should ban "It seems like" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"It seems like..."')
    })

    it('should ban "I\'m not sure, but" hedging phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain("\"I'm not sure, but...\"")
    })
  })

  describe('Filler Phrase Bans (AC: #1, #5)', () => {
    it('should ban "Let me" filler phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Let me..."')
    })

    it('should ban "Sure, I can" filler phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Sure, I can..."')
    })

    it('should ban "Great question!" filler phrase via DON\'T guidance', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('"Great question!"')
    })
  })

  describe('Operation Confirmation Patterns (AC: #2, FR44)', () => {
    it('should include Operation Confirmation Patterns table', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('Operation Confirmation Patterns (FR44)')
    })

    it('should include good confirmation pattern for Q&A item', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('Added: [summary]. Total: N items.')
    })

    it('should include good confirmation pattern for search', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('Found X results across Y documents.')
    })

    it('should show contrast with bad confirmation patterns', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain("I've successfully added")
      expect(AGENT_SYSTEM_PROMPT).toContain('I was able to find')
    })
  })

  describe('Uncertainty Expression (AC: #4)', () => {
    it('should reference Handling Uncertainty section', () => {
      expect(AGENT_SYSTEM_PROMPT).toContain('Reference the "Handling Uncertainty" section')
    })

    it('should provide replacement patterns for hedging', () => {
      // Check for the pattern guidance
      expect(AGENT_SYSTEM_PROMPT).toContain('Use "Based on available data, ..." NOT "I think..."')
      expect(AGENT_SYSTEM_PROMPT).toContain('Use "The documents show..." NOT "It looks like maybe..."')
    })
  })
})

// =============================================================================
// Story 2.4: IRL Prompt Professional Tone Tests (AC: #1, #3)
// =============================================================================

describe('getIRLSystemPrompt Professional Tone (Story 2.4)', () => {
  it('should include Response Style section', () => {
    const prompt = getIRLSystemPrompt()
    expect(prompt).toContain('## Response Style')
  })

  it('should include professional language guidance', () => {
    const prompt = getIRLSystemPrompt()
    expect(prompt).toContain("DON'T use hedging or filler phrases")
  })

  it('should specify hedging phrases to avoid', () => {
    const prompt = getIRLSystemPrompt()
    expect(prompt).toContain('"I think"')
  })

  it('should include IRL-specific confirmation example', () => {
    const prompt = getIRLSystemPrompt()
    expect(prompt).toContain('Added to IRL: [item]. Outstanding items: N.')
  })
})
