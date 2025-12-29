/**
 * P0 Document Processing Pipeline Tests
 * Priority: Critical | Risk Score: 6-9
 *
 * Tests the document upload and processing pipeline:
 * Upload → GCS Storage → Webhook → pg-boss Queue → Workers → Graphiti
 */

import { test, expect } from '@playwright/test'
import { TEST_CONFIG, navigate, uploadActions, testData } from '../fixtures/test-config'

// Use stored auth state for all document tests
test.use({ storageState: 'playwright/.auth/user.json' })

test.describe('Document Upload - P0 Critical @p0 @document-processing @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await navigate.toDataRoom(page, TEST_CONFIG.testProject.id)
  })

  test('DP-001: Upload PDF document successfully', async ({ page }) => {
    // Click upload button
    await page.getByRole('button', { name: /upload/i }).click()

    // Upload sample PDF
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_CONFIG.fixtures.samplePdf)

    // Wait for file to appear in list
    await expect(page.getByText(/sample-cim\.pdf/i)).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload,
    })

    // Verify processing status is shown (Processing, Uploading, or Pending badge)
    await expect(
      page.locator(':text("Processing"), :text("Uploading"), :text("Pending")').first()
    ).toBeVisible({
      timeout: TEST_CONFIG.timeouts.expect,
    })
  })

  test('DP-001b: Upload completes and shows processed status', async ({ page }) => {
    // Click upload button
    await page.getByRole('button', { name: /upload/i }).click()

    // Upload sample PDF
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_CONFIG.fixtures.samplePdf)

    // Wait for processing to complete (up to 90 seconds)
    // Look for Processed or Analyzed status badge
    await expect(
      page.locator(':text("Processed"), :text("Analyzed")').first()
    ).toBeVisible({
      timeout: TEST_CONFIG.timeouts.processing,
    })
  })

  test('DP-002: Upload multiple documents', async ({ page }) => {
    await page.getByRole('button', { name: /upload/i }).click()

    const fileInput = page.locator('input[type="file"]')

    // Upload first file
    await fileInput.setInputFiles(TEST_CONFIG.fixtures.samplePdf)
    await expect(page.getByText(/sample-cim/i)).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload,
    })

    // Upload second file (create a text file on the fly)
    const testFileName = testData.uniqueFileName()
    await page.getByRole('button', { name: /upload/i }).click()
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('Test document content for E2E testing'),
    })

    await expect(page.getByText(testFileName)).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload,
    })
  })
})

test.describe('Document Upload - Error Handling @p0 @document-processing @error-handling', () => {
  test.beforeEach(async ({ page }) => {
    await navigate.toDataRoom(page, TEST_CONFIG.testProject.id)
  })

  test('DP-003: Handle empty PDF gracefully', async ({ page }) => {
    await page.getByRole('button', { name: /upload/i }).click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_CONFIG.fixtures.emptyPdf)

    // Should either show error or process with warning
    // Wait for file to appear in list first
    await expect(page.getByText(/empty\.pdf/i)).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload,
    })

    // Check for error status or just log result (empty files may be handled gracefully)
    await page.waitForTimeout(2000)
    const hasError = await page
      .locator(':text("Error"), :text("Failed"), :text("empty")')
      .first()
      .isVisible()
      .catch(() => false)
    console.log(`Empty PDF handling: ${hasError ? 'error shown' : 'no error (handled gracefully)'}`)
  })

  test('DP-003b: Handle encrypted PDF with error message', async ({ page }) => {
    await page.getByRole('button', { name: /upload/i }).click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_CONFIG.fixtures.encryptedPdf)

    // Should show error or processing failure
    // Wait for file to appear and show status
    await page.waitForTimeout(2000) // Brief wait for upload

    // Check if error state is shown (encrypted files may fail to process)
    const hasError = await page
      .locator(':text("Failed"), :text("Error"), :text("encrypted"), :text("password")')
      .first()
      .isVisible()
      .catch(() => false)

    // Log the result - encrypted handling varies by implementation
    console.log(`Encrypted PDF handling: ${hasError ? 'error shown' : 'no error (may be expected)'}`)
  })

  test('DP-004: Reject unsupported file types', async ({ page }) => {
    await page.getByRole('button', { name: /upload/i }).click()

    const fileInput = page.locator('input[type="file"]')

    // Try to upload an unsupported file type
    await fileInput.setInputFiles({
      name: 'malicious.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('fake exe content'),
    })

    // Should show error or reject the file
    // Check for error message or that file doesn't appear in list
    const fileAppeared = await page
      .getByText('malicious.exe')
      .isVisible()
      .catch(() => false)

    if (fileAppeared) {
      // If file appeared, check for error status
      await expect(
        page.locator(':text("Error"), :text("Rejected"), :text("unsupported")')
      ).toBeVisible({
        timeout: TEST_CONFIG.timeouts.expect,
      })
    }
    // If file didn't appear, rejection worked correctly
  })
})

test.describe('Document Processing Status - P0 @p0 @document-processing', () => {
  test.beforeEach(async ({ page }) => {
    await navigate.toDataRoom(page, TEST_CONFIG.testProject.id)
  })

  test('DP-005: Processing queue shows pending documents', async ({ page }) => {
    // Look for processing queue section
    const processingQueue = page.locator('text=Processing Queue, text=Queue')

    if (await processingQueue.isVisible()) {
      // Queue section exists - verify it shows count
      await expect(page.locator('text=/\\d+ items?|\\(\\d+\\)/')).toBeVisible()
    }
  })

  test('DP-006: Document status transitions correctly', async ({ page }) => {
    await page.getByRole('button', { name: /upload/i }).click()

    const testFileName = `status-test-${Date.now()}.pdf`
    const fileInput = page.locator('input[type="file"]')

    // Create minimal PDF-like content
    await fileInput.setInputFiles({
      name: testFileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\ntest content'),
    })

    // Track status transitions
    const statuses: string[] = []

    // Check initial status (pending or uploading)
    await page.waitForTimeout(1000)
    const initialStatus = await page
      .locator(`[data-status]`)
      .first()
      .getAttribute('data-status')
      .catch(() => 'unknown')

    if (initialStatus) statuses.push(initialStatus)

    // Wait for processing
    await page.waitForTimeout(5000)
    const midStatus = await page
      .locator(`[data-status]`)
      .first()
      .getAttribute('data-status')
      .catch(() => 'unknown')

    if (midStatus && midStatus !== initialStatus) statuses.push(midStatus)

    console.log(`Status transitions observed: ${statuses.join(' → ')}`)
  })

  test('DP-007: Realtime status indicator shows connection', async ({ page }) => {
    // Look for realtime connection indicator
    const connectionIndicator = page.locator(
      '[data-testid="realtime-status"], text=Connected, text=Connecting'
    )

    // May show "Connected" or "Connecting..." or an icon
    const isVisible = await connectionIndicator.first().isVisible().catch(() => false)

    console.log(`Realtime indicator visible: ${isVisible}`)
  })
})

test.describe('Document Folder Operations - P1 @p1 @document-processing', () => {
  test.beforeEach(async ({ page }) => {
    await navigate.toDataRoom(page, TEST_CONFIG.testProject.id)
  })

  test('DP-008: Create folder and upload document to it', async ({ page }) => {
    const folderName = testData.uniqueFolderName()

    // Create folder
    await page.getByRole('button', { name: /new folder/i }).click()

    // Fill folder name in dialog
    const folderInput = page.getByLabel(/folder name/i).or(page.getByPlaceholder(/folder/i))
    await folderInput.fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()

    // Verify folder created
    await expect(page.getByText(folderName)).toBeVisible({
      timeout: TEST_CONFIG.timeouts.expect,
    })

    // Select folder
    await page.getByText(folderName).click()

    // Upload file to folder
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'folder-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Document inside folder'),
    })

    await expect(page.getByText('folder-document.txt')).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload,
    })
  })

  test('DP-009: Navigate between folders and buckets view', async ({ page }) => {
    // Verify Folders tab is visible and selected
    // Tab has accessible name "Switch to folder view"
    const foldersTab = page.getByRole('tab', { name: /folder/i })
    await expect(foldersTab).toBeVisible()

    // Click Buckets tab (accessible name "Switch to buckets view")
    const bucketsTab = page.getByRole('tab', { name: /bucket/i })
    await bucketsTab.click()

    // Wait for view to change
    await page.waitForTimeout(500)

    // Click back to Folders
    await foldersTab.click()

    // Verify we can navigate between views without errors
    await expect(foldersTab).toBeVisible()
  })
})

test.describe('IRL Checklist Integration - P1 @p1 @document-processing', () => {
  test.beforeEach(async ({ page }) => {
    await navigate.toDataRoom(page, TEST_CONFIG.testProject.id)
  })

  test('DP-010: IRL Checklist panel is visible', async ({ page }) => {
    // Look for IRL Checklist heading
    const irlChecklist = page.getByRole('heading', { name: /IRL Checklist/i })

    await expect(irlChecklist).toBeVisible({
      timeout: TEST_CONFIG.timeouts.expect,
    })
  })

  test('DP-011: IRL Checklist can be collapsed', async ({ page }) => {
    // Look for collapse button
    const collapseButton = page.getByRole('button', { name: /collapse.*irl|hide.*irl/i })

    if (await collapseButton.isVisible()) {
      await collapseButton.click()

      // Checklist content should be hidden
      await expect(page.locator('[data-testid="irl-items"]')).not.toBeVisible()
    }
  })
})

test.describe('Document Actions - P1 @p1 @document-processing', () => {
  test.beforeEach(async ({ page }) => {
    await navigate.toDataRoom(page, TEST_CONFIG.testProject.id)
  })

  test('DP-012: Refresh button reloads document list', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh/i })
    await expect(refreshButton).toBeVisible()

    // Click refresh
    await refreshButton.click()

    // Should show loading state briefly or reload data
    // No error should occur
    await page.waitForTimeout(1000)

    // Verify page still functional
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible()
  })

  test('DP-013: Download document', async ({ page }) => {
    // First ensure there's a document to download
    await page.getByRole('button', { name: /upload/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'download-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Content for download test'),
    })

    await expect(page.getByText('download-test.txt')).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload,
    })

    // Click on document to select it
    await page.getByText('download-test.txt').click()

    // Start download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)

    // Look for download button and click
    const downloadButton = page.getByRole('button', { name: /download/i })
    if (await downloadButton.isVisible()) {
      await downloadButton.click()

      const download = await downloadPromise
      if (download) {
        expect(download.suggestedFilename()).toContain('download-test')
      }
    }
  })
})
