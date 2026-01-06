/**
 * Vitest Integration Test Configuration
 *
 * Story: E11.7 - Context-Knowledge Integration Tests
 * Separate configuration for integration tests with longer timeouts.
 *
 * Run with: npm run test:integration
 */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],

    // Integration tests only
    include: ['**/__tests__/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'e2e'],

    // Longer timeouts for integration tests (30 seconds per test)
    testTimeout: 30000,
    hookTimeout: 30000,

    // Run tests sequentially to avoid resource contention
    pool: 'forks' as const,

    // Isolate tests for reliability
    isolate: true,

    // Reporter configuration
    reporters: process.env.CI ? ['dot', 'json'] : ['verbose'],
    outputFile: process.env.CI ? './test-results/integration-results.json' : undefined,

    // Environment variables for integration tests
    env: {
      RUN_INTEGRATION_TESTS: 'true',
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/vitest.setup.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
