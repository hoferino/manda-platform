/**
 * Project Access Logging API Route
 * Logs when a user accesses a project (for audit trail)
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #4)
 *
 * This endpoint is called when a user views a project to log the access.
 * It's designed to be non-blocking - the client can fire-and-forget.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createAuditLog,
  AUDIT_EVENT_TYPES,
  getRequestContextFromRequest,
} from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ipAddress, userAgent } = getRequestContextFromRequest(request)
  const { id: projectId } = await params

  try {
    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify user has access to this project (RLS will block if not)
    const { data: project, error } = await supabase
      .from('deals')
      .select('id, name')
      .eq('id', projectId)
      .single()

    if (error || !project) {
      // Log access denied
      await createAuditLog({
        event_type: AUDIT_EVENT_TYPES.ACCESS_DENIED,
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          attempted_resource_id: projectId,
          attempted_resource_type: 'project',
          reason: error?.message || 'Project not found or access denied',
        },
        success: false,
      })

      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Log successful project access
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.PROJECT_ACCESSED,
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        project_id: project.id,
        project_name: project.name,
        access_type: 'view',
      },
      success: true,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/projects/[id]/access] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
