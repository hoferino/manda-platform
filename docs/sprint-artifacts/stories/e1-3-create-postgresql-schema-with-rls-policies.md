# Story 1.3: Create PostgreSQL Schema with RLS Policies

Status: ready-for-dev

## Story

As a **developer**,
I want **a complete PostgreSQL database schema with Row-Level Security (RLS) policies enforcing data isolation**,
so that **users can only access their own data and the system has a solid foundation for all future features**.

## Context

This story creates the entire database schema for the Manda platform, including tables for deals, documents, findings, insights, conversations, IRLs, Q&A lists, and CIMs. Most importantly, it implements Row-Level Security (RLS) policies on all tables to enforce multi-tenant data isolation at the database level. RLS ensures that even if application code has bugs, users cannot access each other's data.

**Architecture Context:** PostgreSQL 18 with pgvector extension for semantic search. RLS policies use Supabase's `auth.uid()` function to identify the current user and filter queries automatically. All tables follow the pattern: `POLICY FOR ALL USING (auth.uid() = user_id)`.

## Acceptance Criteria

### AC1: Database Migration Setup
**Given** the database connection is configured (E1.2)
**When** I run database migrations
**Then** all tables are created in the correct order
**And** Foreign key constraints are enforced
**And** Indexes are created on all foreign keys and query-heavy columns
**And** pgvector extension is enabled

### AC2: Core Tables Creation
**Given** the migration runs successfully
**When** I inspect the database schema
**Then** I see all 9 core tables:
- `deals` - Project metadata
- `documents` - Document tracking
- `findings` - Extracted facts with embeddings
- `insights` - Analyzed patterns
- `conversations` - Chat history
- `messages` - Chat messages
- `irls` - Information Request Lists
- `qa_lists` - Q&A lists
- `cims` - CIM versions
**And** All tables have proper primary keys (UUID)
**And** All tables have `created_at` and `updated_at` timestamps
**And** All tables have `user_id` foreign key to `auth.users`

### AC3: Row-Level Security Policies
**Given** RLS is enabled on all tables
**When** User A queries the `deals` table
**Then** User A sees only their own deals
**And** User A cannot query User B's deals
**When** User A tries to INSERT a deal with User B's user_id
**Then** the database rejects the operation
**When** User A tries to UPDATE User B's deal
**Then** the database rejects the operation

### AC4: Foreign Key Constraints
**Given** the schema is created
**When** I try to insert a document with invalid `deal_id`
**Then** the database rejects with foreign key constraint violation
**When** I delete a deal
**Then** all related documents, findings, insights are cascade deleted
**And** No orphaned records remain

### AC5: Indexes and Performance
**Given** indexes are created
**When** I query deals by `user_id`
**Then** the query uses the index (verified with EXPLAIN)
**And** Query completes in <100ms (NFR-PERF-003)
**When** I query findings with pgvector similarity search
**Then** the vector index is used
**And** Semantic search completes in <500ms

### AC6: pgvector Configuration
**Given** pgvector extension is installed
**When** I create a finding with an embedding vector
**Then** the vector is stored in the `embedding` column
**And** I can perform similarity search using `<=>` operator
**And** Vector dimensions match embedding model (1536 for text-embedding-3-large)

### AC7: Data Validation Constraints
**Given** validation constraints are defined
**When** I try to insert a deal without a `name`
**Then** the database rejects with NOT NULL constraint violation
**When** I try to insert a deal with invalid `status` value
**Then** the database rejects with CHECK constraint violation (if defined)

### AC8: Multi-User Data Isolation Test
**Given** two test users (Alice and Bob) with authenticated sessions
**When** Alice creates 3 deals and Bob creates 2 deals
**Then** Alice's query returns exactly 3 deals
**And** Bob's query returns exactly 2 deals
**And** Neither can see the other's deals
**When** Alice tries to access Bob's deal directly by ID
**Then** the query returns 0 rows (RLS policy blocks access)

## Tasks / Subtasks

- [ ] **Task 1: Set Up Database Migration Tool** (AC: #1)
  - [ ] Choose migration tool: Supabase CLI migrations or dbmate
  - [ ] Install migration tool: `npm install -D supabase` or `brew install dbmate`
  - [ ] Initialize migrations directory: `supabase/migrations/` or `db/migrations/`
  - [ ] Configure migration connection string in `.env.local`
  - [ ] Test migration up/down commands

- [ ] **Task 2: Enable pgvector Extension** (AC: #6)
  - [ ] Create migration: `00001_enable_pgvector.sql`
  - [ ] Add SQL: `CREATE EXTENSION IF NOT EXISTS vector;`
  - [ ] Run migration and verify extension enabled
  - [ ] Test vector operations: `SELECT '[1,2,3]'::vector(3);`

- [ ] **Task 3: Create Deals Table** (AC: #2, #3)
  - [ ] Create migration: `00002_create_deals_table.sql`
  - [ ] Define schema:
    ```sql
    CREATE TABLE deals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        name text NOT NULL,
        company_name text,
        industry text,
        deal_type text,
        status text DEFAULT 'active',
        irl_template text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_deals_user_id ON deals(user_id);
    ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
    CREATE POLICY deals_isolation_policy ON deals
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration and verify table created
  - [ ] Test RLS policy with multi-user queries

- [ ] **Task 4: Create Documents Table** (AC: #2, #3, #4)
  - [ ] Create migration: `00003_create_documents_table.sql`
  - [ ] Define schema with foreign key to deals:
    ```sql
    CREATE TABLE documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        name text NOT NULL,
        file_path text NOT NULL,
        file_size bigint,
        mime_type text,
        upload_status text DEFAULT 'pending',
        processing_status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_documents_deal_id ON documents(deal_id);
    CREATE INDEX idx_documents_user_id ON documents(user_id);
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY documents_isolation_policy ON documents
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration and verify foreign key constraint
  - [ ] Test cascade delete (delete deal → documents deleted)

- [ ] **Task 5: Create Findings Table with pgvector** (AC: #2, #3, #6)
  - [ ] Create migration: `00004_create_findings_table.sql`
  - [ ] Define schema with embedding column:
    ```sql
    CREATE TABLE findings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        text text NOT NULL,
        source_document text,
        page_number int,
        confidence float,
        embedding vector(1536),  -- OpenAI text-embedding-3-large dimensions
        metadata jsonb,
        created_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_findings_deal_id ON findings(deal_id);
    CREATE INDEX idx_findings_user_id ON findings(user_id);
    CREATE INDEX idx_findings_embedding ON findings USING ivfflat (embedding vector_cosine_ops);
    ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY findings_isolation_policy ON findings
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration and verify vector index created
  - [ ] Test vector similarity search: `SELECT * FROM findings ORDER BY embedding <=> '[...]'::vector LIMIT 10;`

- [ ] **Task 6: Create Insights Table** (AC: #2, #3)
  - [ ] Create migration: `00005_create_insights_table.sql`
  - [ ] Define schema:
    ```sql
    CREATE TABLE insights (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        insight_type text NOT NULL,
        text text NOT NULL,
        confidence float,
        source_finding_ids uuid[],
        metadata jsonb,
        created_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_insights_deal_id ON insights(deal_id);
    CREATE INDEX idx_insights_user_id ON insights(user_id);
    ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
    CREATE POLICY insights_isolation_policy ON insights
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration

- [ ] **Task 7: Create Conversations and Messages Tables** (AC: #2, #3)
  - [ ] Create migration: `00006_create_conversations_messages_tables.sql`
  - [ ] Define conversations schema:
    ```sql
    CREATE TABLE conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        title text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_conversations_deal_id ON conversations(deal_id);
    CREATE INDEX idx_conversations_user_id ON conversations(user_id);
    ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY conversations_isolation_policy ON conversations
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Define messages schema:
    ```sql
    CREATE TABLE messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
        role text NOT NULL,  -- 'human', 'ai', 'tool'
        content text NOT NULL,
        tool_calls jsonb,
        created_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
    ```
  - [ ] Note: Messages inherit RLS via conversation_id (no direct user_id)
  - [ ] Run migration

- [ ] **Task 8: Create IRLs Table** (AC: #2, #3)
  - [ ] Create migration: `00007_create_irls_table.sql`
  - [ ] Define schema:
    ```sql
    CREATE TABLE irls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        name text NOT NULL,
        template_type text,
        sections jsonb NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_irls_deal_id ON irls(deal_id);
    CREATE INDEX idx_irls_user_id ON irls(user_id);
    ALTER TABLE irls ENABLE ROW LEVEL SECURITY;
    CREATE POLICY irls_isolation_policy ON irls
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration

- [ ] **Task 9: Create Q&A Lists Table** (AC: #2, #3)
  - [ ] Create migration: `00008_create_qa_lists_table.sql`
  - [ ] Define schema:
    ```sql
    CREATE TABLE qa_lists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        question text NOT NULL,
        answer text,
        sources jsonb,
        status text DEFAULT 'pending',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_qa_lists_deal_id ON qa_lists(deal_id);
    CREATE INDEX idx_qa_lists_user_id ON qa_lists(user_id);
    ALTER TABLE qa_lists ENABLE ROW LEVEL SECURITY;
    CREATE POLICY qa_lists_isolation_policy ON qa_lists
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration

- [ ] **Task 10: Create CIMs Table** (AC: #2, #3)
  - [ ] Create migration: `00009_create_cims_table.sql`
  - [ ] Define schema:
    ```sql
    CREATE TABLE cims (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
        user_id uuid REFERENCES auth.users(id) NOT NULL,
        version int NOT NULL DEFAULT 1,
        title text NOT NULL,
        content jsonb NOT NULL,
        export_formats text[],
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX idx_cims_deal_id ON cims(deal_id);
    CREATE INDEX idx_cims_user_id ON cims(user_id);
    ALTER TABLE cims ENABLE ROW LEVEL SECURITY;
    CREATE POLICY cims_isolation_policy ON cims
        FOR ALL USING (auth.uid() = user_id);
    ```
  - [ ] Run migration

- [ ] **Task 11: Add Updated_at Triggers** (AC: #2)
  - [ ] Create migration: `00010_add_updated_at_triggers.sql`
  - [ ] Create trigger function:
    ```sql
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    ```
  - [ ] Add triggers to tables with `updated_at`:
    ```sql
    CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    -- Repeat for documents, conversations, irls, qa_lists, cims
    ```
  - [ ] Run migration and test trigger

- [ ] **Task 12: Generate TypeScript Types** (AC: #2)
  - [ ] Install Supabase type generator: `npm install -D supabase`
  - [ ] Run type generation: `npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts`
  - [ ] Update Supabase client to use generated types
  - [ ] Verify TypeScript autocomplete for table schemas

- [ ] **Task 13: RLS Testing** (AC: #3, #8)
  - [ ] Create test script: `scripts/test-rls.ts`
  - [ ] Create two test users (Alice and Bob) via Supabase Auth
  - [ ] Authenticate as Alice, create 3 deals
  - [ ] Authenticate as Bob, create 2 deals
  - [ ] Query as Alice, verify 3 deals returned
  - [ ] Query as Bob, verify 2 deals returned
  - [ ] Attempt cross-user access, verify 0 rows returned
  - [ ] Test UPDATE attempt, verify rejection
  - [ ] Test DELETE attempt, verify rejection
  - [ ] Document RLS verification in README

- [ ] **Task 14: Performance Testing** (AC: #5)
  - [ ] Create test data: 100 deals, 500 documents, 5000 findings
  - [ ] Run EXPLAIN ANALYZE on user_id queries
  - [ ] Verify indexes are used
  - [ ] Measure query times (<100ms for indexed queries)
  - [ ] Test vector similarity search performance (<500ms)
  - [ ] Optimize slow queries if needed

- [ ] **Task 15: Documentation** (AC: All)
  - [ ] Document schema in README or dedicated schema.md
  - [ ] Add ER diagram (optional, can use dbdiagram.io)
  - [ ] Document RLS policies and security model
  - [ ] Add migration rollback instructions
  - [ ] Document pgvector usage for semantic search
  - [ ] Add troubleshooting section for common issues

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Database:**
- **PostgreSQL 18**: Latest stable, released Nov 2025
  - Docs: [PostgreSQL 18 Documentation](https://www.postgresql.org/docs/18/)
  - RLS: [Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- **pgvector 0.8+**: Vector similarity search extension
  - Docs: [pgvector GitHub](https://github.com/pgvector/pgvector)
  - Best Practices: Use ivfflat index for large datasets (>100K vectors)
- **Supabase**: Managed PostgreSQL with built-in RLS support
  - RLS Guide: [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Row-Level Security (RLS) Architecture

**Why RLS is Critical:**
- Database-level enforcement (not application logic)
- Even if application code has bugs, users cannot access other users' data
- Defense-in-depth security strategy
- Required for multi-tenant SaaS applications

**RLS Policy Pattern:**
```sql
-- Step 1: Enable RLS on table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policy (FOR ALL = SELECT + INSERT + UPDATE + DELETE)
CREATE POLICY table_isolation_policy ON table_name
    FOR ALL
    USING (auth.uid() = user_id);
```

**How RLS Works:**
1. User authenticates via Supabase Auth
2. Supabase sets `auth.uid()` in PostgreSQL session
3. Every query automatically includes `WHERE auth.uid() = user_id` via RLS policy
4. No application code changes needed - enforced at database level

### Database Schema Relationships

**Entity Relationships:**
```
auth.users (Supabase managed)
  ├─ deals (1:N) - Projects owned by user
  │   ├─ documents (1:N) - Files uploaded to project
  │   │   └─ findings (1:N) - Extracted facts from documents
  │   ├─ insights (1:N) - Analyzed patterns
  │   ├─ conversations (1:N) - Chat sessions
  │   │   └─ messages (1:N) - Chat messages
  │   ├─ irls (1:N) - Information Request Lists
  │   ├─ qa_lists (1:N) - Q&A lists
  │   └─ cims (1:N) - CIM versions
```

**Cascade Deletes:**
- Delete deal → all related records deleted (ON DELETE CASCADE)
- Delete document → all findings for that document deleted
- Delete conversation → all messages deleted
- Prevents orphaned records

### pgvector Configuration

**Embedding Dimensions:**
- OpenAI text-embedding-3-large: 1536 dimensions
- Define column: `embedding vector(1536)`

**Similarity Search Operators:**
- `<=>` : Cosine distance (most common for embeddings)
- `<->` : L2 distance (Euclidean)
- `<#>` : Inner product

**Index Types:**
- `ivfflat`: Good for large datasets (>10K vectors)
- `hnsw`: Better recall, more memory (consider in Phase 2)

**Example Query:**
```sql
SELECT text, 1 - (embedding <=> $1::vector) AS similarity
FROM findings
WHERE deal_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

### Migration Best Practices

**Naming Convention:**
- `00001_description.sql` (sequential numbering)
- Use descriptive names: `create_deals_table`, `add_rls_policies`

**Migration Order:**
1. Enable extensions (pgvector)
2. Create tables in dependency order (deals first, then documents, then findings)
3. Add indexes after table creation
4. Enable RLS and create policies last

**Rollback Strategy:**
- Always write down migrations (DROP TABLE, DROP POLICY, etc.)
- Test rollback before deploying to production
- Keep migrations idempotent when possible (IF NOT EXISTS)

### Non-Functional Requirements

**Performance (NFR-PERF-003):**
- Deal CRUD operations: <200ms
- RLS policy evaluation: <50ms overhead
- Indexed queries (deals by user_id): <100ms
- Vector similarity search: <500ms (for 10K vectors)

**Security (NFR-SEC-002):**
- All tables enforce RLS policies (no exceptions)
- Users can ONLY access their own deals
- RLS policy: `auth.uid() = user_id` on all multi-tenant tables
- No admin bypass in MVP

**Reliability (NFR-REL-002):**
- Foreign key constraints enforce referential integrity
- Transactions for multi-step operations
- No orphaned records (cascading deletes)
- Database migrations tested before deployment

### Testing Strategy

**Unit Tests:**
- Test migration up/down
- Test constraint violations
- Test trigger functions

**Integration Tests:**
- Test RLS policies with multiple users
- Test foreign key constraints
- Test cascade deletes
- Test vector similarity search

**Performance Tests:**
- Query performance with realistic data volumes
- Index usage verification (EXPLAIN)
- RLS overhead measurement

**Security Tests:**
- Multi-user isolation verification
- Cross-user access attempts (should fail)
- SQL injection prevention (parameterized queries)

### Common Pitfalls & Solutions

**Pitfall: Forgetting to enable RLS**
- Solution: Always enable RLS immediately after creating table
- Verification: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`

**Pitfall: RLS policy too restrictive**
- Problem: Users can't insert their own records
- Solution: Ensure INSERT policy allows `user_id = auth.uid()`

**Pitfall: Service role bypasses RLS**
- Problem: Backend using service role key sees all data
- Solution: Use anon key for user-scoped queries, service key only for admin operations

**Pitfall: Missing indexes on RLS columns**
- Problem: RLS queries are slow
- Solution: Always index `user_id` column

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Data-Architecture]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Data-Models]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-3-Data-Isolation]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-5-Database-Schema]

**Official Documentation:**
- [PostgreSQL 18 Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)

### Security Considerations

**Critical Security Requirements:**
- RLS MUST be enabled on all tables before production
- Test RLS policies with multiple user accounts
- Never use service role key in client-side code
- Validate RLS with penetration testing before launch
- Monitor for RLS policy violations in logs (E1.9)

**RLS Policy Testing Checklist:**
- [ ] User A cannot SELECT User B's records
- [ ] User A cannot INSERT with User B's user_id
- [ ] User A cannot UPDATE User B's records
- [ ] User A cannot DELETE User B's records
- [ ] Service role can access all records (admin operations)

### Prerequisites

- **E1.2** (Supabase Auth) must be completed
- Supabase project created and configured
- Database connection string available

### Dependencies

- **E1.4** (Projects Overview) depends on `deals` table
- **E1.5** (Project Creation) depends on `deals` table
- **All Epic 2-5 stories** depend on this schema foundation

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-3-create-postgresql-schema-with-rls-policies.context.xml)

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
