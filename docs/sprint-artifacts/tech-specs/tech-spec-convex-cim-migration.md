# Tech Spec: Convex CIM State Migration

---
title: Convex CIM State Migration
version: 1.0
status: Proposed
stream: CIM Builder
last-updated: 2026-01-25
owner: Max
adr: ADR-002
---

## Overview

Migrate CIM workflow state management from Supabase PostgreSQL to Convex for improved real-time updates, workflow durability, and cascade handling. Supabase remains the source of truth for authentication, permissions, and organizational data.

### Goals

1. **Real-time UI updates** - Automatic push when CIM state changes
2. **Durable workflows** - Survive crashes, browser close, multi-day sessions
3. **Cascade invalidation** - Backward navigation marks downstream slides stale
4. **Direct navigation** - Jump to any slide, not just sequential stages
5. **Single source of truth** - Eliminate sync gaps between LangGraph and database

### Non-Goals

- Migrating user/org/deal data from Supabase (stays in Supabase)
- Replacing Supabase Auth (Convex uses Supabase for auth checks)
- Production data migration (platform not live yet)

---

## 1. Convex Schema Definition

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Main CIM document
  cims: defineTable({
    // Foreign keys (to Supabase)
    dealId: v.string(),
    userId: v.string(),
    projectId: v.string(),

    // Metadata
    title: v.string(),
    version: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("in_progress"),
      v.literal("complete")
    ),

    // Workflow state (replaces workflow_state JSONB)
    stage: v.string(),  // WorkflowStage
    completedStages: v.array(v.string()),
    currentSectionId: v.optional(v.string()),
    currentSlideId: v.optional(v.string()),
    sectionProgress: v.any(),  // Record<string, SectionProgress>

    // Artifacts (replaces JSONB columns)
    buyerPersona: v.optional(v.object({
      type: v.string(),
      motivations: v.array(v.string()),
      concerns: v.array(v.string()),
    })),
    heroContext: v.optional(v.object({
      selectedHero: v.string(),
      investmentThesis: v.object({
        asset: v.string(),
        timing: v.string(),
        opportunity: v.string(),
      }),
    })),
    outline: v.optional(v.array(v.object({
      id: v.string(),
      title: v.string(),
      description: v.string(),
    }))),
    slides: v.array(v.object({
      id: v.string(),
      sectionId: v.string(),
      title: v.string(),
      layoutType: v.optional(v.string()),
      components: v.array(v.any()),
      status: v.union(
        v.literal("draft"),
        v.literal("needs_review"),
        v.literal("approved")
      ),
      staleReason: v.optional(v.string()),
    })),
    gatheredContext: v.optional(v.any()),  // GatheredContext

    // Timestamps
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_deal", ["dealId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Conversation messages (separate for vector search)
  messages: defineTable({
    cimId: v.id("cims"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_cim", ["cimId"])
    .index("by_cim_timestamp", ["cimId", "timestamp"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,  // Voyage 3.5
      filterFields: ["cimId"],
    }),

  // LangGraph checkpoints (replaces PostgresSaver)
  checkpoints: defineTable({
    threadId: v.string(),
    checkpoint: v.any(),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_thread", ["threadId"]),
})
```

---

## 2. Security Model

### Auth Bridge Architecture

```typescript
// convex/auth/checkAccess.ts
import { action } from "./_generated/server"
import { v } from "convex/values"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Bypasses RLS to check permissions
)

export const checkDealAccess = action({
  args: { userId: v.string(), dealId: v.string() },
  handler: async (ctx, { userId, dealId }): Promise<boolean> => {
    const { data } = await supabase
      .from("deals")
      .select(`
        id,
        project:projects!inner(
          members:project_members!inner(user_id)
        )
      `)
      .eq("id", dealId)
      .eq("project.members.user_id", userId)
      .single()
    return !!data
  },
})

export const checkCIMAccess = action({
  args: { userId: v.string(), cimId: v.string() },
  handler: async (ctx, { userId, cimId }): Promise<boolean> => {
    // Get CIM's dealId from Convex, then check deal access
    const cim = await ctx.runQuery(internal.cims.getById, { cimId })
    if (!cim) return false
    return await ctx.runAction(internal.auth.checkDealAccess, {
      userId,
      dealId: cim.dealId,
    })
  },
})
```

### Middleware Wrapper

```typescript
// convex/middleware/withCIMAccess.ts
import { QueryCtx, MutationCtx } from "./_generated/server"
import { Doc, Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"

export function withCIMAccess<T extends { cimId: Id<"cims"> }>(
  handler: (ctx: QueryCtx | MutationCtx, cim: Doc<"cims">, args: T) => Promise<any>
) {
  return async (ctx: QueryCtx | MutationCtx, args: T) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const cim = await ctx.db.get(args.cimId)
    if (!cim) throw new Error("CIM not found")

    const hasAccess = await ctx.runAction(internal.auth.checkDealAccess, {
      userId: identity.subject,
      dealId: cim.dealId,
    })
    if (!hasAccess) throw new Error("Access denied")

    return handler(ctx, cim, args)
  }
}
```

---

## 3. Core Mutations

### Mutation Summary

| Mutation | Purpose | Cascade Behavior |
|----------|---------|------------------|
| `cims.create` | Create new CIM | None |
| `cims.updateState` | Update workflow state | None |
| `cims.navigateToStage` | Navigate backward | Marks downstream slides as `needs_review` |
| `cims.saveBuyerPersona` | Save persona | If changed, invalidates hero + outline + slides |
| `cims.saveHeroContext` | Save hero/thesis | If changed, invalidates outline + slides |
| `cims.createOutline` | Create outline | Initializes section progress |
| `cims.updateSlide` | Update single slide | None |
| `cims.delete` | Delete CIM | Cascades to messages |

### Cascade Invalidation Implementation

```typescript
// convex/cims/navigate.ts
import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { withCIMAccess } from "../middleware/withCIMAccess"

export const navigateToStage = mutation({
  args: {
    cimId: v.id("cims"),
    targetStage: v.string(),
    reason: v.string()
  },
  handler: withCIMAccess(async (ctx, cim, { targetStage, reason }) => {
    const cascade = calculateCascade(cim.stage, targetStage)

    const updates: Partial<Doc<"cims">> = {
      stage: targetStage,
      updatedAt: Date.now(),
    }

    if (cascade.invalidatesHero && cim.heroContext) {
      updates.heroContext = {
        ...cim.heroContext,
        // Mark for review without deleting
      }
    }

    if (cascade.invalidatesSlides) {
      updates.slides = cim.slides.map(s => ({
        ...s,
        status: "needs_review" as const,
        staleReason: `${targetStage}_changed`,
      }))
    }

    await ctx.db.patch(cim._id, updates)
    // UI updates automatically via Convex reactivity
  }),
})

function calculateCascade(from: string, to: string): {
  invalidatesHero: boolean
  invalidatesOutline: boolean
  invalidatesSlides: boolean
} {
  const order = [
    "welcome",
    "buyer_persona",
    "hero_concept",
    "outline",
    "building_sections"
  ]
  const fromIdx = order.indexOf(from)
  const toIdx = order.indexOf(to)

  // Going forward doesn't invalidate anything
  if (toIdx >= fromIdx) {
    return {
      invalidatesHero: false,
      invalidatesOutline: false,
      invalidatesSlides: false
    }
  }

  // Going backward invalidates downstream artifacts
  return {
    invalidatesHero: toIdx <= 1,      // buyer_persona or earlier
    invalidatesOutline: toIdx <= 2,   // hero_concept or earlier
    invalidatesSlides: toIdx <= 3,    // outline or earlier
  }
}
```

### CRUD Mutations

```typescript
// convex/cims/mutations.ts
import { mutation } from "./_generated/server"
import { v } from "convex/values"

export const create = mutation({
  args: {
    dealId: v.string(),
    projectId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { dealId, projectId, title }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Check deal access via Supabase
    const hasAccess = await ctx.runAction(internal.auth.checkDealAccess, {
      userId: identity.subject,
      dealId,
    })
    if (!hasAccess) throw new Error("Access denied")

    const cimId = await ctx.db.insert("cims", {
      dealId,
      projectId,
      userId: identity.subject,
      title,
      version: 1,
      status: "draft",
      stage: "welcome",
      completedStages: [],
      slides: [],
      updatedAt: Date.now(),
    })

    return cimId
  },
})

export const saveBuyerPersona = mutation({
  args: {
    cimId: v.id("cims"),
    persona: v.object({
      type: v.string(),
      motivations: v.array(v.string()),
      concerns: v.array(v.string()),
    }),
  },
  handler: withCIMAccess(async (ctx, cim, { persona }) => {
    const personaChanged = JSON.stringify(cim.buyerPersona) !== JSON.stringify(persona)

    const updates: Partial<Doc<"cims">> = {
      buyerPersona: persona,
      stage: "hero_concept",
      completedStages: [...new Set([...cim.completedStages, "buyer_persona"])],
      updatedAt: Date.now(),
    }

    // Cascade invalidation if persona changed
    if (personaChanged && cim.slides.length > 0) {
      updates.slides = cim.slides.map(s => ({
        ...s,
        status: "needs_review" as const,
        staleReason: "buyer_persona_changed",
      }))
    }

    await ctx.db.patch(cim._id, updates)
  }),
})
```

---

## 4. ConvexSaver for LangGraph

```typescript
// convex/checkpointer.ts
import { BaseSaver, Checkpoint, CheckpointMetadata, CheckpointTuple, RunnableConfig } from "@langchain/langgraph"
import { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"

export class ConvexSaver extends BaseSaver {
  constructor(private ctx: ActionCtx) {
    super()
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id
    if (!threadId) throw new Error("thread_id required")

    await this.ctx.runMutation(internal.checkpoints.upsert, {
      threadId,
      checkpoint,
      metadata,
      updatedAt: Date.now(),
    })

    return config
  }

  async get(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id
    if (!threadId) return undefined

    const doc = await this.ctx.runQuery(internal.checkpoints.getByThread, {
      threadId
    })
    if (!doc) return undefined

    return {
      checkpoint: doc.checkpoint,
      metadata: doc.metadata,
      config,
    }
  }

  async list(
    config: RunnableConfig,
    options?: { limit?: number }
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id
    if (!threadId) return

    const docs = await this.ctx.runQuery(internal.checkpoints.listByThread, {
      threadId,
      limit: options?.limit ?? 10,
    })

    for (const doc of docs) {
      yield {
        checkpoint: doc.checkpoint,
        metadata: doc.metadata,
        config: { ...config, configurable: { thread_id: doc.threadId } },
      }
    }
  }

  async delete(config: RunnableConfig): Promise<void> {
    const threadId = config.configurable?.thread_id
    if (!threadId) return

    await this.ctx.runMutation(internal.checkpoints.deleteByThread, { threadId })
  }
}
```

### Checkpoint Mutations

```typescript
// convex/checkpoints.ts
import { mutation, query, internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"

export const upsert = internalMutation({
  args: {
    threadId: v.string(),
    checkpoint: v.any(),
    metadata: v.optional(v.any()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("checkpoints")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        checkpoint: args.checkpoint,
        metadata: args.metadata,
        updatedAt: args.updatedAt,
      })
    } else {
      await ctx.db.insert("checkpoints", args)
    }
  },
})

export const getByThread = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("checkpoints")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first()
  },
})
```

---

## 5. API Route Updates

### Before (Supabase + PostgresSaver)

```typescript
// app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"

const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!)
const graph = createCIMGraph(checkpointer)
```

### After (Convex)

```typescript
// app/api/projects/[id]/cims/[cimId]/chat-mvp/route.ts
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

// In handler
const cim = await convex.query(api.cims.get, { cimId })
const checkpointer = new ConvexSaver(convex)
const graph = createCIMGraph(checkpointer)
```

---

## 6. UI Hook Updates

### Option A: Keep React Query (Minimal Change)

```typescript
// lib/hooks/useCIM.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ConvexHttpClient } from "convex/browser"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function useCIM(cimId: string) {
  return useQuery({
    queryKey: ["cim", cimId],
    queryFn: () => convex.query(api.cims.get, { cimId }),
    // Poll for updates (not ideal but minimal change)
    refetchInterval: 2000,
  })
}
```

### Option B: Use Convex Hooks (Recommended)

```typescript
// lib/hooks/useCIM.ts
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export function useCIM(cimId: Id<"cims">) {
  // Real-time subscription - no polling needed
  const cim = useQuery(api.cims.get, { cimId })
  const saveBuyerPersona = useMutation(api.cims.saveBuyerPersona)
  const updateSlide = useMutation(api.cims.updateSlide)
  const navigateToStage = useMutation(api.cims.navigateToStage)

  return {
    cim,
    isLoading: cim === undefined,
    saveBuyerPersona,
    updateSlide,
    navigateToStage,
  }
}
```

---

## 7. Migration Steps

| Step | Task | Files Changed | Effort |
|------|------|---------------|--------|
| 1 | Create Convex project | `convex/` directory, `.env.local` | 1 day |
| 2 | Define schema | `convex/schema.ts` | 0.5 day |
| 3 | Implement auth bridge | `convex/auth/*.ts` | 1 day |
| 4 | Implement CRUD mutations | `convex/cims/*.ts` | 1.5 days |
| 5 | Implement ConvexSaver | `convex/checkpointer.ts` | 1 day |
| 6 | Update CIM service | `lib/services/cim.ts` | 1 day |
| 7 | Update API routes | `app/api/projects/[id]/cims/` | 1 day |
| 8 | Update hooks | `lib/hooks/useCIM*.ts` | 1 day |
| 9 | Test edge cases | `__tests__/` | 2 days |
| 10 | Deploy + verify | Convex dashboard | 0.5 day |

**Total: ~10-11 days**

---

## 8. Data Migration

**Not required** - Platform is pre-launch. Test CIMs in Supabase can be wiped when Convex goes live. No migration scripts needed.

If migration were needed in the future:

```typescript
// scripts/migrate-cims.ts
const supabaseCims = await supabase.from("cims").select("*")

for (const cim of supabaseCims) {
  await convex.mutation(api.cims.importFromSupabase, {
    dealId: cim.deal_id,
    projectId: cim.project_id,
    userId: cim.user_id,
    title: cim.title,
    workflowState: cim.workflow_state,
    slides: cim.slides,
    buyerPersona: cim.buyer_persona,
    heroContext: cim.hero_context,
    outline: cim.outline,
  })
}
```

---

## 9. Testing Strategy

### Unit Tests

```typescript
// __tests__/convex/cims.test.ts
import { convexTest } from "convex-test"
import { api } from "../convex/_generated/api"

describe("CIM mutations", () => {
  it("cascades invalidation on backward navigation", async () => {
    const t = convexTest()

    // Create CIM with slides
    const cimId = await t.mutation(api.cims.create, { ... })
    await t.mutation(api.cims.updateSlide, { cimId, slide: { status: "approved" } })

    // Navigate backward
    await t.mutation(api.cims.navigateToStage, {
      cimId,
      targetStage: "buyer_persona",
      reason: "User requested change"
    })

    // Verify slides marked stale
    const cim = await t.query(api.cims.get, { cimId })
    expect(cim.slides[0].status).toBe("needs_review")
    expect(cim.slides[0].staleReason).toBe("buyer_persona_changed")
  })
})
```

### Edge Case Tests

| Test Case | Expected Behavior |
|-----------|-------------------|
| Browser refresh mid-workflow | State restored from Convex |
| Concurrent session edits | Optimistic UI with last-write-wins |
| Auth token expires | Re-authenticate via Supabase |
| Convex down | Graceful error message, no data loss |

---

## 10. Rollback Plan

If Convex migration fails:

1. **Immediate**: Revert API routes to PostgresSaver
2. **Short-term**: Re-enable Supabase CIM sync
3. **Data**: Convex data doesn't affect Supabase (clean rollback)

---

## References

- [ADR-002: Convex for CIM Workflow State](../../architecture-decisions/adr-002-convex-cim-state.md)
- [Convex Documentation](https://docs.convex.dev/)
- [Convex React Hooks](https://docs.convex.dev/client/react)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [CIM MVP README](../../cim-mvp/README.md)
