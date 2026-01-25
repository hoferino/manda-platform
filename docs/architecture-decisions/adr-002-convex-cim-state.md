# ADR-002: Convex for CIM Workflow State Management

## Status

**Proposed** (2026-01-25)

## Context

### Current Architecture (Post-E10)

The CIM Builder uses a three-layer persistence model:

1. **LangGraph PostgresSaver**: Conversation checkpoints (thread state)
2. **Supabase sync**: Final CIM state in `cims` table (JSONB columns)
3. **Client-side cache**: Slide updates for fast UI rendering

### Problems Identified

1. **Eventual consistency gaps**: If sync fails mid-stream, database lags behind LangGraph state
2. **No cascade invalidation**: When user navigates back to change buyer persona, downstream slides aren't marked stale (only warnings logged)
3. **Tool-state isolation**: Tools can't access full workflow state during execution (global service workaround)
4. **Linear navigation only**: Can't jump directly to a specific slide
5. **Limited real-time**: UI polling or manual refresh required for updates
6. **No conversation versioning**: Overwrites on each sync, no audit trail

### Enterprise Requirements

- Multi-tenant security (RLS for org/deal isolation)
- Handle edge cases (reload, leave, concurrent sessions)
- CIM artifacts are interdependent (buyer persona affects all slides)
- Durable workflows spanning days/weeks

### Research Conducted

- **Temporal.io**: Excellent durability, adds infrastructure complexity
- **Convex**: Real-time reactive database with built-in workflow durability
- **LangGraph improvements**: Doesn't solve core state management issues

## Decision

Adopt **Convex for CIM workflow state**, keeping **Supabase for authentication and permissions**.

### Architecture Split

| Data | Location | Reason |
|------|----------|--------|
| CIM workflow state | Convex | Real-time, durable workflows |
| Conversations | Convex | Vector search, live updates |
| Slides (during building) | Convex | Cascade invalidation |
| LangGraph checkpoints | Convex | Replace PostgresSaver |
| Users, auth | Supabase | Existing infrastructure |
| Organizations, projects | Supabase | RLS policies |
| Deals, documents | Supabase | RLS policies |
| Permissions | Supabase | Source of truth for access control |

### Security Model

Every Convex query/mutation checks Supabase for access:

```typescript
// In every Convex function
const hasAccess = await ctx.runAction(internal.auth.checkDealAccess, {
  userId: identity.subject,
  dealId: cim.dealId,
})
if (!hasAccess) throw new Error("Access denied")
```

### Data Flow

```
User Action → Convex Mutation → State Update → Real-time UI Push
                    ↓
              Auth Check (Supabase RLS)
                    ↓
              LangGraph Action (for LLM reasoning)
```

## Consequences

### Positive

- **Real-time UI**: Convex subscriptions push updates automatically
- **Durable workflows**: Survives crashes, browser close, multi-day sessions
- **Cascade invalidation**: Navigate backward → downstream slides marked stale
- **Atomic state updates**: No sync gaps between layers
- **Direct navigation**: Jump to any slide, not just sequential stages
- **Built-in vector search**: Conversation context retrieval
- **Cleaner architecture**: One source of truth for CIM state

### Negative

- **Two databases**: Convex + Supabase adds operational complexity
- **Learning curve**: Team needs to learn Convex patterns
- **Migration effort**: ~8-12 days estimated
- **Auth check discipline**: Must remember to add access checks to every function

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Missing auth check → data leak | Shared middleware wrapper for all queries |
| Query syntax errors | Comprehensive test coverage |
| LangGraph compatibility | ConvexSaver implements standard checkpointer interface |

## Alternatives Considered

### 1. Temporal + Supabase

- **Pros**: Bulletproof durability, excellent audit trails
- **Cons**: More infrastructure (Temporal server), higher complexity
- **Verdict**: Overkill for current scale, consider for future multi-agent orchestration

### 2. Temporal + Convex + Supabase

- **Pros**: Best of both worlds
- **Cons**: Three systems to maintain, unnecessary complexity
- **Verdict**: Only if CIM workflows become significantly more complex

### 3. Improve Current LangGraph Setup

- **Pros**: Minimal migration effort
- **Cons**: Doesn't solve real-time, cascade, or durability issues
- **Verdict**: Band-aids on fundamental architecture limitations

## Implementation

### Epic: Convex CIM Migration

| Story | Points | Description |
|-------|--------|-------------|
| 1 | 3 | Convex project setup + schema definition |
| 2 | 5 | Implement auth bridge (Supabase access checks) |
| 3 | 5 | CRUD mutations + cascade invalidation |
| 4 | 3 | ConvexSaver for LangGraph checkpointing |
| 5 | 3 | Update API routes to use Convex |
| 6 | 3 | Update UI hooks (optional: use Convex hooks) |
| 7 | 5 | Testing + edge case validation |
| 8 | 2 | Documentation updates |
| **Total** | **29** | ~8-12 days |

## References

- [Convex Documentation](https://docs.convex.dev/)
- [Convex AI Agents](https://docs.convex.dev/agents)
- [ADR-001: Graphiti Migration](./adr-001-graphiti-migration.md)
- [CIM MVP README](../cim-mvp/README.md)
- [manda-architecture.md](../manda-architecture.md)
- [tech-spec-convex-cim-migration.md](../sprint-artifacts/tech-specs/tech-spec-convex-cim-migration.md)

## Timeline

- **2026-01-25**: Architecture decision proposed
- **TBD**: Implementation begins
- **TBD**: Migration complete
