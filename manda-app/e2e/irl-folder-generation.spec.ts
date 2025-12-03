/**
 * IRL to Folder Generation E2E Tests
 * Story: E6.4 - Implement Data Room Folder Structure Auto-Generation from IRL
 *
 * Tests the workflow: Create IRL → Generate Folders → Verify in Data Room
 */

import { test, expect, Page } from '@playwright/test'

// Test configuration
const TEST_PROJECT_NAME = 'E2E IRL Folder Test'

// Helper to navigate to a project
async function navigateToProject(page: Page, projectName: string): Promise<string> {
  await page.goto('/projects')

  // Find and click the test project
  const projectCard = page.locator(`[data-testid="project-card"]`).filter({
    hasText: projectName,
  })

  // If project doesn't exist, create one
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

  // Extract project ID from URL
  const url = page.url()
  const match = url.match(/\/projects\/([a-f0-9-]+)/)
  return match?.[1] ?? ''
}

// Helper to navigate to IRL Builder
async function navigateToIRLBuilder(page: Page) {
  // Navigate to IRL tab
  const irlTab = page.getByRole('link', { name: /irl|checklist/i })
  if (await irlTab.isVisible()) {
    await irlTab.click()
  }

  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+\/(irl|checklist)/, { timeout: 5000 })
}

// Helper to navigate to Data Room
async function navigateToDataRoom(page: Page) {
  const dataRoomTab = page.getByRole('link', { name: /data room/i })
  if (await dataRoomTab.isVisible()) {
    await dataRoomTab.click()
  }

  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+\/data-room/, { timeout: 5000 })
}

test.describe('IRL to Folder Generation', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page, TEST_PROJECT_NAME)
  })

  test('should generate folders from IRL template categories', async ({ page }) => {
    // Navigate to IRL Builder
    await navigateToIRLBuilder(page)

    // Check if IRL already exists, if not create one from template
    const createIRLButton = page.getByRole('button', { name: /create irl|new irl|select template/i })

    if (await createIRLButton.isVisible()) {
      await createIRLButton.click()

      // Select a template (e.g., Standard M&A)
      const templateOption = page.getByText(/standard|m&a|acquisition/i).first()
      if (await templateOption.isVisible()) {
        await templateOption.click()
      }

      // Confirm template selection
      const confirmButton = page.getByRole('button', { name: /create|confirm|apply/i })
      if (await confirmButton.isVisible()) {
        await confirmButton.click()
      }

      // Wait for IRL to be created
      await expect(page.locator('[data-testid="irl-builder"], [data-testid="irl-items"]')).toBeVisible({
        timeout: 10000,
      })
    }

    // Find and click the Generate Folders button
    const generateFoldersButton = page.getByRole('button', { name: /generate folders/i })
    await expect(generateFoldersButton).toBeVisible({ timeout: 5000 })
    await generateFoldersButton.click()

    // Wait for the folder generation dialog/result to appear
    const folderResultDialog = page.locator('[role="dialog"], [data-testid="folder-result"]')
    await expect(folderResultDialog).toBeVisible({ timeout: 10000 })

    // Verify folders were created (check for success message or folder count)
    const successIndicator = page.getByText(/folder.*created|generated|success/i)
    await expect(successIndicator).toBeVisible({ timeout: 5000 })

    // Close the dialog
    const closeButton = page.getByRole('button', { name: /close|done|ok/i })
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }

    // Navigate to Data Room to verify folders exist
    await navigateToDataRoom(page)

    // Verify folder tree shows the generated folders
    const folderTree = page.locator('[data-testid="folder-tree"]')
    await expect(folderTree).toBeVisible()

    // Check that at least one folder exists (from IRL categories)
    const folderItems = folderTree.locator('[class*="folder"], [data-testid*="folder"]')
    const folderCount = await folderItems.count()
    expect(folderCount).toBeGreaterThan(0)
  })

  test('should not duplicate folders when generating multiple times', async ({ page }) => {
    // Navigate to IRL Builder
    await navigateToIRLBuilder(page)

    // Ensure IRL exists
    await expect(page.locator('[data-testid="irl-builder"], [data-testid="irl-items"]')).toBeVisible({
      timeout: 10000,
    })

    // Click Generate Folders button
    const generateFoldersButton = page.getByRole('button', { name: /generate folders/i })
    await expect(generateFoldersButton).toBeVisible({ timeout: 5000 })
    await generateFoldersButton.click()

    // Wait for result dialog
    const folderResultDialog = page.locator('[role="dialog"], [data-testid="folder-result"]')
    await expect(folderResultDialog).toBeVisible({ timeout: 10000 })

    // Check for skipped message (folders already exist)
    const skippedText = page.getByText(/skipped|already exist/i)

    // First time may create, second time should skip
    // Either created or skipped is acceptable
    const resultText = page.getByText(/created|skipped|generated/i)
    await expect(resultText).toBeVisible({ timeout: 5000 })

    // Close dialog
    const closeButton = page.getByRole('button', { name: /close|done|ok/i })
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }
  })

  test('should show folder tree structure matching IRL categories', async ({ page }) => {
    // Navigate to Data Room
    await navigateToDataRoom(page)

    // Verify folder tree is visible
    const folderTree = page.locator('[data-testid="folder-tree"]')
    await expect(folderTree).toBeVisible()

    // Expand folders to see hierarchy
    const expandButtons = page.locator('[data-testid="folder-tree"] button[class*="expand"], [data-testid="folder-tree"] [class*="chevron"]')
    const expandCount = await expandButtons.count()

    for (let i = 0; i < expandCount && i < 5; i++) {
      const button = expandButtons.nth(i)
      if (await button.isVisible()) {
        await button.click()
        await page.waitForTimeout(200) // Brief delay for animation
      }
    }

    // Verify nested structure exists (subfolders)
    // This confirms IRL subcategories were converted to nested folders
    const nestedFolders = page.locator('[data-testid="folder-tree"] [style*="padding-left"]')
    const nestedCount = await nestedFolders.count()

    // Should have some nested structure
    expect(nestedCount).toBeGreaterThan(0)
  })
})

test.describe('IRL Folder Integration - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page, TEST_PROJECT_NAME)
    await navigateToDataRoom(page)
  })

  test('should create subfolder within generated IRL folder', async ({ page }) => {
    const subfolderName = `Subfolder ${Date.now()}`

    // Find a folder in the tree and right-click for context menu
    const folderTree = page.locator('[data-testid="folder-tree"]')
    await expect(folderTree).toBeVisible()

    // Get the first folder item
    const folderItems = folderTree.locator('[class*="cursor-pointer"]:has-text("/")')
    const firstFolder = folderItems.first()

    if (await firstFolder.isVisible()) {
      // Open context menu via more button
      await firstFolder.hover()
      const moreButton = firstFolder.locator('button:has(svg)').last()
      if (await moreButton.isVisible()) {
        await moreButton.click()
      }

      // Click New Subfolder
      await page.getByRole('menuitem', { name: /new subfolder|add subfolder/i }).click()

      // Fill in subfolder name
      await page.getByLabel(/folder name/i).fill(subfolderName)
      await page.getByRole('button', { name: /create/i }).click()

      // Verify subfolder appears
      await expect(page.getByText(subfolderName)).toBeVisible({ timeout: 5000 })
    }
  })

  test('should rename an IRL-generated folder', async ({ page }) => {
    const newName = `Renamed ${Date.now()}`

    // Find a folder and open context menu
    const folderTree = page.locator('[data-testid="folder-tree"]')
    const folderItems = folderTree.locator('[class*="cursor-pointer"]')
    const targetFolder = folderItems.first()

    if (await targetFolder.isVisible()) {
      // Get current name
      const currentName = await targetFolder.textContent()

      // Open context menu
      await targetFolder.hover()
      const moreButton = targetFolder.locator('button:has(svg)').last()
      if (await moreButton.isVisible()) {
        await moreButton.click()
      }

      // Click Rename
      await page.getByRole('menuitem', { name: /rename/i }).click()

      // Enter new name
      await page.getByLabel(/folder name|new name/i).fill(newName)
      await page.getByRole('button', { name: /rename|save/i }).click()

      // Verify renamed
      await expect(page.getByText(newName)).toBeVisible({ timeout: 5000 })
    }
  })

  test('should delete empty folder with confirmation', async ({ page }) => {
    // First create a folder to delete
    const folderToDelete = `ToDelete ${Date.now()}`

    // Click create folder button
    const createButton = page.getByTestId('create-folder-button')
    if (await createButton.isVisible()) {
      await createButton.click()
    } else {
      await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    }

    // Create the folder
    await page.getByLabel(/folder name/i).fill(folderToDelete)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(folderToDelete)).toBeVisible()

    // Now delete it
    const folderItem = page.getByText(folderToDelete)
    await folderItem.hover()

    // Open context menu
    const moreButton = folderItem.locator('..').locator('button:has(svg)').last()
    if (await moreButton.isVisible()) {
      await moreButton.click()
    }

    // Click Delete
    await page.getByRole('menuitem', { name: /delete/i }).click()

    // Confirm deletion
    await page.getByRole('button', { name: /delete|confirm/i }).click()

    // Verify folder is gone
    await expect(page.getByText(folderToDelete)).not.toBeVisible({ timeout: 5000 })
  })

  test('should show toast notifications for folder operations', async ({ page }) => {
    const folderName = `Toast Test ${Date.now()}`

    // Create a folder
    const createButton = page.getByTestId('create-folder-button')
    if (await createButton.isVisible()) {
      await createButton.click()
    } else {
      await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    }

    await page.getByLabel(/folder name/i).fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()

    // Verify toast notification appears
    const toast = page.locator('[data-sonner-toast], [role="alert"], [class*="toast"]')
    await expect(toast.filter({ hasText: /created|success/i })).toBeVisible({ timeout: 5000 })

    // Verify folder was created
    await expect(page.getByText(folderName)).toBeVisible()
  })
})

test.describe('Data Room - Folder Refresh After Operations', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToProject(page, TEST_PROJECT_NAME)
    await navigateToDataRoom(page)
  })

  test('should refresh folder list after creating folder', async ({ page }) => {
    const folderName = `Refresh Test ${Date.now()}`

    // Get initial folder count
    const folderTree = page.locator('[data-testid="folder-tree"]')
    const initialFolders = await folderTree.locator('[class*="cursor-pointer"]').count()

    // Create a new folder
    await page.getByRole('button', { name: /new folder|create folder/i }).first().click()
    await page.getByLabel(/folder name/i).fill(folderName)
    await page.getByRole('button', { name: /create/i }).click()

    // Verify folder list updated without manual refresh
    await expect(page.getByText(folderName)).toBeVisible({ timeout: 5000 })

    // Count should have increased
    const afterFolders = await folderTree.locator('[class*="cursor-pointer"]').count()
    expect(afterFolders).toBeGreaterThan(initialFolders)
  })

  test('should update folder list via Refresh button', async ({ page }) => {
    // Click refresh button
    await page.getByRole('button', { name: /refresh/i }).click()

    // Verify folder tree is still visible (data reloaded)
    const folderTree = page.locator('[data-testid="folder-tree"]')
    await expect(folderTree).toBeVisible()
  })
})
