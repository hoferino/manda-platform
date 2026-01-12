# CIM MVP Fast Track - Dev Handoff

**Date:** 2026-01-11
**Branch:** `cim-mvp-fast-track`
**Working Directory:** `/Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform-mvp`
**Proposal:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-01-11.md`

---

## Overview

Build a simplified CIM workflow for immediate user testing. This is a **parallel track** - the main codebase remains untouched.

**The Flow:**
```
1. manda-analyze (IDE skill) → JSON knowledge file
2. Simple CIM agent (UI) → reads JSON + source docs + web search
3. Existing CIM UI → wired to simple agent
4. Preview → updates in real-time as slides are created
```

---

## Task 1: Improve manda-analyze Skill

**File:** `.claude/commands/manda-analyze.md`

**Goal:** Output comprehensive JSON (not Markdown) that the CIM agent can consume.

**Changes:**

1. Change output format from Markdown to JSON
2. Expand extraction to be comprehensive (everything, user decides relevance)
3. Structure by CIM sections
4. Include source attribution for EVERY finding
5. Output location: `data/{company}/knowledge.json`

**JSON Schema:**

```json
{
  "metadata": {
    "analyzed_at": "2026-01-11T12:00:00Z",
    "documents": [
      {"name": "company-overview.pdf", "pages": 12},
      {"name": "financials.xlsx", "sheets": 3}
    ],
    "company_name": "Acme Corp",
    "data_sufficiency_score": 78
  },
  "sections": {
    "executive_summary": {
      "findings": [
        {
          "id": "es-001",
          "content": "Acme Corp is a B2B SaaS company founded in 2018...",
          "source": {"document": "company-overview.pdf", "location": "page 1"},
          "confidence": "high",
          "category": "company_description"
        }
      ]
    },
    "company_overview": {
      "history": {
        "findings": [...]
      },
      "mission_vision": {
        "findings": [...]
      },
      "milestones": {
        "findings": [...]
      }
    },
    "management_team": {
      "executives": [
        {
          "name": "Jane Smith",
          "title": "CEO",
          "background": "...",
          "source": {"document": "...", "location": "..."}
        }
      ]
    },
    "products_services": {
      "findings": [...]
    },
    "market_opportunity": {
      "market_size": {...},
      "growth_drivers": {...},
      "target_segments": {...}
    },
    "business_model": {
      "revenue_model": {...},
      "pricing": {...},
      "unit_economics": {...}
    },
    "financial_performance": {
      "revenue": {...},
      "profitability": {...},
      "growth_metrics": {...},
      "historical_financials": [...]
    },
    "competitive_landscape": {
      "competitors": [...],
      "competitive_advantages": [...],
      "market_position": {...}
    },
    "growth_strategy": {
      "findings": [...]
    },
    "risk_factors": {
      "findings": [...]
    }
  },
  "raw_extractions": {
    "all_findings": [
      {
        "id": "raw-001",
        "content": "...",
        "source": {...},
        "extracted_from_section": "..."
      }
    ]
  }
}
```

**Key Principles:**
- Extract EVERYTHING - user decides what's relevant
- Every finding has a source citation
- Confidence levels: high, medium, low, inferred
- Raw extractions preserved for fallback queries

---

## Task 2: Create Simplified CIM Agent

**Location:** `manda-app/lib/agent/cim-mvp/`

**Files to Create:**

```
manda-app/lib/agent/cim-mvp/
├── index.ts           # Main export
├── graph.ts           # Simple LangGraph StateGraph
├── state.ts           # Minimal state schema
├── tools.ts           # Tool definitions
├── prompts.ts         # System prompts
└── knowledge-loader.ts # JSON file loading
```

### state.ts

```typescript
import { Annotation } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

// CIM phases matching the workflow
export type CIMPhase =
  | 'executive_summary'
  | 'company_overview'
  | 'management_team'
  | 'products_services'
  | 'market_opportunity'
  | 'business_model'
  | 'financial_performance'
  | 'competitive_landscape'
  | 'growth_strategy'
  | 'risk_factors'
  | 'appendix'

export interface SlideUpdate {
  slideId: string
  sectionId: string
  title: string
  components: SlideComponent[]
  status: 'draft' | 'approved'
}

export interface SlideComponent {
  id: string
  type: 'heading' | 'text' | 'bullet_list' | 'table' | 'chart' | 'metric'
  content: string
  data?: unknown
}

export const CIMMVPState = Annotation.Root({
  // Conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),

  // Knowledge context (loaded once)
  knowledgeLoaded: Annotation<boolean>({ default: () => false }),
  companyName: Annotation<string>({ default: () => '' }),

  // CIM workflow tracking
  currentPhase: Annotation<CIMPhase>({ default: () => 'executive_summary' }),
  completedPhases: Annotation<CIMPhase[]>({ default: () => [] }),

  // Slide outputs
  pendingSlideUpdate: Annotation<SlideUpdate | null>({ default: () => null }),

  // Sources for attribution
  sourcesUsed: Annotation<string[]>({ default: () => [] }),
})

export type CIMMVPStateType = typeof CIMMVPState.State
```

### tools.ts

```typescript
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

// Web search for market data, comps, etc.
export const webSearchTool = tool(
  async ({ query }) => {
    // Use Tavily or similar
    // Return search results
  },
  {
    name: 'web_search',
    description: 'Search the web for market data, competitor information, industry trends, or other external context not in the documents.',
    schema: z.object({
      query: z.string().describe('Search query'),
    }),
  }
)

// Read from source documents (fallback for specific questions)
export const readSourceTool = tool(
  async ({ documentName, query }) => {
    // Load document from project folder
    // Extract relevant section based on query
  },
  {
    name: 'read_source',
    description: 'Read from the original source documents when the JSON knowledge file lacks specific details. Use for exact quotes, specific numbers, or detailed context.',
    schema: z.object({
      documentName: z.string().describe('Name of the document to read'),
      query: z.string().describe('What information to look for'),
    }),
  }
)

// Create or update a slide
export const updateSlideTool = tool(
  async ({ sectionId, title, components }) => {
    // Returns structured slide data
    // UI will receive this via SSE and update preview
    return {
      slideId: `slide-${Date.now()}`,
      sectionId,
      title,
      components,
      status: 'draft',
    }
  },
  {
    name: 'update_slide',
    description: 'Create or update a CIM slide. Use this when you have gathered enough information to create slide content for a section.',
    schema: z.object({
      sectionId: z.string().describe('CIM section ID (e.g., executive_summary, company_overview)'),
      title: z.string().describe('Slide title'),
      components: z.array(z.object({
        type: z.enum(['heading', 'text', 'bullet_list', 'table', 'chart', 'metric']),
        content: z.string(),
        data: z.unknown().optional(),
      })).describe('Slide components'),
    }),
  }
)

// Navigate between CIM phases
export const navigatePhaseTool = tool(
  async ({ targetPhase, reason }) => {
    return { navigatedTo: targetPhase, reason }
  },
  {
    name: 'navigate_phase',
    description: 'Move to a different CIM section. Use when the user wants to skip ahead, go back, or when current section is complete.',
    schema: z.object({
      targetPhase: z.string().describe('Target CIM phase to navigate to'),
      reason: z.string().describe('Why navigating to this phase'),
    }),
  }
)

export const cimMVPTools = [
  webSearchTool,
  readSourceTool,
  updateSlideTool,
  navigatePhaseTool,
]
```

### graph.ts

```typescript
import { StateGraph, START, END } from '@langchain/langgraph'
import { ChatAnthropic } from '@langchain/anthropic'
import { CIMMVPState, type CIMMVPStateType } from './state'
import { cimMVPTools } from './tools'
import { getSystemPrompt } from './prompts'
import { loadKnowledge } from './knowledge-loader'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { AIMessage } from '@langchain/core/messages'

const model = new ChatAnthropic({
  modelName: 'claude-sonnet-4-20250514',
  temperature: 0.7,
}).bindTools(cimMVPTools)

// Load knowledge on first message
async function loadKnowledgeNode(state: CIMMVPStateType) {
  if (state.knowledgeLoaded) {
    return {} // Already loaded
  }

  const knowledge = await loadKnowledge() // Reads JSON file

  return {
    knowledgeLoaded: true,
    companyName: knowledge.metadata.company_name,
  }
}

// Main agent node
async function agentNode(state: CIMMVPStateType) {
  const systemPrompt = getSystemPrompt(state)

  const response = await model.invoke([
    { role: 'system', content: systemPrompt },
    ...state.messages,
  ])

  return {
    messages: [response],
  }
}

// Tool execution
const toolNode = new ToolNode(cimMVPTools)

// Routing logic
function shouldContinue(state: CIMMVPStateType) {
  const lastMessage = state.messages[state.messages.length - 1]

  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return 'tools'
  }
  return END
}

// Build the graph
const workflow = new StateGraph(CIMMVPState)
  .addNode('load_knowledge', loadKnowledgeNode)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'load_knowledge')
  .addEdge('load_knowledge', 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addEdge('tools', 'agent')

export const cimMVPGraph = workflow.compile({
  // Add checkpointer for conversation persistence
  // checkpointer: postgresCheckpointer,
})
```

### prompts.ts

```typescript
import type { CIMMVPStateType } from './state'

export function getSystemPrompt(state: CIMMVPStateType): string {
  const phaseInstructions = getPhaseInstructions(state.currentPhase)

  return `You are an expert M&A advisor helping create a Confidential Information Memorandum (CIM) for ${state.companyName || 'a company'}.

## Your Role
- Guide the user through CIM creation section by section
- Use the knowledge base (JSON) as your primary source
- Search the web for market context, comps, and industry data
- Fall back to source documents for specific details
- Create slides with clear, professional content

## Current Phase: ${state.currentPhase}
${phaseInstructions}

## Completed Phases: ${state.completedPhases.join(', ') || 'None yet'}

## Guidelines
1. **Be proactive** - Suggest what content to include based on the knowledge base
2. **Cite sources** - Always mention where information comes from
3. **Create slides** - Use update_slide when you have enough info for a section
4. **Ask clarifying questions** - If the user's intent is unclear
5. **Navigate flexibly** - User can skip ahead or go back anytime

## Knowledge Available
You have access to a comprehensive JSON knowledge file with extracted findings from all deal documents. Query it naturally - the information is organized by CIM section.

## Tools
- web_search: Get market data, competitor info, industry trends
- read_source: Access original documents for specific details
- update_slide: Create/update slide content (triggers preview update)
- navigate_phase: Move to different CIM section

Remember: You're building a professional CIM that will be shown to potential buyers. Quality and accuracy matter.`
}

function getPhaseInstructions(phase: string): string {
  const instructions: Record<string, string> = {
    executive_summary: `
Focus on:
- Company snapshot (what, when founded, key metrics)
- Investment highlights (3-5 compelling reasons)
- Financial summary (revenue, growth, profitability)
- Transaction rationale
Keep it concise - this is the hook.`,

    company_overview: `
Focus on:
- Company history and founding story
- Mission and vision
- Key milestones
- Corporate structure
- Geographic footprint`,

    management_team: `
Focus on:
- Executive bios (name, title, background)
- Years of experience
- Key achievements
- Board composition
- Organizational structure`,

    // ... add other phases
  }

  return instructions[phase] || 'Gather relevant information and create slides.'
}
```

### knowledge-loader.ts

```typescript
import { readFile } from 'fs/promises'
import path from 'path'

interface KnowledgeFile {
  metadata: {
    analyzed_at: string
    documents: Array<{ name: string; pages?: number; sheets?: number }>
    company_name: string
    data_sufficiency_score: number
  }
  sections: Record<string, unknown>
  raw_extractions: {
    all_findings: Array<{
      id: string
      content: string
      source: { document: string; location: string }
    }>
  }
}

let cachedKnowledge: KnowledgeFile | null = null

export async function loadKnowledge(projectPath?: string): Promise<KnowledgeFile> {
  if (cachedKnowledge) {
    return cachedKnowledge
  }

  // Default path - adjust based on your project structure
  const knowledgePath = projectPath
    ? path.join(projectPath, 'knowledge.json')
    : path.join(process.cwd(), 'data', 'test-company', 'knowledge.json')

  const content = await readFile(knowledgePath, 'utf-8')
  cachedKnowledge = JSON.parse(content)

  return cachedKnowledge!
}

export function getKnowledgeForSection(section: string): unknown {
  if (!cachedKnowledge) {
    throw new Error('Knowledge not loaded')
  }

  return cachedKnowledge.sections[section] || null
}

export function searchKnowledge(query: string): Array<{ content: string; source: string }> {
  if (!cachedKnowledge) {
    return []
  }

  // Simple keyword search across all findings
  const queryLower = query.toLowerCase()

  return cachedKnowledge.raw_extractions.all_findings
    .filter(f => f.content.toLowerCase().includes(queryLower))
    .map(f => ({
      content: f.content,
      source: `${f.source.document}, ${f.source.location}`,
    }))
}
```

---

## Task 3: Create MVP API Route

**File:** `manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cimMVPGraph } from '@/lib/agent/cim-mvp'
import { HumanMessage } from '@langchain/core/messages'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; cimId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { message, conversationId } = await request.json()

  // Thread ID for conversation persistence
  const threadId = conversationId || `cim-mvp:${params.cimId}:${Date.now()}`

  // Create SSE stream
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Run agent in background
  ;(async () => {
    try {
      const config = {
        configurable: { thread_id: threadId },
        streamMode: 'messages' as const,
      }

      const input = {
        messages: [new HumanMessage(message)],
      }

      for await (const event of await cimMVPGraph.stream(input, config)) {
        // Stream tokens
        if (event.messages) {
          const lastMessage = event.messages[event.messages.length - 1]
          if (lastMessage.content) {
            await writer.write(encoder.encode(
              `data: ${JSON.stringify({ type: 'token', content: lastMessage.content })}\n\n`
            ))
          }
        }

        // Stream slide updates
        if (event.pendingSlideUpdate) {
          await writer.write(encoder.encode(
            `data: ${JSON.stringify({ type: 'slide_update', slide: event.pendingSlideUpdate })}\n\n`
          ))
        }

        // Stream source citations
        if (event.sourcesUsed?.length) {
          await writer.write(encoder.encode(
            `data: ${JSON.stringify({ type: 'sources', sources: event.sourcesUsed })}\n\n`
          ))
        }
      }

      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'done', conversationId: threadId })}\n\n`
      ))
    } catch (error) {
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ type: 'error', message: String(error) })}\n\n`
      ))
    } finally {
      await writer.close()
    }
  })()

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

---

## Task 4: Wire UI to MVP Agent

### Update ConversationPanel

**File:** `manda-app/components/cim-builder/ConversationPanel/ConversationPanel.tsx`

Add support for MVP endpoint and slide update events:

```typescript
// Add prop for endpoint selection
interface ConversationPanelProps {
  projectId: string
  cimId: string
  // ... existing props
  useMVPAgent?: boolean // NEW: Toggle between v2 and MVP
}

// In the send message handler:
const endpoint = useMVPAgent
  ? `/api/projects/${projectId}/cims/${cimId}/chat-mvp`
  : `/api/projects/${projectId}/cims/${cimId}/chat`

// Handle SSE events including slide_update:
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'token':
      // Append to current message
      break
    case 'slide_update':
      // Notify parent to update preview
      onSlideUpdate?.(data.slide)
      break
    case 'sources':
      // Add source citations
      break
    case 'done':
      // Finalize message
      break
  }
}
```

### Update CIMBuilderPage

**File:** `manda-app/components/cim-builder/CIMBuilderPage.tsx`

Handle slide updates from agent:

```typescript
// Add state for real-time slide updates
const [slideUpdates, setSlideUpdates] = useState<Map<string, SlideUpdate>>(new Map())

// Handler for slide updates from agent
const handleSlideUpdate = useCallback((slide: SlideUpdate) => {
  setSlideUpdates(prev => {
    const next = new Map(prev)
    next.set(slide.slideId, slide)
    return next
  })

  // Also persist to backend
  // updateSlide(cimId, slide)
}, [])

// Merge slideUpdates with cim.slides for preview
const previewSlides = useMemo(() => {
  // Merge persisted slides with real-time updates
  // Real-time updates take precedence
}, [cim?.slides, slideUpdates])
```

---

## Task 5: Add Conversation Persistence

For the agent to remember where you left off, add a simple checkpointer:

**Option A: PostgresSaver (recommended)**
- Reuse existing `lib/agent/checkpointer.ts`
- Just wire it into the MVP graph

**Option B: File-based (simpler for sandbox)**
```typescript
// lib/agent/cim-mvp/file-checkpointer.ts
import { BaseCheckpointSaver } from '@langchain/langgraph'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

export class FileCheckpointer extends BaseCheckpointSaver {
  private dir: string

  constructor(dir: string = '.checkpoints') {
    super()
    this.dir = dir
  }

  async getTuple(config: { configurable: { thread_id: string } }) {
    const filePath = path.join(this.dir, `${config.configurable.thread_id}.json`)
    try {
      const data = await readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return undefined
    }
  }

  async put(config: { configurable: { thread_id: string } }, checkpoint: unknown) {
    await mkdir(this.dir, { recursive: true })
    const filePath = path.join(this.dir, `${config.configurable.thread_id}.json`)
    await writeFile(filePath, JSON.stringify(checkpoint, null, 2))
    return { configurable: config.configurable }
  }
}
```

---

## Testing Checklist

After implementation, verify:

- [ ] `manda-analyze` produces valid JSON at `data/{company}/knowledge.json`
- [ ] JSON contains all expected sections with source citations
- [ ] CIM MVP agent loads and uses the JSON knowledge
- [ ] Agent responds with context from the knowledge file
- [ ] Web search tool works for external queries
- [ ] `update_slide` tool creates slide data
- [ ] SSE stream delivers tokens and slide updates
- [ ] UI preview updates when slide_update event received
- [ ] Conversation persists across page refreshes
- [ ] Agent remembers current phase and progress

---

## Quick Start Commands

```bash
# Navigate to sandbox
cd /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform-mvp

# Install dependencies (if needed)
cd manda-app && npm install

# Start dev server
npm run dev

# Test manda-analyze first (in Claude Code IDE)
# Run /manda-analyze on your test documents

# Then test the CIM Builder UI
# Navigate to a project's CIM section
```

---

## Notes

- This is a **sandbox** - feel free to experiment
- Main codebase (`manda-platform/`) remains untouched
- Focus on getting a working end-to-end flow first
- Polish and edge cases come later
- When ready to merge, user will decide

---

## Session Updates: 2026-01-12

### UI/UX Improvements

#### 1. Instant Intro Message (Hardcoded)
**Problem:** Intro message took 10-18 seconds to load from LLM.
**Solution:** Hardcoded the intro message directly in `CIMMessageList.tsx` for instant display.

**File:** `manda-app/components/cim-builder/ConversationPanel/CIMMessageList.tsx`
```typescript
// Hardcoded intro message for instant display
const introMessage: ConversationMessage = {
  id: 'intro-message',
  role: 'assistant',
  content: `## Welcome to CIM Builder
I'll help you create a professional **Confidential Information Memorandum**...`,
  timestamp: new Date().toISOString(),
}

// Always prepend intro message so it stays visible during conversation
const displayMessages = [introMessage, ...messages]
```

#### 2. Fixed Scroll Area
**Problem:** Chat window wasn't scrollable.
**Solution:** Added `min-h-0` and `overflow-hidden` to flex containers.

**Files:**
- `CIMMessageList.tsx`: Added `min-h-0 overflow-hidden` to wrapper, `h-full` to ScrollArea
- `ConversationPanel.tsx`: Added `min-h-0 overflow-hidden` to both MVP and Standard panel containers

#### 3. Improved Markdown Rendering
**Problem:** Responses were a "wall of text" - hard to read.
**Solution:** Added custom ReactMarkdown components with proper styling.

**Features:**
- Styled headings (h1, h2, h3) with proper sizing and spacing
- Tables with borders, headers, and clean rows
- Lists with proper indentation
- Inline code with monospace font and background
- Better paragraph spacing with `leading-relaxed`

```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    h1: ({ children }) => <h1 className="text-lg font-bold border-b pb-1 mb-3">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    // ... more components
  }}
>
```

### Performance Improvements

#### 4. Switched from Reasoning Model to Fast Model
**Problem:** Responses took 12-18 seconds due to reasoning tokens (800-1800 per request).
**Solution:** Changed from `gpt-5-nano` (reasoning model) to `gpt-4o-mini`.

**File:** `manda-app/lib/agent/cim-mvp/graph.ts`
```typescript
// Before
const model = new ChatOpenAI({
  modelName: 'gpt-5-nano',
  // Note: gpt-5-nano only supports temperature=1
  maxTokens: 4096,
})

// After
const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 4096,
})
```

**Results (from LangSmith traces):**
| Metric | Before | After |
|--------|--------|-------|
| Duration | 12-18s | 5.5s |
| Reasoning tokens | 800-1800 | 0 |
| Cost | $0.0006-0.0009 | $0.0003 |

### Bug Fixes

#### 5. Removed First Message Greeting from System Prompt
**Problem:** Agent was generating its own intro message (duplicate of hardcoded one).
**Solution:** Removed the "First Message Greeting" instructions from `prompts.ts`.

**File:** `manda-app/lib/agent/cim-mvp/prompts.ts`
- Removed `isFirstMessage` check
- Removed `greetingInstructions` block

#### 6. Fixed Thread ID Isolation Per CIM
**Problem:** Different CIMs were sharing conversation history.
**Solution:** Made thread ID deterministic per CIM (removed `Date.now()`).

**File:** `manda-app/app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts`
```typescript
// Before - created new thread on each request
const threadId = conversationId || `cim-mvp:${cimId}:${Date.now()}`

// After - deterministic per CIM
const threadId = conversationId || `cim-mvp:${cimId}`
```

### Files Modified

| File | Changes |
|------|---------|
| `CIMMessageList.tsx` | Hardcoded intro, scroll fix, markdown styling |
| `ConversationPanel.tsx` | Scroll fix (`min-h-0 overflow-hidden`) |
| `prompts.ts` | Removed greeting instructions |
| `graph.ts` | Changed model to `gpt-4o-mini` |
| `route.ts` | Fixed thread ID format |

---

*Generated by BMAD Course Correction Workflow*
