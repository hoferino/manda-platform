import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ErrorToast } from '@/components/ui/error-toast'

describe('ErrorToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders with message', () => {
    render(<ErrorToast message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('has alert role for accessibility', () => {
    render(<ErrorToast message="Error" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows retry button when isRetryable and onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorToast message="Error" isRetryable onRetry={onRetry} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('hides retry button when not retryable', () => {
    render(<ErrorToast message="Error" isRetryable={false} />)
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('calls onRetry and dismisses when retry clicked', () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()
    render(<ErrorToast message="Error" isRetryable onRetry={onRetry} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses when X button clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorToast message="Error" onDismiss={onDismiss} />)

    // Find the dismiss button (X icon button)
    const dismissButtons = screen.getAllByRole('button')
    const dismissButton = dismissButtons.find((btn) => !btn.textContent?.includes('Retry'))
    fireEvent.click(dismissButton!)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('auto-hides after autoHideMs', async () => {
    const onDismiss = vi.fn()
    render(<ErrorToast message="Error" autoHideMs={5000} onDismiss={onDismiss} />)

    expect(screen.getByText('Error')).toBeInTheDocument()

    // Advance past auto-hide timeout
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not auto-hide when autoHideMs is 0', () => {
    const onDismiss = vi.fn()
    render(<ErrorToast message="Error" autoHideMs={0} onDismiss={onDismiss} />)

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
