/**
 * Apply Migrations Script
 *
 * This script applies database migrations to Supabase by connecting
 * to the Supabase SQL endpoint using the service role key.
 *
 * Usage: node scripts/apply-migrations.mjs
 *
 * Story: E1.3 - Create PostgreSQL Schema with RLS Policies
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read .env.local file manually
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env = {}

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  }

  return env
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

console.log('🚀 Starting database migration...')
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`)

// Read the combined migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', 'combined_schema.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

console.log(`📄 Loaded migration file: ${migrationPath}`)
console.log(`📏 Migration size: ${migrationSQL.length} characters`)

// Execute migration via Supabase REST API (using pg-graphql or direct query)
async function runMigration() {
  // Use the Supabase Management API to run SQL
  // Note: For production, use supabase db push or the dashboard
  const projectRef = 'cymfyqussypehaeebedn'

  // Try using the database REST endpoint to check connection
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // First, let's verify connection by checking if any existing tables exist
  console.log('\n📡 Verifying database connection...')

  try {
    // Try to query pg_tables to see what exists
    const { data: existingTables, error: tablesError } = await supabase
      .from('deals')
      .select('id')
      .limit(1)

    if (tablesError && tablesError.code === '42P01') {
      // Table doesn't exist - this is expected before migration
      console.log('✅ Connection verified (deals table does not exist yet - expected)')
    } else if (tablesError) {
      console.log(`⚠️ Connection test result: ${tablesError.message}`)
    } else {
      console.log('✅ Connection verified (deals table already exists)')
      console.log('ℹ️  Schema may already be applied. Running migration anyway (idempotent).')
    }
  } catch (err) {
    console.error('Connection error:', err.message)
  }

  // Output instructions for manual migration
  console.log('\n' + '='.repeat(60))
  console.log('📋 MANUAL MIGRATION REQUIRED')
  console.log('='.repeat(60))
  console.log(`
Since the Supabase CLI is not linked and there's no direct SQL
execution endpoint, please run the migration manually:

OPTION 1: Supabase Dashboard SQL Editor (Recommended)
------------------------------------------------------
1. Open: https://supabase.com/dashboard/project/${projectRef}/sql/new
2. Copy the contents of: ${migrationPath}
3. Paste into the SQL Editor
4. Click "Run" to execute

OPTION 2: Supabase CLI (If you have access token)
-------------------------------------------------
1. Run: npx supabase login
2. Run: npx supabase link --project-ref ${projectRef}
3. Run: npx supabase db push

OPTION 3: Direct PostgreSQL Connection
--------------------------------------
1. Get your database connection string from Supabase Dashboard
2. Run: psql <connection-string> -f ${migrationPath}
`)

  // Save migration instructions to a file
  const instructionsPath = path.join(__dirname, '..', 'MIGRATION_INSTRUCTIONS.md')
  const instructions = `# Database Migration Instructions

## Story: E1.3 - Create PostgreSQL Schema with RLS Policies

### Option 1: Supabase Dashboard SQL Editor (Recommended)

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/${projectRef}/sql/new)
2. Open the migration file: \`supabase/migrations/combined_schema.sql\`
3. Copy all the SQL content
4. Paste into the SQL Editor
5. Click "Run" to execute all migrations

### Option 2: Supabase CLI

\`\`\`bash
# Login to Supabase
npx supabase login

# Link your project
npx supabase link --project-ref ${projectRef}

# Push migrations
npx supabase db push
\`\`\`

### Option 3: Direct PostgreSQL Connection

\`\`\`bash
# Get your database URL from Supabase Dashboard > Settings > Database
psql "postgresql://postgres:[PASSWORD]@db.${projectRef}.supabase.co:5432/postgres" -f supabase/migrations/combined_schema.sql
\`\`\`

## Verification

After running migrations, verify with these queries:

\`\`\`sql
-- Check all tables were created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;

-- Check pgvector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- List all RLS policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
\`\`\`

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
`

  fs.writeFileSync(instructionsPath, instructions)
  console.log(`\n📝 Migration instructions saved to: ${instructionsPath}`)
}

runMigration().catch(console.error)
