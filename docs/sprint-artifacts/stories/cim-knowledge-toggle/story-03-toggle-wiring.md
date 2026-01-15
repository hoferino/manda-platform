# Story 3: Toggle Wiring

**Files:** `CIMBuilderPage.tsx`, `useCIMMVPChat.ts`, API route
**Estimate:** Small
**Dependencies:** Story 1, Story 2

---

## Overview

Wire the existing MVP toggle to control the knowledge source instead of switching between completely different implementations. The toggle becomes a "knowledge mode" selector:

- **Toggle ON:** Use JSON knowledge file (dev/testing mode)
- **Toggle OFF:** Use Graphiti/Neo4j (production mode)

## Current State

The toggle currently switches between two different hooks:

```typescript
// CIMBuilderPage.tsx
const [useMVPAgent, setUseMVPAgent] = React.useState(initialUseMVPAgent)

// ConversationPanel.tsx
if (useMVPAgent) {
  // Uses useCIMMVPChat hook with knowledgePath
} else {
  // Uses useCIMChat hook (v2 - different implementation)
}
```

## Target State

Both modes use the **same CIM MVP implementation**, just with different knowledge sources:

```typescript
// CIMBuilderPage.tsx
const [useJsonKnowledge, setUseJsonKnowledge] = React.useState(true) // Default to JSON for safety

// Pass knowledgeMode to hook
const { ... } = useCIMMVPChat({
  projectId,
  cimId,
  knowledgeMode: useJsonKnowledge ? 'json' : 'graphiti',
  knowledgePath: useJsonKnowledge ? '/data/test-company/knowledge.json' : undefined,
  dealId: useJsonKnowledge ? undefined : dealId,
})
```

## Tasks

- [x] 3.1 Rename `useMVPAgent` state to `useJsonKnowledge` in `CIMBuilderPage.tsx`
- [x] 3.2 Update toggle label from "MVP Agent" to "Dev Mode" or "JSON Knowledge"
- [x] 3.3 Add `knowledgeMode` prop to `useCIMMVPChat` hook
- [x] 3.4 Pass `knowledgeMode` to API route via request body
- [x] 3.5 Update API route to create `KnowledgeService` with correct mode
- [x] 3.6 Pass `KnowledgeService` instance to CIM graph initialization
- [x] 3.7 Update `knowledge_search` tool to use `KnowledgeService` instead of direct loader
- [x] 3.8 Add environment variable `CIM_DEFAULT_KNOWLEDGE_MODE` for production default
- [x] 3.9 Run `npm run type-check` - must pass
- [ ] 3.10 Test both modes manually

## Completion Notes

**Completed:** 2026-01-15
**Status:** Done (pending manual testing)

### Implementation Summary
- **CIMBuilderPage.tsx:**
  - Renamed `useMVPAgent` → `useJsonKnowledge`
  - Toggle label now shows "Dev Mode (JSON)" / "Live Data (Neo4j)"
  - Added readiness check on toggle to Graphiti mode
  - Added `NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE` env var support
- **useCIMMVPChat.ts:**
  - Added `knowledgeMode`, `dealId` props
  - Passes mode to API route in request body
- **chat-mvp/route.ts:**
  - Creates `KnowledgeService` based on mode
  - Sets global service for tools via `setGlobalKnowledgeService()`
  - Added input validation for knowledgeMode
- **tools.ts:**
  - `knowledgeSearchTool` and `getSectionContextTool` now use global `KnowledgeService`
  - Falls back to JSON loader if service not set
  - Added architecture documentation for global state pattern
- **ConversationPanel.tsx:**
  - Updated props to accept `knowledgeMode` and `dealId`

### Code Review Fixes Applied
- **CRITICAL FIX:** Added `NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE` environment variable (AC #6)
- **MEDIUM FIX:** Added input validation for `knowledgeMode` (rejects invalid values, defaults to 'json')
- **MEDIUM FIX:** Documented global state pattern with race condition caveats in tools.ts

### Architecture Decision
Used global singleton pattern for `KnowledgeService` instead of LangGraph configurable because LangChain tools don't have access to configurable state during execution. Documented trade-offs and future improvement path in tools.ts.

## Implementation

### 3.1-3.2 UI Changes (CIMBuilderPage.tsx)

```typescript
// Before
const [useMVPAgent, setUseMVPAgent] = React.useState(initialUseMVPAgent)

// After
const [useJsonKnowledge, setUseJsonKnowledge] = React.useState(
  process.env.NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE === 'true' ?? true
)

// Toggle UI
<Switch
  id="knowledge-mode-toggle"
  checked={useJsonKnowledge}
  onCheckedChange={setUseJsonKnowledge}
/>
<Label htmlFor="knowledge-mode-toggle" className="text-sm text-muted-foreground">
  {useJsonKnowledge ? 'JSON (Dev)' : 'Neo4j (Live)'}
</Label>
```

### 3.3-3.4 Hook Changes (useCIMMVPChat.ts)

```typescript
interface UseCIMMVPChatOptions {
  projectId: string
  cimId: string
  knowledgeMode: 'json' | 'graphiti'
  knowledgePath?: string // Required if mode === 'json'
  dealId?: string // Required if mode === 'graphiti'
  // ... existing options
}

// In sendMessage:
const response = await fetch(`/api/projects/${projectId}/cims/${cimId}/chat-mvp`, {
  method: 'POST',
  body: JSON.stringify({
    message,
    knowledgeMode,
    knowledgePath,
    dealId,
  }),
})
```

### 3.5-3.6 API Route Changes

```typescript
// app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts

import { createKnowledgeService, type KnowledgeMode } from '@/lib/agent/cim-mvp'

export async function POST(request: Request, { params }: { params: { id: string; cimId: string } }) {
  const { message, knowledgeMode, knowledgePath, dealId } = await request.json()

  // Create knowledge service based on mode
  const knowledgeService = createKnowledgeService({
    mode: knowledgeMode as KnowledgeMode,
    knowledgePath: knowledgeMode === 'json' ? knowledgePath : undefined,
    dealId: knowledgeMode === 'graphiti' ? dealId : undefined,
    groupId: knowledgeMode === 'graphiti' ? params.id : undefined, // projectId as groupId
  })

  // Pass to graph
  const graph = createCIMGraph({ knowledgeService })
  // ... rest of handler
}
```

### 3.7 Tool Changes (tools.ts)

```typescript
// Before: Direct knowledge-loader import
import { searchKnowledge } from './knowledge-loader'

export const knowledgeSearchTool = tool({
  // ...
  func: async ({ query, section }) => {
    const results = searchKnowledge(query, section)
    return results
  }
})

// After: Use KnowledgeService from state/context
export const knowledgeSearchTool = tool({
  // ...
  func: async ({ query, section }, config) => {
    const knowledgeService = config.knowledgeService as IKnowledgeService
    const results = await knowledgeService.search(query, { section })
    return results
  }
})
```

### 3.8 Environment Variable

```bash
# .env.local (development)
CIM_DEFAULT_KNOWLEDGE_MODE=json
NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE=true

# .env.production
CIM_DEFAULT_KNOWLEDGE_MODE=graphiti
NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE=false
```

## Acceptance Criteria

1. Toggle switches between JSON and Graphiti knowledge sources
2. Same CIM graph/prompts/tools used for both modes
3. JSON mode works identically to current MVP behavior
4. Graphiti mode queries live deal data
5. Toggle label clearly indicates current mode
6. Environment variable controls production default
7. `npm run type-check` passes

## Testing Checklist

Manual testing required:

- [ ] Toggle ON (JSON): Complete a CIM workflow with test company data
- [ ] Toggle OFF (Graphiti): Start a CIM workflow and verify it queries Neo4j
- [ ] Toggle switch mid-session: Verify graceful handling (may need session reset)
- [ ] No toggle visible in production when feature flag disabled (optional)

## Files to Modify

| File | Action |
|------|--------|
| `components/cim-builder/CIMBuilderPage.tsx` | MODIFY - Rename state, update toggle UI |
| `lib/hooks/useCIMMVPChat.ts` | MODIFY - Add knowledgeMode prop |
| `app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts` | MODIFY - Create KnowledgeService |
| `lib/agent/cim-mvp/tools.ts` | MODIFY - Use KnowledgeService in tool |
| `lib/agent/cim-mvp/graph.ts` | MODIFY - Accept KnowledgeService in config |
| `.env.local`, `.env.production` | MODIFY - Add default mode variables |

## Edge Cases

1. **No dealId in Graphiti mode:** Return error, don't allow CIM creation without deal context
2. **Empty Graphiti results:** Graceful degradation with "insufficient data" message (Story 4)
3. **Toggle mid-conversation:** May need to clear conversation or warn user about context change
