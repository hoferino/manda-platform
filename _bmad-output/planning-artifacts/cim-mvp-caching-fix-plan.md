# CIM MVP Prompt Caching Fix Plan

**Date:** 2026-01-15
**Status:** ✅ Implemented
**Issue:** Story 5 prompt caching not working - 0% cache hit rate

## Implementation Status

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Restructure Static Prompt | ✅ Done | Moved all 7 stage instructions to static prompt (~8,500 tokens) |
| Task 2: Fix Code Comments | ✅ Done | Corrected min cacheable tokens (4096 for Haiku, 1024 for Sonnet) |
| Task 3: Improve Cache Logging | ✅ Done | Now logs on every request with warning if no cache activity |
| Task 4: Token Estimation | ✅ Done | Added `estimateTokens()` and validation warning |
| Task 5: LangSmith Validation | ⏳ Pending | Requires manual testing |

**Implementation Date:** 2026-01-15
**Compatibility:** Verified compatible with CIM Knowledge Toggle (orthogonal features)

---

## Problem Summary

Story 5 (Prompt Caching) was marked complete but **is not working**:

| Metric | Expected | Actual |
|--------|----------|--------|
| Cache hit rate | >50% | **0%** |
| Input tokens/request | 30-40k | **57k** |
| Cost/request | $0.01-0.02 | **$0.05-0.06** |
| TTFT | <1.5s | **10s+** |

---

## Root Cause Analysis

### Issue 1: Static Prompt Below Minimum Threshold

| Model | Min Cacheable Tokens | Current Static | Status |
|-------|---------------------|----------------|--------|
| Claude Haiku 4.5 | **4,096** | ~1,500 | ❌ Too small |

The static prompt (`getStaticPrompt()`) is only ~5,500 characters (~1,500 tokens). Anthropic's prompt caching **silently ignores** cache breakpoints below the minimum threshold.

### Issue 2: Incorrect Documentation in Code

**graph.ts line 42:**
```typescript
// Min cacheable prefix: 2048 tokens for Sonnet, 1024 for Haiku  // WRONG!
```

**Correct values (Anthropic docs 2025):**
- Claude Haiku 4.5: **4,096 tokens**
- Claude Sonnet 4.5: **1,024 tokens**

### Issue 3: Stage Instructions in Dynamic Prompt

The `getWorkflowStageInstructions()` output (~2,000 tokens per stage) is placed in the **dynamic** prompt, but these instructions are **identical across all requests for a given stage**. They should be in static.

### Issue 4: Tool Schemas Not Cached

LangChain's `bindTools()` adds tool schemas (~5,000 tokens) to each request but they're not included in the cached prefix. Tools should be placed BEFORE the system prompt cache breakpoint.

---

## Fix Plan

### Task 1: Restructure Static Prompt (P0)

**Goal:** Ensure static prompt exceeds 4,096 tokens

**Changes to `lib/agent/cim-mvp/prompts.ts`:**

1. Move ALL stage instructions into `getStaticPrompt()`:
   ```typescript
   function getStaticPrompt(): string {
     return `
   ${BASE_ROLE_AND_RULES}

   ## Stage Instructions

   ### Welcome Stage
   ${getWorkflowStageInstructions('welcome')}

   ### Buyer Persona Stage
   ${getWorkflowStageInstructions('buyer_persona')}

   // ... all 7 stages
   `
   }
   ```

2. Update `getDynamicPrompt()` to only include:
   - Current stage name (not instructions)
   - Company name
   - Workflow progress state
   - Saved context (buyer persona, hero, outline)
   - Knowledge summary (if loaded)

**Expected result:** Static prompt ~8,000-10,000 tokens (well above 4,096 minimum)

### Task 2: Fix Code Comments (P1)

**File:** `lib/agent/cim-mvp/graph.ts`

Update line 42:
```typescript
// Before:
// Min cacheable prefix: 2048 tokens for Sonnet, 1024 for Haiku

// After:
// Min cacheable prefix: 1024 tokens for Sonnet, 4096 for Haiku
// See: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
```

### Task 3: Verify Cache Metrics Logging (P1)

**File:** `lib/agent/cim-mvp/graph.ts`

Ensure cache metrics are logged on EVERY request (not just when non-zero):
```typescript
// Current (only logs when cache hits exist):
if (inputDetails?.cache_read || inputDetails?.cache_creation) {
  console.log(`[CIM-MVP] Cache metrics...`)
}

// Fixed (always log for debugging):
console.log(`[CIM-MVP] Cache metrics - read: ${inputDetails?.cache_read || 0}, write: ${inputDetails?.cache_creation || 0}, total_input: ${usageMetadata.input_tokens}`)
```

### Task 4: Add Token Count Logging (P2)

**File:** `lib/agent/cim-mvp/prompts.ts`

Add helper to estimate token count:
```typescript
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English
  return Math.ceil(text.length / 4)
}

export function getSystemPromptForCaching(state: CIMMVPStateType): CacheableSystemPrompt {
  const staticPrompt = getStaticPrompt()
  const dynamicPrompt = getDynamicPrompt(state)

  const staticTokens = estimateTokens(staticPrompt)
  const dynamicTokens = estimateTokens(dynamicPrompt)

  console.log(`[CIM-MVP] Prompt tokens - static: ~${staticTokens}, dynamic: ~${dynamicTokens}`)

  if (staticTokens < 4096) {
    console.warn(`[CIM-MVP] WARNING: Static prompt (${staticTokens} tokens) below Haiku minimum (4096)`)
  }

  return { staticPrompt, dynamicPrompt }
}
```

### Task 5: Validate in LangSmith (P0)

After implementation:
1. Send 3+ messages in same CIM session
2. Check LangSmith traces for `cache_read_input_tokens > 0`
3. Verify cost reduction in Anthropic dashboard

**Success criteria:**
- Cache hit rate > 50% on 2nd+ messages
- Input tokens reduced from 57k to ~35-40k
- Cost per request reduced to ~$0.02

---

## Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `lib/agent/cim-mvp/prompts.ts` | Move stage instructions to static, add token logging | P0 |
| `lib/agent/cim-mvp/graph.ts` | Fix comments, improve cache logging | P1 |

---

## Estimated Token Distribution (After Fix)

### Static Prompt (~8,500 tokens) - CACHED
| Component | Est. Tokens |
|-----------|-------------|
| Role & rules | 1,500 |
| Tool descriptions | 500 |
| Stage navigation | 300 |
| Welcome instructions | 800 |
| Buyer persona instructions | 1,000 |
| Hero concept instructions | 1,200 |
| Investment thesis instructions | 800 |
| Outline instructions | 1,000 |
| Building sections instructions | 1,200 |
| Response style | 200 |

### Dynamic Prompt (~2,000-4,000 tokens) - NOT CACHED
| Component | Est. Tokens |
|-----------|-------------|
| Current stage pointer | 50 |
| Company name | 20 |
| Workflow progress | 100 |
| Buyer persona (if saved) | 200 |
| Hero context (if saved) | 300 |
| CIM outline (if created) | 500 |
| Gathered context | 500 |
| Knowledge summary | 1,500 |

### Tool Schemas (~5,000 tokens) - Bound by LangChain
(Not directly cached, but stable across requests)

### Messages (~variable) - NOT CACHED
Conversation history grows with each turn

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Static prompt tokens | ~1,500 | ~8,500 |
| Cache hit rate | 0% | >70% |
| Effective input tokens | 57k | ~35k (8.5k cached @ 10% + 26.5k uncached) |
| Cost per request | $0.05-0.06 | ~$0.02 |
| TTFT | 10s+ | <3s |

---

## Rollback Plan

If caching causes issues:
1. Revert `getStaticPrompt()` to original
2. Remove token logging
3. Cache will simply not activate (graceful degradation)

---

## References

- [Anthropic Prompt Caching Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Story 5 Original Implementation](cim-mvp-fix-stories.md#story-5-implement-prompt-caching)
- [Architecture Evaluation - Token Optimization](../planning-artifacts/cim-builder-architecture-evaluation.md#context-engineering--token-optimization-2026-best-practices)
