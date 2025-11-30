/**
 * ValidationHistory Component Tests
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 6)
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ValidationHistory } from '@/components/knowledge-explorer/findings/ValidationHistory'
import type { ValidationEvent } from '@/lib/types/findings'

const mockValidatedEvent: ValidationEvent = {
  action: 'validated',
  previousValue: 'pending',
  newValue: 'validated',
  timestamp: '2024-01-15T10:00:00Z',
  userId: 'user-123-abc-456',
}

const mockRejectedEvent: ValidationEvent = {
  action: 'rejected',
  previousValue: 'pending',
  newValue: 'rejected',
  timestamp: '2024-01-14T09:00:00Z',
  userId: 'user-789-def-012',
}

const mockEditEvent: ValidationEvent = {
  action: 'edited',
  previousValue: 'Old finding text that was changed',
  newValue: 'New finding text after editing',
  timestamp: '2024-01-13T08:00:00Z',
  userId: 'user-456-ghi-789',
}

describe('ValidationHistory', () => {
  describe('Empty State', () => {
    it('displays empty state when history is empty', () => {
      render(<ValidationHistory history={[]} />)

      expect(screen.getByText('No validation history')).toBeInTheDocument()
      expect(
        screen.getByText(/Actions like validating, rejecting, or editing will appear here/)
      ).toBeInTheDocument()
    })
  })

  describe('Timeline Display', () => {
    it('displays validation events in timeline', () => {
      render(<ValidationHistory history={[mockValidatedEvent]} />)

      expect(screen.getByText('Validated')).toBeInTheDocument()
      expect(screen.getByText('History')).toBeInTheDocument()
      expect(screen.getByText('(1 event)')).toBeInTheDocument()
    })

    it('displays rejection events correctly', () => {
      render(<ValidationHistory history={[mockRejectedEvent]} />)

      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })

    it('displays edit events with diff view', () => {
      render(<ValidationHistory history={[mockEditEvent]} />)

      expect(screen.getByText('Edited')).toBeInTheDocument()
      expect(screen.getByText('Previous:')).toBeInTheDocument()
      expect(screen.getByText('New:')).toBeInTheDocument()
      expect(screen.getByText(/Old finding text/)).toBeInTheDocument()
      expect(screen.getByText(/New finding text/)).toBeInTheDocument()
    })

    it('sorts events by timestamp (newest first)', () => {
      render(
        <ValidationHistory
          history={[mockEditEvent, mockValidatedEvent, mockRejectedEvent]}
        />
      )

      // Get all timeline items
      const timelineItems = screen.getAllByRole('listitem')
      expect(timelineItems).toHaveLength(3)

      // Check order - validated (Jan 15) should be first, edited (Jan 13) should be last
      const actionLabels = timelineItems.map(item => item.textContent)
      expect(actionLabels[0]).toContain('Validated')
      expect(actionLabels[1]).toContain('Rejected')
      expect(actionLabels[2]).toContain('Edited')
    })

    it('displays event count in header', () => {
      render(
        <ValidationHistory
          history={[mockValidatedEvent, mockRejectedEvent, mockEditEvent]}
        />
      )

      expect(screen.getByText('(3 events)')).toBeInTheDocument()
    })

    it('displays singular "event" for single item', () => {
      render(<ValidationHistory history={[mockValidatedEvent]} />)

      expect(screen.getByText('(1 event)')).toBeInTheDocument()
    })
  })

  describe('User Information', () => {
    it('displays truncated user ID', () => {
      render(<ValidationHistory history={[mockValidatedEvent]} />)

      // Should show first 8 chars of user ID
      expect(screen.getByText(/by user-123/)).toBeInTheDocument()
    })
  })

  describe('Status Change Indicator', () => {
    it('shows status change for validate/reject events', () => {
      render(<ValidationHistory history={[mockValidatedEvent]} />)

      expect(screen.getByText(/Status changed from/)).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
      expect(screen.getByText('validated')).toBeInTheDocument()
    })
  })

  describe('Diff View', () => {
    it('truncates long previous/new values in diff', () => {
      const longEditEvent: ValidationEvent = {
        action: 'edited',
        previousValue: 'A'.repeat(250),
        newValue: 'B'.repeat(250),
        timestamp: '2024-01-13T08:00:00Z',
        userId: 'user-456',
      }

      render(<ValidationHistory history={[longEditEvent]} />)

      // Should be truncated to 200 chars with ellipsis
      expect(screen.getByText(/A{200}\.\.\./)).toBeInTheDocument()
      expect(screen.getByText(/B{200}\.\.\./)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper list role and label', () => {
      render(<ValidationHistory history={[mockValidatedEvent]} />)

      const list = screen.getByRole('list', { name: /validation history timeline/i })
      expect(list).toBeInTheDocument()
    })
  })
})
