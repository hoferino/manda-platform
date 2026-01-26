# Q&A and Chat

---
status: Current
last-updated: 2026-01-26
implements: E8, E11
---

Conversational interface for querying deal knowledge.

## Overview

The Q&A system provides an intelligent chat interface that:
- Answers questions about uploaded documents
- Maintains conversation context
- Provides source attribution for all claims
- Tracks information gaps via Q&A lists

## Implementation

The Q&A functionality is part of the **Agent System**:

| Component | Location | Description |
|-----------|----------|-------------|
| Chat Agent (v2) | `lib/agent/v2/` | LangGraph-based chat |
| Retrieval | `lib/agent/v2/nodes/retrieval.ts` | Graphiti search |
| API | `/api/projects/[id]/chat` | Chat endpoint |
| UI | `components/chat/` | Chat interface |

## Features

### Conversational Q&A

```typescript
// User asks about deal documents
"What was the Q3 2024 revenue?"

// Agent retrieves from knowledge graph
→ Graphiti hybrid search (vector + BM25 + graph)
→ Voyage rerank for relevance
→ Response with source citation

"Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12)"
```

### Source Attribution

Every factual claim includes:
- Source document name
- Location (page, cell, section)
- Multiple sources when applicable

### Uncertainty Handling

| Situation | Response |
|-----------|----------|
| No findings | "I couldn't find information about X..." |
| Low confidence | Shows results + explains why |
| Conflicting sources | Flags conflict, explains both |

### Q&A List Management

Unanswered questions are tracked:
- Agent offers to add to Q&A list
- Tracks pending seller requests
- Status tracking for responses

## API

```typescript
POST /api/projects/[id]/chat
{
  "message": "What is the EBITDA margin?",
  "conversationId": "..."
}

// Returns SSE stream of tokens + sources
```

## Related Documentation

- **[Agent System](../agent-system/)** - Full agent documentation
- **[Behavior Spec](../agent-system/behavior-spec.md)** - Q&A behavior rules
- **[Knowledge Graph](../knowledge-graph/)** - Retrieval backend
