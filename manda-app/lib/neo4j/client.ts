/**
 * Neo4j Database Client
 * Singleton driver with connection pooling for graph database operations
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #2, #7)
 */

import neo4j, { Driver, Session, SessionConfig } from 'neo4j-driver'

// Singleton driver instance
let driver: Driver | null = null

/**
 * Get or create the Neo4j driver instance
 * Uses connection pooling for efficient resource management
 */
export function getNeo4jDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI
    const user = process.env.NEO4J_USER
    const password = process.env.NEO4J_PASSWORD

    if (!uri || !user || !password) {
      throw new Error(
        'Neo4j configuration missing. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD environment variables.'
      )
    }

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
      maxConnectionPoolSize: 50,
      connectionTimeout: 30000, // 30 seconds
      maxTransactionRetryTime: 30000,
      logging: {
        level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
        logger: (level, message) => {
          if (level === 'error') {
            console.error(`[Neo4j] ${message}`)
          } else if (process.env.NODE_ENV === 'development') {
            console.log(`[Neo4j] ${message}`)
          }
        },
      },
    })
  }

  return driver
}

/**
 * Create a new session for database operations
 * Always close sessions after use (in finally blocks)
 */
export function getSession(config?: SessionConfig): Session {
  const d = getNeo4jDriver()
  return d.session(config)
}

/**
 * Close the Neo4j driver connection
 * Call this during application shutdown
 */
export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close()
    driver = null
  }
}

/**
 * Verify Neo4j connection is working
 * Returns true if connection is healthy, throws error otherwise
 */
export async function verifyNeo4jConnection(): Promise<boolean> {
  const session = getSession()
  try {
    const result = await session.run('RETURN 1 AS health')
    const health = result.records[0]?.get('health')
    return health === 1 || health?.toNumber?.() === 1
  } finally {
    await session.close()
  }
}

/**
 * Execute a read query with automatic session management
 */
export async function executeRead<T>(
  query: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const session = getSession()
  try {
    const result = await session.executeRead(async (tx) => {
      const res = await tx.run(query, params)
      return res.records.map((record) => record.toObject() as T)
    })
    return result
  } finally {
    await session.close()
  }
}

/**
 * Execute a write query with automatic session management
 */
export async function executeWrite<T>(
  query: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const session = getSession()
  try {
    const result = await session.executeWrite(async (tx) => {
      const res = await tx.run(query, params)
      return res.records.map((record) => record.toObject() as T)
    })
    return result
  } finally {
    await session.close()
  }
}
