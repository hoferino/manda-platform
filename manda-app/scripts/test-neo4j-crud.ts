#!/usr/bin/env npx tsx
/**
 * Neo4j CRUD Operations Test Script
 * Tests basic create, read, update, delete operations
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #5, #6, #11)
 *
 * Usage:
 *   npx tsx scripts/test-neo4j-crud.ts
 *
 * Prerequisites:
 *   - Neo4j running with schema initialized
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import {
  verifyNeo4jConnection,
  closeNeo4jDriver,
  createDealNode,
  createDocumentNode,
  createFindingNode,
  createContradiction,
  getNodeById,
  deleteNode,
  getContradictions,
  getFindingsWithSources,
  NODE_LABELS,
} from '../lib/neo4j'

// Generate UUIDs for test data
const testDealId = `test-deal-${Date.now()}`
const testDocId = `test-doc-${Date.now()}`
const testFinding1Id = `test-finding-1-${Date.now()}`
const testFinding2Id = `test-finding-2-${Date.now()}`
const testUserId = 'test-user-123'

async function main() {
  console.log('🧪 Neo4j CRUD Operations Test')
  console.log('=============================')
  console.log('')

  try {
    // Verify connection
    console.log('1. Verifying connection...')
    await verifyNeo4jConnection()
    console.log('   ✅ Connected')
    console.log('')

    // Create Deal node
    console.log('2. Creating Deal node...')
    const deal = await createDealNode({
      id: testDealId,
      name: 'Test Deal for CRUD',
      user_id: testUserId,
      created_at: new Date().toISOString(),
    })
    console.log(`   ✅ Created Deal: ${deal.name}`)
    console.log('')

    // Create Document node
    console.log('3. Creating Document node (linked to Deal)...')
    const doc = await createDocumentNode({
      id: testDocId,
      name: 'Q3 2024 Financial Report.pdf',
      doc_type: 'pdf',
      upload_date: new Date().toISOString(),
      deal_id: testDealId,
    })
    console.log(`   ✅ Created Document: ${doc.name}`)
    console.log('')

    // Create Finding nodes with temporal metadata
    console.log('4. Creating Finding nodes with temporal metadata...')
    const finding1 = await createFindingNode(
      {
        id: testFinding1Id,
        text: 'Revenue was $10M in Q3 2024',
        confidence: 0.95,
        category: 'financial',
        date_referenced: '2024-09-30', // Q3 2024
        date_extracted: new Date().toISOString(),
        source_document_id: testDocId,
        source_location: 'Page 5',
        deal_id: testDealId,
        user_id: testUserId,
        status: 'validated',
      },
      { page: 5 }
    )
    console.log(`   ✅ Created Finding 1: "${finding1.text.substring(0, 40)}..."`)

    const finding2 = await createFindingNode(
      {
        id: testFinding2Id,
        text: 'Revenue was $8M in Q3 2024',
        confidence: 0.90,
        category: 'financial',
        date_referenced: '2024-09-30', // Same time period - potential contradiction
        date_extracted: new Date().toISOString(),
        source_document_id: testDocId,
        source_location: 'Page 12',
        deal_id: testDealId,
        user_id: testUserId,
        status: 'pending',
      },
      { page: 12 }
    )
    console.log(`   ✅ Created Finding 2: "${finding2.text.substring(0, 40)}..."`)
    console.log('')

    // Create contradiction relationship
    console.log('5. Creating CONTRADICTS relationship...')
    const contradictionCreated = await createContradiction(
      testFinding1Id,
      testFinding2Id,
      'Different revenue figures for same period',
      0.85
    )
    console.log(`   ✅ Created contradiction: ${contradictionCreated}`)
    console.log('')

    // Test queries
    console.log('6. Testing queries...')

    // Get findings with sources
    const findingsWithSources = await getFindingsWithSources(testDealId)
    console.log(`   - getFindingsWithSources: Found ${findingsWithSources.length} findings`)

    // Get contradictions
    const contradictions = await getContradictions(testDealId)
    console.log(`   - getContradictions: Found ${contradictions.length} contradictions`)
    if (contradictions.length > 0) {
      console.log(`     Reason: ${contradictions[0].reason}`)
    }

    // Get node by ID
    const retrievedDeal = await getNodeById(NODE_LABELS.DEAL, testDealId)
    console.log(`   - getNodeById: Retrieved deal "${retrievedDeal?.name}"`)
    console.log('')

    // Cleanup test data
    console.log('7. Cleaning up test data...')
    await deleteNode(NODE_LABELS.FINDING, testFinding1Id)
    await deleteNode(NODE_LABELS.FINDING, testFinding2Id)
    await deleteNode(NODE_LABELS.DOCUMENT, testDocId)
    await deleteNode(NODE_LABELS.DEAL, testDealId)
    console.log('   ✅ Test data cleaned up')
    console.log('')

    console.log('=============================')
    console.log('✅ All CRUD tests passed!')
  } catch (error) {
    console.error('')
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    console.error('')

    // Attempt cleanup even on error
    try {
      console.log('Attempting cleanup...')
      await deleteNode(NODE_LABELS.FINDING, testFinding1Id)
      await deleteNode(NODE_LABELS.FINDING, testFinding2Id)
      await deleteNode(NODE_LABELS.DOCUMENT, testDocId)
      await deleteNode(NODE_LABELS.DEAL, testDealId)
    } catch {
      // Ignore cleanup errors
    }

    process.exit(1)
  } finally {
    await closeNeo4jDriver()
  }
}

main()
