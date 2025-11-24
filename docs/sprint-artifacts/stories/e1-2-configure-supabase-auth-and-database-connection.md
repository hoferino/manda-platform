# Story 1.2: Configure Supabase Auth and Database Connection

Status: ready-for-dev

## Story

As a **developer**,
I want **Supabase Auth and PostgreSQL database properly configured with secure connection handling**,
so that **users can authenticate and the application can securely access the database with Row-Level Security enforced**.

## Context

This story establishes the authentication and database infrastructure for the Manda platform. It configures Supabase Auth for user authentication (email/password, magic links, OAuth), sets up the Supabase client in Next.js with proper environment variable handling, and prepares the connection for Row-Level Security (RLS) enforcement. This story is foundational for all subsequent database interactions and user-specific features.

**Architecture Context:** Supabase provides PostgreSQL 18 with built-in authentication, Row-Level Security, and storage capabilities. The Supabase client SDK handles JWT token management, session persistence, and automatic token refresh.

## Acceptance Criteria

### AC1: Supabase Project Setup
**Given** I have a Supabase account
**When** I create a new Supabase project
**Then** the project is initialized with PostgreSQL 18
**And** I can access the project dashboard
**And** I have the project URL and anon key
**And** I have the service role key (stored securely, never exposed to client)

### AC2: Supabase Client Configuration
**Given** Supabase environment variables are configured
**When** the Next.js application initializes
**Then** the Supabase client is created with correct credentials
**And** The client uses the project URL and anon key
**And** The client is configured for client-side auth helpers
**And** TypeScript types for Supabase are generated and available

### AC3: Email/Password Authentication
**Given** a new user visits the signup page
**When** they enter email and password and submit
**Then** a user account is created in `auth.users` table
**And** a confirmation email is sent to the user
**When** the user clicks the confirmation link
**Then** their email is marked as confirmed
**And** they can sign in with their credentials

### AC4: Magic Link Authentication
**Given** a user chooses magic link authentication
**When** they enter their email and submit
**Then** a magic link is sent to their email
**When** they click the magic link
**Then** they are authenticated and redirected to the application
**And** a session is established with JWT token

### AC5: OAuth Authentication (Google)
**Given** Google OAuth is configured in Supabase
**When** a user clicks "Sign in with Google"
**Then** they are redirected to Google OAuth consent screen
**When** they authorize the application
**Then** they are redirected back to the application
**And** a user account is created or linked
**And** they are authenticated with a valid session

### AC6: Session Management
**Given** a user is authenticated
**When** they navigate between pages
**Then** their session persists across page loads
**And** the JWT access token is automatically refreshed before expiry (1 hour)
**And** the session is restored from localStorage on browser restart
**When** the user signs out
**Then** the session is terminated
**And** all tokens are cleared from storage

### AC7: Authentication Middleware
**Given** authentication middleware is configured
**When** an unauthenticated user tries to access `/projects`
**Then** they are redirected to `/login`
**And** the original URL is preserved for post-login redirect
**When** an authenticated user accesses a protected route
**Then** they can view the page
**And** their user information is available in the request context

### AC8: Database Connection Health
**Given** the Supabase client is configured
**When** the application makes a database query
**Then** the connection succeeds
**And** queries execute within 500ms (NFR-PERF-002)
**And** Connection pooling is handled by Supabase
**And** RLS policies are enforced on all queries

## Tasks / Subtasks

- [ ] **Task 1: Create Supabase Project** (AC: #1)
  - [ ] Sign up for Supabase account (or use existing)
  - [ ] Create new project: "manda-platform-dev"
  - [ ] Choose region closest to primary users
  - [ ] Wait for project provisioning (PostgreSQL 18)
  - [ ] Note project URL: `https://<project-id>.supabase.co`
  - [ ] Copy anon (public) key from Settings > API
  - [ ] Copy service role key from Settings > API (store in password manager)
  - [ ] Enable pgvector extension in Database > Extensions

- [ ] **Task 2: Configure Environment Variables** (AC: #2)
  - [ ] Create `.env.local` file in Next.js project root
  - [ ] Add Supabase URL: `NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co`
  - [ ] Add anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
  - [ ] Add service role key (server-only): `SUPABASE_SERVICE_ROLE_KEY=<service-key>`
  - [ ] Update `.env.example` with placeholder values
  - [ ] Add `.env.local` to `.gitignore` (verify)
  - [ ] Document environment variables in README

- [ ] **Task 3: Install Supabase Client SDK** (AC: #2)
  - [ ] Install dependencies: `npm install @supabase/supabase-js @supabase/auth-helpers-nextjs`
  - [ ] Install TypeScript types: `npm install -D @supabase/supabase-js`
  - [ ] Verify package versions compatible with Next.js 15 and React 19.2

- [ ] **Task 4: Create Supabase Client Utility** (AC: #2, #8)
  - [ ] Create `lib/supabase/client.ts` for browser client:
    ```typescript
    import { createBrowserClient } from '@supabase/ssr'
    export const createClient = () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    ```
  - [ ] Create `lib/supabase/server.ts` for server-side client (Server Components/Actions)
  - [ ] Create `lib/supabase/middleware.ts` for middleware client
  - [ ] Add TypeScript types for database schema (prepare for E1.3)

- [ ] **Task 5: Implement Authentication Pages** (AC: #3, #4, #5)
  - [ ] Create `app/login/page.tsx` with email/password and magic link options
  - [ ] Create `app/signup/page.tsx` with email/password signup form
  - [ ] Create `app/auth/callback/route.ts` to handle OAuth redirects
  - [ ] Add Google OAuth button to login page
  - [ ] Implement form validation (email format, password requirements)
  - [ ] Add error handling and user feedback (toast notifications)
  - [ ] Style forms with shadcn/ui components (Input, Button, Label, Card)

- [ ] **Task 6: Configure OAuth Providers** (AC: #5)
  - [ ] In Supabase Dashboard > Authentication > Providers, enable Google
  - [ ] Create Google OAuth app in Google Cloud Console
  - [ ] Configure authorized redirect URIs: `https://<project-id>.supabase.co/auth/v1/callback`
  - [ ] Add Google Client ID and Client Secret to Supabase
  - [ ] Test OAuth flow in development environment
  - [ ] Document OAuth setup in README

- [ ] **Task 7: Implement Session Management** (AC: #6)
  - [ ] Create auth context provider: `components/providers/auth-provider.tsx`
  - [ ] Implement `useAuth()` hook for accessing user session
  - [ ] Add session listener for auth state changes
  - [ ] Implement sign out functionality
  - [ ] Test session persistence across page reloads
  - [ ] Test automatic token refresh (mock token expiry)
  - [ ] Verify session restoration from localStorage

- [ ] **Task 8: Create Authentication Middleware** (AC: #7)
  - [ ] Create `middleware.ts` in project root
  - [ ] Implement route protection for `/projects/*` routes
  - [ ] Add redirect logic for unauthenticated users
  - [ ] Preserve original URL for post-login redirect
  - [ ] Test middleware with protected and public routes
  - [ ] Add logging for auth events (debug mode)

- [ ] **Task 9: Database Connection Testing** (AC: #8)
  - [ ] Create test API route: `app/api/health/route.ts`
  - [ ] Implement health check query: `SELECT 1`
  - [ ] Test connection from server-side client
  - [ ] Verify RLS is enabled (query should fail without auth)
  - [ ] Test query performance (<500ms target)
  - [ ] Document connection patterns in code comments

- [ ] **Task 10: Email Confirmation Configuration** (AC: #3)
  - [ ] In Supabase Dashboard > Authentication > Email Templates, customize confirmation email
  - [ ] Set confirmation URL redirect to: `https://your-domain.com/auth/callback`
  - [ ] Test email confirmation flow end-to-end
  - [ ] Configure SMTP settings for custom domain emails (optional for dev)

- [ ] **Task 11: Documentation and Testing** (AC: All)
  - [ ] Document authentication flows in README
  - [ ] Add setup instructions for Supabase configuration
  - [ ] Create manual test plan for all auth methods
  - [ ] Test signup → confirm → login flow
  - [ ] Test magic link flow
  - [ ] Test Google OAuth flow
  - [ ] Test session persistence and refresh
  - [ ] Test middleware route protection
  - [ ] Verify no credentials exposed in browser

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Authentication & Database:**
- **Supabase Auth**: JWT-based authentication with OAuth, magic links, MFA support
  - Docs: [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
  - Auth Helpers: [Next.js Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- **PostgreSQL 18**: Managed by Supabase with pgvector extension
  - Version: 18.1 (released Nov 2025)
  - RLS Guide: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- **Supabase Client SDK**: `@supabase/supabase-js` + `@supabase/auth-helpers-nextjs`
  - Version: Latest compatible with Next.js 15

### Authentication Methods

**Email/Password:**
- Default method, password requirements: min 8 chars
- Confirmation email required (can be disabled in dev)
- Password reset via email

**Magic Links:**
- Passwordless authentication
- Link expires after 1 hour
- Useful for demo accounts and temporary access

**OAuth (Google):**
- Requires Google Cloud Console setup
- OAuth scopes: `email`, `profile`
- Can add Microsoft, GitHub in Phase 2

### Session Management

**JWT Token Structure:**
- Access token: Valid for 1 hour
- Refresh token: Valid for 7 days (configurable)
- Stored in localStorage (Supabase client handles)
- Automatic refresh before expiry

**Security Best Practices:**
- Never expose service role key to client
- Use anon key for client-side operations
- RLS policies enforce data isolation (E1.3)
- HTTPS required for production OAuth

### Middleware Configuration

**Protected Routes:**
```typescript
export const config = {
  matcher: [
    '/projects/:path*',
    '/dashboard/:path*',
    '/api/protected/:path*'
  ]
}
```

**Public Routes:**
- `/` (landing page)
- `/login`
- `/signup`
- `/auth/callback`

### Non-Functional Requirements

**Performance (NFR-PERF-002):**
- Login via email/password: <2 seconds
- Magic link generation: <1 second
- Session validation: <100ms
- OAuth redirect flow: 3-5 seconds (network dependent)

**Security (NFR-SEC-001):**
- JWT tokens expire after 1 hour
- Refresh tokens stored securely
- Password requirements: min 8 chars, complexity enforced
- OAuth providers verified

**Reliability (NFR-REL-003):**
- Sessions persist across browser restarts
- Graceful session expiry handling
- Concurrent session support (same user, multiple tabs)
- Session revocation on logout

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-key>  # Server-only, never expose

# Optional: Custom SMTP (Phase 2)
# SUPABASE_SMTP_HOST=smtp.sendgrid.net
# SUPABASE_SMTP_PORT=587
```

### Database Schema Preparation

This story prepares for E1.3 (PostgreSQL Schema) by:
- Enabling pgvector extension
- Verifying RLS enforcement
- Testing connection patterns
- Schema creation happens in E1.3

### Known Issues & Workarounds

**Issue: OAuth redirect in development**
- Supabase OAuth requires HTTPS
- Workaround: Use ngrok or Supabase local development
- Alternative: Test OAuth in staging environment only

**Issue: Email confirmation in development**
- Confirmation emails may go to spam
- Workaround: Disable email confirmation in Supabase settings (dev only)
- Production: Use custom SMTP provider

### Testing Strategy

**Unit Tests:**
- Test auth utility functions
- Test session management hooks

**Integration Tests:**
- Test Supabase client creation
- Test database connection
- Test RLS enforcement (E1.3)

**E2E Tests:**
- Signup → confirm → login flow
- Magic link authentication
- OAuth flow (if configured)
- Session persistence across page reloads
- Middleware route protection

**Manual QA:**
- Test all authentication methods
- Verify error messages are user-friendly
- Test session expiry and refresh
- Verify no credentials in browser DevTools

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Authentication-Authorization]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Supabase-Auth]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-2-Authentication-and-Authorization]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#NFR-SEC-001-Authentication]

**Official Documentation:**
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Next.js Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [PostgreSQL 18 Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### Security Considerations

**Critical Security Requirements:**
- Never commit `.env.local` to version control
- Service role key must NEVER be exposed to client
- Use HTTPS in production for OAuth
- Enable RLS on all tables (E1.3)
- Validate all user inputs
- Sanitize email addresses before database storage
- Implement rate limiting for auth endpoints (Phase 2)

**Audit Logging:**
- Auth events logged in E1.9 (Audit Logging story)
- Track: login, logout, signup, password reset, OAuth attempts

### Prerequisites

- **E1.1** (Next.js 15 Setup) must be completed
- Supabase account created
- Google Cloud Console account (for OAuth)

### Dependencies

- **E1.3** (PostgreSQL Schema) depends on database connection
- **E1.4** (Projects Overview) depends on authentication
- **E1.9** (Audit Logging) depends on user identification

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-2-configure-supabase-auth-and-database-connection.context.xml)

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
