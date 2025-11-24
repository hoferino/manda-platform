# Story 1.7: Configure Neo4j Graph Database

Status: ready-for-dev

## Story

As a **developer**,
I want **Neo4j graph database configured and connected to the application**,
so that **the platform can store knowledge graph relationships for cross-domain pattern detection and source attribution**.

## Context

This story sets up Neo4j as the graph database for storing relationships between findings, documents, and insights. Neo4j enables the platform's cross-domain intelligence capabilities by tracking relationships like EXTRACTED_FROM (finding → document), CONTRADICTS (finding → finding), SUPPORTS (finding → finding), and PATTERN_DETECTED (finding → finding). In Epic 1, we configure the database, test the connection, and create initial node/relationship schemas.

**Architecture Context:** Neo4j complements PostgreSQL by storing graph relationships while PostgreSQL stores structured data and vectors. This hybrid approach optimizes for both relational queries and graph traversals.

## Acceptance Criteria

### AC1: Neo4j Installation and Configuration
**Given** I have Docker installed
**When** I run `docker-compose up`
**Then** Neo4j Community Edition 5.x+ starts successfully
**And** I can access Neo4j Browser at `http://localhost:7474`
**And** I can connect using Bolt protocol at `bolt://localhost:7687`
**And** The database is initialized with authentication (username: neo4j, password: configured)

### AC2: Neo4j Connection from Application
**Given** Neo4j is running
**When** the backend application starts
**Then** it establishes a connection to Neo4j
**And** a health check query succeeds: `RETURN 1`
**And** the connection uses the official Neo4j JavaScript driver
**And** Connection credentials are loaded from environment variables

### AC3: Initial Graph Schema Creation
**Given** Neo4j is connected
**When** I run the schema initialization script
**Then** the following node labels are created:
  - `:Deal` - Deal/project nodes
  - `:Document` - Document nodes
  - `:Finding` - Finding/fact nodes (with temporal metadata)
  - `:Insight` - Insight/pattern nodes
**And** Constraints are created for unique IDs
**And** Indexes are created on frequently queried properties

### AC4: Relationship Types Definition
**Given** the schema is initialized
**When** I query relationship types
**Then** the following relationship types are defined:
  - `EXTRACTED_FROM` - Finding extracted from Document
  - `CONTRADICTS` - Finding contradicts another Finding
  - `SUPERSEDES` - Newer Finding supersedes older Finding (temporal)
  - `SUPPORTS` - Finding supports another Finding
  - `PATTERN_DETECTED` - Cross-domain pattern relationship
  - `BASED_ON` - Insight based on Finding(s)
**And** Each relationship type has defined properties (e.g., `detected_at`, `confidence`)

### AC5: Basic CRUD Operations
**Given** Neo4j is connected
**When** I create a test Deal node
**Then** the node is stored in Neo4j with all properties
**When** I query for the Deal node
**Then** I retrieve the node with all properties
**When** I create a Finding node and EXTRACTED_FROM relationship to a Document
**Then** the relationship is stored
**And** I can traverse from Finding to Document via relationship
**When** I delete a test node
**Then** the node and its relationships are removed

### AC6: Temporal Metadata Support
**Given** I create a Finding node
**When** I add temporal properties
**Then** the node includes:
  - `date_referenced`: The date the data refers to (e.g., Q3 2024 → 2024-09-30)
  - `date_extracted`: When the finding was extracted
**And** Temporal properties are indexed for efficient queries
**And** Contradiction detection queries use temporal metadata

### AC7: Connection Pooling and Error Handling
**Given** the application is running
**When** multiple concurrent graph queries are executed
**Then** Neo4j driver connection pooling handles the load
**And** Connections are reused efficiently
**When** Neo4j is unavailable (stopped)
**Then** the application handles connection errors gracefully
**And** an error message is logged
**And** the application retries connection (optional, configurable)

### AC8: Performance and Health Checks
**Given** Neo4j is running
**When** I run a health check endpoint `/api/health/neo4j`
**Then** the endpoint returns 200 OK with Neo4j status
**And** Health check completes in <500ms
**When** I create 100 nodes and relationships
**Then** write operations complete in <2 seconds total
**And** Query performance is acceptable (<100ms for simple queries)

### AC9: Environment Configuration
**Given** Neo4j connection is configured
**When** I check environment variables
**Then** I see:
  - `NEO4J_URI`: Connection URI (e.g., bolt://localhost:7687)
  - `NEO4J_USER`: Username (e.g., neo4j)
  - `NEO4J_PASSWORD`: Password (configured securely)
**And** Environment variables are documented in `.env.example`
**And** Production uses secure passwords (not default)

### AC10: Docker Compose Integration
**Given** Docker Compose is configured
**When** I run `docker-compose up`
**Then** Neo4j service starts alongside Postgres, Next.js, and API services
**And** Neo4j data is persisted in a Docker volume
**And** Neo4j is accessible to other services via Docker network
**When** I run `docker-compose down`
**Then** Neo4j stops gracefully
**And** data is preserved in the volume (not lost)

## Tasks / Subtasks

- [ ] **Task 1: Add Neo4j to Docker Compose** (AC: #1, #10)
  - [ ] Update `docker-compose.dev.yml` to include Neo4j service:
    ```yaml
    neo4j:
      image: neo4j:5.15-community
      container_name: manda-neo4j
      environment:
        NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
        NEO4J_PLUGINS: '["apoc"]'
      volumes:
        - neo4j-data:/data
        - neo4j-logs:/logs
      ports:
        - "7474:7474"  # HTTP Browser
        - "7687:7687"  # Bolt Protocol
      healthcheck:
        test: ["CMD-SHELL", "cypher-shell -u neo4j -p ${NEO4J_PASSWORD} 'RETURN 1'"]
        interval: 10s
        timeout: 5s
        retries: 5
    ```
  - [ ] Add volume definitions: `neo4j-data`, `neo4j-logs`
  - [ ] Test Docker Compose startup

- [ ] **Task 2: Configure Environment Variables** (AC: #9)
  - [ ] Add to `.env.local`:
    ```bash
    NEO4J_URI=bolt://localhost:7687
    NEO4J_USER=neo4j
    NEO4J_PASSWORD=your_secure_password  # Change in production
    ```
  - [ ] Update `.env.example` with placeholder values
  - [ ] Document environment variables in README

- [ ] **Task 3: Install Neo4j JavaScript Driver** (AC: #2)
  - [ ] Install driver: `npm install neo4j-driver`
  - [ ] Install TypeScript types: `npm install -D @types/neo4j-driver`
  - [ ] Verify package version compatible with Neo4j 5.x+

- [ ] **Task 4: Create Neo4j Client Utility** (AC: #2, #7)
  - [ ] Create `lib/neo4j/client.ts`:
    ```typescript
    import neo4j, { Driver } from 'neo4j-driver'

    let driver: Driver | null = null

    export function getNeo4jDriver() {
      if (!driver) {
        driver = neo4j.driver(
          process.env.NEO4J_URI!,
          neo4j.auth.basic(
            process.env.NEO4J_USER!,
            process.env.NEO4J_PASSWORD!
          ),
          { maxConnectionPoolSize: 50 }
        )
      }
      return driver
    }

    export async function closeNeo4jDriver() {
      if (driver) {
        await driver.close()
        driver = null
      }
    }
    ```
  - [ ] Add connection pooling configuration
  - [ ] Add error handling for connection failures

- [ ] **Task 5: Create Schema Initialization Script** (AC: #3, #4)
  - [ ] Create `scripts/init-neo4j-schema.ts`
  - [ ] Define constraints:
    ```cypher
    CREATE CONSTRAINT deal_id_unique IF NOT EXISTS
    FOR (d:Deal) REQUIRE d.id IS UNIQUE;

    CREATE CONSTRAINT document_id_unique IF NOT EXISTS
    FOR (d:Document) REQUIRE d.id IS UNIQUE;

    CREATE CONSTRAINT finding_id_unique IF NOT EXISTS
    FOR (f:Finding) REQUIRE f.id IS UNIQUE;

    CREATE CONSTRAINT insight_id_unique IF NOT EXISTS
    FOR (i:Insight) REQUIRE i.id IS UNIQUE;
    ```
  - [ ] Define indexes:
    ```cypher
    CREATE INDEX finding_date_referenced IF NOT EXISTS
    FOR (f:Finding) ON (f.date_referenced);

    CREATE INDEX finding_user_id IF NOT EXISTS
    FOR (f:Finding) ON (f.user_id);
    ```
  - [ ] Run script on application startup (or as separate migration)

- [ ] **Task 6: Define Node Schemas** (AC: #3, #6)
  - [ ] Document node schemas in `lib/neo4j/schemas.ts`:
    ```typescript
    // Deal node
    interface DealNode {
      id: string  // UUID from PostgreSQL
      name: string
      user_id: string
    }

    // Document node
    interface DocumentNode {
      id: string
      name: string
      upload_date: string
      doc_type: string
    }

    // Finding node (with temporal metadata)
    interface FindingNode {
      id: string
      text: string
      confidence: number
      date_referenced: string  // Date the data refers to (e.g., "2024-09-30" for Q3 2024)
      date_extracted: string   // When finding was extracted
      source_document_id: string
      source_location: string  // "Page 5", "Cell B15", etc.
    }

    // Insight node
    interface InsightNode {
      id: string
      text: string
      insight_type: string  // "pattern", "contradiction", "gap"
    }
    ```
  - [ ] Add TypeScript types for nodes and relationships

- [ ] **Task 7: Define Relationship Schemas** (AC: #4)
  - [ ] Document relationship schemas:
    ```typescript
    // EXTRACTED_FROM relationship
    interface ExtractedFromRel {
      page?: number
      cell?: string
    }

    // CONTRADICTS relationship (temporal awareness)
    interface ContradictsRel {
      detected_at: string
      reason?: string
    }

    // SUPERSEDES relationship
    interface SupersedesRel {
      reason: string  // "Newer data available"
    }

    // SUPPORTS relationship
    interface SupportsRel {
      strength: number  // 0.0 to 1.0
    }

    // PATTERN_DETECTED relationship
    interface PatternDetectedRel {
      pattern_type: string  // "financial_operational", etc.
      confidence: number
    }

    // BASED_ON relationship
    interface BasedOnRel {
      relevance: number  // 0.0 to 1.0
    }
    ```

- [ ] **Task 8: Implement Basic CRUD Operations** (AC: #5)
  - [ ] Create `lib/neo4j/operations.ts` with helper functions:
    - `createNode(label, properties)`
    - `getNodeById(label, id)`
    - `updateNode(label, id, properties)`
    - `deleteNode(label, id)`
    - `createRelationship(fromId, toId, type, properties)`
  - [ ] Test CRUD operations with sample data
  - [ ] Add error handling for all operations

- [ ] **Task 9: Create Health Check Endpoint** (AC: #8)
  - [ ] Create `app/api/health/neo4j/route.ts`
  - [ ] Implement health check:
    ```typescript
    const driver = getNeo4jDriver()
    const session = driver.session()
    try {
      const result = await session.run('RETURN 1 AS health')
      return Response.json({ status: 'healthy', neo4j: result.records[0].get('health') })
    } catch (error) {
      return Response.json({ status: 'unhealthy', error: error.message }, { status: 503 })
    } finally {
      await session.close()
    }
    ```
  - [ ] Test health check endpoint
  - [ ] Add to overall health check dashboard (optional)

- [ ] **Task 10: Implement Error Handling and Retry Logic** (AC: #7)
  - [ ] Add connection error handling in Neo4j client
  - [ ] Log connection errors to console (production: error tracking service)
  - [ ] Implement optional retry logic with exponential backoff
  - [ ] Handle session failures gracefully (close sessions in finally blocks)

- [ ] **Task 11: Test Temporal Metadata Queries** (AC: #6)
  - [ ] Create test script: `scripts/test-neo4j-temporal.ts`
  - [ ] Create sample findings with different `date_referenced` values
  - [ ] Test query: Find findings for specific time period
  - [ ] Test contradiction detection with temporal awareness:
    ```cypher
    MATCH (f1:Finding)-[:CONTRADICTS]->(f2:Finding)
    WHERE f1.date_referenced = f2.date_referenced  // Same time period = true contradiction
    RETURN f1, f2
    ```
  - [ ] Verify temporal indexes improve query performance

- [ ] **Task 12: Performance Testing** (AC: #8)
  - [ ] Create performance test script
  - [ ] Insert 100 nodes and 200 relationships
  - [ ] Measure write performance (<2 seconds total)
  - [ ] Measure query performance (<100ms for simple queries)
  - [ ] Test connection pooling under concurrent load

- [ ] **Task 13: Documentation** (AC: All)
  - [ ] Document Neo4j setup in README
  - [ ] Document node and relationship schemas
  - [ ] Add example Cypher queries
  - [ ] Document Docker Compose configuration
  - [ ] Document environment variables

- [ ] **Task 14: Integration Testing** (AC: All)
  - [ ] Unit test: Neo4j client connection
  - [ ] Integration test: CRUD operations
  - [ ] Integration test: Relationship creation and traversal
  - [ ] Integration test: Health check endpoint
  - [ ] Test Docker Compose startup and shutdown

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Graph Database:**
- **Neo4j 5.x+ (Community Edition)**: Graph database for knowledge relationships
  - Docs: [Neo4j Getting Started](https://neo4j.com/docs/getting-started/)
  - Driver: [Neo4j JavaScript Driver](https://neo4j.com/docs/javascript-manual/current/)
  - Best Practices: [Neo4j Driver Best Practices](https://neo4j.com/blog/developer/neo4j-driver-best-practices/)

**Neo4j JavaScript Driver:**
- Official driver: `neo4j-driver`
- Supports Bolt protocol
- Connection pooling built-in
- Promise-based API

### Neo4j vs PostgreSQL Responsibilities

**PostgreSQL (Supabase):**
- Structured data (deals, documents, findings, insights)
- Vector embeddings (pgvector for semantic search)
- User authentication and RLS

**Neo4j:**
- Graph relationships (EXTRACTED_FROM, CONTRADICTS, SUPPORTS, PATTERN_DETECTED)
- Cross-domain pattern detection
- Source attribution chains
- Temporal contradiction detection

**Why Both?**
- PostgreSQL: Optimized for relational queries and vector search
- Neo4j: Optimized for graph traversals and relationship queries
- Hybrid approach leverages strengths of both databases

### Graph Schema Design

**Nodes:**
- **Deal**: Represents a project
- **Document**: Represents an uploaded file
- **Finding**: Extracted fact with temporal metadata
- **Insight**: Analyzed pattern or insight

**Relationships:**
- **EXTRACTED_FROM**: Source attribution (Finding → Document)
- **CONTRADICTS**: Conflicting information (Finding → Finding)
- **SUPERSEDES**: Newer data replaces older (Finding → Finding)
- **SUPPORTS**: Corroborating evidence (Finding → Finding)
- **PATTERN_DETECTED**: Cross-domain patterns (Finding → Finding)
- **BASED_ON**: Insight derivation (Insight → Finding)

**Temporal Intelligence:**
- `date_referenced`: The date the data refers to (e.g., "Q3 2024" → 2024-09-30)
- `date_extracted`: When the finding was extracted
- **Critical for validation**: Q2 data vs Q3 data are different time periods, not contradictions

### Connection Management

**Connection Pooling:**
```typescript
const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(
    process.env.NEO4J_USER!,
    process.env.NEO4J_PASSWORD!
  ),
  {
    maxConnectionPoolSize: 50,  // Max concurrent connections
    connectionTimeout: 30000,   // 30 seconds
    maxTransactionRetryTime: 30000
  }
)
```

**Session Management:**
```typescript
const session = driver.session()
try {
  const result = await session.run('CREATE (n:Node) RETURN n')
  // Process result
} finally {
  await session.close()  // Always close sessions
}
```

### Cypher Query Examples

**Create Node:**
```cypher
CREATE (f:Finding {
  id: $id,
  text: $text,
  date_referenced: $date_referenced,
  date_extracted: $date_extracted
})
RETURN f
```

**Create Relationship:**
```cypher
MATCH (f:Finding {id: $finding_id})
MATCH (d:Document {id: $document_id})
CREATE (f)-[:EXTRACTED_FROM {page: $page}]->(d)
```

**Traverse Relationships:**
```cypher
MATCH (f:Finding)-[:EXTRACTED_FROM]->(d:Document)
WHERE f.id = $finding_id
RETURN f, d
```

**Temporal Contradiction Detection:**
```cypher
MATCH (f1:Finding)-[:CONTRADICTS]->(f2:Finding)
WHERE f1.date_referenced = f2.date_referenced  // Same time period
RETURN f1, f2
```

### Docker Configuration

**Neo4j Service:**
```yaml
neo4j:
  image: neo4j:5.15-community
  environment:
    NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
    NEO4J_PLUGINS: '["apoc"]'  # APOC plugin for advanced procedures
    NEO4J_dbms_security_procedures_unrestricted: apoc.*
  ports:
    - "7474:7474"  # HTTP Browser
    - "7687:7687"  # Bolt Protocol
  volumes:
    - neo4j-data:/data
    - neo4j-logs:/logs
```

**APOC Plugin:**
- APOC (Awesome Procedures on Cypher) provides utility functions
- Useful for batch operations, data import, etc.
- Optional for MVP, useful in Phase 2

### Non-Functional Requirements

**Performance:**
- Health check: <500ms
- Simple queries: <100ms
- Write operations: <2 seconds for 100 nodes
- Connection pooling handles concurrent requests

**Reliability:**
- Connection errors handled gracefully
- Sessions always closed (finally blocks)
- Data persisted in Docker volumes (survives restarts)

**Security:**
- Authentication required (username/password)
- Change default password in production
- Credentials stored in environment variables (never committed)

### Testing Strategy

**Unit Tests:**
- Test Neo4j client connection
- Test helper functions (createNode, getNodeById, etc.)

**Integration Tests:**
- Test CRUD operations
- Test relationship creation and traversal
- Test health check endpoint

**Performance Tests:**
- Measure write performance (100 nodes)
- Measure query performance (simple queries)
- Test connection pooling under load

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Graph-Database]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Neo4j-Graph-Database]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-6-Neo4j-Graph-Database]
- [Source: docs/epics.md#Epic-1-Story-E1.7]

**Official Documentation:**
- [Neo4j Getting Started](https://neo4j.com/docs/getting-started/)
- [Neo4j JavaScript Driver](https://neo4j.com/docs/javascript-manual/current/)
- [Neo4j Driver Best Practices](https://neo4j.com/blog/developer/neo4j-driver-best-practices/)
- [Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)

### Security Considerations

**Authentication:**
- Neo4j requires username/password authentication
- Default credentials (neo4j/neo4j) must be changed
- Use strong passwords in production

**Network Security:**
- Neo4j accessible only within Docker network (production)
- Bolt protocol (7687) not exposed publicly (production)
- Browser (7474) accessible only for development/admin

**Data Isolation:**
- No built-in multi-tenancy in Neo4j Community Edition
- Application-level isolation via `user_id` property on nodes
- Queries must filter by `user_id` to enforce isolation

### Prerequisites

- **E1.1** (Next.js 15 Setup) must be completed
- Docker installed and running
- Docker Compose configured

### Dependencies

- **Epic 3** (Document Processing) will populate Finding and Document nodes
- **Epic 4** (Pattern Detection) will use PATTERN_DETECTED relationships
- **Epic 5** (Chat Agent) will query graph for source attribution

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-7-configure-neo4j-graph-database.context.xml)

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent during implementation_

### Completion Notes List

_To be filled by dev agent after completion_

### File List

_To be filled by dev agent with created/modified/deleted files_

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-24 | Max (SM Agent) | Initial story draft created from Epic 1 tech spec |
