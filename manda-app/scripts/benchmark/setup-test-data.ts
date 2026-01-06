/**
 * Test Data Setup Script
 *
 * Creates or validates test data required for benchmark runs.
 * Story: E13.7 - Performance Benchmarking Suite (AC: #2)
 *
 * Usage:
 *   npx tsx scripts/benchmark/setup-test-data.ts
 *   npx tsx scripts/benchmark/setup-test-data.ts --cleanup
 */

import { createClient } from '@supabase/supabase-js'

interface SetupResult {
  success: boolean
  dealId?: string
  conversationId?: string
  errors: string[]
}

/**
 * Validate environment configuration
 */
function validateEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not set')
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  }

  // Either auth token or user credentials required
  const hasAuthToken = !!process.env.BENCHMARK_AUTH_TOKEN
  const hasUserCredentials =
    !!process.env.BENCHMARK_USER_EMAIL && !!process.env.BENCHMARK_USER_PASSWORD

  if (!hasAuthToken && !hasUserCredentials) {
    errors.push(
      'Authentication required: Set BENCHMARK_AUTH_TOKEN or BENCHMARK_USER_EMAIL + BENCHMARK_USER_PASSWORD'
    )
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Get authenticated Supabase client
 */
async function getAuthenticatedClient(): Promise<ReturnType<typeof createClient>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // If using user credentials, sign in
  if (process.env.BENCHMARK_USER_EMAIL && process.env.BENCHMARK_USER_PASSWORD) {
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.BENCHMARK_USER_EMAIL,
      password: process.env.BENCHMARK_USER_PASSWORD,
    })

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  return supabase
}

/**
 * Check if a test deal exists and is accessible
 */
async function verifyTestDeal(
  supabase: ReturnType<typeof createClient>,
  dealId: string
): Promise<{ valid: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', dealId)
    .single()

  if (error) {
    return { valid: false, error: `Deal not found: ${error.message}` }
  }

  if (!data) {
    return { valid: false, error: 'Deal not found' }
  }

  console.log(`✅ Test deal found: ${data.name} (${data.id})`)
  return { valid: true }
}

/**
 * Create or get a test conversation for benchmarks
 */
async function ensureTestConversation(
  supabase: ReturnType<typeof createClient>,
  dealId: string
): Promise<{ conversationId: string; isNew: boolean }> {
  // Check for existing benchmark conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('project_id', dealId)
    .eq('title', 'Benchmark Test Conversation')
    .single()

  if (existing) {
    console.log(`✅ Using existing conversation: ${existing.id}`)
    return { conversationId: existing.id, isNew: false }
  }

  // Create new conversation
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      project_id: dealId,
      title: 'Benchmark Test Conversation',
    })
    .select('id')
    .single()

  if (error || !newConv) {
    throw new Error(`Failed to create conversation: ${error?.message}`)
  }

  console.log(`✅ Created new conversation: ${newConv.id}`)
  return { conversationId: newConv.id, isNew: true }
}

/**
 * Verify test deal has documents for retrieval queries
 */
async function verifyDocuments(
  supabase: ReturnType<typeof createClient>,
  dealId: string
): Promise<{ count: number; hasProcessed: boolean }> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, status')
    .eq('project_id', dealId)

  if (error) {
    console.warn(`⚠️  Could not check documents: ${error.message}`)
    return { count: 0, hasProcessed: false }
  }

  const processedCount = data?.filter((d) => d.status === 'completed').length ?? 0
  const totalCount = data?.length ?? 0

  console.log(`📄 Documents: ${processedCount} processed / ${totalCount} total`)

  return {
    count: totalCount,
    hasProcessed: processedCount > 0,
  }
}

/**
 * Run setup validation
 */
async function setup(): Promise<SetupResult> {
  console.log('🔧 Benchmark Test Data Setup')
  console.log('')

  const result: SetupResult = {
    success: false,
    errors: [],
  }

  // Validate environment
  const envCheck = validateEnvironment()
  if (!envCheck.valid) {
    console.error('❌ Environment validation failed:')
    envCheck.errors.forEach((e) => console.error(`   - ${e}`))
    result.errors = envCheck.errors
    return result
  }
  console.log('✅ Environment configuration valid')

  // Get deal ID
  const dealId = process.env.BENCHMARK_DEAL_ID
  if (!dealId) {
    console.error('❌ BENCHMARK_DEAL_ID is not set')
    result.errors.push('BENCHMARK_DEAL_ID is not set')
    return result
  }

  try {
    // Get authenticated client
    const supabase = await getAuthenticatedClient()
    console.log('✅ Authenticated successfully')

    // Verify deal exists
    const dealCheck = await verifyTestDeal(supabase, dealId)
    if (!dealCheck.valid) {
      result.errors.push(dealCheck.error!)
      return result
    }
    result.dealId = dealId

    // Ensure conversation exists
    const convResult = await ensureTestConversation(supabase, dealId)
    result.conversationId = convResult.conversationId

    // Verify documents
    const docResult = await verifyDocuments(supabase, dealId)
    if (!docResult.hasProcessed) {
      console.warn('⚠️  No processed documents found - retrieval queries may fail')
    }

    result.success = true

    console.log('')
    console.log('✅ Setup complete!')
    console.log('')
    console.log('Add these to your environment:')
    console.log(`   BENCHMARK_DEAL_ID=${result.dealId}`)
    console.log(`   BENCHMARK_CONVERSATION_ID=${result.conversationId}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`❌ Setup failed: ${message}`)
    result.errors.push(message)
  }

  return result
}

/**
 * Cleanup test artifacts
 */
async function cleanup(): Promise<void> {
  console.log('🧹 Cleaning up benchmark test artifacts')
  console.log('')

  const envCheck = validateEnvironment()
  if (!envCheck.valid) {
    console.error('❌ Environment validation failed')
    return
  }

  const dealId = process.env.BENCHMARK_DEAL_ID
  if (!dealId) {
    console.error('❌ BENCHMARK_DEAL_ID is not set')
    return
  }

  try {
    const supabase = await getAuthenticatedClient()

    // Delete benchmark conversations (but keep the deal)
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('project_id', dealId)
      .eq('title', 'Benchmark Test Conversation')

    if (error) {
      console.error(`❌ Failed to delete conversations: ${error.message}`)
    } else {
      console.log('✅ Deleted benchmark conversations')
    }

    console.log('')
    console.log('✅ Cleanup complete')
  } catch (error) {
    console.error(`❌ Cleanup failed: ${error}`)
  }
}

// Main entry point
const isCleanup = process.argv.includes('--cleanup')

if (isCleanup) {
  cleanup()
} else {
  setup()
}

export { setup, cleanup, validateEnvironment }
