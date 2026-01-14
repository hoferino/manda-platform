# CIM MVP Agent

Workflow-based Confidential Information Memorandum (CIM) builder using LangGraph and Claude.

## Overview

The CIM MVP agent guides users through creating professional M&A documents via a structured, conversational workflow. It implements "v3 prototype patterns" for natural, collaborative interactions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CIM MVP Graph                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   START ──► agent ──► [tools] ──► post_tool ──► agent ──► END   │
│               │          │           │                           │
│               │          │           └─ State updates            │
│               │          └─ Tool execution                       │
│               └─ Model invocation + system prompt                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| File | Purpose |
|------|---------|
| `graph.ts` | LangGraph StateGraph definition with nodes and routing |
| `state.ts` | State type definitions using LangGraph Annotations |
| `tools.ts` | LangChain tool definitions (12 tools) |
| `prompts.ts` | System prompt construction and stage instructions |
| `knowledge-loader.ts` | JSON knowledge file loading and search |

## Workflow Stages

The CIM creation follows a 7-stage workflow:

```
1. welcome ──► 2. buyer_persona ──► 3. hero_concept ──► 4. investment_thesis
                                                              │
                                                              ▼
           7. complete ◄── 6. building_sections ◄── 5. outline
```

| Stage | Purpose | Key Tools |
|-------|---------|-----------|
| `welcome` | Greet user, explain process | None |
| `buyer_persona` | Identify target buyer | `save_buyer_persona` |
| `hero_concept` | Find company's unique story | `save_hero_concept` |
| `investment_thesis` | Create 3-part thesis | `save_hero_concept` |
| `outline` | Define CIM structure | `create_outline`, `update_outline` |
| `building_sections` | Build slides collaboratively | `start_section`, `update_slide` |
| `complete` | Celebrate and offer next steps | `navigate_to_stage` |

### Non-Linear Navigation

Users can jump back to previous stages using `navigate_to_stage`:

```typescript
// Jump back to revise buyer persona
navigate_to_stage({ targetStage: 'buyer_persona', reason: 'User wants to change target' })
```

This preserves completed stages while allowing revisions.

## Tools Reference

### Research Tools

| Tool | Description |
|------|-------------|
| `web_search` | External web search via Tavily API |
| `knowledge_search` | Search uploaded document knowledge base |
| `get_section_context` | Get all findings for a CIM section |

### Workflow Tools

| Tool | Description |
|------|-------------|
| `advance_workflow` | Move to the next workflow stage |
| `navigate_to_stage` | Jump back to a previous stage |
| `save_buyer_persona` | Save buyer type, motivations, concerns |
| `save_hero_concept` | Save hero concept and investment thesis |
| `create_outline` | Create CIM section structure |
| `update_outline` | Modify outline (add/remove/reorder) |
| `start_section` | Begin working on a specific section |

### Output Tools

| Tool | Description |
|------|-------------|
| `update_slide` | Create/update slides with layouts |
| `save_context` | Save gathered company information |

## Conversational Patterns

The agent implements v3 prototype patterns for natural conversation:

### Key Behaviors

1. **One Thing at a Time** - Ask one question, wait for answer, then continue
2. **Always Explain Why** - Connect requests to buyer context/thesis
3. **Present Options with Equal Detail** - All options get same level of specificity
4. **Wait for Approval** - Don't assume agreement, ask for confirmation
5. **Carry Context Forward** - Reference previous decisions naturally
6. **Celebrate Progress** - Acknowledge completed work

### Anti-Patterns to Avoid

- ❌ Don't dump all information at once
- ❌ Don't be vague (never say "strong metrics" without citing them)
- ❌ Don't proceed without user approval
- ❌ Don't forget buyer context when making suggestions
- ❌ Don't batch generate multiple slides

## Usage

### Basic Usage

```typescript
import { getCIMMVPGraph, streamCIMMVP, executeCIMMVP } from '@/lib/agent/cim-mvp'

// Streaming (recommended)
for await (const event of streamCIMMVP(message, threadId, knowledgePath)) {
  if (event.type === 'token') console.log(event.content)
  if (event.type === 'slide_update') handleSlide(event.data)
}

// Non-streaming
const result = await executeCIMMVP(message, threadId, knowledgePath)
```

### With Custom Checkpointer

```typescript
import { createCIMMVPGraph } from '@/lib/agent/cim-mvp'

const graph = createCIMMVPGraph(myCheckpointer)
const result = await graph.invoke(state, {
  configurable: { thread_id: 'my-thread' }
})
```

### API Endpoint

```
POST /api/projects/[id]/cims/[cimId]/chat-mvp

{
  "message": "Let's start building the CIM",
  "stream": true,
  "knowledgePath": "optional/path/to/knowledge.json",
  "conversationId": "optional-thread-id"
}
```

**SSE Events:**
- `token` - Text token from model
- `workflow_progress` - Stage change notification
- `outline_created` - New outline created
- `outline_updated` - Outline modified
- `section_started` - Section work began
- `slide_update` - Slide created/updated
- `sources` - Source citations
- `done` - Stream complete
- `error` - Error occurred

## State Schema

Key state fields managed by the agent:

| Field | Type | Description |
|-------|------|-------------|
| `messages` | `BaseMessage[]` | Conversation history |
| `workflowProgress` | `WorkflowProgress` | Current stage and progress |
| `buyerPersona` | `BuyerPersona` | Target buyer context |
| `heroContext` | `HeroContext` | Story hook and thesis |
| `cimOutline` | `CIMOutline` | Section structure |
| `gatheredContext` | `GatheredContext` | Accumulated company info |
| `pendingSlideUpdate` | `SlideUpdate` | Latest slide for UI |
| `knowledgeLoaded` | `boolean` | Knowledge base status |

See `state.ts` for complete type definitions.

## Knowledge Base

The agent can operate in two modes:

### With Knowledge Base
- Loads pre-extracted document findings
- Makes data-grounded recommendations
- Cites specific metrics and facts

### Without Knowledge Base
- Gathers information through conversation
- Uses `save_context` to accumulate data
- Asks clarifying questions before making claims

## Development

### Adding New Tools

1. Define tool in `tools.ts` using `tool()` helper
2. Add result handling in `postToolNode` (graph.ts)
3. Document tool in system prompt (prompts.ts)
4. Add to `cimMVPTools` export array

### Modifying Prompts

Stage instructions are in `prompts.ts`:
- `getWorkflowStageInstructions()` - Per-stage guidance
- `getSystemPrompt()` - Full system prompt assembly

### Testing

```bash
# Run unit tests
npm run test:run __tests__/lib/agent/cim-mvp/

# Run E2E tests
npm run test:e2e -- e2e/cim-builder.spec.ts
```

## Related Documentation

- [Agent System README](../README.md) - Overview of all agents
- [CIM Workflow Spec](../../../../cim-workflow/cim-workflow.md) - Workflow design document
- [Architecture Evaluation](../../../../_bmad-output/planning-artifacts/cim-builder-architecture-evaluation.md) - Design decisions

## Version History

- **v1.1.0** - Added v3 conversational patterns, `navigate_to_stage` tool
- **v1.0.0** - Initial workflow-based implementation
