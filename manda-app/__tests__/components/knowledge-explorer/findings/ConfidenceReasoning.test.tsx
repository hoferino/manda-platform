/**
 * ConfidenceReasoning Component Tests
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 3)
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ConfidenceReasoning } from '@/components/knowledge-explorer/findings/ConfidenceReasoning'

describe('ConfidenceReasoning', () => {
  describe('Confidence Score Display', () => {
    it('displays high confidence correctly (>= 80%)', () => {
      render(<ConfidenceReasoning confidence={0.85} reasoning="Test reasoning" />)

      // The component renders "85% (High)" together
      expect(screen.getByText('85% (High)')).toBeInTheDocument()
    })

    it('displays medium confidence correctly (60-79%)', () => {
      render(<ConfidenceReasoning confidence={0.65} reasoning="Test reasoning" />)

      expect(screen.getByText('65% (Medium)')).toBeInTheDocument()
    })

    it('displays low confidence correctly (< 60%)', () => {
      render(<ConfidenceReasoning confidence={0.45} reasoning="Test reasoning" />)

      expect(screen.getByText('45% (Low)')).toBeInTheDocument()
    })

    it('displays N/A for null confidence', () => {
      render(<ConfidenceReasoning confidence={null} reasoning="Test reasoning" />)

      expect(screen.getByText('N/A (Unknown)')).toBeInTheDocument()
    })

    it('renders the progress bar with correct width', () => {
      render(<ConfidenceReasoning confidence={0.75} reasoning={null} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '75')
      expect(progressBar).toHaveAttribute('aria-valuemin', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    })
  })

  describe('Reasoning Display', () => {
    it('displays reasoning text when provided', () => {
      const reasoning = 'This is the confidence reasoning explanation.'
      render(<ConfidenceReasoning confidence={0.8} reasoning={reasoning} />)

      expect(screen.getByText(reasoning)).toBeInTheDocument()
    })

    it('displays "No reasoning available" when reasoning is null', () => {
      render(<ConfidenceReasoning confidence={0.8} reasoning={null} />)

      expect(screen.getByText('No reasoning available')).toBeInTheDocument()
    })

    it('displays "No reasoning available" when reasoning is empty string', () => {
      render(<ConfidenceReasoning confidence={0.8} reasoning="" />)

      expect(screen.getByText('No reasoning available')).toBeInTheDocument()
    })

    it('truncates long reasoning text (> 200 chars)', () => {
      const longReasoning = 'A'.repeat(250)
      render(<ConfidenceReasoning confidence={0.8} reasoning={longReasoning} />)

      // Should show truncated text with "..." and "Show more" button
      expect(screen.getByText(/A{200}\.\.\./)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })

    it('expands truncated reasoning when "Show more" is clicked', () => {
      const longReasoning = 'A'.repeat(250)
      render(<ConfidenceReasoning confidence={0.8} reasoning={longReasoning} />)

      // Click Show more
      fireEvent.click(screen.getByRole('button', { name: /show more/i }))

      // Should now show full text and "Show less" button
      expect(screen.getByText(longReasoning)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument()
    })

    it('collapses expanded reasoning when "Show less" is clicked', () => {
      const longReasoning = 'A'.repeat(250)
      render(<ConfidenceReasoning confidence={0.8} reasoning={longReasoning} />)

      // Expand
      fireEvent.click(screen.getByRole('button', { name: /show more/i }))
      // Collapse
      fireEvent.click(screen.getByRole('button', { name: /show less/i }))

      // Should be truncated again
      expect(screen.getByText(/A{200}\.\.\./)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument()
    })

    it('does not show expand button for short reasoning', () => {
      const shortReasoning = 'Short reasoning text'
      render(<ConfidenceReasoning confidence={0.8} reasoning={shortReasoning} />)

      expect(screen.getByText(shortReasoning)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has accessible progress bar', () => {
      render(<ConfidenceReasoning confidence={0.75} reasoning={null} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-label', 'Confidence: 75%')
    })

    it('has section heading for reasoning', () => {
      render(<ConfidenceReasoning confidence={0.75} reasoning="Test" />)

      expect(screen.getByText('Confidence Reasoning')).toBeInTheDocument()
    })
  })
})
