---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/audit/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for the audit logging module. Provides event type definitions with type guards, audit log creation and querying functions, and request context extraction utilities. Enables comprehensive security event logging for authentication, data access, and security-related actions across the platform.

## Exports

- Event types: `AUDIT_EVENT_TYPES`, `AUTH_EVENTS`, `DATA_ACCESS_EVENTS`, `SECURITY_EVENTS`
- Type guards: `isAuthEvent`, `isDataAccessEvent`, `isSecurityEvent`
- Type definitions: `AuditEventType`, `AuditMetadata`, `AuthLoginMetadata`, `AuthSignupMetadata`, `ProjectCreatedMetadata`, `ProjectAccessedMetadata`, `AccessDeniedMetadata`, `DocumentUploadedMetadata`
- Logging functions: `createAuditLog`, `createAuditLogBatch`, `queryAuditLogs`, `AuditLogInput`, `AuditLogEntry`
- Request context: `getRequestContext`, `getRequestContextFromRequest`, `RequestContext`

## Dependencies

- [[manda-app-lib-audit-event-types]] - Event type definitions
- [[manda-app-lib-audit-logger]] - Logging functions
- [[manda-app-lib-audit-request-context]] - Request context utilities

## Used By

TBD

## Notes

Audit events are categorized into AUTH_EVENTS (login, signup, logout), DATA_ACCESS_EVENTS (project/document access), and SECURITY_EVENTS (access denied, suspicious activity). Request context captures IP, user agent, and request metadata.
