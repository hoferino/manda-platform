/**
 * Audit Logging Module
 * Story: E1.9 - Implement Audit Logging for Security Events
 *
 * Exports:
 * - Event types and type guards
 * - Audit logging functions
 * - Request context utilities
 */

// Event types
export {
  AUDIT_EVENT_TYPES,
  AUTH_EVENTS,
  DATA_ACCESS_EVENTS,
  SECURITY_EVENTS,
  isAuthEvent,
  isDataAccessEvent,
  isSecurityEvent,
  type AuditEventType,
  type AuditMetadata,
  type AuthLoginMetadata,
  type AuthSignupMetadata,
  type ProjectCreatedMetadata,
  type ProjectAccessedMetadata,
  type AccessDeniedMetadata,
  type DocumentUploadedMetadata,
} from './event-types'

// Audit logging
export {
  createAuditLog,
  createAuditLogBatch,
  queryAuditLogs,
  type AuditLogInput,
  type AuditLogEntry,
} from './logger'

// Request context
export {
  getRequestContext,
  getRequestContextFromRequest,
  type RequestContext,
} from './request-context'
