/**
 * Q&A Tools
 *
 * Agent tools for Q&A item management.
 * Story: E8.3 - Agent Tool - add_qa_item()
 *
 * Tools:
 * - add_qa_item - Add a Q&A item for client to answer (NOT AI-generated answers)
 *
 * Design Notes:
 * - Q&A items are questions for the CLIENT to answer
 * - Status is derived from date_answered (NULL = pending, NOT NULL = answered)
 * - Optional sourceFindingId links question to a finding that triggered it
 */

import { tool } from '@langchain/core/tools'
import { createClient } from '@/lib/supabase/server'
import { AddQAItemInputSchema } from '../schemas'
import { formatToolResponse, handleToolError } from './utils'
import { createQAItem } from '@/lib/services/qa'
import type { CreateQAItemInput } from '@/lib/types/qa'

/**
 * add_qa_item
 *
 * Adds a Q&A item for the client to answer.
 * Use this when the agent identifies information gaps that need clarification from the target company.
 *
 * Story: E8.3 - Agent Tool - add_qa_item()
 * AC: #1 - Agent can call tool with valid parameters
 * AC: #2 - Invalid category/priority returns clear Zod error message
 * AC: #3 - Q&A item appears in UI immediately
 * AC: #4 - Optional sourceFindingId links to finding
 * AC: #5 - Returns success with itemId, or error message
 * AC: #6 - Validates question length (minimum 10 characters)
 */
export const addQAItemTool = tool(
  async (input) => {
    try {
      const { dealId, question, category, priority, sourceFindingId } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Verify the project exists and user has access
      const { data: project, error: projectError } = await supabase
        .from('deals')
        .select('id, name')
        .eq('id', dealId)
        .single()

      if (projectError || !project) {
        return formatToolResponse(
          false,
          `Project not found or access denied. Please verify the project ID.`
        )
      }

      // If sourceFindingId is provided, verify it exists (AC #4)
      if (sourceFindingId) {
        const { data: finding, error: findingError } = await supabase
          .from('findings')
          .select('id, text')
          .eq('id', sourceFindingId)
          .single()

        if (findingError || !finding) {
          return formatToolResponse(
            false,
            `Source finding not found. The finding ID "${sourceFindingId}" does not exist.`
          )
        }
      }

      // Create the Q&A item using the QA service
      const createInput: CreateQAItemInput = {
        question,
        category,
        priority,
        sourceFindingId,
      }

      const qaItem = await createQAItem(supabase, dealId, createInput)

      // Return success response (AC #5)
      return formatToolResponse(true, {
        message: `Q&A item added successfully to "${project.name}".`,
        itemId: qaItem.id,
        question: qaItem.question,
        category: qaItem.category,
        priority: qaItem.priority,
        linkedFinding: sourceFindingId ? true : false,
      })
    } catch (err) {
      return handleToolError(err, 'add_qa_item')
    }
  },
  {
    name: 'add_qa_item',
    description: `Add a question to the Q&A list for the client to answer.
Use this when you identify information gaps, inconsistencies, or items that need clarification from the target company.

The question will appear in the Q&A Management UI where the analyst can track it.
This is NOT for storing AI-generated answers - it creates questions for humans to answer.

Categories: Financials, Legal, Operations, Market, Technology, HR
Priorities: high, medium, low

Example use cases:
- "The financial statements show revenue of $5M but the CIM says $4.8M - adding a question to clarify"
- "No employee headcount data found - adding a question to request this from the client"
- "Contract terms are unclear - adding a high-priority legal question"`,
    schema: AddQAItemInputSchema,
  }
)

/**
 * Export all Q&A tools as an array for easy registration
 */
export const qaTools = [addQAItemTool]