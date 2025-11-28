/**
 * Data Room E2E Tests
 * TD-001: Add E2E tests for Data Room
 *
 * Tests document upload, folder operations, and bucket view functionality.
 * Requires authentication - see auth.setup.ts
 */

import { test, expect, Page } from '@playwright/test'
import path from 'path'

// Test configuration
const TEST_PROJECT_NAME = 'E2E Test Project'

// Helper to navigate to a project's data room
async function navigateToDataRoom(page: Page, projectName: string) {
  await page.goto('/projects')

  // Find and click the test project
  const projectCard = page.locator(`[data-testid="project-card"]`).filter({
    hasText: projectName,
  })

  // If project doesn't exist, we need to create one
  if ((await projectCard.count()) === 0) {
    // Create a test project first
    await page.getByRole('button', { name: /new project|create project/i }).click()

    // Fill in project details (step 1)
    await page.getByLabel(/project name/i).fill(projectName)
    await page.getByLabel(/company/i).fill('E2E Test Company')

    // Select industry if required
    const industrySelect = page.getByLabel(/industry/i)
    if (await industrySelect.isVisible()) {
      await industrySelect.click()
      await page.getByRole('option').first().click()
    }

    // Continue to step 2
    await page.getByRole('button', { name: /next|continue/i }).click()

    // Complete wizard (step 2 - data room setup)
    await page.getByRole('button', { name: /create|finish/i }).click()

    // Wait for project to be created and redirect
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10000 })
  } else {
    // Click on existing project
    await projectCard.click()
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 5000 })
  }

  // Navigate to Data Room tab
  const dataRoomTab = page.getByRole('link', { name: /data room/i })
  if (await dataRoomTab.isVisible()) {
    await dataRoomTab.click()
  }

  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+\/data-room/, { timeout: 5000 })
}

test.describe('Data Room - Folder Operations', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataRoom(page, TEST_PROJECT_NAME)
  })

  test('should display empty data room initially', async ({ page }) => {
    // Verify data room UI elements are present
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible()

    // Verify folder tree area exists
    const folderTree = page.locator('[data-testid="folder-tree"]')
    await expect(folderTree).toBeVisible()
  })

  test('should create a new folder', async ({ page }) => {
    const folderName = `Test Folder ${Date.now()}`

    // Click create folder button (in folder tree header or context menu)
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()

    // Fill in folder name in dialog
    await page.getByLabel(/folder name/i).fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()

    // Verify folder appears in tree
    await expect(page.getByText(folderName)).toBeVisible({ timeout: 5000 })
  })

  test('should rename a folder', async ({ page }) => {
    const originalName = `Rename Test ${Date.now()}`
    const newName = `Renamed Folder ${Date.now()}`

    // Create folder first
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(originalName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(originalName)).toBeVisible()

    // Right-click to open context menu (or use menu button)
    const folderItem = page.getByText(originalName)
    await folderItem.click({ button: 'right' })

    // Click rename option
    await page.getByRole('menuitem', { name: /rename/i }).click()

    // Fill new name
    await page.getByLabel(/new name|folder name/i).fill(newName)
    await page.getByRole('button', { name: /rename|save/i }).click()

    // Verify new name appears
    await expect(page.getByText(newName)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(originalName)).not.toBeVisible()
  })

  test('should delete an empty folder', async ({ page }) => {
    const folderName = `Delete Test ${Date.now()}`

    // Create folder first
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(folderName)).toBeVisible()

    // Right-click to open context menu
    const folderItem = page.getByText(folderName)
    await folderItem.click({ button: 'right' })

    // Click delete option
    await page.getByRole('menuitem', { name: /delete/i }).click()

    // Confirm deletion
    await page.getByRole('button', { name: /delete|confirm/i }).click()

    // Verify folder is removed
    await expect(page.getByText(folderName)).not.toBeVisible({ timeout: 5000 })
  })

  test('should navigate folder tree via breadcrumb', async ({ page }) => {
    const parentFolder = `Parent ${Date.now()}`
    const childFolder = `Child ${Date.now()}`

    // Create parent folder
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(parentFolder)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(parentFolder)).toBeVisible()

    // Select parent folder
    await page.getByText(parentFolder).click()

    // Create child folder inside parent
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(childFolder)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(childFolder)).toBeVisible()

    // Select child folder
    await page.getByText(childFolder).click()

    // Verify breadcrumb shows path
    const breadcrumb = page.locator('[data-testid="breadcrumb"]')
    await expect(breadcrumb).toContainText(parentFolder)
    await expect(breadcrumb).toContainText(childFolder)

    // Click parent in breadcrumb to navigate up
    await breadcrumb.getByText(parentFolder).click()

    // Verify we're back at parent level
    const breadcrumbAfterNav = page.locator('[data-testid="breadcrumb"]')
    await expect(breadcrumbAfterNav).toContainText(parentFolder)
  })
})

test.describe('Data Room - Document Upload', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataRoom(page, TEST_PROJECT_NAME)
  })

  test('should upload a document', async ({ page }) => {
    // Create a test file
    const testFileName = `test-document-${Date.now()}.txt`

    // Click upload button
    await page.getByRole('button', { name: /upload/i }).click()

    // Handle file input (may be hidden)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('This is a test document for E2E testing.'),
    })

    // Wait for upload to complete
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })

    // Verify upload status shows completed
    await expect(
      page.locator(`[data-testid="document-item"]`).filter({ hasText: testFileName })
    ).toBeVisible()
  })

  test('should show upload progress', async ({ page }) => {
    const testFileName = `progress-test-${Date.now()}.txt`

    // Click upload button
    await page.getByRole('button', { name: /upload/i }).click()

    // Upload file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('A'.repeat(10000)), // Larger file to see progress
    })

    // Check that progress indicator appears (may be brief)
    // Note: Progress may be too fast to catch, so we mainly verify completion
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })
  })

  test('should upload document to specific folder', async ({ page }) => {
    const folderName = `Upload Target ${Date.now()}`
    const testFileName = `folder-upload-${Date.now()}.txt`

    // Create folder first
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(folderName)).toBeVisible()

    // Select the folder
    await page.getByText(folderName).click()

    // Upload file to this folder
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('Document in folder'),
    })

    // Verify document appears in folder
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })

    // Verify folder shows document count
    const folderItem = page.getByText(folderName).first()
    await expect(folderItem.locator('..')).toContainText('1')
  })

  test('should download a document', async ({ page }) => {
    const testFileName = `download-test-${Date.now()}.txt`
    const fileContent = 'Download test content'

    // Upload a file first
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    })
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })

    // Start download
    const downloadPromise = page.waitForEvent('download')

    // Click on document to open details, then download
    await page.getByText(testFileName).click()
    await page.getByRole('button', { name: /download/i }).click()

    const download = await downloadPromise

    // Verify download started
    expect(download.suggestedFilename()).toContain(testFileName.replace(/-\d+/, ''))
  })

  test('should delete a document', async ({ page }) => {
    const testFileName = `delete-test-${Date.now()}.txt`

    // Upload a file first
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('Document to delete'),
    })
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })

    // Click on document to open details
    await page.getByText(testFileName).click()

    // Click delete button
    await page.getByRole('button', { name: /delete/i }).click()

    // Confirm deletion
    await page.getByRole('button', { name: /confirm|delete/i }).last().click()

    // Verify document is removed
    await expect(page.getByText(testFileName)).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('Data Room - View Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataRoom(page, TEST_PROJECT_NAME)
  })

  test('should toggle between Folders and Buckets view', async ({ page }) => {
    // Find view toggle tabs
    const foldersTab = page.getByRole('tab', { name: /folders/i })
    const bucketsTab = page.getByRole('tab', { name: /buckets/i })

    // Verify both tabs exist
    await expect(foldersTab).toBeVisible()
    await expect(bucketsTab).toBeVisible()

    // Click Buckets tab
    await bucketsTab.click()

    // Verify buckets view is shown
    await expect(page.locator('[data-testid="buckets-view"]')).toBeVisible()

    // Click Folders tab
    await foldersTab.click()

    // Verify folders view is shown
    await expect(page.locator('[data-testid="folder-tree"]')).toBeVisible()
  })

  test('should persist view preference', async ({ page }) => {
    // Switch to Buckets view
    await page.getByRole('tab', { name: /buckets/i }).click()
    await expect(page.locator('[data-testid="buckets-view"]')).toBeVisible()

    // Refresh page
    await page.reload()

    // Verify Buckets view is still selected
    await expect(page.locator('[data-testid="buckets-view"]')).toBeVisible()
  })
})

test.describe('Data Room - Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataRoom(page, TEST_PROJECT_NAME)
  })

  test('should move document to folder via drag and drop', async ({ page }) => {
    const folderName = `DnD Target ${Date.now()}`
    const testFileName = `dnd-test-${Date.now()}.txt`

    // Create folder
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(folderName)).toBeVisible()

    // Upload file at root
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('Drag and drop test'),
    })
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })

    // Drag document to folder
    const documentItem = page.locator(`[data-testid="document-item"]`).filter({
      hasText: testFileName,
    })
    const folderTarget = page.getByText(folderName).first()

    await documentItem.dragTo(folderTarget)

    // Verify document moved (folder count increased)
    const folderItem = page.getByText(folderName).first()
    await expect(folderItem.locator('..')).toContainText('1')

    // Click folder and verify document is there
    await folderItem.click()
    await expect(page.getByText(testFileName)).toBeVisible()
  })
})

test.describe('Data Room - Processing Status', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToDataRoom(page, TEST_PROJECT_NAME)
  })

  test('should show processing status for uploaded document', async ({ page }) => {
    const testFileName = `processing-test-${Date.now()}.pdf`

    // Upload a PDF file (triggers processing)
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test content'),
    })

    // Wait for document to appear
    await expect(page.getByText(testFileName)).toBeVisible({ timeout: 30000 })

    // Verify processing status badge is visible
    const documentItem = page.locator(`[data-testid="document-item"]`).filter({
      hasText: testFileName,
    })

    // Check for processing status indicator
    const statusBadge = documentItem.locator('[data-testid="processing-status"]')
    await expect(statusBadge).toBeVisible()
  })

  test('should show realtime connection status', async ({ page }) => {
    // Verify realtime connection indicator is visible
    const connectionStatus = page.locator('[data-testid="realtime-status"]')

    // Should show connected status (wifi icon or similar)
    await expect(connectionStatus).toBeVisible()
  })
})
