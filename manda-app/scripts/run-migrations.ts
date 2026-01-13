/**
 * Migration Runner Script
 *
 * Runs SQL migrations against the Supabase database using the service role key.
 * This script is used when the Supabase CLI is not available or not linked.
 *
 * Usage: npx tsx scripts/run-migrations.ts
 *
 * Story: E1.3 - Create PostgreSQL Schema with RLS Policies
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Migration directory
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

/**
 * Get all migration files sorted by name
 */
function getMigrationFiles(): string[] {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
  return files
}

/**
 * Run a single migration file
 */
async function runMigration(filename: string): Promise<{ success: boolean; error?: string }> {
  const filepath = path.join(MIGRATIONS_DIR, filename)
  const sql = fs.readFileSync(filepath, 'utf-8')

  console.log(`\n📄 Running migration: ${filename}`)

  try {
    // Execute the SQL using Supabase's rpc function or direct query
    // Note: For complex migrations, we use the Supabase REST API
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // If exec_sql function doesn't exist, we need an alternative approach
      // This typically means we need to use the Supabase Dashboard or CLI
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log(`⚠️  Cannot execute SQL directly. Migration SQL saved to file.`)
        console.log(`   Please run this migration via Supabase Dashboard SQL Editor.`)
        return { success: false, error: 'exec_sql function not available' }
      }
      throw error
    }

    console.log(`✅ Migration ${filename} completed successfully`)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`❌ Migration ${filename} failed:`, message)
    return { success: false, error: message }
  }
}

/**
 * Main function to run all migrations
 */
async function main() {
  console.log('🚀 Starting database migrations...')
  console.log(`📁 Migrations directory: ${MIGRATIONS_DIR}`)
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`)

  const files = getMigrationFiles()
  console.log(`\n📋 Found ${files.length} migration files:`)
  files.forEach(f => console.log(`   - ${f}`))

  let successCount = 0
  let failCount = 0
  const failedMigrations: string[] = []

  for (const file of files) {
    const result = await runMigration(file)
    if (result.success) {
      successCount++
    } else {
      failCount++
      failedMigrations.push(file)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Migration Summary')
  console.log('='.repeat(50))
  console.log(`✅ Successful: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)

  if (failedMigrations.length > 0) {
    console.log('\n⚠️  Failed migrations:')
    failedMigrations.forEach(f => console.log(`   - ${f}`))
    console.log('\n💡 Tip: You can run migrations manually via Supabase Dashboard SQL Editor')
    console.log('   Copy the SQL content from each migration file and execute it.')
  }

  // Exit with error code if any migrations failed
  if (failCount > 0) {
    process.exit(1)
  }

  console.log('\n✨ All migrations completed successfully!')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
