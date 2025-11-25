/**
 * Neo4j Schema Initialization
 * Creates constraints and indexes for the knowledge graph
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #3, #4, #6)
 */

import { getSession } from './client'
import { NODE_LABELS } from './types'

/**
 * Cypher statements for schema initialization
 * These are idempotent (IF NOT EXISTS)
 */
const SCHEMA_STATEMENTS = [
  // ===================
  // Unique Constraints
  // ===================
  // Deal node unique constraint
  `CREATE CONSTRAINT deal_id_unique IF NOT EXISTS
   FOR (d:${NODE_LABELS.DEAL}) REQUIRE d.id IS UNIQUE`,

  // Document node unique constraint
  `CREATE CONSTRAINT document_id_unique IF NOT EXISTS
   FOR (d:${NODE_LABELS.DOCUMENT}) REQUIRE d.id IS UNIQUE`,

  // Finding node unique constraint
  `CREATE CONSTRAINT finding_id_unique IF NOT EXISTS
   FOR (f:${NODE_LABELS.FINDING}) REQUIRE f.id IS UNIQUE`,

  // Insight node unique constraint
  `CREATE CONSTRAINT insight_id_unique IF NOT EXISTS
   FOR (i:${NODE_LABELS.INSIGHT}) REQUIRE i.id IS UNIQUE`,

  // ===================
  // Indexes for Performance
  // ===================
  // Finding indexes for common queries
  `CREATE INDEX finding_date_referenced IF NOT EXISTS
   FOR (f:${NODE_LABELS.FINDING}) ON (f.date_referenced)`,

  `CREATE INDEX finding_deal_id IF NOT EXISTS
   FOR (f:${NODE_LABELS.FINDING}) ON (f.deal_id)`,

  `CREATE INDEX finding_user_id IF NOT EXISTS
   FOR (f:${NODE_LABELS.FINDING}) ON (f.user_id)`,

  `CREATE INDEX finding_category IF NOT EXISTS
   FOR (f:${NODE_LABELS.FINDING}) ON (f.category)`,

  `CREATE INDEX finding_status IF NOT EXISTS
   FOR (f:${NODE_LABELS.FINDING}) ON (f.status)`,

  // Document indexes
  `CREATE INDEX document_deal_id IF NOT EXISTS
   FOR (d:${NODE_LABELS.DOCUMENT}) ON (d.deal_id)`,

  // Insight indexes
  `CREATE INDEX insight_deal_id IF NOT EXISTS
   FOR (i:${NODE_LABELS.INSIGHT}) ON (i.deal_id)`,

  `CREATE INDEX insight_type IF NOT EXISTS
   FOR (i:${NODE_LABELS.INSIGHT}) ON (i.insight_type)`,

  // Deal indexes
  `CREATE INDEX deal_user_id IF NOT EXISTS
   FOR (d:${NODE_LABELS.DEAL}) ON (d.user_id)`,
]

/**
 * Initialize the Neo4j schema with constraints and indexes
 * Safe to run multiple times (idempotent)
 */
export async function initializeNeo4jSchema(): Promise<{
  success: boolean
  statementsExecuted: number
  errors: string[]
}> {
  const session = getSession()
  const errors: string[] = []
  let statementsExecuted = 0

  try {
    for (const statement of SCHEMA_STATEMENTS) {
      try {
        await session.run(statement)
        statementsExecuted++
      } catch (error) {
        // Log but continue - constraint/index might already exist
        const message = error instanceof Error ? error.message : String(error)
        // Only add to errors if it's not an "already exists" type error
        if (!message.includes('already exists') && !message.includes('equivalent')) {
          errors.push(`Failed: ${statement.substring(0, 50)}... - ${message}`)
        }
      }
    }

    return {
      success: errors.length === 0,
      statementsExecuted,
      errors,
    }
  } finally {
    await session.close()
  }
}

/**
 * Get current schema status (constraints and indexes)
 */
export async function getNeo4jSchemaStatus(): Promise<{
  constraints: string[]
  indexes: string[]
}> {
  const session = getSession()

  try {
    // Get constraints
    const constraintsResult = await session.run('SHOW CONSTRAINTS')
    const constraints = constraintsResult.records.map((record) => {
      const name = record.get('name')
      const type = record.get('type')
      return `${name} (${type})`
    })

    // Get indexes
    const indexesResult = await session.run('SHOW INDEXES')
    const indexes = indexesResult.records.map((record) => {
      const name = record.get('name')
      const type = record.get('type')
      return `${name} (${type})`
    })

    return { constraints, indexes }
  } finally {
    await session.close()
  }
}

/**
 * Drop all schema (for testing/reset purposes)
 * WARNING: This will delete all constraints and indexes
 */
export async function dropNeo4jSchema(): Promise<void> {
  const session = getSession()

  try {
    // Get and drop all constraints
    const constraintsResult = await session.run('SHOW CONSTRAINTS')
    for (const record of constraintsResult.records) {
      const name = record.get('name')
      await session.run(`DROP CONSTRAINT ${name} IF EXISTS`)
    }

    // Get and drop all non-default indexes
    const indexesResult = await session.run('SHOW INDEXES')
    for (const record of indexesResult.records) {
      const name = record.get('name')
      const type = record.get('type')
      // Skip lookup indexes (internal Neo4j indexes)
      if (type !== 'LOOKUP') {
        await session.run(`DROP INDEX ${name} IF EXISTS`)
      }
    }
  } finally {
    await session.close()
  }
}
