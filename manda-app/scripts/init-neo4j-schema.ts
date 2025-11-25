#!/usr/bin/env npx tsx
/**
 * Neo4j Schema Initialization Script
 * Creates constraints and indexes for the knowledge graph
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #3, #4)
 *
 * Usage:
 *   npx tsx scripts/init-neo4j-schema.ts
 *
 * Prerequisites:
 *   - Neo4j running (docker-compose -f docker-compose.dev.yml up -d)
 *   - NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD set in .env.local
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import {
  verifyNeo4jConnection,
  initializeNeo4jSchema,
  getNeo4jSchemaStatus,
  closeNeo4jDriver,
} from '../lib/neo4j'

async function main() {
  console.log('🚀 Neo4j Schema Initialization')
  console.log('==============================')
  console.log(`URI: ${process.env.NEO4J_URI}`)
  console.log(`User: ${process.env.NEO4J_USER}`)
  console.log('')

  try {
    // Step 1: Verify connection
    console.log('1. Verifying Neo4j connection...')
    const connected = await verifyNeo4jConnection()
    if (!connected) {
      throw new Error('Failed to connect to Neo4j')
    }
    console.log('   ✅ Connected to Neo4j')
    console.log('')

    // Step 2: Initialize schema
    console.log('2. Initializing schema (constraints and indexes)...')
    const result = await initializeNeo4jSchema()
    console.log(`   ✅ Executed ${result.statementsExecuted} statements`)

    if (result.errors.length > 0) {
      console.log('   ⚠️  Some statements had errors:')
      result.errors.forEach((err) => console.log(`      - ${err}`))
    }
    console.log('')

    // Step 3: Show current schema status
    console.log('3. Current schema status:')
    const status = await getNeo4jSchemaStatus()
    console.log(`   Constraints (${status.constraints.length}):`)
    status.constraints.forEach((c) => console.log(`      - ${c}`))
    console.log(`   Indexes (${status.indexes.length}):`)
    status.indexes.forEach((i) => console.log(`      - ${i}`))
    console.log('')

    console.log('==============================')
    console.log('✅ Schema initialization complete!')
  } catch (error) {
    console.error('')
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    console.error('')
    console.error('Troubleshooting:')
    console.error('  1. Is Neo4j running? Try: docker-compose -f docker-compose.dev.yml up -d')
    console.error('  2. Check NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD in .env.local')
    console.error('  3. Default password after first start is usually neo4j/neo4j')
    process.exit(1)
  } finally {
    await closeNeo4jDriver()
  }
}

main()
