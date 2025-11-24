# Story 1.9: Implement Audit Logging for Security Events

Status: ready-for-dev

## Story

As a **security-conscious platform owner**,
I want **comprehensive audit logging for all security-relevant events**,
so that **I can track user authentication, data access, and detect suspicious activity for compliance and security monitoring**.

## Context

This story implements audit logging for security events across the Manda platform. All authentication actions (login, logout, signup, password reset), data access events (project creation, document access), and security-relevant operations are logged to a dedicated `audit_logs` table. The logs are tamper-proof (append-only), include contextual information (user ID, IP address, user agent), and enable security monitoring and compliance reporting.

**Architecture Context:** Audit logs are critical for security compliance, incident response, and forensic analysis. The logs are stored in PostgreSQL with RLS policies to ensure only authorized users can access them (Phase 2: admin dashboard).

## Acceptance Criteria

### AC1: Audit Logs Table Creation
**Given** the database schema is deployed
**When** I inspect the database
**Then** I see an `audit_logs` table with:
  - `id`: UUID primary key
  - `event_type`: Text (e.g., 'auth_login', 'auth_logout', 'project_created')
  - `user_id`: UUID (reference to auth.users)
  - `timestamp`: Timestamptz (when event occurred)
  - `ip_address`: Text (client IP address)
  - `user_agent`: Text (browser/client information)
  - `metadata`: JSONB (additional event-specific data)
  - `success`: Boolean (whether event succeeded)
**And** The table is append-only (no UPDATE or DELETE allowed)
**And** Indexes exist on: `user_id`, `event_type`, `timestamp`

### AC2: Authentication Event Logging
**Given** a user attempts to sign in
**When** they submit credentials
**Then** an audit log entry is created with event_type `auth_login`
**And** The log includes: user_id (if successful), IP address, user agent, success status
**When** login fails (invalid credentials)
**Then** an audit log entry is created with success = false
**And** The log includes the attempted email (in metadata) but not the password
**When** a user signs out
**Then** an audit log entry is created with event_type `auth_logout`

### AC3: User Registration Logging
**Given** a new user signs up
**When** they complete registration
**Then** an audit log entry is created with event_type `auth_signup`
**And** The log includes: user_id, email, IP address, user agent
**When** email confirmation is completed
**Then** an audit log entry is created with event_type `auth_email_confirmed`

### AC4: Data Access Event Logging
**Given** a user creates a project
**When** the project is created successfully
**Then** an audit log entry is created with event_type `project_created`
**And** The log includes: user_id, project_id (in metadata), IP address
**When** a user accesses a project
**Then** an audit log entry is created with event_type `project_accessed`
**And** The log includes: user_id, project_id (in metadata)

### AC5: Security Event Logging
**Given** a user attempts to access another user's project (RLS violation)
**When** RLS blocks the access
**Then** an audit log entry is created with event_type `access_denied`
**And** The log includes: user_id, attempted_project_id (in metadata), success = false
**When** a user changes their password
**Then** an audit log entry is created with event_type `password_changed`

### AC6: Audit Log Querying
**Given** audit logs exist in the database
**When** I query logs for a specific user
**Then** I see all events for that user in chronological order
**When** I query logs by event_type
**Then** I see all events of that type
**When** I query logs within a date range
**Then** I see all events in that timeframe
**And** Queries complete in <500ms (indexed on timestamp)

### AC7: Tamper-Proof Logs (Append-Only)
**Given** audit logs exist
**When** I try to UPDATE an audit log entry
**Then** the database rejects the operation (policy or trigger prevents UPDATE)
**When** I try to DELETE an audit log entry
**Then** the database rejects the operation (policy or trigger prevents DELETE)
**And** Only INSERT operations are allowed

### AC8: Log Retention and Archival
**Given** audit logs accumulate over time
**When** logs are older than 90 days (configurable)
**Then** they are archived to a separate table or external storage (Phase 2)
**And** Active logs table remains performant
**Note:** MVP implementation prepares for archival but doesn't implement it

### AC9: IP Address and User Agent Capture
**Given** a user makes a request
**When** an audit log is created
**Then** the IP address is captured from the request headers
**And** the user agent is captured from the request headers
**And** The information is stored in the audit log
**When** IP address cannot be determined (internal requests)
**Then** IP address is stored as "internal" or null

### AC10: Logging Middleware Integration
**Given** logging middleware is configured
**When** any authentication event occurs
**Then** the middleware automatically creates an audit log entry
**And** No additional code is needed in route handlers
**When** any data access event occurs
**Then** the middleware captures the event and logs it

## Tasks / Subtasks

- [ ] **Task 1: Create Audit Logs Table** (AC: #1, #7)
  - [ ] Create migration: `00011_create_audit_logs_table.sql`
  - [ ] Define schema:
    ```sql
    CREATE TABLE audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL,
        user_id uuid REFERENCES auth.users(id),  -- Nullable for failed login attempts
        timestamp timestamptz DEFAULT now() NOT NULL,
        ip_address text,
        user_agent text,
        metadata jsonb,
        success boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
    );

    CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
    CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
    ```
  - [ ] Add trigger to prevent UPDATE and DELETE:
    ```sql
    CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER prevent_audit_log_update
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_modification();

    CREATE TRIGGER prevent_audit_log_delete
        BEFORE DELETE ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_modification();
    ```
  - [ ] Run migration and verify table created

- [ ] **Task 2: Define Event Types** (AC: #2-5)
  - [ ] Create `lib/audit/event-types.ts`:
    ```typescript
    export const AUDIT_EVENT_TYPES = {
      // Authentication
      AUTH_LOGIN: 'auth_login',
      AUTH_LOGOUT: 'auth_logout',
      AUTH_SIGNUP: 'auth_signup',
      AUTH_EMAIL_CONFIRMED: 'auth_email_confirmed',
      AUTH_PASSWORD_CHANGED: 'password_changed',
      AUTH_PASSWORD_RESET: 'password_reset',

      // Data Access
      PROJECT_CREATED: 'project_created',
      PROJECT_ACCESSED: 'project_accessed',
      PROJECT_UPDATED: 'project_updated',
      PROJECT_DELETED: 'project_deleted',
      DOCUMENT_UPLOADED: 'document_uploaded',

      // Security Events
      ACCESS_DENIED: 'access_denied',
      RLS_VIOLATION: 'rls_violation',
      INVALID_TOKEN: 'invalid_token'
    } as const

    export type AuditEventType = typeof AUDIT_EVENT_TYPES[keyof typeof AUDIT_EVENT_TYPES]
    ```

- [ ] **Task 3: Create Audit Logging Service** (AC: #9, #10)
  - [ ] Create `lib/audit/logger.ts`:
    ```typescript
    import { createClient } from '@/lib/supabase/server'
    import { AUDIT_EVENT_TYPES, AuditEventType } from './event-types'

    interface AuditLogInput {
      event_type: AuditEventType
      user_id?: string
      ip_address?: string
      user_agent?: string
      metadata?: Record<string, any>
      success?: boolean
    }

    export async function createAuditLog(input: AuditLogInput) {
      const supabase = createClient()

      const { error } = await supabase
        .from('audit_logs')
        .insert({
          event_type: input.event_type,
          user_id: input.user_id,
          ip_address: input.ip_address,
          user_agent: input.user_agent,
          metadata: input.metadata,
          success: input.success ?? true
        })

      if (error) {
        console.error('Failed to create audit log:', error)
        // Don't throw - logging failure shouldn't break the application
      }
    }
    ```
  - [ ] Add error handling (log failures to console, don't break app)

- [ ] **Task 4: Implement IP Address and User Agent Capture** (AC: #9)
  - [ ] Create utility: `lib/audit/request-context.ts`:
    ```typescript
    import { headers } from 'next/headers'

    export function getRequestContext() {
      const headersList = headers()

      const ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0] ||
        headersList.get('x-real-ip') ||
        'unknown'

      const userAgent = headersList.get('user-agent') || 'unknown'

      return { ipAddress, userAgent }
    }
    ```
  - [ ] Test IP address capture in development and production

- [ ] **Task 5: Integrate Audit Logging in Authentication** (AC: #2, #3)
  - [ ] Add logging to signup handler:
    ```typescript
    const { ipAddress, userAgent } = getRequestContext()

    const { data, error } = await supabase.auth.signUp({ email, password })

    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.AUTH_SIGNUP,
      user_id: data.user?.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { email },
      success: !error
    })
    ```
  - [ ] Add logging to login handler (success and failure)
  - [ ] Add logging to logout handler
  - [ ] Add logging to email confirmation handler
  - [ ] Add logging to password change handler

- [ ] **Task 6: Integrate Audit Logging in Data Access** (AC: #4)
  - [ ] Add logging to project creation (E1.5):
    ```typescript
    const { data: deal, error } = await supabase.from('deals').insert(...)

    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.PROJECT_CREATED,
      user_id: session.user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { project_id: deal.id, project_name: deal.name }
    })
    ```
  - [ ] Add logging to project access (E1.6 layout)
  - [ ] Prepare for document upload logging (Epic 2)

- [ ] **Task 7: Implement Security Event Logging** (AC: #5)
  - [ ] Add logging for RLS violations:
    ```typescript
    // When project access fails due to RLS
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.ACCESS_DENIED,
      user_id: session.user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { attempted_project_id: projectId },
      success: false
    })
    ```
  - [ ] Add logging for invalid/expired tokens
  - [ ] Test security event logging

- [ ] **Task 8: Create Audit Log Query API** (AC: #6)
  - [ ] Create `app/api/audit-logs/route.ts` (admin only, Phase 2):
    ```typescript
    // Future endpoint for admin dashboard
    // MVP: Prepare schema, implement in Phase 2
    export async function GET(request: Request) {
      // TODO: Implement in Phase 2 with proper authorization
      return Response.json({ message: 'Admin endpoint - coming in Phase 2' })
    }
    ```
  - [ ] Prepare query functions for Phase 2 admin dashboard

- [ ] **Task 9: Test Tamper-Proof Logs** (AC: #7)
  - [ ] Create test script: `scripts/test-audit-logs.ts`
  - [ ] Insert test audit log
  - [ ] Attempt UPDATE → verify trigger blocks
  - [ ] Attempt DELETE → verify trigger blocks
  - [ ] Verify only INSERT succeeds

- [ ] **Task 10: Test Audit Logging End-to-End** (AC: #2-5)
  - [ ] Sign up new user → verify `auth_signup` log created
  - [ ] Sign in → verify `auth_login` log created
  - [ ] Create project → verify `project_created` log created
  - [ ] Access project → verify `project_accessed` log created
  - [ ] Sign out → verify `auth_logout` log created
  - [ ] Verify all logs include IP address and user agent

- [ ] **Task 11: Prepare for Log Retention** (AC: #8)
  - [ ] Document log retention strategy in README
  - [ ] Add configuration placeholder for retention period
  - [ ] Create placeholder migration for archival table (Phase 2)
  - [ ] Note: Actual archival implementation in Phase 2

- [ ] **Task 12: Performance Testing** (AC: #6)
  - [ ] Insert 10,000 test audit logs
  - [ ] Query logs by user_id → verify <500ms
  - [ ] Query logs by event_type → verify <500ms
  - [ ] Query logs by timestamp range → verify <500ms
  - [ ] Verify indexes are used (EXPLAIN ANALYZE)

- [ ] **Task 13: Documentation** (AC: All)
  - [ ] Document audit logging in README
  - [ ] Document event types and when they're logged
  - [ ] Document how to query audit logs
  - [ ] Document tamper-proof design
  - [ ] Add compliance notes (GDPR, SOC 2, etc.)

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Database:**
- PostgreSQL 18 (Supabase) for audit log storage
- Indexes on user_id, event_type, timestamp
- Triggers for tamper-proof enforcement

**Logging:**
- Custom audit logging service (`lib/audit/logger.ts`)
- Integration with authentication and data access flows
- Middleware for automatic logging (future enhancement)

### Audit Logging Architecture

**Why Audit Logs?**
- **Security:** Track suspicious activity, failed login attempts
- **Compliance:** Required for SOC 2, GDPR, HIPAA
- **Forensics:** Investigate security incidents
- **Accountability:** Know who did what, when

**Tamper-Proof Design:**
- Append-only table (INSERT only, no UPDATE/DELETE)
- Database triggers enforce immutability
- Logs cannot be modified after creation

### Event Types and Categories

**Authentication Events:**
- `auth_login`: User signs in (success/failure)
- `auth_logout`: User signs out
- `auth_signup`: New user registration
- `auth_email_confirmed`: Email confirmation completed
- `password_changed`: User changes password
- `password_reset`: Password reset requested/completed

**Data Access Events:**
- `project_created`: New project created
- `project_accessed`: User views a project
- `project_updated`: Project metadata updated
- `project_deleted`: Project deleted (Phase 2)
- `document_uploaded`: Document uploaded (Epic 2)

**Security Events:**
- `access_denied`: RLS policy blocks access
- `rls_violation`: Attempt to access forbidden data
- `invalid_token`: Expired or invalid JWT token

### Metadata Field Usage

**Examples:**
```typescript
// Login failure
metadata: {
  email: 'user@example.com',
  failure_reason: 'Invalid password'
}

// Project created
metadata: {
  project_id: 'uuid',
  project_name: 'Acme Corp Acquisition',
  deal_type: 'Tech M&A'
}

// Access denied
metadata: {
  attempted_project_id: 'uuid',
  reason: 'RLS policy violation'
}
```

### IP Address Capture

**Next.js Request Headers:**
- `x-forwarded-for`: IP address (behind proxy/CDN)
- `x-real-ip`: Direct IP address
- Fallback: 'unknown' if headers unavailable

**Production Considerations:**
- Ensure CDN/proxy forwards IP addresses
- Respect privacy regulations (GDPR)
- Consider IP anonymization (hash last octet)

### Query Performance

**Indexes:**
- `idx_audit_logs_user_id`: Fast queries by user
- `idx_audit_logs_event_type`: Fast queries by event type
- `idx_audit_logs_timestamp`: Fast queries by date range

**Example Queries:**
```sql
-- Get all logs for a user
SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY timestamp DESC;

-- Get all failed login attempts
SELECT * FROM audit_logs WHERE event_type = 'auth_login' AND success = false;

-- Get logs in date range
SELECT * FROM audit_logs WHERE timestamp BETWEEN $1 AND $2;

-- Get security events
SELECT * FROM audit_logs WHERE event_type IN ('access_denied', 'rls_violation', 'invalid_token');
```

### Log Retention Strategy

**MVP (Epic 1):**
- All logs stored indefinitely in `audit_logs` table
- No automatic archival

**Phase 2:**
- Archive logs older than 90 days to `audit_logs_archive` table
- Optionally export to external logging service (e.g., Datadog, Loggly)
- Compliance retention periods (e.g., SOC 2: 7 years)

### Non-Functional Requirements

**Security (NFR-SEC-004):**
- Logs are tamper-proof (append-only)
- Sensitive data (passwords) never logged
- IP addresses and user agents captured for forensics

**Performance:**
- Audit log insertion: <50ms (should not block user requests)
- Query performance: <500ms (with indexes)

**Observability (NFR-OBS-001):**
- All security events logged
- Logs queryable via SQL (admin dashboard in Phase 2)
- Failed login attempts tracked for rate limiting (Phase 2)

### Testing Strategy

**Unit Tests:**
- Test audit log creation function
- Test IP address and user agent capture

**Integration Tests:**
- Test audit logging in authentication flows
- Test audit logging in data access flows
- Test tamper-proof enforcement (UPDATE/DELETE blocked)

**E2E Tests:**
- Sign up → verify audit log created
- Login → verify audit log created
- Create project → verify audit log created
- Access denied → verify audit log created

**Security Tests:**
- Verify UPDATE blocked
- Verify DELETE blocked
- Verify sensitive data (passwords) not logged

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Observability]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Audit-Logging]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-9-Audit-Logging-for-Security-Events]
- [Source: docs/epics.md#Epic-1-Story-E1.9]

**Official Documentation:**
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [Supabase Audit Trail Example](https://supabase.com/docs/guides/database/postgres/triggers)

### Security Considerations

**What to Log:**
- ✅ Authentication events (login, logout, signup)
- ✅ Data access (project views, document access)
- ✅ Security events (access denied, RLS violations)
- ✅ Administrative actions (user role changes - Phase 2)

**What NOT to Log:**
- ❌ Passwords (plaintext or hashed)
- ❌ Credit card numbers
- ❌ Other PII beyond email and user_id

**Privacy Compliance (GDPR):**
- IP addresses may be considered PII in some jurisdictions
- Consider IP anonymization (hash last octet)
- Provide user data export capability (Phase 2)
- Implement right to be forgotten (Phase 2, careful with audit logs)

### Compliance Considerations

**SOC 2:**
- Audit logs required for access control monitoring
- Retention period: Typically 90 days to 7 years

**GDPR:**
- IP addresses may be PII, consider anonymization
- Users have right to access their audit logs
- Right to erasure (audit logs may be exempt for legal reasons)

**HIPAA (if handling health data):**
- Audit logs required for all access to PHI
- Retention period: 6 years minimum

### Prerequisites

- **E1.2** (Supabase Auth) provides authentication context
- **E1.3** (PostgreSQL Schema) database must be running

### Dependencies

- **Phase 2** (Admin Dashboard) will provide UI for viewing audit logs
- **Phase 2** (Log Retention) will implement archival strategy

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-9-implement-audit-logging-for-security-events.context.xml)

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent during implementation_

### Completion Notes List

_To be filled by dev agent after completion_

### File List

_To be filled by dev agent with created/modified/deleted files_

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-24 | Max (SM Agent) | Initial story draft created from Epic 1 tech spec |
