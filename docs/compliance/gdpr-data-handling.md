# GDPR Data Handling & Right to Erasure

**Document Version:** 1.0
**Last Updated:** 2026-01-17
**Status:** Approved
**Owner:** Engineering

---

## Overview

This document defines how Manda Platform handles GDPR compliance, specifically the Right to Erasure (Article 17) across our multi-database architecture.

### Data Storage Architecture

| Store | Data Type | Retention |
|-------|-----------|-----------|
| **PostgreSQL (Supabase)** | User accounts, conversations, deal metadata, CIM artifacts | Until deal closure + 30 days |
| **Neo4j (Graphiti)** | Knowledge graph entities, episodes, relationships | Until deal closure + 30 days |
| **Redis (Upstash)** | Session cache, query cache | TTL-based (max 24 hours) |
| **GCS** | Document files, images | Until deal closure + 30 days |

---

## Right to Erasure Implementation

### Scope of Erasure

When a user requests deletion of their data, the following is affected:

| Data Type | Action | Rationale |
|-----------|--------|-----------|
| User's conversation messages | **DELETE** | Direct user content |
| LangGraph checkpoints containing user messages | **UPDATE** | Remove messages, preserve thread integrity |
| Graphiti episodes sourced from user messages | **DELETE** | Derived from user content |
| Entities derived from deleted episodes | **CONDITIONAL** | See Hybrid Deletion Policy below |
| Redis cached queries | **INVALIDATE** | May contain user content |

### Hybrid Deletion Policy for Graphiti Entities

**Decision Date:** 2026-01-17
**Decision Maker:** Max Hofer

When a Graphiti episode is deleted, entities extracted from that episode follow this policy:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTITY DELETION DECISION                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Is the entity a Person or contains PII?                        │
│  (name, email, phone, address, title + company)                 │
│                                                                  │
│     YES ──────────────────────► DELETE ENTITY                   │
│      │                          (GDPR compliance)                │
│      │                                                           │
│     NO                                                           │
│      │                                                           │
│      ▼                                                           │
│  Is the entity referenced by OTHER episodes?                    │
│  (episodes not being deleted)                                   │
│                                                                  │
│     YES ──────────────────────► ORPHAN ENTITY                   │
│      │                          (keep entity, remove link)       │
│      │                                                           │
│     NO                                                           │
│      │                                                           │
│      ▼                                                           │
│  DELETE ENTITY                                                   │
│  (no other sources need it)                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Entity Classification for PII Detection

**PII Entities (Always Delete):**
- `Person` - Individual names, roles, contact information
- `Contact` - Email addresses, phone numbers
- Any entity with `pii: true` metadata flag

**Business Entities (Orphan if Referenced):**
- `Company` - Organization names, identifiers
- `FinancialMetric` - Revenue, EBITDA, margins
- `Deal` - Transaction details
- `Document` - Document references
- `Finding` - Analysis findings
- `Risk` - Identified risks

### Implementation Requirements

#### 1. Deletion API Endpoint

```typescript
// DELETE /api/projects/{projectId}/conversations/{conversationId}/messages/{messageId}
interface DeleteMessageRequest {
  messageId: string;
  reason?: 'user_request' | 'gdpr_erasure' | 'deal_closure';
}

interface DeleteMessageResponse {
  success: boolean;
  deletedFrom: {
    postgresql: boolean;
    graphiti: {
      episodesDeleted: number;
      entitiesDeleted: number;  // PII + unreferenced
      entitiesOrphaned: number; // Business entities with other refs
    };
    redis: boolean;
  };
  auditId: string; // Reference for compliance records
}
```

#### 2. Graphiti Entity Reference Check

Before deleting an entity, check for other episode references:

```typescript
async function shouldDeleteEntity(
  entityId: string,
  deletingEpisodeId: string
): Promise<'delete' | 'orphan'> {
  // Check if entity is PII
  const entity = await graphiti.getEntity(entityId);
  if (isPIIEntity(entity)) {
    return 'delete'; // Always delete PII
  }

  // Check for other references
  const otherEpisodes = await graphiti.getEntityEpisodes(entityId);
  const hasOtherRefs = otherEpisodes.some(ep => ep.id !== deletingEpisodeId);

  return hasOtherRefs ? 'orphan' : 'delete';
}

function isPIIEntity(entity: GraphitiEntity): boolean {
  return (
    entity.type === 'Person' ||
    entity.type === 'Contact' ||
    entity.metadata?.pii === true
  );
}
```

#### 3. Audit Trail

All deletion operations must be logged:

```typescript
interface DeletionAuditLog {
  auditId: string;
  timestamp: Date;
  requestedBy: string; // user_id
  reason: 'user_request' | 'gdpr_erasure' | 'deal_closure';
  scope: {
    projectId: string;
    conversationId?: string;
    messageId?: string;
  };
  results: {
    messagesDeleted: number;
    episodesDeleted: number;
    entitiesDeleted: number;
    entitiesOrphaned: number;
  };
  // Note: Do NOT log actual content - only counts and IDs
}
```

Audit logs are stored in PostgreSQL `deletion_audit_log` table and retained for 7 years per compliance requirements.

---

## Data Retention Triggers

### Automatic Deletion on Deal Closure

When a deal status changes to `closed`:

1. **Grace Period:** 30-day retention window
2. **Notification:** Email sent to deal team about upcoming deletion
3. **Export Option:** Users can export their data during grace period
4. **Deletion Execution:** After 30 days, automatic deletion of all deal data

### Manual Deletion Request

Users can request deletion via:
- Settings > Privacy > Delete My Data
- Email to privacy@mandaplatform.com
- Through deal administrator

**SLA:** Deletion completed within 30 days of verified request

---

## Data Residency

All data storage complies with EU data residency requirements:

| Service | Region | Provider |
|---------|--------|----------|
| PostgreSQL | eu-central-1 | Supabase (Frankfurt) |
| Neo4j | eu-west-1 | Self-hosted (Ireland) |
| Redis | eu-west-1 | Upstash |
| GCS | europe-west3 | Google Cloud (Frankfurt) |
| LLM APIs | europe-west1 | Vertex AI (Belgium) |

---

## Compliance Checklist

- [ ] User can view what data we store about them
- [ ] User can export their data in machine-readable format
- [ ] User can request deletion of their data
- [ ] Deletion cascades across all storage systems
- [ ] PII entities are always deleted (not orphaned)
- [ ] Audit trail maintained for all deletions
- [ ] 30-day grace period before permanent deletion
- [ ] Data residency in EU for all storage

---

## Related Documents

- [Sprint Change Proposal 2026-01-16](../sprint-artifacts/sprint-change-proposal-2026-01-16.md) - Story 10-1 definition
- [Architecture Decision: Graphiti Consolidation](../decisions/sprint-change-proposal-2025-12-15.md) - E10 pivot
- [Agent System PRD](../../_bmad-output/planning-artifacts/agent-system-prd.md) - GDPR requirements section

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-17 | Claude/Max | Initial document with hybrid deletion policy |
