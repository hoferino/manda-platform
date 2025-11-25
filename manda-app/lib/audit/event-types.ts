/**
 * Audit Event Types
 * Defines all security-relevant events that are logged for compliance and monitoring
 * Story: E1.9 - Implement Audit Logging for Security Events
 */

/**
 * Authentication Events - Track user authentication lifecycle
 */
export const AUTH_EVENTS = {
  /** User successfully logged in */
  AUTH_LOGIN: 'auth_login',
  /** User logged out */
  AUTH_LOGOUT: 'auth_logout',
  /** New user registered */
  AUTH_SIGNUP: 'auth_signup',
  /** User confirmed their email address */
  AUTH_EMAIL_CONFIRMED: 'auth_email_confirmed',
  /** User changed their password */
  AUTH_PASSWORD_CHANGED: 'auth_password_changed',
  /** User requested password reset */
  AUTH_PASSWORD_RESET_REQUESTED: 'auth_password_reset_requested',
  /** User completed password reset */
  AUTH_PASSWORD_RESET_COMPLETED: 'auth_password_reset_completed',
  /** Session expired or invalidated */
  AUTH_SESSION_EXPIRED: 'auth_session_expired',
} as const

/**
 * Data Access Events - Track data creation, access, modification
 */
export const DATA_ACCESS_EVENTS = {
  /** New project/deal created */
  PROJECT_CREATED: 'project_created',
  /** User accessed/viewed a project */
  PROJECT_ACCESSED: 'project_accessed',
  /** Project metadata updated */
  PROJECT_UPDATED: 'project_updated',
  /** Project deleted */
  PROJECT_DELETED: 'project_deleted',
  /** Document uploaded to project */
  DOCUMENT_UPLOADED: 'document_uploaded',
  /** Document accessed/downloaded */
  DOCUMENT_ACCESSED: 'document_accessed',
  /** Document deleted */
  DOCUMENT_DELETED: 'document_deleted',
} as const

/**
 * Security Events - Track security-related incidents
 */
export const SECURITY_EVENTS = {
  /** Access denied due to RLS policy */
  ACCESS_DENIED: 'access_denied',
  /** RLS violation attempt */
  RLS_VIOLATION: 'rls_violation',
  /** Invalid or expired JWT token */
  INVALID_TOKEN: 'invalid_token',
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  /** Suspicious activity detected */
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
} as const

/**
 * All audit event types combined
 */
export const AUDIT_EVENT_TYPES = {
  ...AUTH_EVENTS,
  ...DATA_ACCESS_EVENTS,
  ...SECURITY_EVENTS,
} as const

/**
 * Type for all valid audit event types
 */
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES]

/**
 * Type guards for event type categories
 */
export function isAuthEvent(
  eventType: string
): eventType is (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS] {
  return Object.values(AUTH_EVENTS).includes(eventType as (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS])
}

export function isDataAccessEvent(
  eventType: string
): eventType is (typeof DATA_ACCESS_EVENTS)[keyof typeof DATA_ACCESS_EVENTS] {
  return Object.values(DATA_ACCESS_EVENTS).includes(
    eventType as (typeof DATA_ACCESS_EVENTS)[keyof typeof DATA_ACCESS_EVENTS]
  )
}

export function isSecurityEvent(
  eventType: string
): eventType is (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS] {
  return Object.values(SECURITY_EVENTS).includes(
    eventType as (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS]
  )
}

/**
 * Metadata type definitions for specific events
 */
export interface AuthLoginMetadata {
  email?: string
  failure_reason?: string
  method?: 'password' | 'oauth' | 'magic_link'
}

export interface AuthSignupMetadata {
  email: string
  signup_method?: 'password' | 'oauth'
}

export interface ProjectCreatedMetadata {
  project_id: string
  project_name: string
  deal_type?: string
}

export interface ProjectAccessedMetadata {
  project_id: string
  project_name?: string
  access_type?: 'view' | 'edit'
}

export interface AccessDeniedMetadata {
  attempted_resource_id?: string
  attempted_resource_type?: 'project' | 'document' | 'other'
  reason?: string
}

export interface DocumentUploadedMetadata {
  document_id: string
  project_id: string
  file_name: string
  file_size?: number
  mime_type?: string
}

/**
 * Generic metadata type - use specific types above when possible
 */
export type AuditMetadata = Record<string, unknown>
