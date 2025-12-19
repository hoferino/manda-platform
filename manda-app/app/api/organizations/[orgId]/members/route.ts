/**
 * Organization Members API Route
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #6)
 *
 * GET /api/organizations/[orgId]/members - List members (admin only)
 * POST /api/organizations/[orgId]/members - Add member (admin only)
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ orgId: string }>
}

async function verifyAdminAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, orgId: string) {
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single()

  return data?.role === 'admin' || data?.role === 'superadmin'
}

/**
 * GET /api/organizations/[orgId]/members
 *
 * Returns all members of an organization. Requires admin role.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin access
    const isAdmin = await verifyAdminAccess(supabase, user.id, orgId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required to view members' },
        { status: 403 }
      )
    }

    // Fetch members with user info via RPC (to get auth.users data)
    // For now, just return membership data - user details would need a separate join
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, user_id, role, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GET /api/organizations/[orgId]/members] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    return NextResponse.json({ members: data })
  } catch (error) {
    console.error('[GET /api/organizations/[orgId]/members] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/[orgId]/members
 *
 * Adds a new member to the organization. Requires admin role.
 * Body: { userId: string, role: 'admin' | 'member' }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin access
    const isAdmin = await verifyAdminAccess(supabase, user.id, orgId)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required to add members' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Validate role
    if (role && !['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be "admin" or "member"' },
        { status: 400 }
      )
    }

    // Cannot assign superadmin role via this endpoint
    const memberRole = role || 'member'

    // Add member
    const { data: newMember, error: insertError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: userId,
        role: memberRole,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 409 }
        )
      }
      console.error('[POST /api/organizations/[orgId]/members] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      )
    }

    return NextResponse.json({ member: newMember }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/organizations/[orgId]/members] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
