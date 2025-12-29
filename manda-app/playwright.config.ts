/**
 * Playwright E2E Test Configuration
 * E12.4: Happy Path Smoke Tests
 * Updated: P0 Test Suite Implementation
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Standardized timeouts (from test architecture knowledge base)
  timeout: 60000, // Global test timeout: 60 seconds
  expect: {
    timeout: 10000, // Expect timeout: 10 seconds
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],

  // Output directory for test artifacts
  outputDir: './test-results',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Standardized timeouts
    actionTimeout: 15000, // Action timeout: 15 seconds
    navigationTimeout: 30000, // Navigation timeout: 30 seconds
  },

  projects: [
    // ===========================================
    // Setup Project - Authentication
    // ===========================================
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ===========================================
    // P0 Critical Tests - Run on every PR
    // ===========================================
    {
      name: 'p0-critical',
      testMatch: '**/p0/*.spec.ts',
      testIgnore: '**/p0/auth.spec.ts', // Auth tests run separately in p0-auth
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },

    // ===========================================
    // P0 Auth Tests (includes both unauthenticated login flows
    // and authenticated session tests)
    // ===========================================
    {
      name: 'p0-auth',
      testMatch: '**/p0/auth.spec.ts',
      // Depends on setup to have auth state available for session tests
      // Individual tests that need auth use test.use({ storageState: ... })
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // No default storageState - login flow tests need fresh browser
        // Session tests override with test.use({ storageState: ... })
      },
    },

    // ===========================================
    // Smoke Tests (legacy - existing happy paths)
    // ===========================================
    {
      name: 'smoke',
      testMatch: '**/smoke/*.spec.ts',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        actionTimeout: 30000,
        navigationTimeout: 30000,
      },
    },

    // ===========================================
    // Full Chromium Tests
    // ===========================================
    {
      name: 'chromium',
      testMatch: '**/*.spec.ts',
      testIgnore: '**/p0/auth.spec.ts', // Auth tests handled separately
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
    },

    // ===========================================
    // Mobile Chrome (P2 - optional)
    // ===========================================
    {
      name: 'mobile-chrome',
      testMatch: '**/smoke/*.spec.ts',
      dependencies: ['setup'],
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],

  // Run local dev server before tests (if not already running)
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
