/**
 * E2E Test Configuration and Fixtures
 * Centralized configuration for all E2E tests
 */

/* eslint-disable react-hooks/rules-of-hooks */
// Note: Playwright fixtures use a `use` function that ESLint mistakes for React's use hook

import { test as base, expect, Page } from '@playwright/test'

// =============================================================================
// Test Data Configuration
// =============================================================================

export const TEST_CONFIG = {
  // Test user credentials (from environment)
  user: {
    email: process.env.E2E_TEST_EMAIL || '',
    password: process.env.E2E_TEST_PASSWORD || '',
  },

  // Known test project (from live exploration)
  testProject: {
    id: '402193e1-a2b8-4994-bbfb-d59e56d2fbd9',
    name: 'Edge Case Test Deal',
  },

  // Timeouts
  timeouts: {
    navigation: 30000,
    action: 15000,
    expect: 10000,
    upload: 60000,
    processing: 90000,
    llmResponse: 45000,
  },

  // File paths
  fixtures: {
    samplePdf: 'e2e/fixtures/sample-cim.pdf',
    emptyPdf: 'e2e/fixtures/edge-cases/empty.pdf',
    encryptedPdf: 'e2e/fixtures/edge-cases/encrypted.pdf',
  },
}

// =============================================================================
// Custom Test Fixtures
// =============================================================================

type TestFixtures = {
  authenticatedPage: Page
  projectPage: Page
  testProjectId: string
}

/**
 * Extended test with custom fixtures for Manda E2E tests
 */
export const test = base.extend<TestFixtures>({
  // Authenticated page fixture (uses stored auth state)
  authenticatedPage: async ({ page }, use) => {
    // Auth state is loaded via storageState in playwright.config.ts
    await use(page)
  },

  // Project page fixture - navigates to test project
  projectPage: async ({ page }, use) => {
    await page.goto(`/projects/${TEST_CONFIG.testProject.id}/dashboard`)
    await expect(page.getByRole('heading', { name: TEST_CONFIG.testProject.name })).toBeVisible({
      timeout: TEST_CONFIG.timeouts.navigation,
    })
    await use(page)
  },

  // Test project ID
  testProjectId: async ({}, use) => {
    await use(TEST_CONFIG.testProject.id)
  },
})

export { expect }

// =============================================================================
// Page Object Helpers
// =============================================================================

/**
 * Navigation helpers for common pages
 */
export const navigate = {
  async toProjects(page: Page) {
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
  },

  async toDataRoom(page: Page, projectId: string) {
    await page.goto(`/projects/${projectId}/data-room`)
    // Wait for Data Room UI to load (Folders/Buckets tabs)
    // The tab has accessible name "Switch to folder view" with visible text "Folders"
    await expect(page.getByRole('tab', { name: /folder/i })).toBeVisible({
      timeout: TEST_CONFIG.timeouts.navigation,
    })
  },

  async toChat(page: Page, projectId: string) {
    await page.goto(`/projects/${projectId}/chat`)
    await expect(page.getByPlaceholder(/ask a question about your deal/i)).toBeVisible({
      timeout: TEST_CONFIG.timeouts.navigation,
    })
  },

  async toKnowledgeExplorer(page: Page, projectId: string) {
    await page.goto(`/projects/${projectId}/knowledge-explorer`)
  },

  async toQA(page: Page, projectId: string) {
    await page.goto(`/projects/${projectId}/qa`)
  },
}

// =============================================================================
// Action Helpers
// =============================================================================

/**
 * Chat interaction helpers
 */
export const chatActions = {
  async sendMessage(page: Page, message: string) {
    const input = page.getByPlaceholder(/ask a question about your deal/i)
    // Wait for input to be enabled (may be disabled during streaming)
    await expect(input).toBeEnabled({ timeout: TEST_CONFIG.timeouts.llmResponse })
    await input.fill(message)
    await input.press('Enter')
  },

  async waitForResponse(page: Page, timeout = TEST_CONFIG.timeouts.llmResponse) {
    // Wait for assistant message to appear (assistant messages don't have flex-row-reverse)
    const assistantMessages = page.locator('[data-testid="message-item"]:not(.flex-row-reverse)')
    await expect(assistantMessages.last()).toBeVisible({
      timeout,
    })

    // Wait for streaming to complete by checking that:
    // 1. The input is enabled (disabled during streaming)
    // 2. The message has actual content (not just typing indicator dots)
    const input = page.getByPlaceholder(/ask a question about your deal/i)
    await expect(input).toBeEnabled({ timeout })

    // Also wait for the message content to have more than just the typing indicator
    // The typing indicator is ~8 chars ("..." dots), so wait for meaningful content
    await expect(async () => {
      const content = await assistantMessages.last().textContent()
      expect(content?.length).toBeGreaterThan(15)
    }).toPass({ timeout })
  },

  async getLastAssistantMessage(page: Page) {
    return page.locator('[data-testid="message-item"]:not(.flex-row-reverse)').last()
  },

  async startNewConversation(page: Page) {
    // Close any dev overlay that might be intercepting clicks
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)

    // Check if we're already in a fresh state (welcome message visible)
    const welcomeMessage = page.getByText(/start a conversation/i)
    const input = page.getByPlaceholder(/ask a question about your deal/i)

    if (await welcomeMessage.isVisible().catch(() => false)) {
      // Already in fresh state, but still wait for input to be ready
      await expect(input).toBeEnabled({ timeout: TEST_CONFIG.timeouts.llmResponse })
      return
    }

    // Otherwise, click the "New conversation" button
    const newButton = page.getByRole('button', { name: /new.*conversation/i }).first()
    if (await newButton.isVisible()) {
      await newButton.click({ force: true })
      // Wait for the chat to reset (welcome message should appear)
      await expect(welcomeMessage).toBeVisible({
        timeout: TEST_CONFIG.timeouts.expect,
      })
      // Wait for input to be enabled (streaming state may still be clearing)
      await expect(input).toBeEnabled({ timeout: TEST_CONFIG.timeouts.llmResponse })
    }
  },
}

/**
 * Document upload helpers
 */
export const uploadActions = {
  async uploadFile(page: Page, filePath: string) {
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath)
  },

  async waitForProcessing(page: Page, timeout = TEST_CONFIG.timeouts.processing) {
    // Wait for status to change from pending/processing to processed/analyzed
    await expect(
      page.locator('[data-status="processed"], [data-status="analyzed"], text=Processed, text=Analyzed')
    ).toBeVisible({ timeout })
  },
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Custom assertions for Manda-specific checks
 */
export const assertions = {
  async hasSourceCitations(page: Page) {
    const citations = page.locator('[data-testid="citation-link"], [data-testid="source-citation"]')
    await expect(citations.first()).toBeVisible()
    return citations.count()
  },

  async hasErrorMessage(page: Page, messagePattern?: RegExp) {
    const alert = page.locator('[role="alert"], .error-message, [data-testid="error"]')
    await expect(alert).toBeVisible()
    if (messagePattern) {
      await expect(alert).toContainText(messagePattern)
    }
  },

  async isAuthenticated(page: Page) {
    // Check for authenticated UI elements
    const signOutButton = page.getByRole('button', { name: /sign out/i })
    return signOutButton.isVisible()
  },
}

// =============================================================================
// Test Data Factories
// =============================================================================

/**
 * Generate unique test data
 */
export const testData = {
  uniqueProjectName: () => `Test Project ${Date.now()}`,
  uniqueFolderName: () => `Folder ${Date.now()}`,
  uniqueFileName: () => `test-file-${Date.now()}.txt`,

  sampleChatQueries: [
    'What is the company revenue?',
    'What are the key risk factors?',
    'Summarize the financial highlights',
    'Are there any red flags in the contracts?',
  ],

  correctionMessage: (originalValue: string, newValue: string) =>
    `The ${originalValue} was actually ${newValue} - please remember this correction.`,
}
