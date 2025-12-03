import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'e2e'],

    // TD-003: Parallel execution optimizations
    // Run tests in parallel across multiple threads
    pool: 'threads' as const,
    // @ts-expect-error - vitest types are outdated for pool options
    poolOptions: {
      threads: {
        // Use all available CPU cores
        minThreads: 1,
        maxThreads: undefined, // Auto-detect based on CPU cores
      },
    },

    // Isolate tests for reliability (each test file runs in clean environment)
    isolate: true,

    // Faster test file discovery
    passWithNoTests: true,

    // Reporter optimizations
    reporter: process.env.CI ? ['dot', 'json'] : ['verbose'],
    outputFile: process.env.CI ? './test-results/results.json' : undefined,

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
