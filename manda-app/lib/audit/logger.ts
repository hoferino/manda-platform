/**
 * Audit Logger Service
 * Creates tamper-proof audit log entries for security events
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #2-6, #10)
 *
 * Features:
 * - Uses service role client to bypass RLS (ensures logs are always created)
 * - Non-blocking - logging failures don't break the application
 * - Type-safe event types and metadata
 */

import { createClient } from '@supabase/supabase-js'
import { type AuditEventType, type AuditMetadata } from './event-types'

/**
 * Input for creating an audit log entry
 */
export interface AuditLogInput {
  /** Type of event being logged */
  event_type: AuditEventType
  /** User ID who triggered the event (null for unauthenticated events like failed login) */
  user_id?: string | null
  /** Client IP address */
  ip_address?: string
  /** Client user agent string */
  user_agent?: string
  /** Additional event-specific data */
  metadata?: AuditMetadata
  /** Whether the event/action succeeded */
  success?: boolean
}

/**
 * Audit log entry as stored in the database
 */
export interface AuditLogEntry {
  id: string
  event_type: string
  user_id: string | null
  timestamp: string
  ip_address: string | null
  user_agent: string | null
  metadata: AuditMetadata
  success: boolean
  created_at: string
}

/**
 * Create a service role client for audit logging
 * Uses service role to bypass RLS and ensure logs are always created
 */
function getAuditClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[Audit] Missing Supabase URL or service role key')
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Create an audit log entry
 *
 * This function is non-blocking and will not throw errors.
 * Logging failures are logged to console but don't break the application.
 *
 * @param input - The audit log data to insert
 * @returns The created log entry ID, or null if creation failed
 *
 * @example
 * ```typescript
 * await createAuditLog({
 *   event_type: AUDIT_EVENT_TYPES.AUTH_LOGIN,
 *   user_id: user.id,
 *   ip_address: '192.168.1.1',
 *   user_agent: 'Mozilla/5.0...',
 *   metadata: { email: 'user@example.com' },
 *   success: true
 * })
 * ```
 */
export async function createAuditLog(input: AuditLogInput): Promise<string | null> {
  try {
    const client = getAuditClient()

    if (!client) {
      console.error('[Audit] Failed to create audit client')
      return null
    }

    const { data, error } = await client
      .from('audit_logs')
      .insert({
        event_type: input.event_type,
        user_id: input.user_id || null,
        ip_address: input.ip_address || null,
        user_agent: input.user_agent || null,
        metadata: input.metadata || {},
        success: input.success ?? true,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Audit] Failed to create audit log:', error.message)
      return null
    }

    return data?.id || null
  } catch (err) {
    // Never let audit logging break the application
    console.error('[Audit] Unexpected error:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Create multiple audit log entries in a batch
 * Useful for bulk operations or event replays
 *
 * @param inputs - Array of audit log data to insert
 * @returns Number of successfully created entries
 */
export async function createAuditLogBatch(inputs: AuditLogInput[]): Promise<number> {
  try {
    const client = getAuditClient()

    if (!client) {
      console.error('[Audit] Failed to create audit client')
      return 0
    }

    const { data, error } = await client.from('audit_logs').insert(
      inputs.map((input) => ({
        event_type: input.event_type,
        user_id: input.user_id || null,
        ip_address: input.ip_address || null,
        user_agent: input.user_agent || null,
        metadata: input.metadata || {},
        success: input.success ?? true,
      }))
    )

    if (error) {
      console.error('[Audit] Failed to create batch audit logs:', error.message)
      return 0
    }

    return inputs.length
  } catch (err) {
    console.error('[Audit] Unexpected error in batch:', err instanceof Error ? err.message : err)
    return 0
  }
}

/**
 * Query audit logs (for admin use in Phase 2)
 * Note: This requires admin/service role access
 *
 * @param options - Query options
 * @returns Array of audit log entries
 */
export async function queryAuditLogs(options?: {
  user_id?: string
  event_type?: AuditEventType
  success?: boolean
  from_date?: Date
  to_date?: Date
  limit?: number
  offset?: number
}): Promise<AuditLogEntry[]> {
  try {
    const client = getAuditClient()

    if (!client) {
      console.error('[Audit] Failed to create audit client')
      return []
    }

    let query = client
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })

    if (options?.user_id) {
      query = query.eq('user_id', options.user_id)
    }

    if (options?.event_type) {
      query = query.eq('event_type', options.event_type)
    }

    if (options?.success !== undefined) {
      query = query.eq('success', options.success)
    }

    if (options?.from_date) {
      query = query.gte('timestamp', options.from_date.toISOString())
    }

    if (options?.to_date) {
      query = query.lte('timestamp', options.to_date.toISOString())
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Audit] Failed to query audit logs:', error.message)
      return []
    }

    return (data as AuditLogEntry[]) || []
  } catch (err) {
    console.error('[Audit] Unexpected error in query:', err instanceof Error ? err.message : err)
    return []
  }
}
