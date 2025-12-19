/**
 * API Client with Organization Context
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #9)
 *
 * This module provides a fetch wrapper that automatically includes
 * the organization context header in all API requests.
 *
 * Usage:
 *   import { apiFetch } from '@/lib/api/client'
 *
 *   // Automatically includes x-organization-id header
 *   const response = await apiFetch('/api/projects')
 *   const data = await response.json()
 *
 * Note: This client requires the OrganizationProvider to be mounted.
 * For server-side usage, use the server-side org-context utilities instead.
 */

'use client'

/**
 * Configuration for the API client.
 */
interface ApiClientConfig {
  /** Base URL for API requests (defaults to '') */
  baseUrl?: string
  /** Default headers to include in all requests */
  defaultHeaders?: Record<string, string>
}

/**
 * Global configuration for the API client.
 * Can be updated via configureApiClient().
 */
let apiConfig: ApiClientConfig = {
  baseUrl: '',
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
}

/**
 * Configure the API client globally.
 *
 * @param config - Configuration options
 */
export function configureApiClient(config: Partial<ApiClientConfig>): void {
  apiConfig = { ...apiConfig, ...config }
}

/**
 * Get the current organization ID from localStorage.
 * This is a fallback when the React context is not available.
 */
function getCurrentOrgId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem('manda_current_org_id')
}

/**
 * Get the current auth token from Supabase session.
 * Returns null if not authenticated.
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null
  }

  // Try to get token from Supabase client
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

/**
 * Extended fetch options with organization context.
 */
export interface ApiFetchOptions extends RequestInit {
  /** Override the organization ID for this request */
  organizationId?: string
  /** Skip including organization header (for org management endpoints) */
  skipOrgHeader?: boolean
  /** Skip including auth header */
  skipAuthHeader?: boolean
}

/**
 * Fetch wrapper that automatically includes organization context.
 *
 * This function wraps the native fetch API and adds:
 * - x-organization-id header from current context or localStorage
 * - Authorization header from Supabase session
 * - Default Content-Type header
 *
 * @param url - URL or path to fetch (relative paths use baseUrl)
 * @param options - Fetch options with additional organization config
 * @returns Promise resolving to the fetch Response
 *
 * @example
 * ```ts
 * // GET request with automatic org context
 * const response = await apiFetch('/api/projects')
 *
 * // POST request with body
 * const response = await apiFetch('/api/projects', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'New Project' }),
 * })
 *
 * // Override organization for specific request
 * const response = await apiFetch('/api/projects', {
 *   organizationId: 'specific-org-id',
 * })
 *
 * // Skip org header for org management endpoints
 * const response = await apiFetch('/api/organizations', {
 *   skipOrgHeader: true,
 * })
 * ```
 */
export async function apiFetch(
  url: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const {
    organizationId,
    skipOrgHeader = false,
    skipAuthHeader = false,
    headers: customHeaders,
    ...fetchOptions
  } = options

  // Build headers
  const headers: Record<string, string> = {
    ...apiConfig.defaultHeaders,
    ...(customHeaders as Record<string, string>),
  }

  // Add organization header unless skipped
  if (!skipOrgHeader) {
    const orgId = organizationId || getCurrentOrgId()
    if (orgId) {
      headers['x-organization-id'] = orgId
    }
  }

  // Add auth header unless skipped
  if (!skipAuthHeader) {
    const token = await getAuthToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  // Build full URL
  const fullUrl = url.startsWith('http') ? url : `${apiConfig.baseUrl}${url}`

  // Execute fetch
  return fetch(fullUrl, {
    ...fetchOptions,
    headers,
  })
}

/**
 * Convenience method for GET requests.
 */
export async function apiGet(
  url: string,
  options: Omit<ApiFetchOptions, 'method' | 'body'> = {}
): Promise<Response> {
  return apiFetch(url, { ...options, method: 'GET' })
}

/**
 * Convenience method for POST requests.
 */
export async function apiPost<T>(
  url: string,
  body: T,
  options: Omit<ApiFetchOptions, 'method' | 'body'> = {}
): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * Convenience method for PUT requests.
 */
export async function apiPut<T>(
  url: string,
  body: T,
  options: Omit<ApiFetchOptions, 'method' | 'body'> = {}
): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/**
 * Convenience method for PATCH requests.
 */
export async function apiPatch<T>(
  url: string,
  body: T,
  options: Omit<ApiFetchOptions, 'method' | 'body'> = {}
): Promise<Response> {
  return apiFetch(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/**
 * Convenience method for DELETE requests.
 */
export async function apiDelete(
  url: string,
  options: Omit<ApiFetchOptions, 'method'> = {}
): Promise<Response> {
  return apiFetch(url, { ...options, method: 'DELETE' })
}

/**
 * Type-safe JSON response helper.
 *
 * @example
 * ```ts
 * interface Project {
 *   id: string
 *   name: string
 * }
 *
 * const { data, error } = await apiFetchJson<{ data: Project[] }>('/api/projects')
 * if (error) {
 *   console.error('Failed to fetch projects:', error)
 * } else {
 *   console.log('Projects:', data.data)
 * }
 * ```
 */
export async function apiFetchJson<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const response = await apiFetch(url, options)
    const json = await response.json()

    if (!response.ok) {
      return {
        data: null,
        error: json.error || `Request failed with status ${response.status}`,
        status: response.status,
      }
    }

    return {
      data: json as T,
      error: null,
      status: response.status,
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      status: 0,
    }
  }
}
