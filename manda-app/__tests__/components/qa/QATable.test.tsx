/**
 * QATable Component Tests
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 1, 2, 3, 4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QATable } from '@/components/qa/QATable'
import { QAItem } from '@/lib/types/qa'

const mockItems: QAItem[] = [
  {
    id: 'qa-1',
    dealId: 'deal-1',
    question: 'What is the annual revenue?',
    answer: null,
    comment: 'Need to verify with CFO',
    category: 'Financials',
    priority: 'high',
    sourceFindingId: null,
    createdBy: 'user-1',
    dateAdded: '2025-01-01T00:00:00Z',
    dateAnswered: null,
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'qa-2',
    dealId: 'deal-1',
    question: 'Are there any pending lawsuits?',
    answer: 'No pending lawsuits',
    comment: null,
    category: 'Legal',
    priority: 'medium',
    sourceFindingId: null,
    createdBy: 'user-1',
    dateAdded: '2025-01-01T00:00:00Z',
    dateAnswered: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'qa-3',
    dealId: 'deal-1',
    question: 'What is the profit margin?',
    answer: null,
    comment: null,
    category: 'Financials',
    priority: 'low',
    sourceFindingId: null,
    createdBy: 'user-1',
    dateAdded: '2025-01-01T00:00:00Z',
    dateAnswered: null,
    updatedAt: '2025-01-01T00:00:00Z',
  },
]

describe('QATable', () => {
  const defaultProps = {
    items: mockItems,
    isLoading: false,
    onSave: vi.fn(),
    projectId: 'project-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render loading skeleton when isLoading is true', () => {
      render(<QATable {...defaultProps} isLoading={true} items={[]} />)

      // Should show skeleton elements
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('should render empty state when no items', () => {
      render(<QATable {...defaultProps} items={[]} />)

      expect(screen.getByText('No Q&A items yet')).toBeInTheDocument()
      expect(
        screen.getByText(/questions will appear here/i)
      ).toBeInTheDocument()
    })

    it('should render items grouped by category (AC1)', () => {
      render(<QATable {...defaultProps} />)

      // Should show Financials and Legal categories
      expect(screen.getByText('Financials')).toBeInTheDocument()
      expect(screen.getByText('Legal')).toBeInTheDocument()
    })

    it('should show item count per category', () => {
      render(<QATable {...defaultProps} />)

      // Financials has 2 items, Legal has 1
      expect(screen.getByText('2 items')).toBeInTheDocument()
      expect(screen.getByText('1 item')).toBeInTheDocument()
    })

    it('should show pending count badge for categories with pending items', () => {
      render(<QATable {...defaultProps} />)

      // Financials has 2 pending items
      expect(screen.getByText('2 pending')).toBeInTheDocument()
    })
  })

  describe('category grouping (AC1)', () => {
    it('should show table headers for each column', () => {
      render(<QATable {...defaultProps} />)

      // Multiple tables exist (one per category), so check for all occurrences
      expect(screen.getAllByText('Question').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Answer').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Notes').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Priority').length).toBeGreaterThan(0)
    })

    it('should group multiple items under same category', () => {
      render(<QATable {...defaultProps} />)

      // Both Financials questions should be visible
      expect(screen.getByText('What is the annual revenue?')).toBeInTheDocument()
      expect(screen.getByText('What is the profit margin?')).toBeInTheDocument()
    })

    it('should skip categories with no items', () => {
      // Only Financials items
      const financialsOnly = mockItems.filter(i => i.category === 'Financials')
      render(<QATable {...defaultProps} items={financialsOnly} />)

      expect(screen.getByText('Financials')).toBeInTheDocument()
      expect(screen.queryByText('Legal')).not.toBeInTheDocument()
      expect(screen.queryByText('Operations')).not.toBeInTheDocument()
    })
  })

  describe('collapsible sections (AC2)', () => {
    it('should collapse category when header is clicked', async () => {
      const user = userEvent.setup()
      render(<QATable {...defaultProps} />)

      // Initially visible
      expect(screen.getByText('What is the annual revenue?')).toBeVisible()

      // Click to collapse Financials
      const financialsHeader = screen.getByText('Financials').closest('[class*="cursor-pointer"]')
      await user.click(financialsHeader!)

      // Table content should be hidden (but may still be in DOM)
      await waitFor(() => {
        const question = screen.queryByText('What is the annual revenue?')
        // Either not in document or hidden
        expect(question === null || !question.closest('table')?.closest('[data-state="open"]')).toBeTruthy()
      })
    })

    it('should expand collapsed category when header is clicked again', async () => {
      const user = userEvent.setup()
      render(<QATable {...defaultProps} />)

      const financialsHeader = screen.getByText('Financials').closest('[class*="cursor-pointer"]')

      // Collapse
      await user.click(financialsHeader!)

      // Expand
      await user.click(financialsHeader!)

      await waitFor(() => {
        expect(screen.getByText('What is the annual revenue?')).toBeVisible()
      })
    })

    it('should show chevron down when expanded', () => {
      render(<QATable {...defaultProps} />)

      // When expanded, should show down chevron (not right)
      const financialsHeader = screen.getByText('Financials').closest('[class*="cursor-pointer"]')
      const chevronDown = financialsHeader?.querySelector('[class*="lucide-chevron-down"]')
      expect(chevronDown).toBeInTheDocument()
    })
  })

  describe('answer display (AC2)', () => {
    it('should show "No answer yet" for pending items', () => {
      render(<QATable {...defaultProps} />)

      // First item has no answer
      expect(screen.getAllByText('No answer yet')).toHaveLength(2)
    })

    it('should show answer text with checkmark for answered items', () => {
      render(<QATable {...defaultProps} />)

      expect(screen.getByText('No pending lawsuits')).toBeInTheDocument()
    })

    it('should highlight pending items with amber background', () => {
      render(<QATable {...defaultProps} />)

      // Pending items should have amber background class
      const row = screen.getByText('What is the annual revenue?').closest('tr')
      expect(row).toHaveClass('bg-amber-50/30')
    })
  })

  describe('priority display (AC2)', () => {
    it('should display priority badges', () => {
      render(<QATable {...defaultProps} />)

      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })
  })

  describe('inline editing (AC3)', () => {
    it('should enter edit mode when question cell is clicked', async () => {
      const user = userEvent.setup()
      render(<QATable {...defaultProps} />)

      const questionCell = screen.getByText('What is the annual revenue?')
      await user.click(questionCell)

      // Should show textarea
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
        expect(screen.getByRole('textbox')).toHaveValue('What is the annual revenue?')
      })
    })

    it('should enter edit mode when answer cell is clicked', async () => {
      const user = userEvent.setup()
      render(<QATable {...defaultProps} />)

      const answerCells = screen.getAllByText('No answer yet')
      expect(answerCells.length).toBeGreaterThan(0)
      await user.click(answerCells[0]!)

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })
    })

    it('should enter edit mode when notes cell is clicked', async () => {
      const user = userEvent.setup()
      render(<QATable {...defaultProps} />)

      const notesCell = screen.getByText('Need to verify with CFO')
      await user.click(notesCell)

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
        expect(screen.getByRole('textbox')).toHaveValue('Need to verify with CFO')
      })
    })

    it('should call onSave with updated value (AC4)', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockResolvedValue(undefined)
      render(<QATable {...defaultProps} onSave={onSave} />)

      // Click to edit question
      const questionCell = screen.getByText('What is the annual revenue?')
      await user.click(questionCell)

      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'Updated question text')

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('qa-1', {
          question: 'Updated question text',
        })
      })
    })

    it('should exit edit mode when cancelled', async () => {
      const user = userEvent.setup()
      render(<QATable {...defaultProps} />)

      const questionCell = screen.getByText('What is the annual revenue?')
      await user.click(questionCell)

      // Should be in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Should exit edit mode
      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
        expect(screen.getByText('What is the annual revenue?')).toBeInTheDocument()
      })
    })
  })

  describe('answer with date (AC4)', () => {
    it('should set dateAnswered when answer is saved', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn().mockResolvedValue(undefined)
      render(<QATable {...defaultProps} onSave={onSave} />)

      // Click to edit answer
      const answerCells = screen.getAllByText('No answer yet')
      expect(answerCells.length).toBeGreaterThan(0)
      await user.click(answerCells[0]!)

      const textarea = screen.getByRole('textbox')
      await user.type(textarea, 'New answer provided')

      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          'qa-1',
          expect.objectContaining({
            answer: 'New answer provided',
            dateAnswered: expect.any(String),
          })
        )
      })
    })
  })

  describe('accessibility', () => {
    it('should have accessible table structure', () => {
      render(<QATable {...defaultProps} />)

      expect(screen.getAllByRole('table')).toHaveLength(2) // One per category
      expect(screen.getAllByRole('columnheader')).toHaveLength(8) // 4 per table
    })

    it('should have click hint on editable cells', async () => {
      render(<QATable {...defaultProps} />)

      const questionCell = screen.getByText('What is the annual revenue?')
      expect(questionCell.closest('[title]')).toHaveAttribute('title', 'Click to edit')
    })
  })
})
