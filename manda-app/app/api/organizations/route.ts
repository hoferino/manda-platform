/**
 * Organizations API Route
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #6)
 *
 * GET /api/organizations - List user's organizations with membership info
 * POST /api/organizations - Create a new organization (admin only)
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/organizations
 *
 * Returns all organizations the authenticated user belongs to.
 * Does not require x-organization-id header.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        organization_id,
        role,
        created_at,
        organizations (
          id,
          name,
          slug,
          created_at
        )
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('[GET /api/organizations] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch organizations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ organizations: data })
  } catch (error) {
    console.error('[GET /api/organizations] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations
 *
 * Creates a new organization. Requires superadmin role in at least one org.
 * The creating user becomes the admin of the new organization.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is superadmin (can create orgs)
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'superadmin')
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'Only superadmins can create organizations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, slug } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3) {
      return NextResponse.json(
        { error: 'Slug must be at least 3 characters, lowercase alphanumeric with hyphens only' },
        { status: 400 }
      )
    }

    // Create organization
    const { data: newOrg, error: createError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        created_by: user.id,
      })
      .select()
      .single()

    if (createError) {
      if (createError.code === '23505') {
        // Unique violation
        return NextResponse.json(
          { error: 'An organization with this slug already exists' },
          { status: 409 }
        )
      }
      console.error('[POST /api/organizations] Create error:', createError)
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      )
    }

    // Add creating user as admin of new org
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: newOrg.id,
        user_id: user.id,
        role: 'admin',
      })

    if (memberError) {
      console.error('[POST /api/organizations] Member error:', memberError)
      // Org was created but membership failed - should not happen with proper constraints
    }

    return NextResponse.json({ organization: newOrg }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/organizations] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
