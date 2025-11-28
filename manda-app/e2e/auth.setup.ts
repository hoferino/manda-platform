/**
 * Authentication Setup for E2E Tests
 * TD-001: Add E2E tests for Data Room
 *
 * This file handles authentication state that can be reused across tests.
 * Uses Supabase auth - requires test user credentials in environment.
 */

import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Skip auth in CI if no credentials provided
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    console.log('⚠️ E2E_TEST_EMAIL and E2E_TEST_PASSWORD not set, skipping auth setup')
    console.log('   Set these in .env.local or CI secrets to enable authenticated tests')
    return
  }

  // Navigate to login page
  await page.goto('/login')

  // Fill in credentials
  await page.getByLabel(/email/i).fill(process.env.E2E_TEST_EMAIL)
  await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD)

  // Submit login form
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Wait for redirect to projects page (authenticated)
  await expect(page).toHaveURL('/projects', { timeout: 10000 })

  // Store authentication state
  await page.context().storageState({ path: authFile })
})
