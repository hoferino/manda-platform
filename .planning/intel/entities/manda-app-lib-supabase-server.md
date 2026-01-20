---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/supabase/server.ts
type: service
updated: 2026-01-20
status: active
---

# server.ts

## Purpose

Provides Supabase client factories for server-side operations in Next.js. Handles cookie-based authentication for Server Components, Server Actions, and Route Handlers. Also provides an admin client that bypasses RLS for trusted server operations and a header-based client for CLI/external integrations.

## Exports

- `createClient(): Promise<SupabaseClient>` - Cookie-authenticated client for server components/actions
- `createClientFromAuthHeader(authHeader: string | null): Promise<SupabaseClient | null>` - Bearer token authenticated client for API routes
- `createAdminClient(): Promise<SupabaseClient>` - Service role client that bypasses RLS (server-only)

## Dependencies

- @supabase/ssr - createServerClient for SSR cookie handling
- @supabase/supabase-js - createClient for token auth
- next/headers - cookies() for cookie access
- [[manda-app-lib-supabase-types]] - Database type definitions

## Used By

TBD

## Notes

Admin client uses SUPABASE_SERVICE_ROLE_KEY and should never be exposed to client-side. The createClientFromAuthHeader enables CLI tools and benchmarks to authenticate via Bearer tokens.
