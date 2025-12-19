# Agent Behavior & Token Usage Test Plan

**Version:** 1.0
**Author:** TEA (Test Architect)
**Created:** 2025-12-19
**Story Context:** Agent Testing for M&A Due Diligence Assistant

---

## Executive Summary

This test plan addresses two critical concerns:
1. **Agent Behavior Correctness** - Does the agent respond appropriately based on user query intent?
2. **Token Usage Optimization** - Is token consumption within acceptable bounds given LangChain/LangGraph integration?

**Risk Assessment:**
- **Token bloat**: P0 (High financial impact at scale)
- **Incorrect behavior**: P0 (Revenue-critical user experience)
- **Intent misclassification**: P1 (Causes unnecessary retrieval or missed context)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Test Categories](#2-test-categories)
3. [Token Usage Tests](#3-token-usage-tests)
4. [Behavior Tests by Intent](#4-behavior-tests-by-intent)
5. [Multi-Turn Conversation Tests](#5-multi-turn-conversation-tests)
6. [Edge Cases & Stress Tests](#6-edge-cases--stress-tests)
7. [Observability & Metrics](#7-observability--metrics)
8. [Test Fixtures](#8-test-fixtures)

---

## 1. Architecture Overview

### Components Under Test

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent Execution Pipeline                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌───────────────┐    ┌────────────────┐                │
│  │   Intent    │ → │ Summarization │ → │   Retrieval    │                │
│  │Classification│    │  (E11.2)      │    │   (E11.4)      │                │
│  └─────────────┘    └───────────────┘    └────────────────┘                │
│        │                   │                    │                           │
│        ▼                   ▼                    ▼                           │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │                 LangGraph ReactAgent                    │               │
│  │  (createReactAgent with 17 tools)                       │               │
│  └─────────────────────────────────────────────────────────┘               │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │            LLM Client (Claude → Gemini fallback)        │               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Flow Points (Critical for Cost)

| Component | Token Source | Expected Range | Risk |
|-----------|--------------|----------------|------|
| System Prompt | `prompts.ts` | ~3,500 tokens | Fixed overhead |
| Summarization | `summarization.ts` | 400 tokens target | Compression saves tokens |
| Retrieval Context | `retrieval.ts` | ≤2,000 tokens | Token budget enforced |
| Conversation History | `executor.ts` | Last 10 messages (~2,000) | Managed by summarization |
| Tool Results | `tool-isolation.ts` | Summarized, not raw | E11.1 isolation |
| User Input | Variable | ~50-500 tokens | User-controlled |
| Agent Response | Variable | ~100-2,000 tokens | Response length |

**Total Expected Per Request:** 6,000-10,000 tokens (input+output)
**Concern Threshold:** >15,000 tokens/request indicates a problem

---

## 2. Test Categories

### 2.1 Priority Matrix

| Test Category | Priority | Coverage Target | Rationale |
|---------------|----------|-----------------|-----------|
| Token Budget Enforcement | P0 | 100% | Direct cost impact |
| Intent Classification | P0 | 100% | Skip/retrieve decision |
| Summarization Trigger | P0 | 90% | Token compression |
| Retrieval Integration | P1 | 80% | Knowledge injection |
| Multi-Turn Context | P1 | 80% | Conversation continuity |
| Tool Result Isolation | P1 | 80% | Prevents context bloat |
| Fallback Behavior | P2 | 60% | Graceful degradation |

### 2.2 Test Levels

| Level | Scope | Token Tracking | Examples |
|-------|-------|----------------|----------|
| Unit | Single function | Mocked | `classifyIntent()`, `estimateTokens()` |
| Integration | Module interaction | Estimated | Summarization + Retrieval pipeline |
| E2E | Full agent execution | Actual API usage | Complete chat flow |

---

## 3. Token Usage Tests

### 3.1 Token Estimation Accuracy (Unit)

**File:** `manda-app/__tests__/lib/agent/token-estimation.test.ts`

```typescript
describe('Token Estimation', () => {
  describe('estimateTokens', () => {
    it('should estimate ~4 chars per token for English text', () => {
      const text = 'Revenue was $5.2M for Q3 2024'; // 30 chars
      expect(estimateTokens(text)).toBe(8); // ceil(30/4) = 8
    });

    it('should handle multi-byte characters (Japanese)', () => {
      const text = '売上高は520万ドルでした'; // Japanese characters
      expect(estimateTokens(text)).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should handle very long strings', () => {
      const longText = 'a'.repeat(10000);
      expect(estimateTokens(longText)).toBe(2500);
    });
  });

  describe('estimateMessageTokens', () => {
    it('should add 4 token overhead for role prefix', () => {
      const msg = new HumanMessage('Hello'); // 5 chars = 2 tokens + 4 overhead
      expect(estimateMessageTokens(msg)).toBe(6);
    });
  });

  describe('estimateMessagesTokens', () => {
    it('should sum tokens across all messages', () => {
      const messages = [
        new HumanMessage('Hello'), // 6 tokens
        new AIMessage('Hi there'), // 7 tokens
      ];
      expect(estimateMessagesTokens(messages)).toBe(13);
    });
  });
});
```

### 3.2 Token Budget Enforcement (Integration)

**File:** `manda-app/__tests__/lib/agent/token-budget.test.ts`

```typescript
describe('Token Budget Enforcement', () => {
  describe('formatRetrievedContext', () => {
    it('should respect RETRIEVAL_MAX_TOKENS (2000)', () => {
      const results = generateMockResults(20); // Each ~200 tokens
      const { context, tokenCount } = formatRetrievedContext(results);

      expect(tokenCount).toBeLessThanOrEqual(2000);
      expect(context).not.toContain(results[15].content); // Later results truncated
    });

    it('should include citation in token count', () => {
      const results = [{ content: 'X'.repeat(100), citation: { title: 'Long Document Title Here' } }];
      const { tokenCount } = formatRetrievedContext(results);

      // Should include "[Source: Long Document Title Here]" in count
      expect(tokenCount).toBeGreaterThan(Math.ceil(100 / 4));
    });
  });

  describe('summarization token budget', () => {
    it('should target ~400 token summaries', () => {
      const oldMessages = generateMessages(30); // Trigger summarization
      const llm = createMockLLM();

      const result = await summarizeConversationHistory(oldMessages, llm);

      expect(estimateTokens(result.summaryText)).toBeLessThan(600); // Allow some margin
    });
  });
});
```

### 3.3 End-to-End Token Tracking (E2E)

**File:** `manda-app/e2e/token-usage.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Token Usage E2E', () => {
  test('single query should use <15K tokens', async ({ request }) => {
    const response = await request.post('/api/projects/test-deal/chat', {
      data: { message: 'What was the Q3 revenue?' }
    });

    expect(response.ok()).toBeTruthy();

    // Check usage logging in response headers or database
    const usage = await getLatestUsageRecord('test-deal');
    expect(usage.inputTokens + usage.outputTokens).toBeLessThan(15000);
  });

  test('10-turn conversation should show token compression', async ({ page }) => {
    // Conduct 10-turn conversation
    for (let i = 0; i < 10; i++) {
      await sendMessage(page, `Question ${i}: Tell me about revenue trend`);
    }

    // After turn 10, summarization should have kicked in
    const metrics = await getSummarizationMetrics('test-deal');
    expect(metrics.compressionRatio).toBeLessThan(0.5); // 50%+ compression
  });

  test('long conversation should not exceed token budget', async ({ page }) => {
    // Send 30 messages to trigger multiple summarizations
    for (let i = 0; i < 30; i++) {
      await sendMessage(page, `Question ${i}`);
    }

    // Check that per-request tokens remain stable
    const usageRecords = await getUsageRecords('test-deal');
    const avgTokens = usageRecords.reduce((sum, r) => sum + r.inputTokens, 0) / usageRecords.length;

    expect(avgTokens).toBeLessThan(12000); // Should stay stable, not grow linearly
  });
});
```

### 3.4 Token Leak Detection (Regression)

**Purpose:** Detect unexpected token growth from code changes

```typescript
describe('Token Leak Detection', () => {
  const baselineTokens = {
    systemPrompt: 3500,
    singleQueryNoHistory: 8000,
    tenTurnConversation: 10000,
    retrievalWithContext: 10000,
  };

  it('system prompt should not exceed baseline', () => {
    const prompt = getSystemPrompt();
    const tokens = estimateTokens(prompt);

    expect(tokens).toBeLessThan(baselineTokens.systemPrompt * 1.1); // 10% margin
  });

  it('single query should not exceed baseline', async () => {
    const { inputTokens, outputTokens } = await executeAndMeasure({
      message: 'What was Q3 revenue?',
      history: [],
    });

    expect(inputTokens + outputTokens).toBeLessThan(baselineTokens.singleQueryNoHistory * 1.2);
  });
});
```

---

## 4. Behavior Tests by Intent

### 4.1 Intent Classification (Unit)

**File:** `manda-app/__tests__/lib/agent/intent.test.ts`

```typescript
describe('Intent Classification', () => {
  describe('classifyIntent', () => {
    // Greeting intent - should skip retrieval
    test.each([
      ['Hello!', 'greeting'],
      ['Hi there', 'greeting'],
      ['Thanks for your help', 'greeting'],
      ['Good morning', 'greeting'],
      ['Goodbye', 'greeting'],
    ])('"%s" should be classified as %s', (input, expected) => {
      expect(classifyIntent(input)).toBe(expected);
    });

    // Meta intent - should skip retrieval
    test.each([
      ['What can you do?', 'meta'],
      ['Help me understand your capabilities', 'meta'],
      ['Summarize our conversation', 'meta'],
      ['What did we discuss?', 'meta'],
      ['Can you help with analysis?', 'meta'],
    ])('"%s" should be classified as %s', (input, expected) => {
      expect(classifyIntent(input)).toBe(expected);
    });

    // Factual intent - should retrieve
    test.each([
      ['What was the Q3 revenue?', 'factual'],
      ['How many employees does the company have?', 'factual'],
      ['When did they acquire the subsidiary?', 'factual'],
      ['What is the EBITDA margin?', 'factual'],
      ['Tell me about customer concentration', 'factual'],
    ])('"%s" should be classified as %s', (input, expected) => {
      expect(classifyIntent(input)).toBe(expected);
    });

    // Task intent - should retrieve
    test.each([
      ['Analyze the revenue trend', 'task'],
      ['Compare Q3 vs Q4 performance', 'task'],
      ['Summarize the deal structure', 'task'], // Note: "summarize the X" is task
      ['Find any red flags', 'task'],
      ['Calculate the growth rate', 'task'],
    ])('"%s" should be classified as %s', (input, expected) => {
      expect(classifyIntent(input)).toBe(expected);
    });
  });

  describe('shouldRetrieve', () => {
    it('should skip retrieval for greeting', () => {
      expect(shouldRetrieve('greeting')).toBe(false);
    });

    it('should skip retrieval for meta', () => {
      expect(shouldRetrieve('meta')).toBe(false);
    });

    it('should retrieve for factual', () => {
      expect(shouldRetrieve('factual')).toBe(true);
    });

    it('should retrieve for task', () => {
      expect(shouldRetrieve('task')).toBe(true);
    });
  });
});
```

### 4.2 Intent Edge Cases (Unit)

```typescript
describe('Intent Edge Cases', () => {
  // Ambiguous cases that could be misclassified
  test.each([
    // "Summarize the X" where X is deal-related should be TASK (retrieval needed)
    ['Summarize the EBITDA trends', 'task'],
    ['Summarize the deal structure', 'task'],
    ['Summarize the financials', 'task'],

    // "Summarize our/the conversation" should be META (no retrieval)
    ['Summarize our conversation', 'meta'],
    ['Recap what we discussed', 'meta'],

    // Questions that LOOK like meta but need data
    ['Tell me about the company', 'factual'], // Not about the agent
    ['What do we know about revenue?', 'factual'],

    // Follow-up pronouns (should be factual, needs history)
    ['What about Q4?', 'factual'],
    ['And the margins?', 'factual'],

    // Compound queries
    ['Hi, what was the revenue?', 'factual'], // Greeting + factual = factual
  ])('edge case "%s" should be %s', (input, expected) => {
    expect(classifyIntent(input)).toBe(expected);
  });
});
```

### 4.3 Retrieval Behavior (Integration)

**File:** `manda-app/__tests__/lib/agent/retrieval-behavior.test.ts`

```typescript
describe('Retrieval Behavior', () => {
  describe('preModelRetrievalHook', () => {
    const mockDealId = 'test-deal-123';

    it('should skip retrieval for greeting intent', async () => {
      const messages = [new HumanMessage('Hello!')];

      const result = await preModelRetrievalHook(messages, mockDealId);

      expect(result.skipped).toBe(true);
      expect(result.intent).toBe('greeting');
      expect(result.retrievalLatencyMs).toBeLessThan(10); // No API call
    });

    it('should skip retrieval for meta intent', async () => {
      const messages = [new HumanMessage('What can you do?')];

      const result = await preModelRetrievalHook(messages, mockDealId);

      expect(result.skipped).toBe(true);
      expect(result.intent).toBe('meta');
    });

    it('should perform retrieval for factual intent', async () => {
      const messages = [new HumanMessage('What was Q3 revenue?')];

      // Mock Graphiti API
      mockGraphitiSearch([{ content: 'Q3 revenue was $5.2M', score: 0.95 }]);

      const result = await preModelRetrievalHook(messages, mockDealId);

      expect(result.skipped).toBe(false);
      expect(result.intent).toBe('factual');
      expect(result.messages[0]).toBeInstanceOf(SystemMessage);
      expect(result.messages[0].content).toContain('Q3 revenue');
    });

    it('should inject context as first message', async () => {
      const messages = [
        new SystemMessage('You are an assistant'),
        new HumanMessage('What was revenue?'),
      ];

      mockGraphitiSearch([{ content: 'Revenue was $10M' }]);

      const result = await preModelRetrievalHook(messages, mockDealId);

      // Context should be injected FIRST
      expect(result.messages[0].content).toContain('Relevant knowledge');
      expect(result.messages.length).toBe(messages.length + 1);
    });

    it('should use cache for repeated queries', async () => {
      const messages = [new HumanMessage('What was Q3 revenue?')];

      // First call
      mockGraphitiSearch([{ content: 'Q3 revenue was $5.2M' }]);
      const result1 = await preModelRetrievalHook(messages, mockDealId);

      // Second call - should hit cache
      const result2 = await preModelRetrievalHook(messages, mockDealId);

      expect(result1.cacheHit).toBe(false);
      expect(result2.cacheHit).toBe(true);
      expect(result2.retrievalLatencyMs).toBeLessThan(result1.retrievalLatencyMs);
    });

    it('should gracefully degrade when Graphiti unavailable', async () => {
      const messages = [new HumanMessage('What was revenue?')];

      // Mock Graphiti failure
      mockGraphitiSearchFailure(new Error('Connection refused'));

      const result = await preModelRetrievalHook(messages, mockDealId);

      expect(result.skipped).toBe(false); // Attempted retrieval
      expect(result.entities).toBeUndefined(); // No results
      // Chat should continue without context
    });
  });
});
```

### 4.4 Response Behavior by Query Type (E2E)

**File:** `manda-app/e2e/agent-behavior.spec.ts`

```typescript
test.describe('Agent Response Behavior', () => {
  test.describe('Fact Lookup', () => {
    test('should return single authoritative answer with source', async ({ page }) => {
      await sendMessage(page, 'What was the Q3 revenue?');

      const response = await getLastResponse(page);

      expect(response).toMatch(/\$[\d.]+[MBK]/); // Contains a dollar amount
      expect(response).toMatch(/\(source:.*\)/); // Has source citation
      expect(response.length).toBeLessThan(500); // Brief response
    });
  });

  test.describe('Financial Deep Dive', () => {
    test('should return structured breakdown', async ({ page }) => {
      await sendMessage(page, 'Walk me through the revenue breakdown');

      const response = await getLastResponse(page);

      // Should have headers or structure
      expect(response).toMatch(/##|•|-|\*/); // Markdown formatting
      expect(response).toMatch(/source:/i); // Sources
    });
  });

  test.describe('Due Diligence Check', () => {
    test('should focus on risks and offer Q&A', async ({ page }) => {
      await sendMessage(page, 'Any red flags in the financials?');

      const response = await getLastResponse(page);

      // Should offer to add to Q&A
      expect(response).toMatch(/Q&A|question|gap/i);
    });
  });

  test.describe('Zero Document Scenario', () => {
    test('should not offer to search when no docs uploaded', async ({ page }) => {
      // Use a deal with no documents
      await navigateToDeal(page, 'empty-deal');
      await sendMessage(page, 'What was the revenue?');

      const response = await getLastResponse(page);

      // Should NOT offer to broaden search
      expect(response).not.toMatch(/search additional|broaden/i);
      // Should offer to upload or draft Q&A
      expect(response).toMatch(/upload|Q&A/i);
    });
  });
});
```

---

## 5. Multi-Turn Conversation Tests

### 5.1 Context Preservation (Integration)

```typescript
describe('Multi-Turn Context', () => {
  describe('Follow-up Resolution', () => {
    it('should resolve "it" to previous topic', async () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'What was Q3 revenue?' },
        { role: 'assistant', content: 'Q3 revenue was $5.2M.' },
        { role: 'user', content: 'What about Q4?' },
      ];

      const response = await executeChat(agent, 'How does it compare?', history);

      // Should reference revenue (not a random topic)
      expect(response.output).toMatch(/revenue|Q3|Q4|\$[\d.]+/i);
    });

    it('should handle topic shift without carrying irrelevant context', async () => {
      const history: ConversationMessage[] = [
        { role: 'user', content: 'What was Q3 revenue?' },
        { role: 'assistant', content: 'Q3 revenue was $5.2M.' },
      ];

      const response = await executeChat(agent, 'Tell me about the management team', history);

      // Should focus on management, not revenue
      expect(response.output).not.toMatch(/revenue|\$[\d.]+/i);
      expect(response.output).toMatch(/management|team|CEO|leadership/i);
    });
  });

  describe('Summarization Trigger', () => {
    it('should trigger summarization after 20+ messages', async () => {
      const history = generateMessages(25);

      const response = await streamChat(agent, 'What was discussed?', history, {
        onSummarizationComplete: (metrics) => {
          expect(metrics.messagesSummarized).toBeGreaterThan(15);
          expect(metrics.method).toBe('llm');
        },
      });
    });

    it('should trigger summarization above 7000 tokens', async () => {
      // 10 long messages with ~800 tokens each = 8000 tokens
      const history = generateLongMessages(10);

      await streamChat(agent, 'Continue', history, {
        onSummarizationComplete: (metrics) => {
          expect(metrics.tokensBeforeSummary).toBeGreaterThan(7000);
          expect(metrics.tokensSaved).toBeGreaterThan(0);
        },
      });
    });
  });
});
```

### 5.2 Summarization Quality (Integration)

```typescript
describe('Summarization Quality', () => {
  it('should preserve analyst corrections in summary', async () => {
    const history: ConversationMessage[] = [
      { role: 'user', content: 'Revenue was $5M' },
      { role: 'assistant', content: 'Noted, revenue is $5M' },
      { role: 'user', content: 'Actually, the revenue was $5.2M, not $5M' }, // CORRECTION
      ...generateMessages(25), // Trigger summarization
    ];

    const result = await summarizeConversationHistory(history, llm);

    expect(result.summaryText).toMatch(/corrected|5\.2M|not \$5M/i);
  });

  it('should preserve key metrics in summary', async () => {
    const history: ConversationMessage[] = [
      { role: 'user', content: 'What is the EBITDA margin?' },
      { role: 'assistant', content: 'EBITDA margin is 22%' },
      { role: 'user', content: 'And the employee count?' },
      { role: 'assistant', content: '150 employees' },
      ...generateMessages(25),
    ];

    const result = await summarizeConversationHistory(history, llm);

    expect(result.summaryText).toMatch(/EBITDA|22%/i);
    expect(result.summaryText).toMatch(/150|employee/i);
  });

  it('should exclude greetings from summary', async () => {
    const history: ConversationMessage[] = [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi! How can I help?' },
      { role: 'user', content: 'Thanks for your help' },
      ...generateMessages(25),
    ];

    const result = await summarizeConversationHistory(history, llm);

    expect(result.summaryText).not.toMatch(/hello|hi|thanks/i);
  });
});
```

---

## 6. Edge Cases & Stress Tests

### 6.1 Token Limits (Stress)

```typescript
describe('Token Limit Stress Tests', () => {
  test('should handle 100 messages without exceeding budget', async () => {
    const history = generateMessages(100);

    const result = await streamChat(agent, 'Summarize everything', history);

    // Check metrics
    const metrics = await getLastUsageRecord();
    expect(metrics.inputTokens).toBeLessThan(15000);
  }, 60000); // 60s timeout

  test('should handle very long user message', async () => {
    const longMessage = 'Analyze: ' + 'revenue '.repeat(1000);

    const result = await streamChat(agent, longMessage, []);

    expect(result).toBeTruthy(); // Should not crash
  });

  test('should handle concurrent requests', async () => {
    const requests = Array(10).fill(null).map(() =>
      streamChat(agent, 'What was revenue?', [])
    );

    const results = await Promise.all(requests);

    results.forEach((r) => expect(r).toBeTruthy());
  });
});
```

### 6.2 Fallback Scenarios

```typescript
describe('Fallback Scenarios', () => {
  test('should use topic extraction when LLM summarization fails', async () => {
    // Mock LLM failure
    mockLLMFailure(new Error('Rate limited'));

    const history = generateMessages(30);
    const result = await summarizeConversationHistory(history, llm);

    expect(result.metrics.method).toBe('fallback');
    expect(result.summaryText).toMatch(/due diligence|financial|company/i);
  });

  test('should use truncation message as last resort', async () => {
    // Mock both LLM and fallback failure
    mockLLMFailure(new Error('Catastrophic failure'));
    mockExtractTopicsFailure();

    const history = generateMessages(30);
    const result = await summarizeConversationHistory(history, llm);

    expect(result.metrics.method).toBe('truncation');
    expect(result.summaryText).toMatch(/\d+ earlier messages/);
  });

  test('should fallback to Gemini when Claude unavailable', async () => {
    // Mock Claude 429 error
    mockClaudeRateLimit();

    const response = await streamChat(agent, 'What was revenue?', []);

    // Should still get a response (via Gemini)
    expect(response).toBeTruthy();
  });
});
```

### 6.3 Cache Behavior

```typescript
describe('Cache Behavior', () => {
  describe('Retrieval Cache', () => {
    beforeEach(() => retrievalCache.clear());

    it('should cache by topic, not exact query', () => {
      const key1 = retrievalCache.generateKey('Q3 revenue', 'deal-1');
      const key2 = retrievalCache.generateKey('revenue Q3', 'deal-1');

      expect(key1).toBe(key2); // Topic-based matching
    });

    it('should expire after TTL', async () => {
      retrievalCache.set('test-key', {
        context: 'test',
        entities: [],
        timestamp: Date.now() - CACHE_TTL_MS - 1000,
      });

      expect(retrievalCache.get('test-key')).toBeUndefined();
    });

    it('should evict LRU when full', () => {
      // Fill cache to max
      for (let i = 0; i < MAX_CACHE_SIZE; i++) {
        retrievalCache.set(`key-${i}`, { context: '', entities: [], timestamp: Date.now() });
      }

      // Add one more
      retrievalCache.set('new-key', { context: '', entities: [], timestamp: Date.now() });

      // First entry should be evicted
      expect(retrievalCache.get('key-0')).toBeUndefined();
      expect(retrievalCache.get('new-key')).toBeDefined();
    });
  });

  describe('Summarization Cache', () => {
    beforeEach(() => summarizationCache.clear());

    it('should invalidate when new message added', () => {
      const messages1 = generateMessages(5);
      const key1 = getCacheKey(messages1, 'deal-1');

      const messages2 = [...messages1, new HumanMessage('New message')];
      const key2 = getCacheKey(messages2, 'deal-1');

      expect(key1).not.toBe(key2); // Different key due to lastMessageHash
    });

    it('should track hit rate', () => {
      // Miss
      summarizationCache.get('nonexistent');

      // Hit (after setting)
      summarizationCache.set('test', { summaryText: '', messageHashes: [], lastMessageHash: '', messageCount: 0, tokenCount: 0, timestamp: Date.now() });
      summarizationCache.get('test');

      const stats = summarizationCache.getStats();
      expect(stats.hitRate).toBe(0.5); // 1 hit / 2 total
    });
  });
});
```

---

## 7. Observability & Metrics

### 7.1 Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| `llm.input_tokens` | `logLLMUsage` | >15,000 per request |
| `llm.output_tokens` | `logLLMUsage` | >5,000 per request |
| `llm.cost_usd` | `calculateLLMCost` | >$0.10 per request |
| `summarization.compression_ratio` | `SummarizationMetrics` | >0.8 (poor compression) |
| `summarization.fallback_rate` | `SummarizationCache.getStats()` | >5% |
| `retrieval.latency_ms` | `RetrievalMetrics` | >500ms |
| `retrieval.cache_hit_rate` | `RetrievalCache.getStats()` | <30% |
| `intent.skip_rate` | Custom counter | <10% (too few greetings) or >50% (too many skips) |

### 7.2 Logging Assertions

```typescript
describe('Observability', () => {
  it('should log LLM usage for every request', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await streamChat(agent, 'What was revenue?', [], {}, { dealId: 'test' });

    // Check structured log output
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('llm_request_complete')
    );
  });

  it('should log retrieval metrics', async () => {
    const logSpy = vi.spyOn(console, 'log');

    await preModelRetrievalHook([new HumanMessage('Revenue?')], 'deal-1');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('preModelRetrievalHook')
    );
  });

  it('should log summarization metrics', async () => {
    const logSpy = vi.spyOn(console, 'log');

    const history = generateMessages(30);
    await summarizeConversationHistory(history, llm);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('summarization')
    );
  });
});
```

---

## 8. Test Fixtures

### 8.1 Mock Data Factories

**File:** `manda-app/__tests__/fixtures/agent-fixtures.ts`

```typescript
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

export function generateMessages(count: number): BaseMessage[] {
  const messages: BaseMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(new HumanMessage(`Question ${i}: What is the data point ${i}?`));
    messages.push(new AIMessage(`Answer ${i}: The data point ${i} is ${i * 100}.`));
  }
  return messages;
}

export function generateLongMessages(count: number): BaseMessage[] {
  const messages: BaseMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(new HumanMessage('Detailed question: ' + 'context '.repeat(150)));
    messages.push(new AIMessage('Detailed answer: ' + 'explanation '.repeat(150)));
  }
  return messages;
}

export function generateMockResults(count: number): HybridSearchResult[] {
  return Array(count).fill(null).map((_, i) => ({
    content: `Result ${i}: ` + 'data '.repeat(40),
    score: 0.95 - i * 0.02,
    citation: { type: 'document', title: `Document ${i}.pdf`, page: i + 1 },
  }));
}

export function createMockLLM() {
  return {
    invoke: vi.fn().mockResolvedValue({
      content: 'Summarized: Revenue $5.2M, EBITDA 22%, 150 employees.',
    }),
  } as unknown as BaseChatModel;
}
```

### 8.2 API Mocks

```typescript
export function mockGraphitiSearch(results: HybridSearchResult[]) {
  vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      results,
      entities: results.map((_, i) => `Entity${i}`),
      latency_ms: 50,
    }),
  } as Response);
}

export function mockGraphitiSearchFailure(error: Error) {
  vi.spyOn(global, 'fetch').mockRejectedValueOnce(error);
}

export function mockClaudeRateLimit() {
  // Mock 429 on first call, success on second (Gemini fallback)
  vi.spyOn(global, 'fetch')
    .mockRejectedValueOnce(new Error('429 Too Many Requests'))
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: 'Gemini response' }),
    } as Response);
}
```

---

## Appendix A: Test Execution Strategy

### A.1 CI Pipeline Integration

```yaml
# .github/workflows/agent-tests.yml
name: Agent Tests

on:
  push:
    paths:
      - 'manda-app/lib/agent/**'
      - 'manda-app/lib/llm/**'
  pull_request:
    paths:
      - 'manda-app/lib/agent/**'
      - 'manda-app/lib/llm/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:run -- --grep "Intent Classification|Token"

  integration-tests:
    runs-on: ubuntu-latest
    env:
      RUN_INTEGRATION_TESTS: true
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration -- --grep "Retrieval|Summarization"

  token-budget-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:run -- --grep "Token Budget"
```

### A.2 Burn-In for Flakiness

```bash
# Run token tests 10 times to detect flakiness
for i in {1..10}; do
  npm run test:run -- --grep "Token" || exit 1
done
```

---

## Appendix B: Debugging Token Issues

### B.1 Token Usage Dashboard Query

```sql
-- Find high token usage requests
SELECT
  id,
  deal_id,
  input_tokens,
  output_tokens,
  (input_tokens + output_tokens) as total_tokens,
  cost_usd,
  latency_ms,
  created_at
FROM llm_usage
WHERE (input_tokens + output_tokens) > 15000
ORDER BY created_at DESC
LIMIT 100;
```

### B.2 Summarization Effectiveness

```sql
-- Check summarization compression over time
SELECT
  deal_id,
  COUNT(*) as summarization_count,
  AVG(tokens_before_summary) as avg_before,
  AVG(tokens_after_summary) as avg_after,
  AVG(compression_ratio) as avg_compression
FROM summarization_metrics
GROUP BY deal_id
ORDER BY avg_compression DESC;
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-19 | TEA (Murat) | Initial comprehensive test plan |
