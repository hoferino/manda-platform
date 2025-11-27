/**
 * Unit tests for ProcessingStatusBadge component
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #1)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ProcessingStatusBadge,
  isProcessingInProgress,
  isProcessingComplete,
  isProcessingFailed,
  getStatusDescription,
} from '@/components/data-room/processing-status-badge'
import type { ProcessingStatus } from '@/lib/api/documents'

describe('ProcessingStatusBadge Component', () => {
  describe('Status Display', () => {
    it('renders pending status with correct label', () => {
      render(<ProcessingStatusBadge status="pending" />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders parsing status with correct label', () => {
      render(<ProcessingStatusBadge status="parsing" />)
      expect(screen.getByText('Parsing')).toBeInTheDocument()
    })

    it('renders parsed status with correct label', () => {
      render(<ProcessingStatusBadge status="parsed" />)
      expect(screen.getByText('Parsed')).toBeInTheDocument()
    })

    it('renders embedding status with correct label', () => {
      render(<ProcessingStatusBadge status="embedding" />)
      expect(screen.getByText('Embedding')).toBeInTheDocument()
    })

    it('renders analyzing status with correct label', () => {
      render(<ProcessingStatusBadge status="analyzing" />)
      expect(screen.getByText('Analyzing')).toBeInTheDocument()
    })

    it('renders analyzed status with correct label', () => {
      render(<ProcessingStatusBadge status="analyzed" />)
      expect(screen.getByText('Analyzed')).toBeInTheDocument()
    })

    it('renders complete status with correct label', () => {
      render(<ProcessingStatusBadge status="complete" />)
      expect(screen.getByText('Complete')).toBeInTheDocument()
    })

    it('renders failed status with correct label', () => {
      render(<ProcessingStatusBadge status="failed" />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('renders analysis_failed status with correct label', () => {
      render(<ProcessingStatusBadge status="analysis_failed" />)
      expect(screen.getByText('Analysis Failed')).toBeInTheDocument()
    })
  })

  describe('Size Variants', () => {
    it('renders small size by default', () => {
      const { container } = render(<ProcessingStatusBadge status="pending" />)
      // Check for small size classes
      expect(container.firstChild).toHaveClass('text-xs')
    })

    it('renders medium size when specified', () => {
      const { container } = render(<ProcessingStatusBadge status="pending" size="md" />)
      // Check for medium size classes
      expect(container.firstChild).toHaveClass('text-sm')
    })
  })

  describe('Label Visibility', () => {
    it('shows label by default', () => {
      render(<ProcessingStatusBadge status="pending" />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('hides label when showLabel is false', () => {
      render(<ProcessingStatusBadge status="pending" showLabel={false} />)
      expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    })
  })
})

describe('Status Helper Functions', () => {
  describe('isProcessingInProgress', () => {
    it('returns true for parsing status', () => {
      expect(isProcessingInProgress('parsing')).toBe(true)
    })

    it('returns true for embedding status', () => {
      expect(isProcessingInProgress('embedding')).toBe(true)
    })

    it('returns true for analyzing status', () => {
      expect(isProcessingInProgress('analyzing')).toBe(true)
    })

    it('returns false for pending status', () => {
      expect(isProcessingInProgress('pending')).toBe(false)
    })

    it('returns false for complete status', () => {
      expect(isProcessingInProgress('complete')).toBe(false)
    })

    it('returns false for failed status', () => {
      expect(isProcessingInProgress('failed')).toBe(false)
    })
  })

  describe('isProcessingComplete', () => {
    it('returns true for complete status', () => {
      expect(isProcessingComplete('complete')).toBe(true)
    })

    it('returns false for pending status', () => {
      expect(isProcessingComplete('pending')).toBe(false)
    })

    it('returns false for analyzing status', () => {
      expect(isProcessingComplete('analyzing')).toBe(false)
    })
  })

  describe('isProcessingFailed', () => {
    it('returns true for failed status', () => {
      expect(isProcessingFailed('failed')).toBe(true)
    })

    it('returns true for analysis_failed status', () => {
      expect(isProcessingFailed('analysis_failed')).toBe(true)
    })

    it('returns false for complete status', () => {
      expect(isProcessingFailed('complete')).toBe(false)
    })

    it('returns false for pending status', () => {
      expect(isProcessingFailed('pending')).toBe(false)
    })
  })

  describe('getStatusDescription', () => {
    const statuses: ProcessingStatus[] = [
      'pending',
      'parsing',
      'parsed',
      'embedding',
      'analyzing',
      'analyzed',
      'complete',
      'failed',
      'analysis_failed',
    ]

    statuses.forEach((status) => {
      it(`returns description for ${status} status`, () => {
        const description = getStatusDescription(status)
        expect(typeof description).toBe('string')
        expect(description.length).toBeGreaterThan(0)
      })
    })
  })
})
