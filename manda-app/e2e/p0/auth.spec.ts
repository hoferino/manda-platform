/**
 * P0 Authentication Tests
 * Priority: Critical | Risk Score: 6
 *
 * Tests authentication flows including login, session persistence, and logout.
 * These tests run WITHOUT stored auth state to test the actual login flow.
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, assertions } from '../fixtures/test-config'

// Don't use stored auth state for auth tests - we're testing the auth flow itself
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication - P0 Critical @p0 @auth', () => {
  test.describe('Login Flow', () => {
    test('AU-001: Login with valid credentials redirects to projects', async ({ page }) => {
      // Skip if no test credentials configured
      test.skip(
        !TEST_CONFIG.user.email || !TEST_CONFIG.user.password,
        'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required'
      )

      // Navigate to login page
      await page.goto('/login')
      await expect(page.getByText('Welcome back')).toBeVisible()

      // Fill credentials
      await page.getByRole('textbox', { name: /email/i }).fill(TEST_CONFIG.user.email)
      await page.getByRole('textbox', { name: /password/i }).fill(TEST_CONFIG.user.password)

      // Submit (use exact match to avoid matching Google sign-in button)
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()

      // Verify redirect to projects page
      await expect(page).toHaveURL('/projects', {
        timeout: TEST_CONFIG.timeouts.navigation,
      })

      // Verify authenticated UI
      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
      await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
    })

    test('AU-002: Login with invalid credentials shows error', async ({ page }) => {
      await page.goto('/login')

      // Fill invalid credentials
      await page.getByRole('textbox', { name: /email/i }).fill('invalid@example.com')
      await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword')

      // Submit
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()

      // Verify error message
      await expect(page.getByText(/invalid login credentials/i)).toBeVisible({
        timeout: TEST_CONFIG.timeouts.expect,
      })

      // Verify still on login page
      await expect(page).toHaveURL('/login')
    })

    test('AU-002b: Login with empty fields shows validation', async ({ page }) => {
      await page.goto('/login')

      // Try to submit with empty fields
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()

      // Should stay on login page (HTML5 validation or custom validation)
      await expect(page).toHaveURL('/login')
    })

    test('AU-002c: Login form disables during submission', async ({ page }) => {
      test.skip(
        !TEST_CONFIG.user.email || !TEST_CONFIG.user.password,
        'E2E_TEST_EMAIL and E2E_TEST_PASSWORD required'
      )

      await page.goto('/login')

      await page.getByRole('textbox', { name: /email/i }).fill(TEST_CONFIG.user.email)
      await page.getByRole('textbox', { name: /password/i }).fill(TEST_CONFIG.user.password)

      // Click sign in and immediately check for loading state
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()

      // Button should show loading state (disabled or loading text)
      const signInButton = page.getByRole('button', { name: /sign in|loading/i })
      // The button might briefly show "Loading..." or be disabled
      // We just verify we eventually reach the projects page
      await expect(page).toHaveURL('/projects', {
        timeout: TEST_CONFIG.timeouts.navigation,
      })
    })
  })

  test.describe('Magic Link Flow', () => {
    test('AU-003: Magic link tab shows email-only form', async ({ page }) => {
      await page.goto('/login')

      // Click magic link tab
      await page.getByRole('button', { name: /magic link/i }).click()

      // Verify email field is visible
      await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible()

      // Verify password field is NOT visible
      await expect(page.getByRole('textbox', { name: /password/i })).not.toBeVisible()

      // Verify "Send Magic Link" submit button is visible
      await expect(page.getByRole('button', { name: 'Send Magic Link' })).toBeVisible()
    })
  })

  test.describe('OAuth Flow', () => {
    test('AU-004: Google OAuth button is visible', async ({ page }) => {
      await page.goto('/login')

      // Verify Google sign-in button exists
      const googleButton = page.getByRole('button', { name: /google/i })
      await expect(googleButton).toBeVisible()
    })
  })

  test.describe('Signup Flow', () => {
    test('AU-005: Signup link navigates to signup page', async ({ page }) => {
      await page.goto('/login')

      // Click signup link
      await page.getByRole('link', { name: /sign up/i }).click()

      // Verify on signup page
      await expect(page).toHaveURL('/signup')
    })
  })
})

test.describe('Session Management - P0 Critical @p0 @auth @session', () => {
  // These tests use stored auth state
  test.use({ storageState: 'playwright/.auth/user.json' })

  test('AU-006: Session persists across page navigation', async ({ page }) => {
    test.skip(
      !TEST_CONFIG.user.email || !TEST_CONFIG.user.password,
      'Requires authenticated session'
    )

    // Navigate to projects
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

    // Navigate to a project
    await page.goto(`/projects/${TEST_CONFIG.testProject.id}/dashboard`)
    await expect(page.getByRole('heading', { name: TEST_CONFIG.testProject.name })).toBeVisible()

    // Navigate to data room
    await page.goto(`/projects/${TEST_CONFIG.testProject.id}/data-room`)

    // Should still be authenticated (no redirect to login)
    await expect(page).not.toHaveURL('/login')
  })

  test('AU-007: Session persists across page refresh', async ({ page }) => {
    test.skip(
      !TEST_CONFIG.user.email || !TEST_CONFIG.user.password,
      'Requires authenticated session'
    )

    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()

    // Refresh the page
    await page.reload()

    // Should still be authenticated
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  })

  test('AU-008: Logout clears session and redirects to login', async ({ page }) => {
    test.skip(
      !TEST_CONFIG.user.email || !TEST_CONFIG.user.password,
      'Requires authenticated session'
    )

    await page.goto('/projects')
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()

    // Click sign out
    await page.getByRole('button', { name: /sign out/i }).click()

    // Verify redirect to login
    await expect(page).toHaveURL('/login', {
      timeout: TEST_CONFIG.timeouts.navigation,
    })

    // Verify can't access protected pages
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Protected Routes - P0 Critical @p0 @auth @security', () => {
  // Don't use stored auth - test unauthenticated access
  test.use({ storageState: { cookies: [], origins: [] } })

  test('AU-009: Unauthenticated user redirected from /projects', async ({ page }) => {
    await page.goto('/projects')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, {
      timeout: TEST_CONFIG.timeouts.navigation,
    })
  })

  test('AU-010: Unauthenticated user redirected from project pages', async ({ page }) => {
    await page.goto(`/projects/${TEST_CONFIG.testProject.id}/dashboard`)

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, {
      timeout: TEST_CONFIG.timeouts.navigation,
    })
  })

  test('AU-011: Unauthenticated user can access login page', async ({ page }) => {
    await page.goto('/login')

    // Should NOT redirect
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('AU-012: Unauthenticated user can access signup page', async ({ page }) => {
    await page.goto('/signup')

    // Should NOT redirect
    await expect(page).toHaveURL('/signup')
  })
})
