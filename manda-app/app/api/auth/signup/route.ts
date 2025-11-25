/**
 * Signup API Route
 * Handles user registration with audit logging
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #3)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createAuditLog,
  AUDIT_EVENT_TYPES,
  getRequestContextFromRequest,
} from '@/lib/audit'

interface SignupRequest {
  email: string
  password: string
}

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getRequestContextFromRequest(request)

  try {
    const body = (await request.json()) as SignupRequest
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
    })

    if (error) {
      // Log failed signup attempt
      await createAuditLog({
        event_type: AUDIT_EVENT_TYPES.AUTH_SIGNUP,
        user_id: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          email,
          failure_reason: error.message,
          signup_method: 'password',
        },
        success: false,
      })

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Log successful signup
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.AUTH_SIGNUP,
      user_id: data.user?.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        email,
        signup_method: 'password',
      },
      success: true,
    })

    return NextResponse.json({
      user: data.user,
      message: 'Check your email for the confirmation link!',
    })
  } catch (err) {
    console.error('[api/auth/signup] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
