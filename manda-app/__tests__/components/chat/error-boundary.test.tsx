import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatErrorBoundary } from '@/components/chat/error-boundary'
import { RateLimitError, UserFacingError } from '@/lib/errors/types'

// Suppress React error boundary console.error in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Component that throws an error when rendered
function ThrowingComponent({ error }: { error: Error }): React.ReactNode {
  throw error
}

describe('ChatErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ChatErrorBoundary>
        <div data-testid="child">Child content</div>
      </ChatErrorBoundary>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    render(
      <ChatErrorBoundary>
        <ThrowingComponent error={new Error('Test error')} />
      </ChatErrorBoundary>
    )
    expect(screen.getByText('Oops, something went wrong')).toBeInTheDocument()
  })

  it('displays user-friendly message from UserFacingError', () => {
    const userError = new RateLimitError('test', 1000)
    render(
      <ChatErrorBoundary>
        <ThrowingComponent error={userError} />
      </ChatErrorBoundary>
    )
    expect(screen.getByText(/too many requests/i)).toBeInTheDocument()
  })

  it('shows retry button for retryable errors', () => {
    const userError = new RateLimitError('test', 1000) // isRetryable: true
    render(
      <ChatErrorBoundary>
        <ThrowingComponent error={userError} />
      </ChatErrorBoundary>
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('hides retry button for non-retryable errors', () => {
    const userError = new UserFacingError('Not retryable', { isRetryable: false })
    render(
      <ChatErrorBoundary>
        <ThrowingComponent error={userError} />
      </ChatErrorBoundary>
    )
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('calls onRetry and resets state when retry button clicked', () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <ChatErrorBoundary onRetry={onRetry}>
        <ThrowingComponent error={new RateLimitError('test', 1000)} />
      </ChatErrorBoundary>
    )

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders custom fallback when provided', () => {
    render(
      <ChatErrorBoundary fallback={<div data-testid="custom-fallback">Custom</div>}>
        <ThrowingComponent error={new Error('Test')} />
      </ChatErrorBoundary>
    )
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByText('Oops, something went wrong')).not.toBeInTheDocument()
  })
})
