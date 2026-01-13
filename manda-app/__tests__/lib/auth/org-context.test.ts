/**
 * Organization Context Tests
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #8)
 *
 * Tests for organization context utilities including:
 * - Header extraction
 * - Membership verification
 * - Superadmin checks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  limit: vi.fn().mockReturnThis(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// Import after mocking
import {
  getOrganizationFromHeaders,
  verifyOrganizationMembership,
  isSuperadmin,
  getUserOrganizations,
  ForbiddenError,
} from '@/lib/auth/org-context'

describe('Organization Context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrganizationFromHeaders', () => {
    it('should extract x-organization-id from request headers', () => {
      const mockRequest = {
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'x-organization-id') {
              return 'org-123'
            }
            return null
          }),
        },
      } as unknown as Request

      const result = getOrganizationFromHeaders(mockRequest as Request)
      expect(result).toBe('org-123')
      expect(mockRequest.headers.get).toHaveBeenCalledWith('x-organization-id')
    })

    it('should return null if header is missing', () => {
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as Request

      const result = getOrganizationFromHeaders(mockRequest as Request)
      expect(result).toBeNull()
    })
  })

  describe('verifyOrganizationMembership', () => {
    it('should return context when user is member', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'member' },
        error: null,
      })

      const result = await verifyOrganizationMembership('user-123', 'org-456')

      expect(result).toEqual({
        organizationId: 'org-456',
        userId: 'user-123',
        role: 'member',
      })
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_members')
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123')
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-456')
    })

    it('should throw ForbiddenError when user is not member', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })

      await expect(
        verifyOrganizationMembership('user-123', 'org-456')
      ).rejects.toThrow(ForbiddenError)
    })

    it('should return admin role when user is admin', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      })

      const result = await verifyOrganizationMembership('user-123', 'org-456')

      expect(result.role).toBe('admin')
    })

    it('should return superadmin role when user is superadmin', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'superadmin' },
        error: null,
      })

      const result = await verifyOrganizationMembership('user-123', 'org-456')

      expect(result.role).toBe('superadmin')
    })
  })

  describe('isSuperadmin', () => {
    it('should return true when user has superadmin role', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'membership-1' },
        error: null,
      })

      const result = await isSuperadmin('user-123')

      expect(result).toBe(true)
      expect(mockSupabase.eq).toHaveBeenCalledWith('role', 'superadmin')
    })

    it('should return false when user is not superadmin', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      })

      const result = await isSuperadmin('user-123')

      expect(result).toBe(false)
    })
  })

  describe('getUserOrganizations', () => {
    it('should return all user organizations', async () => {
      const mockOrgs = [
        {
          organization_id: 'org-1',
          role: 'admin',
          organizations: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        },
        {
          organization_id: 'org-2',
          role: 'member',
          organizations: { id: 'org-2', name: 'Org Two', slug: 'org-two' },
        },
      ]

      // Reset and set up mock chain
      mockSupabase.from.mockReturnThis()
      mockSupabase.select.mockReturnThis()
      mockSupabase.eq.mockResolvedValueOnce({
        data: mockOrgs,
        error: null,
      })

      const result = await getUserOrganizations('user-123')

      expect(result).toHaveLength(2)
      expect(result[0]?.organization_id).toBe('org-1')
      expect(result[1]?.organization_id).toBe('org-2')
    })

    it('should return empty array when user has no organizations', async () => {
      mockSupabase.eq.mockResolvedValueOnce({
        data: [],
        error: null,
      })

      const result = await getUserOrganizations('user-123')

      expect(result).toEqual([])
    })
  })

  describe('ForbiddenError', () => {
    it('should be an instance of Error', () => {
      const error = new ForbiddenError('Access denied')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('ForbiddenError')
      expect(error.message).toBe('Access denied')
    })
  })
})

describe('Organization Isolation', () => {
  describe('Cross-Organization Access Prevention', () => {
    it('should prevent user from accessing data in organization they do not belong to', async () => {
      // User is member of org-A but tries to access org-B
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      })

      await expect(
        verifyOrganizationMembership('user-123', 'org-B')
      ).rejects.toThrow('Not a member of this organization')
    })

    it('should allow superadmin to access any organization data', async () => {
      // Superadmin should pass verification for any org they belong to
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'superadmin' },
        error: null,
      })

      const result = await verifyOrganizationMembership('superadmin-user', 'any-org')

      expect(result.role).toBe('superadmin')
    })
  })

  describe('Role-Based Access', () => {
    it('should differentiate between member and admin roles', async () => {
      // Member
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'member' },
        error: null,
      })
      const memberResult = await verifyOrganizationMembership('member-user', 'org-1')
      expect(memberResult.role).toBe('member')

      // Admin
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      })
      const adminResult = await verifyOrganizationMembership('admin-user', 'org-1')
      expect(adminResult.role).toBe('admin')

      // Superadmin
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'superadmin' },
        error: null,
      })
      const superadminResult = await verifyOrganizationMembership('superadmin-user', 'org-1')
      expect(superadminResult.role).toBe('superadmin')
    })
  })
})
