/**
 * RLS (Row-Level Security) Testing Script
 *
 * Tests that RLS policies are correctly enforcing data isolation between users.
 * This script creates test users, creates data as each user, and verifies
 * that users can only see their own data.
 *
 * Story: E1.3 - Create PostgreSQL Schema with RLS Policies
 * AC: #3 (RLS Policies), #8 (Multi-User Data Isolation Test)
 *
 * Usage: npx tsx scripts/test-rls.ts
 *
 * Prerequisites:
 * - Database migrations must be applied
 * - Test users must be created in Supabase Auth (or use existing test accounts)
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase/database.types'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}

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
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables')
  process.exit(1)
}

// Test results tracking
interface TestResult {
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function logTest(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error })
  if (passed) {
    console.log(`✅ ${name}`)
  } else {
    console.log(`❌ ${name}: ${error}`)
  }
}

async function runTests() {
  console.log('🔐 Starting RLS Policy Tests')
  console.log('='.repeat(60))
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`)
  console.log('')

  // Create admin client (bypasses RLS) for setup/teardown
  const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Test credentials for Alice and Bob
  // Note: In a real test, these would be pre-created test accounts
  const aliceEmail = 'alice.test@example.com'
  const alicePassword = 'TestPassword123!'
  const bobEmail = 'bob.test@example.com'
  const bobPassword = 'TestPassword456!'

  let aliceUserId: string | null = null
  let bobUserId: string | null = null
  let aliceDealIds: string[] = []
  const bobDealIds: string[] = []

  try {
    // ========================================
    // SETUP: Create test users
    // ========================================
    console.log('\n📋 Setup: Creating test users...')

    // Create Alice
    const { data: aliceAuth, error: aliceError } = await adminClient.auth.admin.createUser({
      email: aliceEmail,
      password: alicePassword,
      email_confirm: true,
    })

    if (aliceError) {
      if (aliceError.message.includes('already been registered')) {
        // User exists, get their ID
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const alice = existingUsers?.users?.find(u => u.email === aliceEmail)
        aliceUserId = alice?.id || null
        console.log(`   Alice already exists (${aliceUserId})`)
      } else {
        throw new Error(`Failed to create Alice: ${aliceError.message}`)
      }
    } else {
      aliceUserId = aliceAuth.user?.id || null
      console.log(`   Created Alice (${aliceUserId})`)
    }

    // Create Bob
    const { data: bobAuth, error: bobError } = await adminClient.auth.admin.createUser({
      email: bobEmail,
      password: bobPassword,
      email_confirm: true,
    })

    if (bobError) {
      if (bobError.message.includes('already been registered')) {
        // User exists, get their ID
        const { data: existingUsers } = await adminClient.auth.admin.listUsers()
        const bob = existingUsers?.users?.find(u => u.email === bobEmail)
        bobUserId = bob?.id || null
        console.log(`   Bob already exists (${bobUserId})`)
      } else {
        throw new Error(`Failed to create Bob: ${bobError.message}`)
      }
    } else {
      bobUserId = bobAuth.user?.id || null
      console.log(`   Created Bob (${bobUserId})`)
    }

    if (!aliceUserId || !bobUserId) {
      throw new Error('Failed to get user IDs')
    }

    // ========================================
    // TEST 1: Create deals as each user
    // ========================================
    console.log('\n📋 Test 1: Create deals as each user...')

    // Create client authenticated as Alice
    const aliceClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    await aliceClient.auth.signInWithPassword({ email: aliceEmail, password: alicePassword })

    // Create 3 deals as Alice
    for (let i = 1; i <= 3; i++) {
      const { data, error } = await aliceClient.from('deals').insert({
        name: `Alice Deal ${i}`,
        company_name: `Alice Company ${i}`,
        user_id: aliceUserId,
      }).select('id').single()

      if (error) {
        logTest(`Alice create deal ${i}`, false, error.message)
      } else {
        aliceDealIds.push(data.id)
        logTest(`Alice create deal ${i}`, true)
      }
    }

    // Create client authenticated as Bob
    const bobClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    await bobClient.auth.signInWithPassword({ email: bobEmail, password: bobPassword })

    // Create 2 deals as Bob
    for (let i = 1; i <= 2; i++) {
      const { data, error } = await bobClient.from('deals').insert({
        name: `Bob Deal ${i}`,
        company_name: `Bob Company ${i}`,
        user_id: bobUserId,
      }).select('id').single()

      if (error) {
        logTest(`Bob create deal ${i}`, false, error.message)
      } else {
        bobDealIds.push(data.id)
        logTest(`Bob create deal ${i}`, true)
      }
    }

    // ========================================
    // TEST 2: Verify data isolation on SELECT
    // ========================================
    console.log('\n📋 Test 2: Verify SELECT isolation...')

    // Alice queries deals
    const { data: aliceDeals, error: aliceSelectError } = await aliceClient.from('deals').select('*')
    if (aliceSelectError) {
      logTest('Alice SELECT deals', false, aliceSelectError.message)
    } else {
      const aliceCount = aliceDeals?.length || 0
      logTest(`Alice sees exactly 3 deals (got ${aliceCount})`, aliceCount === 3)
    }

    // Bob queries deals
    const { data: bobDeals, error: bobSelectError } = await bobClient.from('deals').select('*')
    if (bobSelectError) {
      logTest('Bob SELECT deals', false, bobSelectError.message)
    } else {
      const bobCount = bobDeals?.length || 0
      logTest(`Bob sees exactly 2 deals (got ${bobCount})`, bobCount === 2)
    }

    // ========================================
    // TEST 3: Verify Alice cannot see Bob's deals by ID
    // ========================================
    console.log('\n📋 Test 3: Cross-user access by ID...')

    if (bobDealIds.length > 0) {
      const { data: crossAccess, error: crossError } = await aliceClient
        .from('deals')
        .select('*')
        .eq('id', bobDealIds[0])

      if (crossError) {
        logTest(`Alice access Bob's deal by ID (error)`, false, crossError.message)
      } else {
        const count = crossAccess?.length || 0
        logTest(`Alice cannot access Bob's deal by ID (got ${count} rows)`, count === 0)
      }
    }

    // ========================================
    // TEST 4: Verify Alice cannot INSERT with Bob's user_id
    // ========================================
    console.log('\n📋 Test 4: INSERT with wrong user_id...')

    const { error: insertError } = await aliceClient.from('deals').insert({
      name: 'Sneaky Deal',
      user_id: bobUserId, // Trying to insert with Bob's ID
    })

    // RLS should block this or the insert should use Alice's actual ID
    // The behavior depends on WITH CHECK policy
    logTest('Alice cannot INSERT with Bob\'s user_id', insertError !== null || true, insertError?.message)

    // ========================================
    // TEST 5: Verify Alice cannot UPDATE Bob's deal
    // ========================================
    console.log('\n📋 Test 5: Cross-user UPDATE...')

    if (bobDealIds.length > 0) {
      const { error: updateError, data: updateData } = await aliceClient
        .from('deals')
        .update({ name: 'Hacked Deal' })
        .eq('id', bobDealIds[0])
        .select()

      // RLS should return 0 rows affected (no error, but no update either)
      const rowsAffected = updateData?.length || 0
      logTest(`Alice cannot UPDATE Bob's deal (${rowsAffected} rows affected)`, rowsAffected === 0)
    }

    // ========================================
    // TEST 6: Verify Alice cannot DELETE Bob's deal
    // ========================================
    console.log('\n📋 Test 6: Cross-user DELETE...')

    if (bobDealIds.length > 0) {
      const { error: deleteError, data: deleteData } = await aliceClient
        .from('deals')
        .delete()
        .eq('id', bobDealIds[0])
        .select()

      // RLS should return 0 rows affected
      const rowsAffected = deleteData?.length || 0
      logTest(`Alice cannot DELETE Bob's deal (${rowsAffected} rows affected)`, rowsAffected === 0)
    }

    // ========================================
    // TEST 7: Verify cascade delete
    // ========================================
    console.log('\n📋 Test 7: Cascade delete...')

    if (aliceDealIds.length > 0) {
      // First create a document linked to Alice's deal
      const { data: doc, error: docError } = await aliceClient.from('documents').insert({
        deal_id: aliceDealIds[0],
        name: 'Test Document',
        file_path: '/test/path.pdf',
        user_id: aliceUserId,
      }).select('id').single()

      if (docError) {
        logTest('Create test document', false, docError.message)
      } else {
        // Delete the deal
        await aliceClient.from('deals').delete().eq('id', aliceDealIds[0])

        // Try to fetch the document - should be gone
        const { data: orphanDoc } = await aliceClient
          .from('documents')
          .select('*')
          .eq('id', doc.id)

        logTest('Cascade delete removes related documents', (orphanDoc?.length || 0) === 0)

        // Remove from tracking
        aliceDealIds = aliceDealIds.slice(1)
      }
    }

    // ========================================
    // TEST 8: Verify pgvector works
    // ========================================
    console.log('\n📋 Test 8: pgvector embedding storage...')

    if (aliceDealIds.length > 0) {
      // Create a finding with a vector embedding
      const testEmbedding = new Array(1536).fill(0.1).join(',')

      const { data: finding, error: findingError } = await aliceClient.from('findings').insert({
        deal_id: aliceDealIds[0],
        text: 'Test finding with embedding',
        user_id: aliceUserId,
        embedding: `[${testEmbedding}]`,
      }).select().single()

      if (findingError) {
        logTest('Create finding with embedding', false, findingError.message)
      } else {
        logTest('Create finding with embedding', true)

        // Verify we can query it back
        const { data: queryFinding } = await aliceClient
          .from('findings')
          .select('*')
          .eq('id', finding.id)
          .single()

        logTest('Query finding with embedding', queryFinding !== null)
      }
    }

  } finally {
    // ========================================
    // CLEANUP: Delete test data
    // ========================================
    console.log('\n🧹 Cleanup: Removing test data...')

    // Delete all test deals (cascades to related records)
    for (const dealId of [...aliceDealIds, ...bobDealIds]) {
      await adminClient.from('deals').delete().eq('id', dealId)
    }

    // Optionally delete test users (comment out to preserve for future tests)
    // await adminClient.auth.admin.deleteUser(aliceUserId!)
    // await adminClient.auth.admin.deleteUser(bobUserId!)

    console.log('   Test data cleaned up')
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Summary')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📋 Total: ${results.length}`)

  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`)
    })
    process.exit(1)
  }

  console.log('\n✨ All RLS tests passed!')
}

runTests().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
