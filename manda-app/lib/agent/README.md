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
├── cim-mvp/           # CIM Builder - ACTIVE MVP
│   ├── graph.ts       # LangGraph StateGraph
│   ├── state.ts       # CIM-specific state
│   ├── tools.ts       # CIM tools (save_buyer_persona, create_outline, etc.)
│   ├── prompts.ts     # System prompts
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

## Future Work

- **Story 6.1:** Integrate CIM into v2 agent graph
  - Implement `v2/nodes/cim/phase-router.ts`
  - Route CIM requests through unified v2 graph
  - Deprecate standalone `cim-mvp/` implementation
