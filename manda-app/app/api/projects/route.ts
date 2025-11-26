/**
 * Projects API Route
 * Handles project creation with audit logging
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #4)
 *
 * Note (v2.6): deal_type removed - it didn't drive any downstream behavior
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createAuditLog,
  AUDIT_EVENT_TYPES,
  getRequestContextFromRequest,
} from '@/lib/audit'

interface CreateProjectRequest {
  name: string
  company_name?: string | null
  industry?: string | null
  irl_template?: string | null
  status?: string
}

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestContextFromRequest(request)

  try {
    const body = (await request.json()) as CreateProjectRequest
    const { name, company_name, industry, irl_template, status } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Create the project
    const { data, error } = await supabase
      .from('deals')
      .insert({
        user_id: user.id,
        name: name.trim(),
        company_name: company_name?.trim() || null,
        industry: industry || null,
        irl_template: irl_template || null,
        status: status || 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[api/projects] Error creating project:', error)

      // Log failed project creation
      await createAuditLog({
        event_type: AUDIT_EVENT_TYPES.PROJECT_CREATED,
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          project_name: name,
          failure_reason: error.message,
        },
        success: false,
      })

      // Handle specific error cases
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A project with this name already exists' },
          { status: 400 }
        )
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log successful project creation
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.PROJECT_CREATED,
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        project_id: data.id,
        project_name: data.name,
        industry: data.industry,
      },
      success: true,
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects - List projects for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[api/projects] Error fetching projects:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
