/**
 * Login API Route
 * Handles email/password login with audit logging
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #2)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createAuditLog,
  AUDIT_EVENT_TYPES,
  getRequestContextFromRequest,
} from '@/lib/audit'

interface LoginRequest {
  email: string
  password: string
}

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestContextFromRequest(request)

  try {
    const body = (await request.json()) as LoginRequest
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Log failed login attempt
      await createAuditLog({
        event_type: AUDIT_EVENT_TYPES.AUTH_LOGIN,
        user_id: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          email,
          failure_reason: error.message,
          method: 'password',
        },
        success: false,
      })

      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Log successful login
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.AUTH_LOGIN,
      user_id: data.user?.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        email,
        method: 'password',
      },
      success: true,
    })

    return NextResponse.json({
      user: data.user,
      session: data.session,
    })
  } catch (err) {
    console.error('[api/auth/login] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
