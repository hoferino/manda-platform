/**
 * Logout API Route
 * Handles user signout with audit logging
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #2)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createAuditLog,
  AUDIT_EVENT_TYPES,
  getRequestContextFromRequest,
} from '@/lib/audit'

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestContextFromRequest(request)

  try {
    const supabase = await createClient()

    // Get current user before signing out
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[api/auth/logout] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log successful logout
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.AUTH_LOGOUT,
      user_id: user?.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        email: user?.email,
      },
      success: true,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[api/auth/logout] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
