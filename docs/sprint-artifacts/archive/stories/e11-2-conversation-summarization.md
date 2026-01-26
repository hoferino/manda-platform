# Story 11.2: Conversation Summarization

Status: Done

## Story

As an M&A analyst,
I want long conversations to be automatically summarized while preserving key context,
so that the agent maintains coherent understanding without hitting token limits.

## Critical Implementation Checklist

Before coding, verify:
- [x] trimMessages uses LLM tokenCounter (not estimateTokens)
- [x] Hook order: summarization BEFORE retrieval in streamChat()
- [x] Cache key includes lastMessageHash for invalidation
- [x] Export pattern matches E11.4 (index.ts lines 33-45)
- [x] disableSummarization flag in ChatExecutionOptions
- [x] SummarizationMetrics interface defined
- [x] Graceful degradation: LLM → fallback → truncation message
- [x] Token budget uses 7K effective (1K safety margin from 8K)

## Acceptance Criteria

1. **AC1: Summarization Trigger** - When conversation exceeds threshold (20+ messages OR 7000+ effective tokens), older messages are summarized and replaced
2. **AC2: Summary Content** - Summary includes: analyst corrections (highest priority), key facts, decisions made, entities mentioned
3. **AC3: Recent Messages Preserved** - Recent messages (last 10) kept verbatim, older messages REPLACED with summary
4. **AC4: Timeout Protection** - Summarization uses 3-second timeout to prevent excessive latency; fallback on timeout
5. **AC5: Summary Storage** - Summary cached with staleness detection via lastMessageHash
6. **AC6: LangGraph Integration** - Uses `trimMessages` from `@langchain/core/messages` with LLM tokenCounter
7. **AC7: Metrics Tracking** - Token savings measured and logged (tokensBeforeSummary, tokensAfterSummary, latencyMs, method)

## Tasks / Subtasks

- [x] Task 1: Create summarization module (AC: #1, #2, #3, #6)
  - [x] 1.1 Create `manda-app/lib/agent/summarization.ts`
  - [x] 1.2 Implement `SummarizationCache` following E11.4 RetrievalCache pattern (LRU, TTL=30min, lastMessageHash for invalidation)
  - [x] 1.3 Implement `summarizeConversationHistory(messages, llm, options)` - returns `[SystemMessage(summary), ...last10Messages]`
  - [x] 1.4 Create M&A-optimized summarization prompt (400 token output limit, priority: corrections > facts > entities)
  - [x] 1.5 Implement multi-level graceful fallback: LLM → topic extraction → truncation message

- [x] Task 2: Integrate with streamChat() (AC: #4, #5)
  - [x] 2.1 Add `SummarizationMetrics` interface and `onSummarizationComplete` callback
  - [x] 2.2 Add `disableSummarization?: boolean` to `ChatExecutionOptions`
  - [x] 2.3 Add summarization hook BEFORE retrieval hook (line ~257 executor.ts)
  - [x] 2.4 Implement timeout wrapper (3s max) with fallback on timeout

- [x] Task 3: Extend ConversationContextManager (AC: #1, #6)
  - [x] 3.1 Add optional `llm` parameter to ConversationContextManager constructor
  - [x] 3.2 Update `summarizeOlderMessages()` to call new LLM-based implementation
  - [x] 3.3 Add `formatContextWithSummarization()` method
  - [x] 3.4 Export types from index.ts: `SummarizationMetrics`, `SummarizationConfig`, `CachedSummary`, `summarizeConversationHistory`

- [x] Task 4: Metrics and observability (AC: #7)
  - [x] 4.1 Define `SummarizationMetrics` interface with all required fields
  - [x] 4.2 Log token savings, latency, method via console (match E11.4 pattern)
  - [x] 4.3 Track cache hit rate and fallback rate

- [x] Task 5: Comprehensive testing (AC: All)
  - [x] 5.1 Create `__tests__/lib/agent/summarization.test.ts`
  - [x] 5.2 Unit tests for summarization logic (15+ tests)
  - [x] 5.3 Unit tests for cache operations including invalidation (10+ tests)
  - [x] 5.4 Integration tests for E11.2 + E11.4 hook interaction (5+ tests)
  - [x] 5.5 Edge case tests: empty history, single message, very long conversations, timeout, all failure modes

## Dev Notes

### Priority Context

**Story Priority:** P2 (Nice-to-have per Epic E11 v5.0)

> "M&A conversations are typically 10-30 messages — context window isn't the bottleneck." - Epic E11

Implements "Compress" strategy from LangChain's context engineering framework.

### Hook Order (CRITICAL)

Summarization must run BEFORE retrieval to reduce message count first:

```typescript
// In executor.ts streamChat() - around line 257

// E11.2: Summarization hook FIRST (reduce message count)
if (!options?.disableSummarization && shouldSummarize(messages)) {
  const result = await summarizeWithTimeout(messages, llm, options)
  messages = result.messages  // [SystemMessage(summary), ...last10]
  callbacks.onSummarizationComplete?.(result.metrics)
}

// E11.4: Retrieval hook SECOND (add context to reduced messages)
if (options?.dealId && !options?.disableRetrieval) {
  const hookResult = await preModelRetrievalHook(messages, options.dealId)
  messages = hookResult.messages  // Prepends retrieval context
}
```

**Final message order:**
1. Retrieval context (SystemMessage) - from E11.4
2. Conversation summary (SystemMessage) - from E11.2
3. Recent messages (last 10 verbatim)
4. New user message

### trimMessages API (CRITICAL)

**Correct usage with LLM tokenCounter:**

```typescript
import { trimMessages } from '@langchain/core/messages'

// trimMessages requires tokenCounter - use LLM instance
const trimmed = await trimMessages(messages, {
  maxTokens: 4000,
  strategy: 'last',
  tokenCounter: llm,  // LLM has getNumTokens() method
  includeSystem: true,
})

// Alternative: custom tokenCounter function
const customTokenCounter = async (msgs: BaseMessage[]): Promise<number> => {
  return msgs.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return total + Math.ceil(content.length / 4)  // ~4 chars/token approximation
  }, 0)
}
```

**NOTE:** `estimateTokens()` from context.ts is NOT compatible with trimMessages API directly.

### Cache Pattern with Invalidation (CRITICAL)

Follow E11.4 RetrievalCache pattern with staleness detection:

```typescript
interface CachedSummary {
  summaryText: string
  messageHashes: string[]      // Content hashes (not IDs - messages don't have stable IDs)
  lastMessageHash: string      // For cache invalidation
  messageCount: number         // Quick validation
  tokenCount: number
  timestamp: number
  entities?: string[]          // Preserved M&A entities
}

function hashMessage(msg: BaseMessage): string {
  const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
  return btoa(`${msg._getType()}:${content.slice(0, 100)}`).slice(0, 8)
}

function getCacheKey(messages: BaseMessage[], dealId: string): string {
  const lastHash = hashMessage(messages[messages.length - 1])
  return `${dealId}:${messages.length}:${lastHash}`
}

// Cache invalidation: new messages change lastMessageHash → cache miss
```

### SummarizationMetrics Interface (CRITICAL)

```typescript
export interface SummarizationMetrics {
  tokensBeforeSummary: number
  tokensAfterSummary: number
  tokensSaved: number
  compressionRatio: number        // tokensAfter / tokensBefore
  latencyMs: number
  messagesSummarized: number
  messagesKept: number
  cacheHit: boolean
  success: boolean
  method: 'llm' | 'fallback' | 'truncation'
}

// Add to streamChat callbacks
callbacks: {
  onToken?: (token: string) => void
  onToolStart?: (tool: string, input: unknown) => void
  onToolEnd?: (tool: string, output: string) => void
  onError?: (error: Error) => void
  onRetrievalComplete?: (metrics: RetrievalMetrics) => void
  onSummarizationComplete?: (metrics: SummarizationMetrics) => void  // NEW
}
```

### ChatExecutionOptions Update

```typescript
export interface ChatExecutionOptions {
  dealId?: string
  disableRetrieval?: boolean
  disableSummarization?: boolean  // NEW: Skip summarization (for debugging)
}
```

### Token Budget (Corrected)

**Context Window:** 8000 tokens | **Effective Budget:** 7000 tokens (1K safety margin)

| Component | Realistic Budget |
|-----------|------------------|
| System Prompt + Tools (18 tools) | ~2,500 tokens |
| Retrieval Context (E11.4) | ~2,000 tokens |
| **Conversation Summary (E11.2)** | **~400 tokens** |
| Recent Messages (last 10) | ~2,000 tokens |
| **Safety Margin** | ~1,100 tokens |

**Trigger condition:** Summarize when `estimatedTokens > 7000` OR `messageCount > 20`

### Summarization Prompt (M&A Optimized)

```typescript
const SUMMARIZATION_PROMPT = `You are summarizing a conversation between an M&A analyst and an AI assistant.

Your summary must fit within 400 tokens. Format as a concise narrative.

Include in order of priority:
1. **Analyst Corrections** - Facts the analyst corrected (mark with "Corrected:")
2. **Key Metrics** - Revenue, EBITDA, margins, employee counts, deal terms
3. **Critical Findings** - Risks, red flags, opportunities identified
4. **Entities** - Company names, people, time periods (Q3 2024, FY2025)
5. **Questions & Answers** - Only if directly relevant to due diligence

Exclude: greetings, pleasantries, meta-conversation, tool usage discussions.

Example output:
"Corrected: Q3 revenue was $5.2M (not $4.8M as initially stated). Company has 150 employees (confirmed). EBITDA margins declined from 22% to 18% YoY. Key risks: customer concentration (top 3 = 65% revenue), EU regulatory exposure. Management: CEO John Smith (15yr experience)."
`
```

### Multi-Level Graceful Degradation (CRITICAL)

```typescript
const SUMMARIZATION_TIMEOUT_MS = 3000

async function summarizeWithTimeout(
  messages: BaseMessage[],
  llm: BaseChatModel,
  options?: SummarizationConfig
): Promise<SummarizationResult> {
  const oldMessages = messages.slice(0, -10)
  const recentMessages = messages.slice(-10)

  try {
    // Level 0: LLM summarization with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), SUMMARIZATION_TIMEOUT_MS)
    )

    const summary = await Promise.race([
      generateSummaryWithLLM(oldMessages, llm),
      timeoutPromise
    ])

    return {
      messages: [new SystemMessage(`Previous context: ${summary}`), ...recentMessages],
      metrics: { success: true, method: 'llm', ... }
    }
  } catch (error) {
    console.warn('[summarization] LLM failed, trying fallback:', error.message)

    try {
      // Level 1: Simple topic extraction (existing placeholder logic)
      const fallback = extractTopicsFromMessages(oldMessages)
      return {
        messages: [new SystemMessage(`Previous topics: ${fallback}`), ...recentMessages],
        metrics: { success: false, method: 'fallback', ... }
      }
    } catch (fallbackError) {
      // Level 2: Basic truncation message (guaranteed to work)
      return {
        messages: [
          new SystemMessage(`Earlier conversation included ${oldMessages.length} messages.`),
          ...recentMessages
        ],
        metrics: { success: false, method: 'truncation', ... }
      }
    }
  }
}
```

### ConversationContextManager Integration

**Problem:** Current ConversationContextManager doesn't have LLM access.

**Solution:** Add optional LLM parameter:

```typescript
// In context.ts
export class ConversationContextManager {
  private options: ConversationContextOptions
  private tokenCounter: TokenCounter
  private llm?: BaseChatModel  // NEW: Optional LLM for summarization

  constructor(options?: Partial<ConversationContextOptions>, llm?: BaseChatModel) {
    this.options = { ...DEFAULT_CONTEXT_OPTIONS, ...options }
    this.tokenCounter = getTokenCounter()
    this.llm = llm
  }

  async summarizeOlderMessages(messages: ConversationMessage[]): Promise<string> {
    if (!this.llm) {
      // Fallback to existing simple topic extraction
      return this.extractTopics(messages)
    }

    // Delegate to new LLM-based implementation
    const langChainMessages = convertToLangChainMessages(messages)
    const { summary } = await summarizeConversationHistory(langChainMessages, this.llm)
    return summary
  }
}
```

### Export Pattern (index.ts)

```typescript
// Add to lib/agent/index.ts following E11.4 pattern:

export {
  summarizeConversationHistory,
  summarizeWithTimeout,
  SummarizationCache,
  shouldSummarize,
  SUMMARIZATION_TIMEOUT_MS,
  SUMMARIZATION_THRESHOLD_MESSAGES,
  SUMMARIZATION_THRESHOLD_TOKENS,
  type SummarizationMetrics,
  type SummarizationConfig,
  type SummarizationResult,
  type CachedSummary,
} from './summarization'
```

### Integration with E11.3 Write-Back

Analyst corrections persisted via E11.3 should be preserved with highest priority:

```typescript
// In summarization prompt, corrections are priority #1
// Additionally, consider querying recent persisted facts:

async function getSummaryContext(dealId: string, messages: BaseMessage[]) {
  // Query Graphiti for facts persisted during this conversation
  // These have highest confidence and should be preserved
  const persistedFacts = await queryRecentlyPersistedFacts(dealId)

  return {
    persistedFacts,  // Include in summary context
    messages
  }
}
```

### Project Structure

**Files to CREATE:**
- `manda-app/lib/agent/summarization.ts` (~250-300 lines)
- `manda-app/__tests__/lib/agent/summarization.test.ts` (35+ tests)

**Files to MODIFY:**
- `manda-app/lib/agent/executor.ts` - Add summarization hook BEFORE retrieval
- `manda-app/lib/agent/context.ts` - Add LLM parameter, update summarizeOlderMessages
- `manda-app/lib/agent/index.ts` - Export summarization types/functions

### Testing Standards

```typescript
describe('summarizeConversationHistory', () => {
  it('should skip summarization for short conversations (<20 messages)', async () => {})
  it('should summarize older messages when threshold exceeded', async () => {})
  it('should preserve last 10 messages verbatim', async () => {})
  it('should use cached summary when available and not stale', async () => {})
  it('should invalidate cache when new message added (lastMessageHash changes)', async () => {})
  it('should fall back to topic extraction when LLM fails', async () => {})
  it('should fall back to truncation message when fallback fails', async () => {})
  it('should respect 3-second timeout', async () => {})
  it('should use LLM tokenCounter with trimMessages', async () => {})
})

describe('E11.2 + E11.4 Integration', () => {
  it('should run summarization BEFORE retrieval', async () => {})
  it('should handle both hooks triggering', async () => {})
  it('should produce correct message order after both hooks', async () => {})
  it('should fit combined context within 8K tokens', async () => {})
  it('should not summarize when disableSummarization=true', async () => {})
})

describe('SummarizationCache', () => {
  it('should evict oldest entries when maxSize exceeded (LRU)', async () => {})
  it('should expire entries after TTL (30 min)', async () => {})
  it('should detect cache staleness via lastMessageHash', async () => {})
  it('should return cache miss for new messages', async () => {})
})
```

**Test coverage targets:** 35+ tests total

### Previous Story Learnings

**From E11.1 (Tool Result Isolation):**
- Cache pattern with LRU + TTL works well
- Token estimation: ~4 chars/token (avoid tiktoken WASM issues)
- Consistent formatting matters for LLM parsing

**From E11.4 (Intent-Aware Retrieval):**
- Hook pattern integrates cleanly into streamChat()
- System message injection is preferred context addition method
- Latency tracking with warnings if >500ms
- Cache key design critical for accuracy

**From E11.3 (Autonomous Write-Back):**
- Graceful degradation: Continue even if service fails
- Document data flow explicitly to prevent integration confusion

### References

- [Source: docs/sprint-artifacts/epics/epic-E11.md#E11.2] - Story definition
- [Source: lib/agent/executor.ts:257-271] - Hook integration point
- [Source: lib/agent/context.ts:314-341] - Placeholder to replace
- [Source: lib/agent/retrieval.ts] - Cache and hook patterns (E11.4)
- [trimMessages API](https://js.langchain.com/docs/how_to/trim_messages/) - LangChain docs
- [Context Engineering](https://blog.langchain.com/context-engineering-for-agents/) - Compress strategy

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

### Completion Notes List

- ✅ Created comprehensive summarization module (~700 lines) with:
  - SummarizationCache with LRU eviction, TTL, and hit rate tracking
  - summarizeConversationHistory with multi-level fallback (LLM → topic extraction → truncation)
  - M&A-optimized summarization prompt prioritizing analyst corrections
  - Token estimation using ~4 chars/token approximation
  - Cache key generation using lastMessageHash for invalidation
  - **trimMessagesWithLLM** and **createTokenCounter** for AC #6 (LangChain trimMessages API)
- ✅ Integrated with streamChat() executor:
  - Added summarization hook BEFORE retrieval hook (critical hook order)
  - Added onSummarizationComplete callback for metrics
  - Added disableSummarization option to ChatExecutionOptions
- ✅ Extended ConversationContextManager:
  - Added optional llm parameter to constructor
  - Updated summarizeOlderMessages() to use LLM when available
  - Added formatContextWithSummarization() method
  - Added setLLM() and hasLLM() helper methods
- ✅ Implemented metrics and observability (AC: #7):
  - SummarizationMetrics interface with all required fields
  - Cache hit rate and fallback rate tracking
  - Console logging matching E11.4 pattern
- ✅ Created 78 comprehensive tests covering:
  - Configuration constants
  - Token estimation
  - Hash utilities (including improved non-ASCII handling)
  - shouldSummarize trigger logic
  - Topic extraction fallback
  - SummarizationCache operations (LRU, TTL, stats)
  - summarizeConversationHistory main flow
  - Timeout handling
  - Edge cases (empty, single message, long conversations, multimodal)
  - E11.2 + E11.4 integration scenarios
  - **createTokenCounter** and **trimMessagesWithLLM** (AC #6 tests)

### Change Log

- 2025-12-18: Initial implementation of E11.2 Conversation Summarization (all tasks complete)
- 2025-12-18: Code review fixes:
  - Added trimMessagesWithLLM and createTokenCounter for proper AC #6 compliance
  - Improved hashMessage fallback for non-ASCII content (Japanese, Chinese text)
  - Added thread-safety documentation for cache singleton
  - Fixed fallbackError logging (was swallowed, now logged)
  - Fixed test file type errors
  - Added 9 new tests for AC #6 trimMessages functionality

### File List

- manda-app/lib/agent/summarization.ts (NEW - ~700 lines)
- manda-app/lib/agent/executor.ts (MODIFY - added summarization hook BEFORE retrieval, lines 285-300)
- manda-app/lib/agent/context.ts (MODIFY - added LLM param, formatContextWithSummarization, ~60 new lines)
- manda-app/lib/agent/index.ts (MODIFY - added summarization exports including trimMessagesWithLLM, lines 48-75)
- manda-app/__tests__/lib/agent/summarization.test.ts (NEW - 78 tests)
