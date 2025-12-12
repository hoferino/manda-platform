# Neo4j Architecture & Integration - Complete Explanation

**Date**: 2025-12-12
**Purpose**: Clarify how Neo4j works in the Manda Platform architecture

---

## What is Neo4j?

### Overview

**Neo4j** is a **native graph database** that stores data as **nodes** (entities) and **relationships** (connections between entities). Unlike traditional relational databases that use tables and rows, Neo4j uses a property graph model optimized for traversing connected data.

### Key Concepts

1. **Nodes**: Entities (e.g., Finding, Document, Deal)
2. **Relationships**: Named connections between nodes (e.g., EXTRACTED_FROM, CONTRADICTS)
3. **Properties**: Key-value pairs on both nodes and relationships
4. **Labels**: Categories for nodes (e.g., `:Finding`, `:Document`)
5. **Cypher**: Query language for graph traversal

---

## Neo4j in Manda Platform Architecture

### Hybrid Database Strategy

The Manda Platform uses **TWO databases** for different purposes:

#### PostgreSQL (Supabase)
- **Purpose**: Structured data storage
- **Stores**:
  - Documents metadata
  - Document chunks (text content)
  - **Findings** (extracted facts from LLM)
  - Embeddings (pgvector for semantic search)
  - Users, projects, permissions
- **Optimized for**:
  - CRUD operations
  - Vector similarity search (HNSW index)
  - Transactional consistency

#### Neo4j
- **Purpose**: Knowledge graph and relationship storage
- **Stores**:
  - **Finding nodes** (synchronized from PostgreSQL)
  - Document nodes
  - Deal nodes
  - **Relationships** between findings (CONTRADICTS, SUPPORTS)
  - Cross-domain patterns
- **Optimized for**:
  - Graph traversals
  - Relationship queries
  - Contradiction detection
  - Pattern discovery

---

## How Neo4j Should Work (Based on Architecture)

### 1. Data Flow: PostgreSQL → Neo4j

```
LLM Analysis (Gemini 2.5 Flash)
  ↓
Findings extracted and stored in PostgreSQL `findings` table
  ↓
Background process syncs findings to Neo4j as Finding nodes
  ↓
Neo4j graph now contains Finding nodes with relationships
```

### 2. Finding Node Structure

Based on story E1-7, Finding nodes should have:

```cypher
(:Finding {
  id: UUID,                    // Same ID as PostgreSQL
  content: STRING,             // Finding text
  type: STRING,                // e.g., "risk", "opportunity"
  confidence: FLOAT,           // 0.0-1.0
  date_referenced: DATE,       // When the data refers to
  date_extracted: TIMESTAMP,   // When finding was created
  document_id: UUID,           // Source document
  project_id: UUID            // Parent deal/project
})
```

### 3. Relationship Types

**Defined in Story E1-7**:
- `EXTRACTED_FROM` - Finding → Document (source attribution)
- `CONTRADICTS` - Finding → Finding (detected conflicts)
- `SUPERSEDES` - Finding → Finding (temporal updates)
- `SUPPORTS` - Finding → Finding (corroborating evidence)
- `PATTERN_DETECTED` - Finding → Finding (cross-domain patterns)
- `BASED_ON` - Insight → Finding (derived insights)

### 4. Example Graph Structure

```cypher
// Deal and Documents
(:Deal {id: "863d...", name: "Acme Corp Acquisition"})
  ← [:PART_OF] - (:Document {id: "c9d7...", name: "brainstorming-session-results.pdf"})

// Finding extracted from Document
(:Finding {
  id: "f1",
  content: "Revenue increased 25% YoY",
  type: "financial_metric",
  confidence: 0.95
})
  - [:EXTRACTED_FROM] → (:Document {id: "c9d7..."})

// Contradictory Finding
(:Finding {
  id: "f2",
  content: "Revenue declined 10% YoY",
  type: "financial_metric",
  confidence: 0.90
})
  - [:EXTRACTED_FROM] → (:Document {id: "abc..."})
  - [:CONTRADICTS {
      reason: "Revenue growth vs decline",
      confidence: 0.85,
      detected_at: timestamp
    }] → (:Finding {id: "f1"})
```

---

## Pricing: Self-Hosted vs Cloud

### Neo4j Community Edition (Self-Hosted) ✅ CURRENT SETUP

**Cost**: **FREE** and open-source
**What you get**:
- Full graph database functionality
- Cypher query language
- Bolt protocol access
- Suitable for development and production

**Limitations**:
- No clustering (single node only)
- No hot backups
- No role-based access control (RBAC)
- Community support only

**Deployment**:
- Docker container (what we're using)
- Runs locally on port 7687 (Bolt) and 7474 (Browser)
- No licensing costs

### Neo4j Enterprise Edition (Self-Hosted)

**Cost**: Licensing required (contact Neo4j sales)
**Additional features**:
- Clustering and replication
- Hot backups
- Advanced security (RBAC, LDAP, encryption)
- Enterprise support

### Neo4j Aura (Cloud - Managed Service)

**Cost**: Pay-as-you-go
**Pricing tiers** (approximate, check Neo4j for current rates):
- **Free tier**: Limited storage, good for learning
- **Professional**: ~$65-200/month depending on resources
- **Enterprise**: Custom pricing

**Benefits**:
- Fully managed (no ops overhead)
- Automatic backups and updates
- Scalable resources
- Global availability

**Cons**:
- Recurring costs
- Less control over infrastructure

---

## Current Setup Analysis

### What We Have

1. ✅ Neo4j Community Edition running in Docker
2. ✅ Connection details in `.env` files:
   ```bash
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=mandadev123
   ```
3. ✅ Neo4j accessible and responding to queries

### What We're Missing

1. ❌ **No Neo4j client code in manda-processing**
   - No code to create Finding nodes
   - No code to create relationships
   - No synchronization from PostgreSQL to Neo4j

2. ❌ **No schema initialization**
   - No constraints for unique IDs
   - No indexes on properties
   - No predefined relationship types

3. ❌ **No integration in analyze_document handler**
   - Findings stored in PostgreSQL only
   - No Neo4j sync after analysis

---

## What Powers Neo4j: LLM vs Direct Code

### Finding Extraction: ✅ LLM-Powered (Gemini 2.5 Flash)

**Process**:
1. Document chunks sent to Gemini 2.5 Flash
2. LLM extracts structured findings (type, content, confidence)
3. Findings stored in PostgreSQL

**Information Used**:
- Document text content
- LLM prompt template (system instructions)
- Context (document name, project name)

### Neo4j Sync: ❌ NOT LLM-Powered (Should be Direct Code)

**How it SHOULD work**:
1. After findings stored in PostgreSQL
2. Background job reads findings from PostgreSQL
3. **Direct code** creates Neo4j nodes and relationships
4. No LLM needed for graph operations

**Code Pattern**:
```python
async def sync_findings_to_neo4j(findings: list[Finding]):
    driver = GraphDatabase.driver(NEO4J_URI, auth=(user, password))

    with driver.session() as session:
        for finding in findings:
            session.run('''
                MERGE (f:Finding {id: $id})
                SET f.content = $content,
                    f.type = $type,
                    f.confidence = $confidence,
                    f.date_extracted = datetime()

                MERGE (d:Document {id: $doc_id})
                MERGE (f)-[:EXTRACTED_FROM]->(d)
            ''',
            id=str(finding.id),
            content=finding.content,
            type=finding.finding_type,
            confidence=finding.confidence_score,
            doc_id=str(finding.document_id)
            )
```

### Contradiction Detection: ⚠️ HYBRID (LLM + Neo4j)

**Process**:
1. Neo4j graph traversal finds similar findings
2. **LLM analyzes** if findings contradict each other
3. If contradiction detected, create `CONTRADICTS` relationship in Neo4j

**Information Used**:
- Finding content from Neo4j
- LLM analysis (Gemini compares two findings)
- Graph query results

---

## Implementation Status

### Epic 1 (Story E1-7): Neo4j Configuration ✅ DONE
- Docker container running
- Connection configured
- **BUT**: No client code implemented

### Epic 3 (Story E3-5): LLM Analysis ✅ DONE
- Gemini 2.5 Flash extracting findings
- Findings stored in PostgreSQL
- **BUT**: Not synced to Neo4j

### Epic 4 (Stories E4-7, E4-13): Neo4j Integration ❌ NOT IMPLEMENTED
- **E4-7**: Detect Contradictions Using Neo4j
- **E4-13**: Build Real-Time Knowledge Graph Updates
- **Status**: These stories are NOT yet implemented

---

## Why Neo4j Nodes Are Empty

### Root Cause Analysis

The Neo4j database is empty because:

1. **Story E1-7 scope**: Only configured Neo4j, didn't implement sync logic
2. **analyze_document handler**: Only stores findings in PostgreSQL
3. **Missing implementation**: No code path from PostgreSQL → Neo4j
4. **Epic 4 not started**: Knowledge graph update logic is in future stories

### Expected Behavior (When Fully Implemented)

```
1. Document uploaded
   ↓
2. Parse → Embed → Analyze (Gemini)
   ↓
3. Findings stored in PostgreSQL ✅ (working)
   ↓
4. Background sync creates Neo4j nodes ❌ (not implemented)
   ↓
5. Contradiction detection job runs ❌ (not implemented)
   ↓
6. CONTRADICTS relationships created ❌ (not implemented)
```

### Current Behavior

```
1. Document uploaded
   ↓
2. Parse → Embed → Analyze (Gemini)
   ↓
3. Findings stored in PostgreSQL ✅ (working)
   ↓
4. Pipeline stops here
   ↓
Neo4j remains empty
```

---

## Cost Summary

### Current Development Setup

| Component | Cost | Notes |
|-----------|------|-------|
| **Neo4j Community** | **$0/month** | Self-hosted, Docker |
| **PostgreSQL (Supabase)** | **$0/month** | Free tier (up to 500MB) |
| **OpenAI Embeddings** | **~$0.13 per 1M tokens** | Pay as you go |
| **Google Gemini** | **$0.30 input + $2.50 output per 1M tokens** | Pay as you go |
| **GCS Storage** | **~$0.02/GB/month** | Pay as you go |

**Total Fixed Costs**: $0/month (all usage-based)

### Production Considerations

**Option 1: Self-Hosted (Recommended for MVP)**
- Neo4j Community: Free
- Hosting costs: ~$50-100/month (VM/container hosting)
- Full control, no vendor lock-in

**Option 2: Managed Services**
- Neo4j Aura: ~$65+/month
- Convenience, but higher costs
- Automatic scaling and backups

---

## Recommended Next Steps

### To Enable Full Neo4j Integration:

1. **Create Neo4j Client Module**
   ```
   manda-processing/src/storage/neo4j_client.py
   ```
   - Connection pooling
   - CRUD operations for nodes/relationships
   - Schema initialization

2. **Add Sync Logic to analyze_document Handler**
   - After storing findings in PostgreSQL
   - Call `sync_findings_to_neo4j()`
   - Create Finding nodes and EXTRACTED_FROM relationships

3. **Implement detect-contradictions Job** (Epic 4, Story E4-7)
   - Query Neo4j for similar findings
   - Use LLM to detect contradictions
   - Create CONTRADICTS relationships

4. **Add Knowledge Graph UI** (Epic 4, Story E4-1)
   - Visualize findings and relationships
   - Show contradictions to users

---

## References

- [Story E1-7: Configure Neo4j](./stories/e1-7-configure-neo4j-graph-database.md)
- [Story E4-7: Detect Contradictions](./stories/e4-7-detect-contradictions-using-neo4j.md)
- [Story E4-13: Knowledge Graph Updates](./stories/e4-13-build-real-time-knowledge-graph-updates.md)
- [Manda Architecture](../manda-architecture.md)

---

## Conclusion

**Neo4j Role**: Knowledge graph for finding relationships and contradiction detection

**LLM Role**: Extract findings from documents (Gemini 2.5 Flash)

**Neo4j Sync**: Direct code (no LLM), currently NOT implemented

**Cost**: $0 for self-hosted Community Edition

**Status**: Neo4j is configured and running, but integration code is missing (planned for Epic 4)
