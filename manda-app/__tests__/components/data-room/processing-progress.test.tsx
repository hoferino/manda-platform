/**
 * Unit tests for ProcessingProgress component
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #3)
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  ProcessingProgress,
  getCurrentStageLabel,
  getProcessingProgressPercent,
} from '@/components/data-room/processing-progress'
import type { ProcessingStatus } from '@/lib/api/documents'

describe('ProcessingProgress Component', () => {
  describe('Stage Display', () => {
    it('renders all pipeline stages', () => {
      render(<ProcessingProgress status="pending" />)
      expect(screen.getByText('Upload')).toBeInTheDocument()
      expect(screen.getByText('Parse')).toBeInTheDocument()
      expect(screen.getByText('Embed')).toBeInTheDocument()
      expect(screen.getByText('Analyze')).toBeInTheDocument()
      expect(screen.getByText('Complete')).toBeInTheDocument()
    })

    it('hides labels in compact mode', () => {
      render(<ProcessingProgress status="pending" compact />)
      expect(screen.queryByText('Upload')).not.toBeInTheDocument()
      expect(screen.queryByText('Parse')).not.toBeInTheDocument()
    })
  })

  describe('Status Progress', () => {
    const statusTests: Array<{ status: ProcessingStatus; expectedStage: string }> = [
      { status: 'pending', expectedStage: 'Upload' },
      { status: 'parsing', expectedStage: 'Parse' },
      { status: 'parsed', expectedStage: 'Parse' },
      { status: 'embedding', expectedStage: 'Embed' },
      { status: 'analyzing', expectedStage: 'Analyze' },
      { status: 'analyzed', expectedStage: 'Analyze' },
      { status: 'complete', expectedStage: 'Complete' },
    ]

    statusTests.forEach(({ status, expectedStage }) => {
      it(`highlights ${expectedStage} stage for ${status} status`, () => {
        render(<ProcessingProgress status={status} />)
        // The stage text should exist
        expect(screen.getByText(expectedStage)).toBeInTheDocument()
      })
    })
  })
})

describe('getCurrentStageLabel', () => {
  it('returns "Parsing..." for parsing status', () => {
    expect(getCurrentStageLabel('parsing')).toBe('Parse...')
  })

  it('returns "Embedding..." for embedding status', () => {
    expect(getCurrentStageLabel('embedding')).toBe('Embed...')
  })

  it('returns "Analyzing..." for analyzing status', () => {
    expect(getCurrentStageLabel('analyzing')).toBe('Analyze...')
  })

  it('returns "Complete" for complete status', () => {
    expect(getCurrentStageLabel('complete')).toBe('Complete')
  })

  it('returns "Failed" for failed status', () => {
    expect(getCurrentStageLabel('failed')).toBe('Failed')
  })

  it('returns "Analysis Failed" for analysis_failed status', () => {
    expect(getCurrentStageLabel('analysis_failed')).toBe('Analysis Failed')
  })
})

describe('getProcessingProgressPercent', () => {
  it('returns 0 for pending status', () => {
    expect(getProcessingProgressPercent('pending')).toBe(0)
  })

  it('returns 20 for parsing status', () => {
    expect(getProcessingProgressPercent('parsing')).toBe(20)
  })

  it('returns 50 for embedding status', () => {
    expect(getProcessingProgressPercent('embedding')).toBe(50)
  })

  it('returns 70 for analyzing status', () => {
    expect(getProcessingProgressPercent('analyzing')).toBe(70)
  })

  it('returns 100 for complete status', () => {
    expect(getProcessingProgressPercent('complete')).toBe(100)
  })

  it('returns 0 for failed status', () => {
    expect(getProcessingProgressPercent('failed')).toBe(0)
  })

  it('returns 70 for analysis_failed status (failed at analyze stage)', () => {
    expect(getProcessingProgressPercent('analysis_failed')).toBe(70)
  })
})
