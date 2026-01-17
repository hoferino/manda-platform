# Sprint Change Proposal: Story Updates for Graphiti Architecture

**Date:** 2026-01-16
**Status:** Approved (2026-01-17)
**Impact:** Epics 5, 6, 7, 8, 10, 11 (Agent System v2.0)

---

## Executive Summary

Following the pgvector removal (commit 7d8b698) and Graphiti + Neo4j consolidation (E10 completion), several backlog stories in the Agent System v2.0 sprint require updates. This SCP proposes revised story definitions that align with the current architecture.

**Key Changes:**
- Epic 11 requires significant redesign (Graphiti handles fact extraction automatically)
- Stories 5-5, 7-3, 8-2, 10-1 need acceptance criteria updates for Graphiti

---

## Background

### Architecture Evolution (E10 Pivot)
- **Before:** pgvector + Neo4j dual-database approach
- **After:** Graphiti + Neo4j consolidation with Voyage embeddings
- **Impact:** Knowledge persistence, search, and learning loops fundamentally changed

### Recent Commits Analyzed
| Commit | Change |
|--------|--------|
| 7d8b698 | Remove all pgvector references |
| b0b8967 | Dynamic KG pipeline for context-aware retrieval |
| a02da49 | Knowledge toggle (JSON/Graphiti mode switching) |

---

## Updated Story Definitions

### Epic 5: Human-in-the-Loop

#### Story 5-5: Implement Knowledge Base Persistence Approval (UPDATED)

**Original Scope:** User confirms before agent writes to knowledge base

**Updated Scope:** User confirms before agent persists insights to Graphiti

**As a** deal analyst,
**I want** to approve when the agent captures new facts from our conversation,
**So that** I maintain control over what gets added to the deal's knowledge graph.

**Acceptance Criteria:**

1. **Graphiti Episode Creation Approval**
   - [ ] When agent detects persistable insight, show approval UI:
     ```
     [Agent suggests adding to knowledge base:]
     "Q2 2023 revenue decline was a one-time inventory write-off (source: CFO call)"
     [Add to Knowledge Base] [Skip]
     ```
   - [ ] Approval triggers `graphiti.add_episode()` with user attribution
   - [ ] Episode includes `source: 'user-provided'` and `confidence: 0.95`

2. **Automatic vs Manual Persistence Rules**
   - [ ] Auto-persist (no approval needed):
     - User corrections to existing facts
     - User confirmations of agent suggestions
   - [ ] Require approval:
     - New facts from conversation not directly stated by user
     - Inferred relationships between entities

3. **Graphiti Integration**
   - [ ] Use `graphiti.add_episode()` for all persistence (not raw Neo4j writes)
   - [ ] Let Graphiti handle entity resolution automatically
   - [ ] Include temporal metadata for fact versioning

4. **Audit Trail**
   - [ ] Log all persistence operations to LangSmith
   - [ ] Store `user_id` with episode for GDPR compliance
   - [ ] Track approval/rejection statistics

**Technical Notes:**
- Graphiti automatically handles deduplication via entity resolution (>85% threshold)
- No need to check for duplicates manually - Graphiti resolves them
- Temporal model means corrections supersede, not delete, previous facts

**Story Points:** 5 (reduced from 8 - Graphiti simplifies implementation)

---

### Epic 7: Thread Management & Conversation Search

#### Story 7-3: Implement Conversation Search Backend (UPDATED)

**Original Scope:** Semantic search using pgvector embeddings

**Updated Scope:** Hybrid search using Graphiti episodes + BM25

**As a** deal team member,
**I want** to search across conversation history,
**So that** I can find previous discussions about specific topics.

**Acceptance Criteria:**

1. **Graphiti-Based Search**
   - [ ] Search endpoint: `POST /api/projects/{id}/conversations/search`
   - [ ] Request body:
     ```typescript
     {
       query: string;
       filters?: {
         dateRange?: { start: Date; end: Date };
         userId?: string;
         conversationId?: string;
       };
       limit?: number; // default 20
     }
     ```
   - [ ] Use Graphiti hybrid search (vector + BM25 + graph traversal)

2. **Episode-Based Retrieval**
   - [ ] Conversation messages stored as Graphiti episodes during chat
   - [ ] Search retrieves episodes with `source_type: 'conversation'`
   - [ ] Include episode metadata: timestamp, user, conversation_id

3. **Voyage Reranking**
   - [ ] Apply Voyage rerank-2.5 to top-50 results
   - [ ] Return top-20 after reranking
   - [ ] Include relevance scores in response

4. **Response Format**
   ```typescript
   interface SearchResult {
     conversationId: string;
     messageId: string;
     content: string;
     timestamp: Date;
     userId: string;
     score: number;
     highlights: string[]; // BM25 matched phrases
   }
   ```

5. **Performance**
   - [ ] Search latency < 500ms (p95)
   - [ ] Cache recent searches in Redis (5-minute TTL)

**Dependencies:**
- Requires conversation messages ingested as Graphiti episodes (new requirement)
- Epic 3 retrieval node pattern can be reused

**Story Points:** 5

**New Prerequisite Story (Add to Epic 7):**

#### Story 7-0: Ingest Conversation Messages as Graphiti Episodes (NEW)

**As a** system,
**I want** to store conversation messages in Graphiti,
**So that** they are searchable via the knowledge graph.

**Acceptance Criteria:**

1. **Episode Ingestion**
   - [ ] After each user message, call `graphiti.add_episode()`:
     ```typescript
     await graphiti.addEpisode({
       name: `conversation-${conversationId}-${messageId}`,
       body: message.content,
       sourceType: 'conversation',
       metadata: {
         conversationId,
         messageId,
         userId,
         timestamp: new Date().toISOString(),
         workflowMode: state.workflowMode
       }
     });
     ```
   - [ ] Ingest both user and assistant messages

2. **Entity Extraction**
   - [ ] Let Graphiti extract entities from conversation content
   - [ ] Link extracted entities to existing deal entities (Company, Person, etc.)

3. **Privacy Controls**
   - [ ] Include `user_id` for GDPR deletion support
   - [ ] Respect deal isolation via `group_id`

**Story Points:** 3

---

### Epic 8: Multimodal Capabilities

#### Story 8-2: Implement Image KG Cross-Reference (UPDATED)

**Original Scope:** Generate embeddings via pgvector, cross-reference with documents

**Updated Scope:** Analyze image with vision model, ingest analysis as Graphiti episode

**As a** analyst,
**I want** to upload an image and have it cross-referenced with deal knowledge,
**So that** I can compare visual data (charts, tables, screenshots) with existing information.

**Acceptance Criteria:**

1. **Vision Model Analysis**
   - [ ] Use Claude 3.5 Sonnet or Gemini 2.0 Flash for image analysis
   - [ ] Extract structured data from image:
     ```typescript
     interface ImageAnalysis {
       description: string;
       extractedData: Record<string, unknown>; // tables, charts, text
       detectedEntities: string[]; // company names, metrics, dates
     }
     ```

2. **Graphiti Episode Creation**
   - [ ] Store image analysis as Graphiti episode:
     ```typescript
     await graphiti.addEpisode({
       name: `image-${imageId}`,
       body: analysis.description,
       sourceType: 'image',
       metadata: {
         imageUrl: gcsUrl,
         extractedData: analysis.extractedData,
         detectedEntities: analysis.detectedEntities
       }
     });
     ```
   - [ ] Graphiti extracts entities and links to existing deal entities

3. **Cross-Reference Query**
   - [ ] After ingestion, query Graphiti for related facts
   - [ ] Use detected entities as search terms
   - [ ] Return comparison analysis:
     ```
     "The pricing table shows $99/month for Enterprise tier.
      This differs from the CIM (page 12) which states $79/month.
      [Source: Uploaded image vs Management Presentation]"
     ```

4. **Source Attribution**
   - [ ] Include image thumbnail in chat response
   - [ ] Link to GCS storage URL for full resolution

**Story Points:** 8

---

### Epic 10: GDPR Compliance & Data Management

#### Story 10-1: Implement GDPR Message Deletion (UPDATED)

**Original Scope:** Delete messages from PostgreSQL

**Updated Scope:** Cascade deletion to PostgreSQL AND Graphiti episodes

**As a** user,
**I want** to delete my conversation messages,
**So that** I can exercise my GDPR right to erasure.

**Acceptance Criteria:**

1. **Dual-Database Deletion**
   - [ ] Delete from PostgreSQL (LangGraph checkpoints)
   - [ ] Delete from Graphiti (conversation episodes)
   - [ ] Delete from any Redis caches

2. **PostgreSQL Deletion**
   - [ ] Delete message from `conversations` table
   - [ ] Update LangGraph checkpoint to remove message from history
   - [ ] Preserve checkpoint integrity (recompute state if needed)

3. **Graphiti Episode Deletion**
   - [ ] Find episodes with `metadata.messageId = targetMessageId`
   - [ ] Use `graphiti.delete_episode()` or equivalent
   - [ ] Handle cascading: if episode created entities, decide:
     - Option A: Orphan entities (keep but remove episode link)
     - Option B: Delete entities only if no other sources reference them
   - [ ] **Decision needed:** Discuss with Max which approach to use

4. **Deletion API**
   ```typescript
   // DELETE /api/projects/{id}/conversations/{convId}/messages/{msgId}
   interface DeleteMessageRequest {
     cascade: boolean; // whether to delete derived entities
   }
   interface DeleteMessageResponse {
     success: boolean;
     deletedFrom: ('postgresql' | 'graphiti' | 'redis')[];
     orphanedEntities?: number; // if cascade=false
   }
   ```

5. **Audit Logging**
   - [ ] Log deletion request (without message content)
   - [ ] Include timestamp and requesting user
   - [ ] Retain audit log for compliance (separate from message data)

6. **Error Handling**
   - [ ] If Graphiti deletion fails, rollback PostgreSQL deletion
   - [ ] Return clear error message with retry option
   - [ ] Queue for retry if transient failure

**Story Points:** 8 (increased from 5 - dual-database complexity)

---

### Epic 11: Conversation Intelligence & Learning (MAJOR REDESIGN)

**Context:** Original stories assumed manual fact extraction pipeline. Graphiti handles this automatically via `add_episode()` with LLM-based entity extraction. Stories need complete redesign.

#### Story 11-1: DEPRECATED - Remove Manual Fact Extraction Pipeline

**Original:** Implement fact extraction pipeline
**New Status:** DEPRECATED - Graphiti handles fact extraction automatically

**Migration Note:** Graphiti's `add_episode()` uses LLM-based extraction to identify entities and relationships. No manual pipeline needed.

---

#### Story 11-2: DEPRECATED - Remove Conversation Summary Storage

**Original:** Implement conversation summary storage
**New Status:** DEPRECATED - Covered by Epic 3 summarization middleware

**Migration Note:** Story 2-3 (summarization middleware at 70% threshold) already handles conversation compression. No separate summary storage needed.

---

#### Story 11-3: Implement Past Conversation Reference (UPDATED)

**Original Scope:** Query separate conversation index
**Updated Scope:** Query Graphiti episodes with `source_type: 'conversation'`

**As a** analyst,
**I want** the agent to reference my past conversations,
**So that** I don't have to repeat context I've already provided.

**Acceptance Criteria:**

1. **Conversation Episode Retrieval**
   - [ ] Before generating response, query Graphiti for relevant past episodes:
     ```typescript
     const pastContext = await graphiti.search({
       query: currentUserMessage,
       filters: {
         groupId: dealId,
         sourceType: 'conversation',
         userId: currentUserId, // privacy: only user's own conversations
         excludeConversationId: currentConversationId // don't return current thread
       },
       limit: 5
     });
     ```

2. **Context Injection**
   - [ ] Add relevant past episodes to retrieval node output
   - [ ] Include in system prompt:
     ```
     Relevant context from past conversations:
     - [2026-01-10] User mentioned Q2 decline was due to inventory write-off
     - [2026-01-08] User confirmed pricing at $99/month
     ```

3. **Privacy Boundaries**
   - [ ] Only retrieve user's own past conversations
   - [ ] Respect deal isolation via `group_id`
   - [ ] Never cross-reference other users' conversations

4. **Source Attribution**
   - [ ] When referencing past conversation, cite it:
     ```
     "As you mentioned in our January 10th conversation, the Q2 decline..."
     ```

**Story Points:** 5

---

#### Story 11-4: Implement User Correction Detection (UPDATED)

**As a** analyst,
**I want** the agent to recognize when I'm correcting its information,
**So that** it updates the knowledge base appropriately.

**Acceptance Criteria:**

1. **Correction Pattern Detection**
   - [ ] Detect correction patterns in user messages:
     - "Actually, X is Y" / "No, it's actually..."
     - "That's wrong, the correct value is..."
     - "You said X but it should be Y"
     - Explicit disagreement with agent's previous statement

2. **Correction Classification**
   ```typescript
   interface DetectedCorrection {
     type: 'factual' | 'clarification' | 'addition';
     originalClaim: string; // what agent said
     correctedValue: string; // what user says it should be
     confidence: number; // how certain we are this is a correction
   }
   ```

3. **Agent Response Pattern**
   - [ ] Acknowledge the correction explicitly
   - [ ] Do NOT ask for confirmation (user already stated the correct value)
   - [ ] Automatically persist via Graphiti (see Story 11-5)
   - [ ] Response pattern:
     ```
     "Thank you for the correction. I've updated my understanding:
      [Previous: EBITDA margin is 15%]
      [Updated: EBITDA margin is 18.3% per Q3 financials]"
     ```

4. **Edge Cases**
   - [ ] If correction contradicts document data, note the discrepancy:
     ```
     "I see the CIM states 15%, but you've indicated the correct figure is 18.3%.
      I've recorded your correction as the authoritative value."
     ```

**Story Points:** 5

---

#### Story 11-5: Implement Correction Persistence with Graphiti (UPDATED)

**Original Scope:** Store corrections with manual provenance tracking
**Updated Scope:** Use Graphiti temporal model for automatic supersession

**As a** system,
**I want** to persist user corrections to the knowledge graph,
**So that** future queries use the corrected information.

**Acceptance Criteria:**

1. **Graphiti Episode for Corrections**
   - [ ] When correction detected, create episode:
     ```typescript
     await graphiti.addEpisode({
       name: `correction-${correctionId}`,
       body: `User correction: ${correction.correctedValue}.
              Original claim: ${correction.originalClaim}.
              Context: ${correction.context}`,
       sourceType: 'user-correction',
       metadata: {
         originalSource: 'agent-response',
         correctedBy: userId,
         confidence: 0.95, // user-provided > document-extracted
         timestamp: new Date().toISOString()
       }
     });
     ```

2. **Temporal Supersession**
   - [ ] Graphiti's temporal model handles fact versioning automatically
   - [ ] New episode with higher confidence supersedes previous
   - [ ] Original fact remains in graph with earlier `valid_at` timestamp
   - [ ] Queries return most recent valid fact by default

3. **Entity Resolution**
   - [ ] Graphiti links correction to existing entities (Company, FinancialMetric, etc.)
   - [ ] If correction creates new entity, Graphiti handles deduplication

4. **Verification**
   - [ ] After persistence, query Graphiti to confirm updated value is returned
   - [ ] Log correction event to LangSmith for auditing

**Story Points:** 5 (reduced from 8 - Graphiti handles complexity)

---

#### Story 11-6: Implement Correction UI (UNCHANGED)

**As a** analyst,
**I want** to see what corrections I've made to the knowledge base,
**So that** I can track my contributions and verify accuracy.

**Acceptance Criteria:**

1. **Corrections List View**
   - [ ] New tab in deal sidebar: "My Corrections"
   - [ ] List all corrections with:
     - Original value
     - Corrected value
     - Timestamp
     - Source context

2. **Correction Details**
   - [ ] Click to expand full context
   - [ ] Show where correction is used in knowledge graph
   - [ ] Option to revert (creates new episode reverting to original)

3. **Export**
   - [ ] Export corrections as CSV for audit trail

**Story Points:** 3

---

## Summary of Changes

| Story | Change Type | Points Before | Points After |
|-------|------------|---------------|--------------|
| 5-5 | Updated | 8 | 5 |
| 7-0 | **NEW** | - | 3 |
| 7-3 | Updated | 5 | 5 |
| 8-2 | Updated | 8 | 8 |
| 10-1 | Updated | 5 | 8 |
| 11-1 | **DEPRECATED** | 5 | 0 |
| 11-2 | **DEPRECATED** | 5 | 0 |
| 11-3 | Updated | 5 | 5 |
| 11-4 | Updated | 5 | 5 |
| 11-5 | Updated | 8 | 5 |
| 11-6 | Unchanged | 3 | 3 |

**Net Change:**
- Epic 11: 31 points → 18 points (13 point reduction)
- Epic 7: +3 points (new story 7-0)
- Epic 10: +3 points (increased complexity)
- **Total:** -7 points net reduction

---

## Decisions Made

### 1. Story 10-1 Cascade Behavior: HYBRID APPROACH

**Decision Date:** 2026-01-17
**Decision Maker:** Max Hofer

When deleting a message and its derived Graphiti entities:

```
IF entity contains PII (Person, Contact):
  → DELETE entity (GDPR compliance)
ELSE IF entity referenced by other episodes:
  → ORPHAN entity (keep but remove link)
ELSE:
  → DELETE entity (no other sources)
```

**Rationale:** Balances GDPR compliance for personal data with preservation of valuable business intelligence.

**Documentation:** See `docs/compliance/gdpr-data-handling.md` for full policy.

---

### 2. Epic 6 (CIM v2 Integration): DEPRECATED

**Decision Date:** 2026-01-17

CIM MVP (`lib/agent/cim-mvp/`) is production-ready with all required functionality. V2 integration provides no additional user value.

All Epic 6 stories (6-1 through 6-5) marked as `deprecated`.

---

### 3. Epic 4 (Specialist Agents): READY TO PROCEED

**Clarification:** The v2 agent architecture is complete (Epics 1-3 done). Epic 4 can proceed immediately - it adds specialist tools to the working supervisor, not blocked on anything.

---

## Approval

- [x] Max reviews updated story definitions (2026-01-17)
- [x] Update sprint-status.yaml with changes (2026-01-17)
- [x] Create GDPR compliance documentation (2026-01-17)
- [ ] Create new story 7-0 file (when epic starts)

---

*This SCP follows the format established in docs/decisions/*
