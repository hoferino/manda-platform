# Manda Platform Database Schema

## Overview

This directory contains the PostgreSQL database schema for the Manda M&A Intelligence Platform, including:
- Database migrations (10 migration files)
- Row-Level Security (RLS) policies for multi-tenant data isolation
- pgvector extension for semantic search capabilities
- TypeScript type definitions

**Story:** E1.3 - Create PostgreSQL Schema with RLS Policies

## Schema Architecture

### Entity Relationship Diagram

```
auth.users (Supabase managed)
  ├─ deals (1:N) - M&A projects owned by user
  │   ├─ documents (1:N) - Files uploaded to project
  │   │   └─ findings (1:N) - Extracted facts from documents
  │   ├─ insights (1:N) - AI-analyzed patterns
  │   ├─ conversations (1:N) - Chat sessions
  │   │   └─ messages (1:N) - Chat messages
  │   ├─ irls (1:N) - Information Request Lists
  │   ├─ qa_lists (1:N) - Q&A lists
  │   └─ cims (1:N) - CIM versions
```

### Tables (9 total)

| Table | Description | RLS Policy |
|-------|-------------|------------|
| `deals` | M&A project/deal metadata | `user_id = auth.uid()` |
| `documents` | Document tracking with processing status | `user_id = auth.uid()` |
| `findings` | Extracted facts with pgvector embeddings | `user_id = auth.uid()` |
| `insights` | AI-generated patterns and contradictions | `user_id = auth.uid()` |
| `conversations` | Chat conversation sessions | `user_id = auth.uid()` |
| `messages` | Individual chat messages | via `conversation_id` |
| `irls` | Information Request Lists | `user_id = auth.uid()` |
| `qa_lists` | Questions and answers | `user_id = auth.uid()` |
| `cims` | Confidential Information Memorandums | `user_id = auth.uid()` |

## Row-Level Security (RLS)

All tables have RLS enabled with policies that ensure users can only access their own data:

```sql
-- Standard RLS policy pattern
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY table_isolation_policy ON table_name
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

### Security Guarantees

- **SELECT**: Users can only query their own records
- **INSERT**: Records can only be created with the user's own `user_id`
- **UPDATE**: Users can only modify their own records
- **DELETE**: Users can only delete their own records

## pgvector Configuration

The `findings` table includes a vector embedding column for semantic search:

```sql
embedding vector(1536)  -- OpenAI text-embedding-3-large dimensions
```

### Index

```sql
CREATE INDEX idx_findings_embedding ON findings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### Similarity Search

```sql
-- Find similar findings
SELECT text, 1 - (embedding <=> $1::vector) AS similarity
FROM findings
WHERE deal_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

## Migrations

Migrations are in the `migrations/` directory:

| File | Description |
|------|-------------|
| `00001_enable_pgvector.sql` | Enable pgvector extension |
| `00002_create_deals_table.sql` | Deals table with RLS |
| `00003_create_documents_table.sql` | Documents table with RLS |
| `00004_create_findings_table.sql` | Findings with pgvector |
| `00005_create_insights_table.sql` | Insights table with RLS |
| `00006_create_conversations_messages_tables.sql` | Chat tables |
| `00007_create_irls_table.sql` | IRLs table with RLS |
| `00008_create_qa_lists_table.sql` | Q&A lists with RLS |
| `00009_create_cims_table.sql` | CIMs table with RLS |
| `00010_add_updated_at_triggers.sql` | Auto-update timestamps |

### Running Migrations

```bash
# Link to your Supabase project
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push
```

### Generating Types

```bash
npx supabase gen types typescript --project-id <project-id> > lib/supabase/database.types.ts
```

## Testing

### RLS Tests

```bash
npx tsx scripts/test-rls.ts
```

Tests verify:
- Users can only see their own deals
- Cross-user access returns 0 rows
- INSERT/UPDATE/DELETE blocked for other users' data
- Cascade deletes work correctly
- pgvector embeddings work

### Performance Tests

```bash
npx tsx scripts/test-performance.ts
```

Tests verify:
- CRUD operations < 200ms
- Indexed queries < 150ms
- Bulk operations perform well
- Vector operations work correctly

## TypeScript Types

Types are auto-generated in `lib/supabase/database.types.ts` with convenience aliases in `lib/supabase/types.ts`:

```typescript
import type { Deal, DealInsert, Finding, Conversation } from '@/lib/supabase/types'
```

## Cascade Delete Behavior

- Deleting a `deal` → deletes all related `documents`, `findings`, `insights`, `conversations`, `irls`, `qa_lists`, `cims`
- Deleting a `document` → deletes related `findings`
- Deleting a `conversation` → deletes related `messages`

## Performance Considerations

### Indexed Columns

All foreign keys and frequently queried columns are indexed:
- `user_id` on all tables
- `deal_id` on child tables
- `status` columns
- `embedding` column (IVFFlat index)

### Query Best Practices

1. Always filter by `user_id` or `deal_id` when possible
2. Use pagination for large result sets
3. Use appropriate index hints for complex queries
4. Monitor slow queries in Supabase Dashboard

## Troubleshooting

### RLS Policy Issues

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- List all policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### pgvector Issues

```sql
-- Check extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Test vector operations
SELECT '[1,2,3]'::vector(3);
```

### Performance Issues

```sql
-- Check index usage
EXPLAIN ANALYZE SELECT * FROM deals WHERE user_id = 'uuid';
```

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
