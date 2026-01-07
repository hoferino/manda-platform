/**
 * Benchmark Setup Command
 *
 * Creates a test deal for benchmark validation and outputs configuration.
 * Story: E13 Retrospective - Phased Validation System
 *
 * Usage: npm run benchmark setup
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { generateUploadChecklist, DOCUMENT_TYPE_INFO } from '../doc-mapping'
import type { DocumentType } from '../types'

/**
 * Run the setup command
 */
export async function runSetup(): Promise<void> {
  console.log('=== Benchmark Setup ===')
  console.log('')

  // Validate environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.BENCHMARK_USER_EMAIL
  const password = process.env.BENCHMARK_USER_PASSWORD

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration.')
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    process.exit(1)
  }

  if (!email || !password) {
    console.error('Missing benchmark user credentials.')
    console.error('Set BENCHMARK_USER_EMAIL and BENCHMARK_USER_PASSWORD')
    process.exit(1)
  }

  // Create Supabase client and authenticate
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`Authenticating as ${email}...`)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    console.error(`Authentication failed: ${authError?.message || 'Unknown error'}`)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log(`Authenticated: ${userId}`)
  console.log('')

  // Get user's organization
  const { data: orgMember, error: orgError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .single()

  if (orgError || !orgMember) {
    console.error('Could not find organization for user.')
    console.error('Make sure the benchmark user has an organization.')
    process.exit(1)
  }

  const organizationId = orgMember.organization_id
  console.log(`Organization: ${organizationId}`)

  // Check for existing benchmark deal
  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, name, created_at')
    .eq('name', 'Benchmark Test Deal')
    .eq('organization_id', organizationId)
    .single()

  let dealId: string

  if (existingDeal) {
    console.log('')
    console.log(`Found existing benchmark deal: ${existingDeal.id}`)
    console.log(`  Created: ${existingDeal.created_at}`)
    dealId = existingDeal.id
  } else {
    // Create new benchmark deal
    console.log('')
    console.log('Creating new benchmark deal...')

    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        name: 'Benchmark Test Deal',
        company_name: 'Benchmark Corp',
        industry: 'Technology',
        status: 'active',
        user_id: userId,
        organization_id: organizationId,
      })
      .select()
      .single()

    if (dealError || !newDeal) {
      console.error(`Failed to create deal: ${dealError?.message || 'Unknown error'}`)
      process.exit(1)
    }

    dealId = newDeal.id
    console.log(`Created deal: ${dealId}`)
  }

  // Generate .env.benchmark file
  const envPath = path.join(process.cwd(), '.env.benchmark')
  const envContent = `# Benchmark Configuration
# Generated: ${new Date().toISOString()}

# Deal ID for benchmark queries
BENCHMARK_DEAL_ID=${dealId}

# Organization ID
BENCHMARK_ORG_ID=${organizationId}

# API URL (update for staging/production)
MANDA_API_URL=http://localhost:3000
`

  await fs.writeFile(envPath, envContent)
  console.log('')
  console.log(`Configuration saved to: ${envPath}`)

  // Output upload checklist
  console.log('')
  console.log(generateUploadChecklist())

  // Output next steps
  console.log('')
  console.log('=== Next Steps ===')
  console.log('')
  console.log('1. Load benchmark configuration:')
  console.log('   source .env.benchmark')
  console.log('')
  console.log('2. Upload documents via the UI:')
  console.log(`   Open: http://localhost:3000/deals/${dealId}`)
  console.log('')
  console.log('3. After each document upload, verify extraction:')
  console.log('   npm run benchmark inspect')
  console.log('')
  console.log('4. Run phased validation:')
  console.log('   npm run benchmark validate cim')
  console.log('   npm run benchmark validate financials')
  console.log('   npm run benchmark validate legal')
  console.log('   npm run benchmark validate operational')
  console.log('')
  console.log('5. Test edge cases (missing content handling):')
  console.log('   npm run benchmark edge-cases')
  console.log('')
  console.log('6. Run full benchmark:')
  console.log('   npm run benchmark run')
}

/**
 * Check existing deals for benchmark
 */
export async function listDeals(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.BENCHMARK_USER_EMAIL
  const password = process.env.BENCHMARK_USER_PASSWORD

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    console.error('Missing configuration. Run `npm run benchmark setup` first.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.user) {
    console.error(`Authentication failed: ${authError?.message}`)
    process.exit(1)
  }

  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, name, company_name, created_at, status')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (dealsError) {
    console.error(`Failed to fetch deals: ${dealsError.message}`)
    process.exit(1)
  }

  console.log('=== Recent Deals ===')
  console.log('')

  if (!deals || deals.length === 0) {
    console.log('No deals found.')
    return
  }

  for (const deal of deals) {
    console.log(`${deal.id}`)
    console.log(`  Name: ${deal.name}`)
    console.log(`  Company: ${deal.company_name || 'N/A'}`)
    console.log(`  Status: ${deal.status}`)
    console.log(`  Created: ${deal.created_at}`)
    console.log('')
  }
}
