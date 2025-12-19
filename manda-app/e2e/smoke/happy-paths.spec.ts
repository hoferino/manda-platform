/**
 * Happy Path Smoke Tests - E12.4
 *
 * Automated validation of critical user workflows.
 * Run with: npm run test:smoke
 *
 * Routes verified against codebase:
 * - /projects/new (2-step wizard)
 * - /projects/[id]/dashboard
 * - /projects/[id]/data-room
 * - /projects/[id]/chat
 * - /projects/[id]/qa
 * - /projects/[id]/knowledge-explorer
 */

import { test, expect } from '@playwright/test'

/**
 * Shared state for sequential test flow.
 * Note: These module-level variables work because tests run serially via test.describe.serial().
 * projectId is extracted from HP-001 and reused by HP-002 through HP-006.
 */
let projectId: string
let projectName: string

test.describe.serial('Happy Path Smoke Tests @smoke', () => {

  test('HP-001: Create new deal via wizard', async ({ page }) => {
    projectName = `Test Deal ${Date.now()}`

    // Navigate to project creation wizard
    await page.goto('/projects/new')
    // TODO: Add data-testid="create-project-heading" to wizard for more robust selector
    await expect(page.locator('h1, h2, [role="heading"]').filter({ hasText: /create.*project/i }).first()).toBeVisible()

    // Step 1: Basic Info
    // projectName field (not 'name')
    await page.fill('input[id="projectName"], input[name="projectName"]', projectName)

    // companyName field (optional)
    await page.fill('input[id="companyName"], input[name="companyName"]', 'Test Company Inc')

    // Industry selection (searchable combobox)
    const industryTrigger = page.locator('button:has-text("Select industry"), [role="combobox"]').first()
    if (await industryTrigger.isVisible()) {
      await industryTrigger.click()
      await page.locator('[role="option"]').first().click()
    }

    // Click Next to go to Step 2
    await page.click('button:has-text("Next")')

    // Step 2: IRL Template Selection
    await expect(page.locator('text=IRL Template, text=Information Request')).toBeVisible({ timeout: 5000 })

    // Select "Start Empty" or first template option
    const emptyOption = page.locator('text=Start Empty, text=Empty Project, [data-value="none"]').first()
    if (await emptyOption.isVisible()) {
      await emptyOption.click()
    } else {
      // Click first available template
      await page.locator('[role="radio"], [data-state="unchecked"]').first().click()
    }

    // Submit wizard
    await page.click('button:has-text("Create Project"), button:has-text("Create")')

    // Verify redirect to project dashboard
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+\/dashboard/, { timeout: 10000 })

    // Extract project ID from URL
    const url = page.url()
    const match = url.match(/\/projects\/([a-f0-9-]+)\//)
    projectId = match?.[1] || ''
    expect(projectId).toBeTruthy()

    // Verify project name visible on dashboard
    await expect(page.locator(`text=${projectName}`).first()).toBeVisible({ timeout: 5000 })
  })

  test('HP-002: Upload document to data-room', async ({ page }) => {
    test.skip(!projectId, 'Requires HP-001 to pass')

    // Navigate to data-room (NOT /documents)
    await page.goto(`/projects/${projectId}/data-room`)
    await expect(page.locator('text=Data Room')).toBeVisible()

    // Click upload button
    await page.click('button:has-text("Upload")')

    // Upload file via file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('e2e/fixtures/sample-cim.pdf')

    // Wait for upload to start
    await expect(page.locator('text=Processing, text=Uploading, text=Pending')).toBeVisible({ timeout: 10000 })

    // Wait for processing to complete (up to 90 seconds for full pipeline)
    await expect(page.locator('[data-status="processed"], [data-status="analyzed"], text=Processed, text=Analyzed'))
      .toBeVisible({ timeout: 90000 })
  })

  test('HP-003: Chat simple query', async ({ page }) => {
    test.skip(!projectId, 'Requires HP-001 to pass')

    // Navigate to chat
    await page.goto(`/projects/${projectId}/chat`)

    // Find textarea and type message
    const chatInput = page.locator('textarea').first()
    await chatInput.fill('What is the company revenue?')

    // Submit via Enter or button
    await chatInput.press('Enter')

    // Wait for assistant response (up to 30 seconds for LLM)
    const assistantMessage = page.locator('[data-role="assistant"], .assistant-message, [class*="assistant"]').last()
    await expect(assistantMessage).toBeVisible({ timeout: 30000 })

    // Verify response has content
    await expect(assistantMessage).not.toBeEmpty()
  })

  test('HP-004: Chat knowledge write-back', async ({ page }) => {
    test.skip(!projectId, 'Requires HP-001 to pass')

    await page.goto(`/projects/${projectId}/chat`)

    // Send correction
    const chatInput = page.locator('textarea').first()
    await chatInput.fill('The Q3 revenue was actually $5.2M - please remember this.')
    await chatInput.press('Enter')

    // Wait for acknowledgment
    await expect(page.locator('text=/noted|got it|understood|recorded|remember/i').last())
      .toBeVisible({ timeout: 30000 })

    // Start new conversation
    const newChatBtn = page.locator('button:has-text("New"), button:has-text("New Chat")').first()
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click()
    } else {
      // Refresh as fallback
      await page.reload()
    }

    // Ask about Q3 revenue
    const freshInput = page.locator('textarea').first()
    await freshInput.fill('What is Q3 revenue?')
    await freshInput.press('Enter')

    // Verify corrected value in response
    await expect(page.locator('text=5.2').last()).toBeVisible({ timeout: 30000 })
  })

  test('HP-005: Q&A workflow', async ({ page }) => {
    test.skip(!projectId, 'Requires HP-001 to pass')

    // Navigate to Q&A
    await page.goto(`/projects/${projectId}/qa`)

    // Add question
    await page.click('button:has-text("Add"), button:has-text("New")')

    const questionInput = page.locator('textarea, input[name="question"]').first()
    await questionInput.fill('What is the EBITDA margin?')
    await page.click('button:has-text("Save"), button:has-text("Add"), button:has-text("Submit")')

    // Verify question appears
    await expect(page.locator('text=EBITDA margin')).toBeVisible()

    // Add answer (click to expand, then fill answer)
    await page.locator('text=EBITDA margin').click()

    const answerInput = page.locator('textarea').last()
    await answerInput.fill('The EBITDA margin is 25% based on latest financials.')
    await page.click('button:has-text("Save")')

    // Verify answer saved
    await expect(page.locator('text=25%')).toBeVisible()
  })

  test('HP-006: Search in knowledge-explorer', async ({ page }) => {
    test.skip(!projectId, 'Requires HP-001 to pass')

    // Navigate to knowledge-explorer (NOT /knowledge)
    await page.goto(`/projects/${projectId}/knowledge-explorer`)

    // Use the actual data-testid from codebase
    const searchInput = page.locator('[data-testid="finding-search-input"], input[type="search"], input[placeholder*="Search"]').first()
    await searchInput.fill('revenue')
    await searchInput.press('Enter')

    // Wait for results
    await expect(page.locator('[data-testid="search-results-badge"], .search-result, [class*="finding"]').first())
      .toBeVisible({ timeout: 10000 })
  })
})
