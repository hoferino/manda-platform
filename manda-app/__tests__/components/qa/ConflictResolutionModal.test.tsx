/**
 * ConflictResolutionModal Component Tests
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 5, 6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConflictResolutionModal } from '@/components/qa/ConflictResolutionModal'
import { QAItem } from '@/lib/types/qa'

const mockTheirVersion: QAItem = {
  id: 'qa-1',
  dealId: 'deal-1',
  question: 'Their question version',
  answer: 'Their answer version',
  comment: 'Their comment version',
  category: 'Financials',
  priority: 'high',
  sourceFindingId: null,
  createdBy: 'user-1',
  dateAdded: '2025-01-01T00:00:00Z',
  dateAnswered: null,
  updatedAt: '2025-01-02T12:00:00Z',
}

const mockYourVersion = {
  question: 'Your question version',
  answer: 'Your answer version',
  comment: 'Your comment version',
}

describe('ConflictResolutionModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    yourVersion: mockYourVersion,
    theirVersion: mockTheirVersion,
    onKeepMine: vi.fn(),
    onKeepTheirs: vi.fn(),
    onMerge: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render modal with conflict title', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(screen.getByText('Concurrent Edit Conflict')).toBeInTheDocument()
    })

    it('should render conflict description', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(
        screen.getByText(/someone else has modified this item/i)
      ).toBeInTheDocument()
    })

    it('should render Compare and Merge tabs', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(screen.getByRole('tab', { name: /compare versions/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /merge manually/i })).toBeInTheDocument()
    })

    it('should show last updated timestamp', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(
        screen.getByText(/last updated by another user/i)
      ).toBeInTheDocument()
    })
  })

  describe('compare view (AC5)', () => {
    it('should show Your Version and Their Version badges for conflicts', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      // Multiple badges exist (one per conflicting field)
      expect(screen.getAllByText('Your Version').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Their Version').length).toBeGreaterThan(0)
    })

    it('should display conflicting question values side by side', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(screen.getByText('Your question version')).toBeInTheDocument()
      expect(screen.getByText('Their question version')).toBeInTheDocument()
    })

    it('should show field labels for conflicts', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(screen.getByText('Question')).toBeInTheDocument()
      expect(screen.getByText('Answer')).toBeInTheDocument()
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })
  })

  describe('keep mine button (AC5)', () => {
    it('should call onKeepMine when "Keep My Version" is clicked', async () => {
      const user = userEvent.setup()
      const onKeepMine = vi.fn()
      render(<ConflictResolutionModal {...defaultProps} onKeepMine={onKeepMine} />)

      await user.click(screen.getByText('Keep My Version'))

      expect(onKeepMine).toHaveBeenCalled()
    })
  })

  describe('keep theirs button (AC5)', () => {
    it('should call onKeepTheirs when "Keep Their Version" is clicked', async () => {
      const user = userEvent.setup()
      const onKeepTheirs = vi.fn()
      render(<ConflictResolutionModal {...defaultProps} onKeepTheirs={onKeepTheirs} />)

      await user.click(screen.getByText('Keep Their Version'))

      expect(onKeepTheirs).toHaveBeenCalled()
    })
  })

  describe('merge view (AC6)', () => {
    it('should switch to merge tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ConflictResolutionModal {...defaultProps} />)

      await user.click(screen.getByRole('tab', { name: /merge manually/i }))

      expect(
        screen.getByText(/edit the fields below to create a merged version/i)
      ).toBeInTheDocument()
    })

    it('should show editable textareas in merge tab', async () => {
      const user = userEvent.setup()
      render(<ConflictResolutionModal {...defaultProps} />)

      await user.click(screen.getByRole('tab', { name: /merge manually/i }))

      // Should have textareas for each conflicting field
      const textareas = screen.getAllByRole('textbox')
      expect(textareas.length).toBeGreaterThanOrEqual(1)
    })

    it('should show "Use Mine" and "Use Theirs" buttons for each field', async () => {
      const user = userEvent.setup()
      render(<ConflictResolutionModal {...defaultProps} />)

      await user.click(screen.getByRole('tab', { name: /merge manually/i }))

      const useMineButtons = screen.getAllByText('Use Mine')
      const useTheirsButtons = screen.getAllByText('Use Theirs')

      expect(useMineButtons.length).toBeGreaterThan(0)
      expect(useTheirsButtons.length).toBeGreaterThan(0)
    })

    it('should populate textarea with your version when "Use Mine" is clicked', async () => {
      const user = userEvent.setup()
      render(<ConflictResolutionModal {...defaultProps} />)

      await user.click(screen.getByRole('tab', { name: /merge manually/i }))

      const useMineButton = screen.getAllByText('Use Mine')[0]
      await user.click(useMineButton)

      // Check textarea value - first textarea should have your version
      const questionTextarea = screen.getByLabelText(/question/i)
      expect(questionTextarea).toHaveValue('Your question version')
    })

    it('should populate textarea with their version when "Use Theirs" is clicked', async () => {
      const user = userEvent.setup()
      render(<ConflictResolutionModal {...defaultProps} />)

      await user.click(screen.getByRole('tab', { name: /merge manually/i }))

      const useTheirsButton = screen.getAllByText('Use Theirs')[0]
      await user.click(useTheirsButton)

      const questionTextarea = screen.getByLabelText(/question/i)
      expect(questionTextarea).toHaveValue('Their question version')
    })

    it('should call onMerge with merged values when "Save Merged Version" is clicked', async () => {
      const user = userEvent.setup()
      const onMerge = vi.fn()
      render(<ConflictResolutionModal {...defaultProps} onMerge={onMerge} />)

      await user.click(screen.getByRole('tab', { name: /merge manually/i }))
      await user.click(screen.getByText('Save Merged Version'))

      expect(onMerge).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.any(String),
        })
      )
    })
  })

  describe('cancel button', () => {
    it('should call onOpenChange(false) when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const onOpenChange = vi.fn()
      render(<ConflictResolutionModal {...defaultProps} onOpenChange={onOpenChange} />)

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('partial conflicts', () => {
    it('should only show question field when only question conflicts', () => {
      render(
        <ConflictResolutionModal
          {...defaultProps}
          yourVersion={{ question: 'Your question' }}
        />
      )

      expect(screen.getByText('Question')).toBeInTheDocument()
      // Answer and Notes should not show conflict sections
      expect(screen.queryByText('Answer')).not.toBeInTheDocument()
      expect(screen.queryByText('Notes')).not.toBeInTheDocument()
    })

    it('should only show answer field when only answer conflicts', () => {
      render(
        <ConflictResolutionModal
          {...defaultProps}
          yourVersion={{ answer: 'Your answer' }}
        />
      )

      expect(screen.getByText('Answer')).toBeInTheDocument()
      expect(screen.queryByText('Question')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have proper dialog role', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have descriptive title', () => {
      render(<ConflictResolutionModal {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAccessibleName(/concurrent edit conflict/i)
    })
  })

  describe('closed state', () => {
    it('should not render when open is false', () => {
      render(<ConflictResolutionModal {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
