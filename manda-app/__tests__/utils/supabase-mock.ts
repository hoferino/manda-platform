/**
 * Shared Supabase Test Utilities
 * TD-004: Create shared Supabase test utilities
 *
 * Provides standardized mock patterns for Supabase client in tests.
 * Reduces boilerplate and ensures consistent mocking across test files.
 *
 * Usage:
 *   import { createMockSupabaseClient, mockSupabaseModule } from '@/__tests__/utils/supabase-mock'
 *
 *   // In your test file:
 *   vi.mock('@/lib/supabase/client', () => mockSupabaseModule())
 *
 *   // In beforeEach:
 *   const { client, mocks } = createMockSupabaseClient()
 *   mocks.from.mockReturnValue(mocks) // Chain as needed
 */

import { vi } from 'vitest'

/**
 * Mock Supabase query builder that supports method chaining
 */
export interface MockQueryBuilder {
  from: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lt: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  like: ReturnType<typeof vi.fn>
  ilike: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  contains: ReturnType<typeof vi.fn>
  containedBy: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  range: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  filter: ReturnType<typeof vi.fn>
  match: ReturnType<typeof vi.fn>
  textSearch: ReturnType<typeof vi.fn>
}

/**
 * Mock Supabase Auth interface
 */
export interface MockSupabaseAuth {
  getUser: ReturnType<typeof vi.fn>
  getSession: ReturnType<typeof vi.fn>
  signIn: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
}

/**
 * Mock Supabase Realtime interface
 */
export interface MockSupabaseRealtime {
  channel: ReturnType<typeof vi.fn>
  removeChannel: ReturnType<typeof vi.fn>
}

/**
 * Mock Supabase channel for realtime subscriptions
 */
export interface MockRealtimeChannel {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
}

/**
 * Complete mock Supabase client interface
 */
export interface MockSupabaseClient extends MockQueryBuilder {
  auth: MockSupabaseAuth
  realtime: MockSupabaseRealtime
  channel: ReturnType<typeof vi.fn>
  removeChannel: ReturnType<typeof vi.fn>
}

/**
 * Create a mock query builder with chainable methods
 * All methods return the builder itself for chaining
 */
export function createMockQueryBuilder(): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    like: vi.fn(),
    ilike: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    contains: vi.fn(),
    containedBy: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    filter: vi.fn(),
    match: vi.fn(),
    textSearch: vi.fn(),
  }

  // Make all methods chainable by default
  Object.keys(builder).forEach((key) => {
    const method = builder[key as keyof MockQueryBuilder]
    method.mockReturnValue(builder)
  })

  return builder
}

/**
 * Create a mock realtime channel
 */
export function createMockRealtimeChannel(): MockRealtimeChannel {
  const channel: MockRealtimeChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }

  // Make on() chainable
  channel.on.mockReturnValue(channel)
  // subscribe() returns a subscription status
  channel.subscribe.mockReturnValue({ status: 'SUBSCRIBED' })

  return channel
}

/**
 * Create a complete mock Supabase client
 * Returns both the client and individual mock references for easy configuration
 */
export function createMockSupabaseClient(): {
  client: MockSupabaseClient
  mocks: MockQueryBuilder
  auth: MockSupabaseAuth
  channel: MockRealtimeChannel
} {
  const queryBuilder = createMockQueryBuilder()
  const realtimeChannel = createMockRealtimeChannel()

  const auth: MockSupabaseAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    signIn: vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  }

  const client: MockSupabaseClient = {
    ...queryBuilder,
    auth,
    realtime: {
      channel: vi.fn().mockReturnValue(realtimeChannel),
      removeChannel: vi.fn(),
    },
    channel: vi.fn().mockReturnValue(realtimeChannel),
    removeChannel: vi.fn(),
  }

  return {
    client,
    mocks: queryBuilder,
    auth,
    channel: realtimeChannel,
  }
}

/**
 * Create a mock module for vi.mock('@/lib/supabase/client')
 * Usage: vi.mock('@/lib/supabase/client', () => mockSupabaseModule())
 */
export function mockSupabaseModule() {
  const { client } = createMockSupabaseClient()
  return {
    createClient: vi.fn().mockReturnValue(client),
  }
}

/**
 * Create a mock module for vi.mock('@/lib/supabase/server')
 * Similar to client but for server-side usage
 */
export function mockSupabaseServerModule() {
  const { client } = createMockSupabaseClient()
  return {
    createClient: vi.fn().mockResolvedValue(client),
  }
}

// ============================================
// Common Test Data Factories
// ============================================

/**
 * Create a mock user for auth tests
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export interface MockUser {
  id: string
  email: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

/**
 * Create a mock document for data room tests
 */
export function createMockDocument(overrides: Partial<MockDocument> = {}): MockDocument {
  return {
    id: `doc-${Date.now()}`,
    deal_id: 'project-123',
    user_id: 'user-123',
    name: 'Test Document.pdf',
    file_path: 'https://storage.example.com/test.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    upload_status: 'completed',
    processing_status: 'pending',
    gcs_bucket: 'test-bucket',
    gcs_object_path: 'projects/project-123/test.pdf',
    folder_path: null,
    category: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export interface MockDocument {
  id: string
  deal_id: string
  user_id: string
  name: string
  file_path: string
  file_size: number
  mime_type: string
  upload_status: string
  processing_status: string
  gcs_bucket: string
  gcs_object_path: string
  folder_path: string | null
  category: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

/**
 * Create a mock project/deal for project tests
 */
export function createMockProject(overrides: Partial<MockProject> = {}): MockProject {
  return {
    id: `project-${Date.now()}`,
    name: 'Test Project',
    company_name: 'Test Company',
    status: 'active',
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export interface MockProject {
  id: string
  name: string
  company_name: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

/**
 * Create a mock folder for data room tests
 */
export function createMockFolder(overrides: Partial<MockFolder> = {}): MockFolder {
  return {
    id: `folder-${Date.now()}`,
    deal_id: 'project-123',
    name: 'Test Folder',
    path: 'Test Folder',
    parent_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export interface MockFolder {
  id: string
  deal_id: string
  name: string
  path: string
  parent_path: string | null
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// ============================================
// Helper Functions for Common Scenarios
// ============================================

/**
 * Configure mock to return data for a query
 */
export function mockQuerySuccess<T>(
  mocks: MockQueryBuilder,
  data: T,
  options: { isSingle?: boolean } = {}
) {
  const result = { data, error: null }

  if (options.isSingle) {
    mocks.single.mockResolvedValue(result)
  } else {
    // For queries ending with order, limit, etc.
    mocks.order.mockResolvedValue(result)
    mocks.limit.mockResolvedValue(result)
    mocks.range.mockResolvedValue(result)
  }

  return result
}

/**
 * Configure mock to return an error
 */
export function mockQueryError(
  mocks: MockQueryBuilder,
  error: { message: string; code?: string }
) {
  const result = { data: null, error }

  mocks.single.mockResolvedValue(result)
  mocks.order.mockResolvedValue(result)
  mocks.limit.mockResolvedValue(result)
  mocks.range.mockResolvedValue(result)

  return result
}

/**
 * Configure auth mock to return an authenticated user
 */
export function mockAuthenticatedUser(
  auth: MockSupabaseAuth,
  user: MockUser = createMockUser()
) {
  auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  })
  auth.getSession.mockResolvedValue({
    data: {
      session: {
        user,
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token',
      },
    },
    error: null,
  })
}

/**
 * Configure auth mock to return unauthenticated state
 */
export function mockUnauthenticated(auth: MockSupabaseAuth) {
  auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  })
  auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  })
}
