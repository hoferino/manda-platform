/**
 * Auth Callback Route Handler
 * Handles OAuth redirects and magic link confirmations
 * Exchanges auth codes for sessions and redirects to the app
 * Story: E1.9 - Adds audit logging for authentication events
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  createAuditLog,
  AUDIT_EVENT_TYPES,
  getRequestContextFromRequest,
} from '@/lib/audit'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/projects'
  const { ipAddress, userAgent } = getRequestContextFromRequest(request)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Log successful OAuth/magic link login
      await createAuditLog({
        event_type: AUDIT_EVENT_TYPES.AUTH_LOGIN,
        user_id: data.user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          email: data.user.email,
          method: data.user.app_metadata?.provider || 'magic_link',
        },
        success: true,
      })

      // Check if this is a new user (email just confirmed)
      if (data.user.email_confirmed_at) {
        const confirmedAt = new Date(data.user.email_confirmed_at)
        const now = new Date()
        // If email was confirmed in the last 5 minutes, log it
        if (now.getTime() - confirmedAt.getTime() < 5 * 60 * 1000) {
          await createAuditLog({
            event_type: AUDIT_EVENT_TYPES.AUTH_EMAIL_CONFIRMED,
            user_id: data.user.id,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: {
              email: data.user.email,
            },
            success: true,
          })
        }
      }

      // Successful authentication - redirect to intended destination
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Log failed authentication
    await createAuditLog({
      event_type: AUDIT_EVENT_TYPES.AUTH_LOGIN,
      user_id: null,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        failure_reason: error?.message || 'Code exchange failed',
        method: 'oauth_or_magic_link',
      },
      success: false,
    })
  }

  // Auth code exchange failed - redirect to error page or login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
