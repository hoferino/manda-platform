import { describe, it, expect } from 'vitest'
import {
  AUTH_EVENTS,
  DATA_ACCESS_EVENTS,
  SECURITY_EVENTS,
  AUDIT_EVENT_TYPES,
  isAuthEvent,
  isDataAccessEvent,
  isSecurityEvent,
} from '@/lib/audit/event-types'

describe('Audit Event Types', () => {
  describe('isAuthEvent', () => {
    it('returns true for auth events', () => {
      expect(isAuthEvent('auth_login')).toBe(true)
      expect(isAuthEvent('auth_logout')).toBe(true)
      expect(isAuthEvent('auth_signup')).toBe(true)
      expect(isAuthEvent('auth_password_changed')).toBe(true)
    })

    it('returns false for non-auth events', () => {
      expect(isAuthEvent('project_created')).toBe(false)
      expect(isAuthEvent('access_denied')).toBe(false)
      expect(isAuthEvent('random_event')).toBe(false)
    })
  })

  describe('isDataAccessEvent', () => {
    it('returns true for data access events', () => {
      expect(isDataAccessEvent('project_created')).toBe(true)
      expect(isDataAccessEvent('project_accessed')).toBe(true)
      expect(isDataAccessEvent('project_updated')).toBe(true)
      expect(isDataAccessEvent('document_uploaded')).toBe(true)
    })

    it('returns false for non-data-access events', () => {
      expect(isDataAccessEvent('auth_login')).toBe(false)
      expect(isDataAccessEvent('access_denied')).toBe(false)
    })
  })

  describe('isSecurityEvent', () => {
    it('returns true for security events', () => {
      expect(isSecurityEvent('access_denied')).toBe(true)
      expect(isSecurityEvent('rls_violation')).toBe(true)
      expect(isSecurityEvent('rate_limit_exceeded')).toBe(true)
    })

    it('returns false for non-security events', () => {
      expect(isSecurityEvent('auth_login')).toBe(false)
      expect(isSecurityEvent('project_created')).toBe(false)
    })
  })
})

describe('AUTH_EVENTS', () => {
  it('has all required auth events', () => {
    expect(AUTH_EVENTS.AUTH_LOGIN).toBe('auth_login')
    expect(AUTH_EVENTS.AUTH_LOGOUT).toBe('auth_logout')
    expect(AUTH_EVENTS.AUTH_SIGNUP).toBe('auth_signup')
    expect(AUTH_EVENTS.AUTH_PASSWORD_CHANGED).toBe('auth_password_changed')
    expect(AUTH_EVENTS.AUTH_SESSION_EXPIRED).toBe('auth_session_expired')
  })
})

describe('DATA_ACCESS_EVENTS', () => {
  it('has all required data access events', () => {
    expect(DATA_ACCESS_EVENTS.PROJECT_CREATED).toBe('project_created')
    expect(DATA_ACCESS_EVENTS.PROJECT_ACCESSED).toBe('project_accessed')
    expect(DATA_ACCESS_EVENTS.PROJECT_UPDATED).toBe('project_updated')
    expect(DATA_ACCESS_EVENTS.PROJECT_DELETED).toBe('project_deleted')
    expect(DATA_ACCESS_EVENTS.DOCUMENT_UPLOADED).toBe('document_uploaded')
  })
})

describe('SECURITY_EVENTS', () => {
  it('has all required security events', () => {
    expect(SECURITY_EVENTS.ACCESS_DENIED).toBe('access_denied')
    expect(SECURITY_EVENTS.RLS_VIOLATION).toBe('rls_violation')
    expect(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED).toBe('rate_limit_exceeded')
    expect(SECURITY_EVENTS.SUSPICIOUS_ACTIVITY).toBe('suspicious_activity')
  })
})

describe('AUDIT_EVENT_TYPES', () => {
  it('contains all event types from all categories', () => {
    // Auth events
    expect(AUDIT_EVENT_TYPES.AUTH_LOGIN).toBeDefined()
    expect(AUDIT_EVENT_TYPES.AUTH_LOGOUT).toBeDefined()

    // Data access events
    expect(AUDIT_EVENT_TYPES.PROJECT_CREATED).toBeDefined()
    expect(AUDIT_EVENT_TYPES.DOCUMENT_UPLOADED).toBeDefined()

    // Security events
    expect(AUDIT_EVENT_TYPES.ACCESS_DENIED).toBeDefined()
    expect(AUDIT_EVENT_TYPES.RLS_VIOLATION).toBeDefined()
  })
})
