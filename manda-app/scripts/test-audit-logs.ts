#!/usr/bin/env npx tsx
/**
 * Audit Logs Test Script
 * Tests audit logging functionality including tamper-proof verification
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #7, #9, #10)
 *
 * Usage:
 *   npx tsx scripts/test-audit-logs.ts
 *
 * Prerequisites:
 *   - PostgreSQL running with Supabase connection
 *   - Migration 00011_create_audit_logs_table.sql applied
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable set
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function main() {
  console.log('🧪 Audit Logs Test Suite')
  console.log('========================')
  console.log('')

  let testLogId: string | null = null

  try {
    // Test 1: Insert an audit log
    console.log('1. Testing INSERT operation...')
    const { data: insertData, error: insertError } = await supabase
      .from('audit_logs')
      .insert({
        event_type: 'test_event',
        user_id: null, // No user for test
        ip_address: '127.0.0.1',
        user_agent: 'Test Script',
        metadata: { test: true, timestamp: new Date().toISOString() },
        success: true,
      })
      .select('id')
      .single()

    if (insertError) {
      console.log(`   ❌ INSERT failed: ${insertError.message}`)
      throw insertError
    }

    testLogId = insertData.id
    console.log(`   ✅ INSERT succeeded: ${testLogId}`)
    console.log('')

    // Test 2: Query the inserted log
    console.log('2. Testing SELECT operation...')
    const { data: selectData, error: selectError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', testLogId)
      .single()

    if (selectError) {
      console.log(`   ❌ SELECT failed: ${selectError.message}`)
      throw selectError
    }

    console.log(`   ✅ SELECT succeeded`)
    console.log(`   Event type: ${selectData.event_type}`)
    console.log(`   IP address: ${selectData.ip_address}`)
    console.log(`   Timestamp: ${selectData.timestamp}`)
    console.log('')

    // Test 3: Attempt UPDATE (should fail - tamper-proof)
    console.log('3. Testing UPDATE prevention (tamper-proof)...')
    const { error: updateError } = await supabase
      .from('audit_logs')
      .update({ event_type: 'modified_event' })
      .eq('id', testLogId)

    if (updateError) {
      console.log(`   ✅ UPDATE correctly blocked: "${updateError.message}"`)
    } else {
      console.log('   ❌ UPDATE should have been blocked!')
      throw new Error('Tamper-proof UPDATE prevention failed')
    }
    console.log('')

    // Test 4: Attempt DELETE (should fail - tamper-proof)
    console.log('4. Testing DELETE prevention (tamper-proof)...')
    const { error: deleteError } = await supabase
      .from('audit_logs')
      .delete()
      .eq('id', testLogId)

    if (deleteError) {
      console.log(`   ✅ DELETE correctly blocked: "${deleteError.message}"`)
    } else {
      // Check if record still exists
      const { data: checkData } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('id', testLogId)
        .single()

      if (checkData) {
        console.log('   ✅ DELETE was blocked (record still exists)')
      } else {
        console.log('   ❌ DELETE should have been blocked!')
        throw new Error('Tamper-proof DELETE prevention failed')
      }
    }
    console.log('')

    // Test 5: Test batch insert
    console.log('5. Testing batch INSERT...')
    const batchLogs = [
      { event_type: 'auth_login', ip_address: '192.168.1.1', success: true },
      { event_type: 'auth_logout', ip_address: '192.168.1.1', success: true },
      { event_type: 'project_created', ip_address: '10.0.0.1', success: true },
      { event_type: 'access_denied', ip_address: '10.0.0.2', success: false },
    ]

    const { error: batchError } = await supabase.from('audit_logs').insert(batchLogs)

    if (batchError) {
      console.log(`   ❌ Batch INSERT failed: ${batchError.message}`)
      throw batchError
    }

    console.log(`   ✅ Batch INSERT succeeded (${batchLogs.length} records)`)
    console.log('')

    // Test 6: Query by event type
    console.log('6. Testing query by event_type...')
    const { data: typeQuery, error: typeError } = await supabase
      .from('audit_logs')
      .select('id, event_type, timestamp')
      .eq('event_type', 'auth_login')
      .order('timestamp', { ascending: false })
      .limit(5)

    if (typeError) {
      console.log(`   ❌ Query failed: ${typeError.message}`)
      throw typeError
    }

    console.log(`   ✅ Found ${typeQuery?.length || 0} auth_login events`)
    console.log('')

    // Test 7: Query by success status
    console.log('7. Testing query by success status...')
    const { data: failedQuery, error: failedError } = await supabase
      .from('audit_logs')
      .select('id, event_type, metadata')
      .eq('success', false)
      .limit(10)

    if (failedError) {
      console.log(`   ❌ Query failed: ${failedError.message}`)
      throw failedError
    }

    console.log(`   ✅ Found ${failedQuery?.length || 0} failed events`)
    console.log('')

    // Test 8: Query by timestamp range
    console.log('8. Testing query by timestamp range...')
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: rangeQuery, error: rangeError } = await supabase
      .from('audit_logs')
      .select('id, event_type, timestamp')
      .gte('timestamp', oneHourAgo)
      .order('timestamp', { ascending: false })

    if (rangeError) {
      console.log(`   ❌ Query failed: ${rangeError.message}`)
      throw rangeError
    }

    console.log(`   ✅ Found ${rangeQuery?.length || 0} events in the last hour`)
    console.log('')

    // Test 9: Verify index usage (count total records)
    console.log('9. Counting total audit logs...')
    const { count, error: countError } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.log(`   ❌ Count failed: ${countError.message}`)
    } else {
      console.log(`   ✅ Total audit logs: ${count}`)
    }
    console.log('')

    // Summary
    console.log('========================')
    console.log('✅ All audit log tests passed!')
    console.log('')
    console.log('Summary:')
    console.log('- INSERT operations: ✅ Working')
    console.log('- SELECT operations: ✅ Working')
    console.log('- UPDATE prevention: ✅ Tamper-proof')
    console.log('- DELETE prevention: ✅ Tamper-proof')
    console.log('- Batch operations: ✅ Working')
    console.log('- Query by type: ✅ Working')
    console.log('- Query by status: ✅ Working')
    console.log('- Query by timestamp: ✅ Working')
  } catch (error) {
    console.error('')
    console.error('❌ Test failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
