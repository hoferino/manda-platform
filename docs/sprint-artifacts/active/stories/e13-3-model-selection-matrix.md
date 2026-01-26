# Story 13.3: Model Selection Matrix

Status: done

## Story

As an **M&A analyst**,
I want the **conversational agent to automatically select the optimal LLM model based on my query complexity**,
so that **simple queries respond faster using lightweight models (<500ms TTFT) while complex queries get accurate responses from capable models**, reducing cost per simple query from ~$0.001 to ~$0.0001.

## Acceptance Criteria

1. **AC1: Create model selection matrix in config**
   - Extend `lib/llm/config.ts` with `MODEL_ROUTING_CONFIG` constant
   - Map complexity levels to provider/model/settings combinations
   - Simple tier: `gemini-2.0-flash-lite` (fast, cheap) - **VERIFY model name exists**
   - Medium tier: `gemini-2.5-pro` (balanced)
   - Complex tier: `claude-sonnet-4-20250514` (capable) - **standardized model name**
   - Configuration must be easily extensible for future model additions

2. **AC2: Implement `selectModelForComplexity(complexity)` function**
   - Accept `ComplexityLevel` from E13.1 as input
   - Return `LLMConfig` with provider, model, and tier-specific settings
   - If complexity is undefined, default to 'complex' (backward compatibility)
   - Export function from `lib/llm/routing.ts` (NEW)

3. **AC3: Integrate with LLM client factory (E11.6)**
   - Modify `createLLMClient()` to accept optional complexity parameter
   - Use `selectModelForComplexity()` to get tier-appropriate model
   - Preserve existing env-based config when no complexity provided
   - Maintain fallback chain behavior (E12.6)
   - **Graceful degradation:** If Google API key missing and tier requires Google → fall back to complex tier (Claude)

4. **AC4: Verify model switching in LangSmith traces**
   - Simple queries should show `gemini-2.0-flash-lite` in trace
   - Medium queries should show `gemini-2.5-pro` in trace
   - Complex queries should show `claude-sonnet-4-20250514` in trace
   - Add `selectedModel` to trace metadata

5. **AC5: Add cost tracking per complexity tier**
   - Extend `TOKEN_COSTS` with all tier models
   - Log estimated cost in `logLLMUsage()` call
   - Add `modelTier` and `estimatedCost` to usage metadata

6. **AC6: Create comprehensive tests**
   - Test model selection returns correct config for each tier
   - Test backward compatibility (undefined complexity = default model)
   - Test LLM client creation with complexity parameter
   - Test cost calculation for each tier
   - Test fallback behavior when tier model unavailable
   - **Test API key missing scenarios** (Google key missing → fallback to Claude)
   - **Test end-to-end flow** through chat route

## Tasks / Subtasks

- [x] **Task 0: Pre-Implementation Verification** (CRITICAL - do first)
  - [x] Verify `gemini-2.0-flash-lite` model name via Google AI Studio API
  - [x] If model name differs, update `MODEL_BY_COMPLEXITY` in `intent.ts` AND this story
  - [x] Verify `claude-sonnet-4-20250514` is valid via Anthropic docs
  - [x] Confirm current pricing for all tier models

- [x] **Task 1: Create lib/llm/routing.ts module** (AC: #1, #2)
  - [x] Import `ComplexityLevel` from `intent.ts`
  - [x] Import `MODEL_BY_COMPLEXITY` from `intent.ts` (model name references)
  - [x] Create `MODEL_ROUTING_CONFIG` with full config per tier
  - [x] Implement `selectModelForComplexity(complexity: ComplexityLevel): LLMConfig`
  - [x] Implement `getFallbackConfig(complexity: ComplexityLevel): LLMConfig` with proper escalation
  - [x] Add logging for model selection decisions
  - [x] Export all functions from `lib/llm/index.ts`

- [x] **Task 2: Extend lib/llm/config.ts** (AC: #1, #5)
  - [x] Add `gemini-2.0-flash-lite` to `TOKEN_COSTS_BY_MODEL`
  - [x] Add `gemini-2.5-pro` to `TOKEN_COSTS_BY_MODEL` (verify pricing)
  - [x] Add `claude-sonnet-4-20250514` to `TOKEN_COSTS_BY_MODEL`
  - [x] Add type `ModelRoutingConfig` for tier configuration
  - [x] Implement `getTokenCosts(model: string)` helper function
  - [x] Ensure all tier models have pricing data

- [x] **Task 3: Update lib/llm/client.ts** (AC: #3)
  - [x] Add optional `complexity?: ComplexityLevel` to `createLLMClient()` signature
  - [x] Integrate `selectModelForComplexity()` when complexity provided
  - [x] Update `createLLMClientWithFallback()` to support complexity-based primary model
  - [x] **Add graceful degradation:** If Google API key missing → fall back to Claude
  - [x] Preserve existing behavior when complexity not provided

- [x] **Task 4: Update lib/agent/executor.ts** (AC: #3, #4)
  - [x] Modify `createChatAgent()` to call `selectModelForComplexity(config.complexity)`
  - [x] Pass resulting `LLMConfig` to `createLLMClientWithFallback()`
  - [x] Add `selectedModel` to `ChatAgentWithCache` interface for tracing
  - [x] Log model selection alongside tool tier selection

- [x] **Task 5: Integrate with chat route** (AC: #4)
  - [x] Verify complexity flows through `createChatAgent()` → LLM client chain
  - [x] Add `selectedModel` to response headers (`X-Model-Used`)
  - [x] Add model info to feature usage logging metadata
  - [x] Log model selection in LangSmith trace

- [x] **Task 6: Write comprehensive tests** (AC: #6)
  - [x] Create `manda-app/__tests__/lib/llm/routing.test.ts`
  - [x] Test `selectModelForComplexity('simple')` returns Gemini Flash Lite config
  - [x] Test `selectModelForComplexity('medium')` returns Gemini Pro config
  - [x] Test `selectModelForComplexity('complex')` returns Claude Sonnet config
  - [x] Test backward compatibility with undefined complexity
  - [x] Test cost calculation accuracy per tier
  - [x] Test `createLLMClient({ complexity: 'simple' })` creates correct client
  - [x] **Test Google API key missing → fallback to Claude**
  - [x] **Test fallback chain: simple fails → medium, medium fails → complex**
  - [x] **Test end-to-end integration with mocked LLM constructors**

## Dev Notes

### E13.1 and E13.2 Foundation

E13.1 implemented complexity classification and defined model recommendations:

```typescript
// manda-app/lib/agent/intent.ts (lines 199-207)
export const MODEL_BY_COMPLEXITY: Record<ComplexityLevel, string> = {
  simple: 'gemini-2.0-flash-lite',
  medium: 'gemini-2.5-pro',
  complex: 'claude-sonnet-4-20250514',
}
```

E13.2 integrated complexity into the agent creation flow:

```typescript
// manda-app/app/api/projects/[id]/chat/route.ts (lines 194-210)
const intentResult = await classifyIntentAsync(message)
const { complexity } = intentResult

const agent = createChatAgent({
  dealId: projectId,
  userId: user.id,
  dealName: project.name,
  complexity, // E13.2: Pass complexity for tier-based tool loading
})
```

**This story extends the chain to also select the appropriate LLM model.**

### Current LLM Architecture

**File: `manda-app/lib/llm/client.ts`**

```typescript
// Current createLLMClient - reads from env
export function createLLMClient(config?: Partial<LLMConfig>): BaseChatModel {
  const envConfig = getLLMConfig()  // Provider from LLM_PROVIDER env
  const finalConfig = config ? { ...envConfig, ...config } : envConfig
  // Creates provider-specific client...
}

// Current createLLMClientWithFallback - Claude → Gemini Pro
export function createLLMClientWithFallback(config?: Partial<LLMConfig>) {
  const primaryLLM = createLLMClient(llmConfig)
  const fallbackLLM = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-pro',  // Hardcoded fallback
    ...
  })
  return primaryLLM.withFallbacks({ fallbacks: [fallbackLLM] })
}
```

**File: `manda-app/lib/llm/config.ts`**

```typescript
export type LLMProvider = 'anthropic' | 'openai' | 'google'

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4-turbo-preview',
  google: 'gemini-1.5-pro',
}

export const TOKEN_COSTS: Record<LLMProvider, { input: number; output: number }> = {
  anthropic: { input: 3.00, output: 15.00 },
  openai: { input: 10.00, output: 30.00 },
  google: { input: 1.25, output: 5.00 },
}
```

### Model Routing Configuration

```typescript
// lib/llm/routing.ts (NEW)
import { ComplexityLevel, MODEL_BY_COMPLEXITY } from '@/lib/agent/intent'
import type { LLMConfig, LLMProvider } from './config'

/**
 * Complete model configuration per complexity tier
 * Story: E13.3 - Model Selection Matrix (AC: #1)
 */
export const MODEL_ROUTING_CONFIG: Record<ComplexityLevel, LLMConfig> = {
  simple: {
    provider: 'google',
    model: 'gemini-2.0-flash-lite',
    temperature: 0.3,      // Lower temp for simple factual responses
    maxTokens: 500,        // Short responses for simple queries
    retryAttempts: 2,      // Fewer retries - fast fail, fast escalate
    timeout: 5000,         // 5s timeout - we want speed
  },
  medium: {
    provider: 'google',
    model: 'gemini-2.5-pro',
    temperature: 0.5,
    maxTokens: 2000,
    retryAttempts: 3,
    timeout: 30000,
  },
  complex: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096,
    retryAttempts: 3,
    timeout: 60000,        // Longer timeout for complex analysis
  },
}

/**
 * Select model configuration based on query complexity
 * Story: E13.3 - Model Selection Matrix (AC: #2)
 *
 * @param complexity - Complexity level from intent classification
 * @returns Full LLMConfig for the tier
 */
export function selectModelForComplexity(complexity?: ComplexityLevel): LLMConfig {
  // Default to complex for backward compatibility
  const tier = complexity ?? 'complex'
  const config = MODEL_ROUTING_CONFIG[tier]

  console.log(`[LLM Routing] Selected ${config.provider}:${config.model} for ${tier} tier`)

  return config
}

/**
 * Get fallback model for a given tier
 * Story: E13.3 - Model Selection Matrix (AC: #3)
 *
 * Fallback chain:
 * - Simple (Flash Lite) fails → Medium (Gemini Pro)
 * - Medium (Gemini Pro) fails → Complex (Claude Sonnet)
 * - Complex (Claude Sonnet) fails → Medium (Gemini Pro) - existing E12.6 behavior
 *
 * @param complexity - Current tier that failed
 * @returns Fallback LLMConfig
 */
export function getFallbackConfig(complexity: ComplexityLevel): LLMConfig {
  switch (complexity) {
    case 'simple':
      // Flash Lite fails → try Gemini Pro
      return MODEL_ROUTING_CONFIG['medium']
    case 'medium':
      // Gemini Pro fails → try Claude Sonnet
      return MODEL_ROUTING_CONFIG['complex']
    case 'complex':
      // Claude Sonnet fails → fall back to Gemini Pro (existing E12.6 behavior)
      return MODEL_ROUTING_CONFIG['medium']
  }
}

/**
 * Check if Google API key is available
 * Used for graceful degradation when simple/medium tier requested but Google unavailable
 */
export function isGoogleAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY
}

/**
 * Get effective model config, handling missing API keys
 * If Google key missing and tier requires Google → fall back to Claude
 */
export function getEffectiveModelConfig(complexity?: ComplexityLevel): LLMConfig {
  const tier = complexity ?? 'complex'
  const config = MODEL_ROUTING_CONFIG[tier]

  // If tier requires Google but Google API key is missing, fall back to Claude
  if (config.provider === 'google' && !isGoogleAvailable()) {
    console.warn(`[LLM Routing] Google API key missing, falling back to Claude for ${tier} tier`)
    return MODEL_ROUTING_CONFIG['complex']
  }

  return config
}
```

### Extended Token Costs

```typescript
// lib/llm/config.ts - extend TOKEN_COSTS
export const TOKEN_COSTS_BY_MODEL: Record<string, { input: number; output: number }> = {
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  // Google
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },  // ~10x cheaper than Pro
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-flash': { input: 0.30, output: 1.20 },
  // OpenAI (for reference)
  'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
}

/**
 * Get token costs for a specific model
 */
export function getTokenCosts(model: string): { input: number; output: number } {
  return TOKEN_COSTS_BY_MODEL[model] ?? TOKEN_COSTS_BY_MODEL['gemini-2.5-pro']
}
```

### Integration Flow

```
User Query
    ↓
classifyIntentAsync(message) → { intent, complexity }  (E13.1)
    ↓
selectModelForComplexity(complexity) → LLMConfig       (E13.3 - THIS STORY)
    ↓
createLLMClient({ ...routingConfig }) → BaseChatModel
    ↓
getToolsForComplexity(complexity) → filtered tools     (E13.2)
    ↓
createReactAgent(llm, tools) → agent
    ↓
streamChat(agent, message) → response
```

### Chat Route Integration

```typescript
// app/api/projects/[id]/chat/route.ts - Update agent creation

// E13.3: Select model based on complexity
const modelConfig = selectModelForComplexity(complexity)
console.log(
  `[api/chat] Model routing: ${modelConfig.provider}:${modelConfig.model} ` +
  `(${complexity ?? 'default'} tier)`
)

// Create the agent with complexity-based model AND tool loading
const agent = createChatAgent({
  dealId: projectId,
  userId: user.id,
  dealName: project.name,
  complexity,        // E13.2: Tool loading
  llmConfig: modelConfig,  // E13.3: Model selection
})

// Add model info to response headers
const headers = getSSEHeaders()
headers.set('X-Model-Used', `${modelConfig.provider}:${modelConfig.model}`)
headers.set('X-Complexity-Tier', complexity ?? 'complex')

// In feature usage logging
await logFeatureUsage({
  ...
  metadata: {
    ...
    modelUsed: `${modelConfig.provider}:${modelConfig.model}`,
    modelTier: complexity ?? 'complex',
    estimatedInputCost: (inputTokens / 1_000_000) * tokenCosts.input,
    estimatedOutputCost: (outputTokens / 1_000_000) * tokenCosts.output,
  },
})
```

### Project Structure Notes

**New File:**
- `manda-app/lib/llm/routing.ts` - Model selection logic (`selectModelForComplexity`, `getFallbackConfig`, `getEffectiveModelConfig`)

**Modified Files:**
- `manda-app/lib/llm/config.ts` - Add `TOKEN_COSTS_BY_MODEL`, `getTokenCosts()` helper
- `manda-app/lib/llm/client.ts` - Add complexity parameter to `createLLMClient()`, graceful degradation
- `manda-app/lib/llm/index.ts` - Export routing functions
- `manda-app/lib/agent/executor.ts` - **KEY INTEGRATION POINT**: Call `selectModelForComplexity()` in `createChatAgent()`, pass to `createLLMClientWithFallback()`
- `manda-app/app/api/projects/[id]/chat/route.ts` - Add `X-Model-Used` header, model info in usage logging

**DO NOT Modify:**
- `manda-app/lib/agent/intent.ts` - Already complete from E13.1 (unless model name verification requires update)
- `manda-app/lib/agent/tools/tool-loader.ts` - Already complete from E13.2

### Testing Strategy

**Unit Tests (routing.test.ts):**
```typescript
import { selectModelForComplexity, MODEL_ROUTING_CONFIG } from '../routing'

describe('selectModelForComplexity', () => {
  it('returns Gemini Flash Lite config for simple complexity', () => {
    const config = selectModelForComplexity('simple')
    expect(config.provider).toBe('google')
    expect(config.model).toBe('gemini-2.0-flash-lite')
    expect(config.maxTokens).toBe(500)
    expect(config.timeout).toBe(5000)
  })

  it('returns Gemini Pro config for medium complexity', () => {
    const config = selectModelForComplexity('medium')
    expect(config.provider).toBe('google')
    expect(config.model).toBe('gemini-2.5-pro')
    expect(config.maxTokens).toBe(2000)
  })

  it('returns Claude Sonnet config for complex complexity', () => {
    const config = selectModelForComplexity('complex')
    expect(config.provider).toBe('anthropic')
    expect(config.model).toBe('claude-sonnet-4-20250514')
    expect(config.maxTokens).toBe(4096)
  })

  it('defaults to complex tier when complexity undefined', () => {
    const config = selectModelForComplexity(undefined)
    expect(config.provider).toBe('anthropic')
    expect(config.model).toBe('claude-sonnet-4-20250514')
  })
})

describe('cost calculations', () => {
  it('calculates correct cost for simple tier', () => {
    const costs = getTokenCosts('gemini-2.0-flash-lite')
    // 1000 input + 100 output tokens
    const cost = (1000 / 1_000_000) * costs.input + (100 / 1_000_000) * costs.output
    expect(cost).toBeCloseTo(0.000105, 6)  // ~$0.0001
  })

  it('calculates correct cost for complex tier', () => {
    const costs = getTokenCosts('claude-sonnet-4-20250514')
    // 1000 input + 100 output tokens
    const cost = (1000 / 1_000_000) * costs.input + (100 / 1_000_000) * costs.output
    expect(cost).toBeCloseTo(0.0045, 4)  // ~$0.005
  })
})
```

**API Key Graceful Degradation Tests:**
```typescript
describe('getEffectiveModelConfig', () => {
  it('returns Claude config when Google key missing and simple tier requested', () => {
    delete process.env.GOOGLE_AI_API_KEY
    const config = getEffectiveModelConfig('simple')
    expect(config.provider).toBe('anthropic')
    expect(config.model).toBe('claude-sonnet-4-20250514')
  })

  it('returns requested tier when Google key available', () => {
    process.env.GOOGLE_AI_API_KEY = 'test-key'
    const config = getEffectiveModelConfig('simple')
    expect(config.provider).toBe('google')
    expect(config.model).toBe('gemini-2.0-flash-lite')
  })
})

describe('getFallbackConfig', () => {
  it('escalates simple to medium on failure', () => {
    const fallback = getFallbackConfig('simple')
    expect(fallback.model).toBe('gemini-2.5-pro')
  })

  it('escalates medium to complex on failure', () => {
    const fallback = getFallbackConfig('medium')
    expect(fallback.model).toBe('claude-sonnet-4-20250514')
  })

  it('falls back complex to medium (existing E12.6 behavior)', () => {
    const fallback = getFallbackConfig('complex')
    expect(fallback.model).toBe('gemini-2.5-pro')
  })
})
```

**Integration Tests:**
- Mock `ChatGoogleGenerativeAI` and `ChatAnthropic` constructors
- Verify correct constructor called for each complexity tier
- Verify config parameters passed correctly
- **Test createChatAgent with complexity passes correct LLM config**
- **Test chat route response headers include X-Model-Used**

### Cost Savings Expectations

| Tier | Model | Input $/1M | Output $/1M | Typical Query Cost |
|------|-------|------------|-------------|-------------------|
| Simple | gemini-2.0-flash-lite | $0.075 | $0.30 | ~$0.0001 |
| Medium | gemini-2.5-pro | $1.25 | $5.00 | ~$0.001 |
| Complex | claude-sonnet-4 | $3.00 | $15.00 | ~$0.005 |

**Savings vs current (all queries use Claude):**
- Simple queries: 98% cost reduction
- Medium queries: 66% cost reduction
- Complex queries: No change (baseline)

### Anti-Patterns to Avoid

1. **DO NOT** hardcode model names in multiple places - use `MODEL_BY_COMPLEXITY` from intent.ts
2. **DO NOT** create model instances directly - use `createLLMClient()` factory
3. **DO NOT** break backward compatibility - undefined complexity = default (complex) model
4. **DO NOT** remove existing env-based configuration - it's still valid for explicit overrides
5. **DO NOT** skip fallback chain for simple/medium tiers - errors should escalate gracefully
6. **DO NOT** ignore the existing `createLLMClientWithFallback()` - extend it to support tiers

### Performance Expectations

| Complexity | Model | Expected TTFT | Token Context |
|------------|-------|---------------|---------------|
| Simple | gemini-2.0-flash-lite | <500ms | ~500 tokens max |
| Medium | gemini-2.5-pro | <3s | ~2000 tokens max |
| Complex | claude-sonnet-4 | 5-15s | ~4096 tokens max |

### References

- [Source: manda-app/lib/agent/intent.ts:199-207] - MODEL_BY_COMPLEXITY constant
- [Source: manda-app/lib/llm/client.ts:98-120] - createLLMClient function
- [Source: manda-app/lib/llm/client.ts:152-174] - createLLMClientWithFallback function
- [Source: manda-app/lib/llm/config.ts:44-49] - TOKEN_COSTS constant
- [Source: manda-app/lib/llm/config.ts:134-166] - getLLMConfig function
- [Source: manda-app/lib/agent/executor.ts:140-190] - createChatAgent function
- [Source: manda-app/app/api/projects/[id]/chat/route.ts:194-210] - Chat route complexity integration
- [Source: manda-processing/config/models.yaml] - Python model configuration (for reference)
- [Source: docs/sprint-artifacts/epics/epic-E13.md#E13.3] - Epic requirements
- [Source: docs/sprint-artifacts/stories/e13-1-enhanced-intent-classification.md] - E13.1 implementation
- [Source: docs/sprint-artifacts/stories/e13-2-tier-based-tool-loading.md] - E13.2 implementation

### Previous Story Learnings (E13.1, E13.2)

From E13.1 implementation:
- **Pattern:** Add optional parameters for backward compatibility
- **Pattern:** Export helper functions for API clarity
- **Pattern:** Create comprehensive tests for each tier combination

From E13.2 implementation:
- **Pattern:** Integrate with chat route by passing config through agent creation
- **Pattern:** Add HTTP headers for debugging (X-Tool-Tier, X-Tool-Count)
- **Pattern:** Log tier selection for LangSmith tracing
- **Lesson:** Fix any constants that reference wrong values (E13.1 had wrong tool names)

### Model Verification Checklist (Task 0)

**CRITICAL: Complete before writing any code!**

Before implementation, verify these model names are current:
- [ ] `gemini-2.0-flash-lite` - **HIGH RISK**: Verify exact model name via Google AI Studio
  - Alternative names to check: `gemini-2.0-flash-exp`, `gemini-2.0-flash`, `gemini-flash-lite`
  - Run: `curl -s "https://generativelanguage.googleapis.com/v1/models?key=$GOOGLE_AI_API_KEY" | jq '.models[].name'`
- [ ] `gemini-2.5-pro` - Verify this is current (not deprecated to gemini-2.5-flash)
- [ ] `claude-sonnet-4-20250514` - Verify this model ID matches Anthropic API
  - Note: E13.1 uses this, config.ts uses `claude-sonnet-4-5-20250929` - **MUST ALIGN**

**If model name differs from story:**
1. Update `MODEL_BY_COMPLEXITY` in `manda-app/lib/agent/intent.ts`
2. Update this story document
3. Update `MODEL_ROUTING_CONFIG` in new `routing.ts`

**Verification Resources:**
- Google AI Studio Models: https://ai.google.dev/gemini-api/docs/models
- Google Pricing: https://ai.google.dev/pricing
- Anthropic Models: https://docs.anthropic.com/claude/docs/models-overview
- Anthropic Pricing: https://www.anthropic.com/pricing

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Model verification via WebFetch to Google AI docs and Anthropic pricing
- TypeScript compilation verified via npm run type-check
- Tests verified via npm run test:run (36 tests passing)

### Completion Notes List

1. **Model Names Verified**: `gemini-2.0-flash-lite`, `gemini-2.5-pro`, and `claude-sonnet-4-20250514` confirmed via official docs
2. **Pricing Correction**: gemini-2.5-pro output is $10/MTok (not $5/MTok as in original story)
3. **Cost Savings**: Simple tier achieves ~98% savings vs complex (verified in tests)
4. **Backward Compatibility**: Undefined complexity defaults to 'complex' tier (Claude Sonnet)
5. **Graceful Degradation**: Missing Google API key → falls back to Claude; Missing Anthropic key → falls back to Gemini Pro

### File List

**New Files:**
- `manda-app/lib/llm/routing.ts` - Model routing functions
- `manda-app/__tests__/lib/llm/routing.test.ts` - 36 comprehensive tests

**Modified Files:**
- `manda-app/lib/llm/config.ts` - Added `TOKEN_COSTS_BY_MODEL`, `getTokenCosts()`, `calculateModelCost()`
- `manda-app/lib/llm/client.ts` - Added `complexity` parameter, updated fallback logic
- `manda-app/lib/llm/index.ts` - Exported new routing functions
- `manda-app/lib/agent/executor.ts` - Pass complexity to LLM client, added `selectedModel`/`selectedProvider` to response
- `manda-app/app/api/projects/[id]/chat/route.ts` - Added `X-Model-Used` header, model info in usage logs

