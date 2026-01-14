# Agent System

Quick reference for agent implementations in the Manda platform.

## Current Implementations

| Feature | Directory | API Endpoint | Status |
|---------|-----------|--------------|--------|
| Chat | `v2/` | `/api/projects/[id]/chat` | Production |
| CIM Builder | `cim-mvp/` | `/api/projects/[id]/cims/[cimId]/chat-mvp` | **MVP (Active)** |

## Directory Guide

```
lib/agent/
├── cim-mvp/           # CIM Builder - ACTIVE MVP (v1.1.0)
│   ├── README.md      # Module documentation (NEW)
│   ├── graph.ts       # LangGraph StateGraph with post-tool processing
│   ├── state.ts       # CIM-specific state (Annotations)
│   ├── tools.ts       # CIM tools (12 tools including navigate_to_stage)
│   ├── prompts.ts     # v3 conversational prompts with stage instructions
│   └── knowledge-loader.ts  # JSON knowledge file loader
│
├── v2/                # Chat Agent - PRODUCTION
│   ├── graph.ts       # Single StateGraph
│   ├── state.ts       # Unified AgentState
│   ├── nodes/
│   │   ├── supervisor.ts    # Main routing node
│   │   ├── retrieval.ts     # Graphiti search
│   │   └── cim/
│   │       └── phase-router.ts  # PLACEHOLDER (Story 6.1)
│   └── middleware/
│       └── workflow-router.ts
│
├── cim/               # Original CIM - SUPERSEDED by cim-mvp
│
├── tools/             # Shared tool definitions
│
└── [other files]      # Shared utilities (streaming, checkpointer, etc.)
```

## API Endpoints

### CIM Builder (MVP)
```
POST /api/projects/[id]/cims/[cimId]/chat-mvp
GET  /api/projects/[id]/cims/[cimId]/chat-mvp  # Agent info
```

**Request:**
```json
{
  "message": "string",
  "stream": true,
  "knowledgePath": "optional/path/to/knowledge.json",
  "conversationId": "optional-thread-id"
}
```

**SSE Events:** `token`, `workflow_progress`, `outline_created`, `outline_updated`, `section_started`, `slide_update`, `sources`, `done`, `error`

### Chat (v2)
```
POST /api/projects/[id]/chat
```

**Request:**
```json
{
  "message": "string",
  "conversationId": "optional-uuid",
  "workflowMode": "chat"
}
```

**SSE Events:** `token`, `source_added`, `done`, `error`

## Usage Examples

### CIM MVP
```typescript
import { streamCIMMVP, executeCIMMVP } from '@/lib/agent/cim-mvp'

// Streaming
for await (const event of streamCIMMVP(message, threadId, knowledgePath)) {
  if (event.type === 'token') console.log(event.content)
}

// Non-streaming
const result = await executeCIMMVP(message, threadId, knowledgePath)
```

### v2 Chat
```typescript
import { streamAgentWithTokens, createInitialState, createV2ThreadId } from '@/lib/agent/v2'

const threadId = createV2ThreadId('chat', dealId, userId, conversationId)
const state = createInitialState('chat', dealId, userId)

for await (const event of streamAgentWithTokens(state, threadId)) {
  if (event.type === 'token') console.log(event.content)
}
```

## UI Integration

### CIM Builder Page
- **Component:** `components/cim-builder/CIMBuilderPage.tsx`
- **Hook:** `lib/hooks/useCIMMVPChat.ts`
- **Toggle:** MVP agent is default ON (line 124)

### Project Chat
- **Route:** `app/projects/[id]/chat/`
- **Hook:** Uses v2 agent via `/api/projects/[id]/chat`

## Recent Changes

### CIM MVP v1.1.0 (Current)
- **v3 Conversational Patterns**: Enhanced prompts for more natural interactions
  - One question at a time approach
  - Always explain why (connect to buyer/thesis)
  - Present options with equal detail
  - Wait for approval before proceeding
- **Non-Linear Navigation**: New `navigate_to_stage` tool allows jumping back to revise earlier decisions
- **Enhanced Documentation**: Added comprehensive JSDoc to all modules and new README

### Tool Changes
| Tool | Change |
|------|--------|
| `navigate_to_stage` | **NEW** - Jump to previous workflow stages |
| All prompt stages | Enhanced with v3 conversational patterns |
| `postToolNode` | Now handles navigation vs. advancement differently |

## Future Work

- **Story 6.1:** Integrate CIM into v2 agent graph
  - Implement `v2/nodes/cim/phase-router.ts`
  - Route CIM requests through unified v2 graph
  - Deprecate standalone `cim-mvp/` implementation
