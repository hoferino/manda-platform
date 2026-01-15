# Sprint Change Proposal: Redis Postponement

**Date:** 2026-01-10
**Triggered By:** Max (User)
**Scope:** Minor

---

## Issue Summary

Redis adds development complexity without immediate benefit for Epic 3 core work. The ioredis migration was completed but running Redis during development is not required.

**Context:** During Epic 2 retro action item completion, all infrastructure was prepared (ioredis migration, docker-compose config). However, the user decided to defer Redis requirement to simplify development workflow.

---

## Impact Analysis

### Epic Impact
- **Epic 3** - No impact. Context-loader middleware and specialists don't require Redis.

### Story Impact
- No story changes required. Cache code has graceful fallback to in-memory.

### Artifact Conflicts
- None. Documentation updated in epic-2-retro.

### Technical Impact
- Cache falls back to in-memory when `REDIS_URL` not set
- No interference with LangGraph agent (verified: no Redis usage in `lib/agent/v2/`)

---

## Recommended Approach

**Direct Adjustment** - Keep ioredis code with graceful fallback.

### Rationale
- Code is ready and tested
- In-memory fallback works for development
- Redis can be enabled later via `docker-compose.dev.yml`
- Zero code changes needed to enable Redis in future

### Effort Estimate
- Already complete

### Risk Assessment
- LOW - No production impact, development workflow simplified

---

## Detailed Changes

### Code Changes (Already Complete)

| File | Change |
|------|--------|
| `lib/cache/redis-client.ts` | Migrated to ioredis, graceful fallback |
| `lib/cache/redis-cache.ts` | Updated for ioredis API |
| `docker-compose.dev.yml` | Added Redis service |
| `__tests__/lib/cache/*.test.ts` | Updated mocks from @upstash/redis to ioredis |

### Documentation Updates

| File | Change |
|------|--------|
| `epic-2-retro-2026-01-10.md` | Added Course Correction section |

---

## Implementation Handoff

**Scope:** Minor - No further action required

**Success Criteria:**
- [x] ioredis code works with graceful fallback
- [x] All cache tests pass (32/32)
- [x] All v2 agent tests pass (287/287)
- [x] No Redis usage in lib/agent/v2/

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Keep ioredis code | Already complete, enables future Redis use |
| Skip long-term memory (Store) | Not needed for MVP, short-term checkpointer sufficient |
| Redis optional for dev | Reduces complexity, can enable when needed |

---

## Sign-Off

Course correction approved and documented. Ready for Epic 3.
