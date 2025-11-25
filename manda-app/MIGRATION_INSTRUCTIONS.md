# Database Migration Instructions

## Story: E1.3 - Create PostgreSQL Schema with RLS Policies

### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/cymfyqussypehaeebedn/sql/new)
2. Open the migration file: `supabase/migrations/combined_schema.sql`
3. Copy all the SQL content
4. Paste into the SQL Editor
5. Click "Run" to execute all migrations

### Option 2: Supabase CLI

```bash
# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref cymfyqussypehaeebedn

# Push migrations
npx supabase db push
```

### Option 3: Direct PostgreSQL Connection

```bash
# Get your database URL from Supabase Dashboard > Settings > Database
psql "postgresql://postgres:[PASSWORD]@db.cymfyqussypehaeebedn.supabase.co:5432/postgres" -f supabase/migrations/combined_schema.sql
```

## Verification

After running migrations, verify with these queries:

```sql
-- Check all tables were created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

-- Check pgvector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- List all RLS policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

## Expected Tables

After migration, you should see these 9 tables:
- deals
- documents
- findings
- insights
- conversations
- messages
- irls
- qa_lists
- cims
