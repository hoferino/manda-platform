/**
 * Q&A Suggestion Flow E2E Tests
 *
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 *
 * These tests document expected agent behavior for the Q&A suggestion flow.
 * Since the behavior is controlled by prompt engineering and requires live LLM interaction,
 * these tests serve as documented specifications and manual test scenarios.
 *
 * AC: #1 - Agent detects gaps and offers to add to Q&A
 * AC: #3 - Q&A item only created after user confirmation
 * AC: #4 - Conversation continues without Q&A if user declines
 */

import { test, expect, Page } from '@playwright/test'

// Test configuration
const TEST_PROJECT_NAME = 'E2E Q&A Test Project'

// Helper to navigate to a project's chat
async function navigateToChat(page: Page, projectName: string) {
  await page.goto('/projects')

  // Find the test project
  const projectCard = page.locator(`[data-testid="project-card"]`).filter({
    hasText: projectName,
  })

  if ((await projectCard.count()) === 0) {
    test.skip(true, 'Test project not found - run data-room.spec.ts first')
    return
  }

  await projectCard.click()
  // Navigate to chat/assistant if not on main page
  const chatLink = page.getByRole('link', { name: /chat|assistant|ask/i })
  if (await chatLink.isVisible()) {
    await chatLink.click()
  }
}

// Helper to send a message in chat
async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('[data-testid="chat-input"], textarea, input[type="text"]').first()
  await chatInput.fill(message)
  await page.keyboard.press('Enter')
}

// Helper to wait for agent response
async function waitForAgentResponse(page: Page, timeout = 30000) {
  // Wait for the loading indicator to disappear
  const loadingIndicator = page.locator('[data-testid="chat-loading"], .loading')
  if (await loadingIndicator.isVisible({ timeout: 1000 })) {
    await loadingIndicator.waitFor({ state: 'hidden', timeout })
  }

  // Wait for agent message to appear
  await page.locator('[data-testid="agent-message"], .assistant-message').last().waitFor({ timeout })
}

// Helper to get last agent message
async function getLastAgentMessage(page: Page): Promise<string> {
  const lastMessage = page
    .locator('[data-testid="agent-message"], .assistant-message')
    .last()
  return (await lastMessage.textContent()) || ''
}

/**
 * Test Scenario 1: KB Miss → Q&A Suggestion → User Confirms → Q&A Created
 *
 * Expected Flow:
 * 1. User asks about missing data (e.g., "What's the customer churn rate?")
 * 2. Agent searches KB, finds no results
 * 3. Agent offers to add to Q&A list with a drafted question
 * 4. User confirms ("Yes, add it")
 * 5. Agent calls add_qa_item tool
 * 6. Q&A item appears in Q&A list
 */
test.describe('Q&A Suggestion Flow - Confirm', () => {
  test.skip('should create Q&A item when user confirms suggestion', async ({ page }) => {
    // NOTE: This test is skipped because it requires live LLM interaction
    // Run manually with: npx playwright test qa-suggestion-flow.spec.ts --headed

    await navigateToChat(page, TEST_PROJECT_NAME)

    // Step 1: Ask about missing data
    await sendChatMessage(page, "What's the customer churn rate?")
    await waitForAgentResponse(page)

    // Step 2: Verify agent offers Q&A suggestion
    const response1 = await getLastAgentMessage(page)
    expect(response1.toLowerCase()).toContain("couldn't find")
    expect(response1.toLowerCase()).toMatch(/q&a|question/i)
    expect(response1).toMatch(/would you like|should i add/i)

    // Step 3: Confirm adding to Q&A
    await sendChatMessage(page, 'Yes, add it')
    await waitForAgentResponse(page)

    // Step 4: Verify confirmation message
    const response2 = await getLastAgentMessage(page)
    expect(response2.toLowerCase()).toMatch(/added|created/i)
    expect(response2).toMatch(/q&a list|operations/i)

    // Step 5: Verify Q&A item exists in Q&A list
    await page.getByRole('link', { name: /q&a/i }).click()
    await expect(page.locator('text=churn')).toBeVisible()
  })

  test.skip('should include proper category and priority in created Q&A item', async ({
    page,
  }) => {
    // NOTE: This test is skipped because it requires live LLM interaction

    await navigateToChat(page, TEST_PROJECT_NAME)

    // Ask about revenue (should map to Financials category)
    await sendChatMessage(page, "What's the annual revenue breakdown by segment?")
    await waitForAgentResponse(page)

    // Confirm
    await sendChatMessage(page, 'Sure, add that')
    await waitForAgentResponse(page)

    // Check Q&A list for category
    await page.getByRole('link', { name: /q&a/i }).click()

    // Verify item has Financials category badge
    await expect(page.locator('text=Financials')).toBeVisible()
  })
})

/**
 * Test Scenario 2: KB Miss → Q&A Suggestion → User Declines → No Q&A Created
 *
 * Expected Flow:
 * 1. User asks about missing data
 * 2. Agent offers to add to Q&A list
 * 3. User declines ("No, let me check elsewhere")
 * 4. Agent acknowledges and offers help
 * 5. No Q&A item is created
 */
test.describe('Q&A Suggestion Flow - Decline', () => {
  test.skip('should not create Q&A item when user declines', async ({ page }) => {
    // NOTE: This test is skipped because it requires live LLM interaction

    await navigateToChat(page, TEST_PROJECT_NAME)

    // Get initial Q&A count
    await page.getByRole('link', { name: /q&a/i }).click()
    const initialCount = await page.locator('[data-testid="qa-item"]').count()

    // Go back to chat
    await page.goBack()

    // Ask about missing data
    await sendChatMessage(page, 'What are the pending litigation matters?')
    await waitForAgentResponse(page)

    // Verify agent offers Q&A suggestion
    const response1 = await getLastAgentMessage(page)
    expect(response1.toLowerCase()).toMatch(/q&a|question/i)

    // Decline the suggestion
    await sendChatMessage(page, 'No, let me check with legal first')
    await waitForAgentResponse(page)

    // Verify agent acknowledges
    const response2 = await getLastAgentMessage(page)
    expect(response2.toLowerCase()).not.toMatch(/added|created/i)
    expect(response2.toLowerCase()).toMatch(/ok|let me know|help/i)

    // Verify no new Q&A item was created
    await page.getByRole('link', { name: /q&a/i }).click()
    const finalCount = await page.locator('[data-testid="qa-item"]').count()
    expect(finalCount).toBe(initialCount)
  })

  test.skip('should continue conversation after user declines', async ({ page }) => {
    // NOTE: This test is skipped because it requires live LLM interaction

    await navigateToChat(page, TEST_PROJECT_NAME)

    // Ask about missing data
    await sendChatMessage(page, 'What is the tech stack?')
    await waitForAgentResponse(page)

    // Decline
    await sendChatMessage(page, "No, I'll ask differently")
    await waitForAgentResponse(page)

    // Continue conversation with new question
    await sendChatMessage(page, "What about the company's revenue?")
    await waitForAgentResponse(page)

    // Verify agent responds to new question
    const response = await getLastAgentMessage(page)
    expect(response.length).toBeGreaterThan(50)
  })
})

/**
 * Test Scenario 3: Question Quality Verification
 *
 * Expected Behavior:
 * - Questions should be specific (include time periods, metrics)
 * - Questions should be professional (client-facing language)
 * - Questions should be actionable (ask for concrete deliverables)
 */
test.describe('Q&A Question Quality', () => {
  test.skip('should draft specific questions with time periods', async ({ page }) => {
    // NOTE: This test is skipped because it requires live LLM interaction

    await navigateToChat(page, TEST_PROJECT_NAME)

    // Ask about financial data
    await sendChatMessage(page, "What's the gross margin?")
    await waitForAgentResponse(page)

    // Verify drafted question includes time period
    const response = await getLastAgentMessage(page)
    expect(response).toMatch(/year|past \d|month|quarter/i)
  })

  test.skip('should use professional language in drafted questions', async ({ page }) => {
    // NOTE: This test is skipped because it requires live LLM interaction

    await navigateToChat(page, TEST_PROJECT_NAME)

    // Ask a casual question
    await sendChatMessage(page, 'Any lawsuits?')
    await waitForAgentResponse(page)

    // Verify drafted question is professional
    const response = await getLastAgentMessage(page)
    // Should not use casual language
    expect(response.toLowerCase()).not.toMatch(/hey|gonna|wanna/i)
    // Should use formal requests
    expect(response).toMatch(/please provide|summary|pending|resolved/i)
  })
})

/**
 * Manual Test Checklist
 *
 * Since these tests require live LLM interaction, use this checklist
 * for manual testing in the development environment:
 *
 * [ ] 1. Navigate to a project with uploaded documents
 * [ ] 2. Ask "What's the customer churn rate?"
 * [ ] 3. Verify agent says it couldn't find the data
 * [ ] 4. Verify agent offers to add to Q&A list
 * [ ] 5. Verify drafted question is specific and professional
 * [ ] 6. Respond "Yes, add it"
 * [ ] 7. Verify agent confirms the addition
 * [ ] 8. Navigate to Q&A page and verify item exists
 * [ ] 9. Verify item has correct category (Operations for churn)
 * [ ] 10. Repeat steps 2-4 with different query
 * [ ] 11. Respond "No, let me check elsewhere"
 * [ ] 12. Verify no Q&A item is created
 * [ ] 13. Verify conversation can continue
 */
test.describe('Manual Test Documentation', () => {
  test('manual test checklist is documented', async () => {
    // This test always passes - it documents the manual testing checklist
    expect(true).toBe(true)
  })
})
