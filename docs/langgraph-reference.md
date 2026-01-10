# LangGraph Reference Guide

**Last Updated:** 2026-01-09
**Purpose:** Quick reference for LangGraph patterns used in Manda Agent System
**Source:** LangGraph Documentation (langchain-ai.github.io/langgraph)

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [State Management](#state-management)
3. [Checkpointing & Persistence](#checkpointing--persistence)
4. [Human-in-the-Loop](#human-in-the-loop)
5. [Tool Calling & ReAct](#tool-calling--react)
6. [Multi-Agent Patterns](#multi-agent-patterns)
7. [Streaming](#streaming)
8. [Memory Management](#memory-management)
9. [Production Patterns](#production-patterns)

---

## Core Concepts

### What is LangGraph?

LangGraph is a **low-level orchestration framework** for building stateful, multi-step AI agents. Key capabilities:

- **Durable Execution** - Agents persist through failures and resume from interruption points
- **Human-in-the-Loop** - Inspect and modify agent state at any point
- **Comprehensive Memory** - Short-term (conversation) and long-term (cross-session)
- **Streaming** - Token-by-token output with multiple modes

### Fundamental Building Blocks

```
┌─────────────────────────────────────────────────────────────┐
│                      StateGraph                             │
├─────────────────────────────────────────────────────────────┤
│  STATE: Shared data structure (TypedDict/Pydantic)         │
│    ↓                                                        │
│  NODES: Functions that receive state, return updates        │
│    ↓                                                        │
│  EDGES: Transitions between nodes (normal or conditional)   │
│    ↓                                                        │
│  CHECKPOINTER: Persistence layer for state snapshots        │
└─────────────────────────────────────────────────────────────┘
```

### Basic Graph Structure (TypeScript)

```typescript
import { StateGraph, START, END, Annotation, messagesStateReducer } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

// 1. Define State with reducers
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  context: Annotation<string>({
    reducer: (_, incoming) => incoming,
    default: () => '',
  }),
})

// 2. Define Nodes (functions)
async function processNode(state: typeof AgentState.State) {
  // Process state, return updates
  return { context: 'processed' }
}

// 3. Build Graph
const workflow = new StateGraph(AgentState)
  .addNode('process', processNode)
  .addEdge(START, 'process')
  .addEdge('process', END)

// 4. Compile with checkpointer
const graph = workflow.compile({ checkpointer })
```

---

## State Management

### Reducers

Reducers define how state updates are applied:

```typescript
// REPLACE: New value replaces old (default behavior)
context: Annotation<string>({
  reducer: (_, incoming) => incoming,
  default: () => '',
})

// APPEND: New values are appended (for messages)
messages: Annotation<BaseMessage[]>({
  reducer: messagesStateReducer,  // Built-in for messages
  default: () => [],
})

// CUSTOM: Merge or transform
metadata: Annotation<Record<string, unknown>>({
  reducer: (existing, incoming) => ({ ...existing, ...incoming }),
  default: () => ({}),
})
```

### MessagesState Pattern

Use the built-in `messagesStateReducer` for conversation history:

```typescript
import { messagesStateReducer } from '@langchain/langgraph'
import { HumanMessage, AIMessage } from '@langchain/core/messages'

const ConversationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
})

// Messages are automatically appended
// ID-based updates replace existing messages with same ID
```

---

## Checkpointing & Persistence

### Storage Options

| Storage | Package | Use Case |
|---------|---------|----------|
| **In-Memory** | `@langchain/langgraph` | Development, testing |
| **PostgreSQL** | `@langchain/langgraph-checkpoint-postgres` | Production (recommended) |
| **SQLite** | `@langchain/langgraph-checkpoint-sqlite` | Local development |

### PostgreSQL Checkpointer (Production)

```typescript
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

// Create checkpointer
const checkpointer = PostgresSaver.fromConnString(
  process.env.DATABASE_URL!
)

// Initialize tables (run once)
await checkpointer.setup()

// Compile graph with checkpointer
const graph = workflow.compile({ checkpointer })

// Invoke with thread_id for persistence
const config = { configurable: { thread_id: 'user-123-session-1' } }
const result = await graph.invoke(input, config)
```

### Thread ID Patterns

```typescript
// User session
{ thread_id: `user-${userId}-${sessionId}` }

// Deal-specific conversation
{ thread_id: `deal-${dealId}-chat` }

// Workflow instance
{ thread_id: `cim-${dealId}-${cimId}` }
```

### Accessing State History

```typescript
// Get current state
const state = await graph.getState(config)

// Get full history
for await (const snapshot of graph.getStateHistory(config)) {
  console.log(snapshot.values)
  console.log(snapshot.next)  // Next nodes to execute
}

// Update state manually
await graph.updateState(config, { context: 'new value' })
```

---

## Human-in-the-Loop

### The interrupt() Pattern

Use `interrupt()` to pause execution and wait for human input:

```typescript
import { interrupt } from '@langchain/langgraph'

async function approvalNode(state: AgentState) {
  // Do some work
  const proposal = generateProposal(state)

  // Pause and wait for human approval
  const approval = await interrupt({
    type: 'approval',
    proposal,
    prompt: 'Do you approve this action?'
  })

  if (approval.approved) {
    return { status: 'approved', result: executeAction(proposal) }
  } else {
    return { status: 'rejected', reason: approval.reason }
  }
}
```

### Resuming After Interrupt

```typescript
import { Command } from '@langchain/langgraph'

// Initial invocation - will pause at interrupt
const result1 = await graph.invoke(input, config)
// result1.__interrupt__ contains the interrupt payload

// Resume with user response
const result2 = await graph.invoke(
  new Command({ resume: { approved: true } }),
  config
)
```

### Common Interrupt Patterns

```typescript
// Approval workflow
const approval = await interrupt({
  type: 'approval',
  action: proposedAction,
  prompt: 'Approve this API call?'
})

// Review and edit
const edited = await interrupt({
  type: 'edit',
  draft: generatedContent,
  prompt: 'Review and edit the content'
})

// Multi-choice selection
const choice = await interrupt({
  type: 'choice',
  options: ['Option A', 'Option B', 'Option C'],
  prompt: 'Which approach should we take?'
})
```

---

## Tool Calling & ReAct

### Binding Tools to LLM

```typescript
import { tool } from '@langchain/core/tools'
import { ChatAnthropic } from '@langchain/anthropic'
import { z } from 'zod'

// Define tool with Zod schema
const searchTool = tool(
  async ({ query }) => {
    // Search implementation
    return await searchKnowledgeBase(query)
  },
  {
    name: 'search_knowledge',
    description: 'Search the knowledge base for relevant information',
    schema: z.object({
      query: z.string().describe('The search query'),
    }),
  }
)

// Bind tools to LLM
const llm = new ChatAnthropic({ model: 'claude-sonnet-4-20250514' })
const llmWithTools = llm.bindTools([searchTool])
```

### ReAct Agent Pattern

```typescript
import { ToolNode } from '@langchain/langgraph/prebuilt'

// Create tool node
const toolNode = new ToolNode([searchTool, analysisTool])

// Agent node - LLM decides whether to use tools
async function agentNode(state: AgentState) {
  const response = await llmWithTools.invoke(state.messages)
  return { messages: [response] }
}

// Router - check if LLM wants to call tools
function shouldContinue(state: AgentState) {
  const lastMessage = state.messages[state.messages.length - 1]
  if (lastMessage.tool_calls?.length > 0) {
    return 'tools'
  }
  return 'end'
}

// Build ReAct graph
const graph = new StateGraph(AgentState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    end: END,
  })
  .addEdge('tools', 'agent')
  .compile({ checkpointer })
```

### Prebuilt ReAct Agent

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt'

const agent = createReactAgent({
  llm,
  tools: [searchTool, analysisTool],
  messageModifier: systemPrompt,
})

const result = await agent.invoke({
  messages: [new HumanMessage('What is the revenue?')]
})
```

---

## Multi-Agent Patterns

### Supervisor Pattern

One agent routes to specialized agents:

```typescript
const SupervisorState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  next: Annotation<string>({
    reducer: (_, incoming) => incoming,
    default: () => '',
  }),
})

async function supervisorNode(state: typeof SupervisorState.State) {
  const routingLLM = llm.bindTools([routingTool])
  const result = await routingLLM.invoke(state.messages)
  const next = result.tool_calls?.[0]?.args?.next ?? 'end'
  return { next, messages: [result] }
}

const graph = new StateGraph(SupervisorState)
  .addNode('supervisor', supervisorNode)
  .addNode('researcher', researcherAgent)
  .addNode('analyst', analystAgent)
  .addNode('writer', writerAgent)
  .addEdge(START, 'supervisor')
  .addConditionalEdges('supervisor', (state) => state.next, {
    researcher: 'researcher',
    analyst: 'analyst',
    writer: 'writer',
    end: END,
  })
  .addEdge('researcher', 'supervisor')
  .addEdge('analyst', 'supervisor')
  .addEdge('writer', 'supervisor')
```

### Handoff Pattern with Command

```typescript
import { Command } from '@langchain/langgraph'

async function researcherNode(state: AgentState) {
  const result = await doResearch(state)

  if (needsAnalysis(result)) {
    return new Command({
      update: { research: result },
      goto: 'analyst',  // Handoff to analyst
    })
  }

  return { research: result }
}
```

### Subgraphs

```typescript
// Create specialized subgraph
const researchGraph = new StateGraph(ResearchState)
  .addNode('search', searchNode)
  .addNode('summarize', summarizeNode)
  .addEdge(START, 'search')
  .addEdge('search', 'summarize')
  .addEdge('summarize', END)
  .compile()

// Use as node in parent graph
const parentGraph = new StateGraph(ParentState)
  .addNode('research', researchGraph)  // Subgraph as node
  .addNode('analyze', analyzeNode)
  .addEdge(START, 'research')
  .addEdge('research', 'analyze')
  .addEdge('analyze', END)
```

---

## Streaming

### Stream Modes

```typescript
// VALUES: Full state after each step
for await (const chunk of graph.stream(input, { streamMode: 'values' })) {
  console.log('Full state:', chunk)
}

// UPDATES: Only deltas after each step
for await (const chunk of graph.stream(input, { streamMode: 'updates' })) {
  console.log('Updates:', chunk)
}

// MESSAGES: Token-by-token LLM streaming
for await (const event of graph.stream(input, { streamMode: 'messages' })) {
  if (event[1]?.type === 'message_token') {
    process.stdout.write(event[1].content)
  }
}
```

### streamEvents for Full Control

```typescript
for await (const event of graph.streamEvents(input, { version: 'v2' })) {
  switch (event.event) {
    case 'on_chat_model_stream':
      // Token streaming
      const content = event.data?.chunk?.content
      if (content) callbacks.onToken(content)
      break

    case 'on_tool_start':
      callbacks.onToolStart(event.name, event.data?.input)
      break

    case 'on_tool_end':
      callbacks.onToolEnd(event.name, event.data?.output)
      break
  }
}
```

---

## Memory Management

### Short-Term Memory (Thread-Scoped)

Conversation history within a session, managed via checkpointer:

```typescript
// Same thread_id = same conversation
const config = { configurable: { thread_id: 'user-123-session-1' } }

// First message
await graph.invoke({ messages: [new HumanMessage('Hello')] }, config)

// Second message - remembers first
await graph.invoke({ messages: [new HumanMessage('What did I just say?')] }, config)
```

### Long-Term Memory (Cross-Session)

Use external store for persistent user data:

```typescript
import { BaseStore } from '@langchain/langgraph'

// Store user preferences across sessions
async function loadUserContext(userId: string) {
  const profile = await store.get(`user:${userId}:profile`)
  const preferences = await store.get(`user:${userId}:preferences`)
  return { profile, preferences }
}

// Save learned information
async function updateUserMemory(userId: string, newInfo: object) {
  await store.put(`user:${userId}:memory`, newInfo)
}
```

### Context Window Management

```typescript
function pruneMessages(messages: BaseMessage[], maxTokens: number = 10000) {
  let total = 0
  const kept: BaseMessage[] = []

  // Keep recent messages within token limit
  for (const msg of [...messages].reverse()) {
    const tokens = estimateTokens(msg.content)
    if (total + tokens > maxTokens) break
    kept.unshift(msg)
    total += tokens
  }

  return kept
}

async function agentNode(state: AgentState) {
  const recentMessages = pruneMessages(state.messages)
  const response = await llm.invoke(recentMessages)
  return { messages: [response] }
}
```

---

## Production Patterns

### Directory Structure

```
lib/agent/
├── orchestrator/
│   ├── index.ts          # Module exports
│   ├── state.ts          # State definitions
│   ├── graph.ts          # Main graph construction
│   ├── router.ts         # Routing logic
│   └── nodes/
│       ├── agent.ts      # Main agent node
│       ├── tools.ts      # Tool execution node
│       └── specialists/  # Specialist subagraphs
├── tools/
│   ├── index.ts          # Tool exports
│   ├── knowledge.ts      # Knowledge base tools
│   ├── analysis.ts       # Analysis tools
│   └── schemas.ts        # Zod schemas
├── memory/
│   ├── checkpointer.ts   # PostgreSQL checkpointer setup
│   └── store.ts          # Long-term memory store
└── config.ts             # LLM and agent configuration
```

### Error Handling

```typescript
async function resilientNode(state: AgentState) {
  try {
    const result = await riskyOperation(state)
    return { result, error: null }
  } catch (error) {
    console.error('Node error:', error)
    return {
      error: error.message,
      retryCount: (state.retryCount ?? 0) + 1,
    }
  }
}

// Conditional retry logic
function shouldRetry(state: AgentState) {
  if (state.error && state.retryCount < 3) {
    return 'retry'
  }
  return state.error ? 'error_handler' : 'next'
}
```

### Configuration

```typescript
// config.ts
export const agentConfig = {
  checkpointer: {
    connectionString: process.env.DATABASE_URL,
    tableName: 'langgraph_checkpoints',
  },

  llm: {
    primary: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    },
    fallback: {
      provider: 'openai',
      model: 'gpt-4o',
    },
  },

  memory: {
    maxMessages: 50,
    summarizeAfter: 20,
    contextWindowTokens: 10000,
  },
}
```

---

## Quick Reference

### When to Use Each Feature

| Feature | Use When |
|---------|----------|
| **StateGraph** | Multi-step workflows with explicit control flow |
| **createReactAgent** | Simple tool-calling agent |
| **interrupt()** | Need human approval/input |
| **Subgraphs** | Modular agents, specialists |
| **PostgresSaver** | Production persistence |
| **Command** | Dynamic routing with state updates |

### Common Gotchas

1. **Checkpointer required for memory** - Without a checkpointer, state is lost between invocations
2. **thread_id is required** - Must pass `configurable.thread_id` for persistence
3. **Reducers matter** - Default behavior replaces state; use `messagesStateReducer` for messages
4. **interrupt() is async** - The graph pauses and must be resumed with `Command({ resume })`
5. **Streaming modes are exclusive** - Can only use one mode per stream call

### Useful Links

- [LangGraph Concepts](https://langchain-ai.github.io/langgraph/concepts/)
- [LangGraph How-Tos](https://langchain-ai.github.io/langgraph/how-tos/)
- [LangGraph TypeScript SDK](https://langchain-ai.github.io/langgraphjs/)
- [LangGraph Studio](https://github.com/langchain-ai/langgraph-studio)

---

## Advanced: Durable Execution & Fault Tolerance

### Durable Execution Modes

LangGraph offers three durability modes:

| Mode | Persistence Timing | Use Case |
|------|-------------------|----------|
| **"exit"** | Only when execution ends | High performance, limited recovery |
| **"async"** | Asynchronously between steps | Balanced (recommended) |
| **"sync"** | Before each step | Maximum durability |

### Automatic Resume After Failure

```typescript
// If a node fails, the graph can resume from the last checkpoint
try {
  await graph.invoke(input, config)
} catch (error) {
  // Retry will resume from last successful checkpoint
  await graph.invoke(null, config) // Pass null to resume
}
```

### Idempotency Pattern

For operations that shouldn't run twice (payments, API calls):

```typescript
import crypto from 'crypto'

async function idempotentNode(state: AgentState) {
  // Generate deterministic key BEFORE operation
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${state.userId}_${state.orderId}`)
    .digest('hex')

  // Check if already processed
  const existing = await redis.get(`processed:${idempotencyKey}`)
  if (existing) {
    return { status: 'already_processed', result: JSON.parse(existing) }
  }

  // Execute operation
  const result = await processPayment(state)

  // Mark as processed
  await redis.set(`processed:${idempotencyKey}`, JSON.stringify(result), 'EX', 86400)

  return { status: 'success', result }
}
```

---

## Advanced: Time Travel Debugging

### Replay from Any Checkpoint

```typescript
// Get execution history
const history = []
for await (const snapshot of graph.getStateHistory(config)) {
  history.push(snapshot)
}

// Find a specific checkpoint
const targetCheckpoint = history.find(s => s.values.step === 'before_error')

// Replay from that point
const result = await graph.invoke(null, {
  configurable: {
    thread_id: config.configurable.thread_id,
    checkpoint_id: targetCheckpoint.config.configurable.checkpoint_id,
  },
})
```

### Fork Execution for "What-If" Analysis

```typescript
// Get state at specific point
const pastState = await graph.getState({
  configurable: {
    thread_id: 'original-thread',
    checkpoint_id: 'checkpoint-before-decision',
  },
})

// Modify state for alternative path
const modifiedState = {
  ...pastState.values,
  decision: 'alternative_choice',
}

// Run alternative execution with new thread
await graph.updateState(
  { configurable: { thread_id: 'fork-thread' } },
  modifiedState
)

const alternativeResult = await graph.invoke(null, {
  configurable: { thread_id: 'fork-thread' },
})
```

---

## Advanced: Memory Types

### Three Memory Categories

| Type | Purpose | Storage | Example |
|------|---------|---------|---------|
| **Semantic** | Facts about users/entities | Key-value store | "User prefers formal tone" |
| **Episodic** | Past experiences | Searchable index | Previous successful resolutions |
| **Procedural** | Rules & instructions | System prompts | Refined agent behaviors |

### Semantic Memory (User Profiles)

```typescript
// Store in external database (Redis/PostgreSQL)
async function updateUserProfile(userId: string, info: object) {
  await store.put(`user:${userId}:profile`, {
    ...await store.get(`user:${userId}:profile`),
    ...info,
    updatedAt: new Date().toISOString(),
  })
}

// Load before LLM invocation
async function agentNode(state: AgentState) {
  const profile = await store.get(`user:${state.userId}:profile`)

  const systemPrompt = `
    You're talking to ${profile.name}.
    Communication style: ${profile.preferences.style}
    Recent context: ${profile.recentTopics.join(', ')}
  `

  return await llm.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ])
}
```

### Episodic Memory (Few-Shot Examples)

```typescript
// Store successful interactions
async function storeEpisode(userId: string, episode: object) {
  const episodes = await store.get(`user:${userId}:episodes`) || []
  episodes.push({ ...episode, timestamp: Date.now() })

  // Keep only last 100 episodes
  if (episodes.length > 100) episodes.shift()

  await store.put(`user:${userId}:episodes`, episodes)
}

// Retrieve similar past experiences
async function getFewShotExamples(userId: string, currentTask: string) {
  const episodes = await store.get(`user:${userId}:episodes`) || []

  // Find similar episodes (could use embedding similarity)
  const similar = episodes
    .filter(e => e.taskType === currentTask)
    .slice(-3) // Last 3 similar

  return similar.map(e => `
Example: ${e.input}
Successful approach: ${e.approach}
Outcome: ${e.outcome}
  `).join('\n')
}
```

---

## Advanced: Hierarchical Multi-Agent

### When to Use Hierarchy

- Worker complexity exceeds single supervisor capacity
- Worker count > 5 agents
- Logical task groupings exist

### Architecture Pattern

```
User Input
    ↓
Top Supervisor (routes to domains)
    ├─→ Research Supervisor
    │   ├─→ Literature Worker
    │   ├─→ Data Worker
    │   └─→ Analysis Worker
    ├─→ Financial Supervisor
    │   ├─→ Modeling Worker
    │   └─→ Forecast Worker
    └─→ Summary Worker (synthesis)
```

### Implementation

```typescript
// Create specialized supervisor subgraph
const researchSupervisor = new StateGraph(SupervisorState)
  .addNode('route', researchRouterNode)
  .addNode('literature', literatureAgent)
  .addNode('data', dataAgent)
  .addNode('analysis', analysisAgent)
  .addEdge(START, 'route')
  .addConditionalEdges('route', selectWorker)
  .compile()

// Parent graph uses supervisor as node
const topLevelGraph = new StateGraph(TopState)
  .addNode('top_router', topRouterNode)
  .addNode('research', researchSupervisor) // Subgraph
  .addNode('financial', financialSupervisor) // Subgraph
  .addNode('synthesize', synthesisNode)
  .addEdge(START, 'top_router')
  .addConditionalEdges('top_router', selectDomain)
  .addEdge('research', 'synthesize')
  .addEdge('financial', 'synthesize')
  .addEdge('synthesize', END)
```

---

## Manda-Specific: Current Infrastructure

### Existing Redis Cache

From `lib/cache/redis-cache.ts`:

```typescript
import { RedisCache } from '@/lib/cache/redis-cache'

// Tool result caching (30min TTL, 50 entries)
const toolCache = new RedisCache<ToolResult>('cache:tool:', 1800, 50)

// Retrieval caching (5min TTL, 100 entries)
const retrievalCache = new RedisCache<RetrievalResult>('cache:retrieval:', 300, 100)

// Summarization caching (30min TTL, 50 entries)
const summaryCache = new RedisCache<string>('cache:summary:', 1800, 50)
```

### Existing PostgreSQL Checkpointer

From `lib/agent/checkpointer.ts`:

```typescript
import { getCheckpointer } from '@/lib/agent/checkpointer'

// Get singleton checkpointer (PostgresSaver or MemorySaver fallback)
const checkpointer = await getCheckpointer()

// Thread ID patterns
const cimThreadId = createCIMThreadId(dealId, cimId)  // cim-{dealId}-{cimId}
const supervisorThreadId = createSupervisorThreadId(dealId)  // supervisor-{dealId}-{ts}
```

### LangSmith Trace Analysis

Recent traces show:

| Issue | Evidence | Root Cause |
|-------|----------|------------|
| Memory loss | `chatHistory: []` in all outputs | No checkpointing for chat |
| Wrong routing | "what was first question" → retrieval | Regex pattern too broad |
| Always Q&A fallback | Same response for all retrievals | System prompt hardcoded |

---

## Decision Matrix: Feature Selection

| Requirement | Feature | Priority |
|-------------|---------|----------|
| Remember conversation | PostgresSaver + thread_id | **P0** |
| Natural tool use | LLM routing (not regex) | **P0** |
| Handle greetings | Vanilla path (working) | Done |
| Knowledge retrieval | Graphiti integration | **P1** |
| Human approval | interrupt() pattern | **P2** |
| Multi-agent | Supervisor + subgraphs | **P2** |
| Multimodal | Vision model binding | **P2** |
| Long-term memory | Redis/PostgreSQL store | **P3** |
