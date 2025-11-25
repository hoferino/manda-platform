/**
 * Request Context Capture Utilities
 * Extracts IP address and user agent from Next.js request headers
 * Story: E1.9 - Implement Audit Logging for Security Events (AC: #9)
 */

import { headers } from 'next/headers'

/**
 * Request context for audit logging
 */
export interface RequestContext {
  ipAddress: string
  userAgent: string
}

/**
 * Get request context from Next.js headers
 * Extracts IP address and user agent for audit logging
 *
 * @returns RequestContext with IP address and user agent
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headersList = await headers()

  // Get IP address from various proxy headers
  // Priority: x-forwarded-for (CDN/proxy) > x-real-ip > cf-connecting-ip (Cloudflare)
  const forwardedFor = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  const cfConnectingIp = headersList.get('cf-connecting-ip')

  let ipAddress: string

  if (forwardedFor) {
    // x-forwarded-for may contain multiple IPs, the first is the original client
    const firstIp = forwardedFor.split(',')[0]
    ipAddress = firstIp ? firstIp.trim() : 'unknown'
  } else if (realIp) {
    ipAddress = realIp
  } else if (cfConnectingIp) {
    ipAddress = cfConnectingIp
  } else {
    // Internal request or headers not available
    ipAddress = 'unknown'
  }

  // Get user agent
  const userAgent = headersList.get('user-agent') || 'unknown'

  return {
    ipAddress,
    userAgent,
  }
}

/**
 * Get request context from a Request object (for Route Handlers)
 * Use this when you have direct access to the Request
 *
 * @param request - The incoming Request object
 * @returns RequestContext with IP address and user agent
 */
export function getRequestContextFromRequest(request: Request): RequestContext {
  const headersList = request.headers

  const forwardedFor = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  const cfConnectingIp = headersList.get('cf-connecting-ip')

  let ipAddress: string

  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]
    ipAddress = firstIp ? firstIp.trim() : 'unknown'
  } else if (realIp) {
    ipAddress = realIp
  } else if (cfConnectingIp) {
    ipAddress = cfConnectingIp
  } else {
    ipAddress = 'unknown'
  }

  const userAgent = headersList.get('user-agent') || 'unknown'

  return {
    ipAddress,
    userAgent,
  }
}
