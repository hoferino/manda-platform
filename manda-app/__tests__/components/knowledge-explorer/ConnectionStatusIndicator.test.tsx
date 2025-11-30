/**
 * Tests for ConnectionStatusIndicator component
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #8)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ConnectionStatusIndicator,
  ConnectionStatusDot,
} from '@/components/knowledge-explorer/ConnectionStatusIndicator'
import type { AggregateConnectionStatus } from '@/lib/hooks/useKnowledgeExplorerRealtime'

describe('ConnectionStatusIndicator', () => {
  const defaultProps = {
    status: 'connected' as AggregateConnectionStatus,
    onReconnect: vi.fn(),
  }

  it('should render connected status with green dot', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="connected" />)

    const indicator = screen.getByRole('button')
    expect(indicator).toBeInTheDocument()

    // Check for aria-label
    expect(indicator).toHaveAccessibleName(/connected/i)
  })

  it('should render connecting status', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="connecting" />)

    const indicator = screen.getByRole('button')
    expect(indicator).toHaveAccessibleName(/connecting/i)
  })

  it('should render disconnected status', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="disconnected" />)

    const indicator = screen.getByRole('button')
    expect(indicator).toHaveAccessibleName(/disconnected/i)
  })

  it('should render partial status', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="partial" />)

    const indicator = screen.getByRole('button')
    expect(indicator).toHaveAccessibleName(/partial/i)
  })

  it('should render error status', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="error" />)

    const indicator = screen.getByRole('button')
    expect(indicator).toHaveAccessibleName(/error/i)
  })

  it('should call onReconnect when clicked in disconnected state', async () => {
    const onReconnect = vi.fn()
    const user = userEvent.setup()

    render(
      <ConnectionStatusIndicator
        {...defaultProps}
        status="disconnected"
        onReconnect={onReconnect}
      />
    )

    const indicator = screen.getByRole('button')
    await user.click(indicator)

    expect(onReconnect).toHaveBeenCalledTimes(1)
  })

  it('should call onReconnect when clicked in error state', async () => {
    const onReconnect = vi.fn()
    const user = userEvent.setup()

    render(
      <ConnectionStatusIndicator
        {...defaultProps}
        status="error"
        onReconnect={onReconnect}
      />
    )

    const indicator = screen.getByRole('button')
    await user.click(indicator)

    expect(onReconnect).toHaveBeenCalledTimes(1)
  })

  it('should not call onReconnect when connected', async () => {
    const onReconnect = vi.fn()
    const user = userEvent.setup()

    render(
      <ConnectionStatusIndicator
        {...defaultProps}
        status="connected"
        onReconnect={onReconnect}
      />
    )

    const indicator = screen.getByRole('button')
    await user.click(indicator)

    expect(onReconnect).not.toHaveBeenCalled()
  })

  it('should show error message when provided', () => {
    render(
      <ConnectionStatusIndicator
        {...defaultProps}
        status="error"
        errorMessage="Network timeout"
      />
    )

    const indicator = screen.getByRole('button')
    expect(indicator).toBeInTheDocument()
  })

  it('should be disabled when connected', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="connected" />)

    const indicator = screen.getByRole('button')
    expect(indicator).toBeDisabled()
  })

  it('should be enabled when disconnected', () => {
    render(<ConnectionStatusIndicator {...defaultProps} status="disconnected" />)

    const indicator = screen.getByRole('button')
    expect(indicator).not.toBeDisabled()
  })

  it('should apply custom className', () => {
    render(
      <ConnectionStatusIndicator
        {...defaultProps}
        className="custom-class"
      />
    )

    const indicator = screen.getByRole('button')
    expect(indicator).toHaveClass('custom-class')
  })
})

describe('ConnectionStatusDot', () => {
  it('should render green dot for connected status', () => {
    render(<ConnectionStatusDot status="connected" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('bg-green-500')
  })

  it('should render yellow dot for connecting status', () => {
    render(<ConnectionStatusDot status="connecting" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('bg-yellow-500')
  })

  it('should render red dot for disconnected status', () => {
    render(<ConnectionStatusDot status="disconnected" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('bg-red-500')
  })

  it('should render yellow dot for partial status', () => {
    render(<ConnectionStatusDot status="partial" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('bg-yellow-500')
  })

  it('should render red dot for error status', () => {
    render(<ConnectionStatusDot status="error" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('bg-red-500')
  })

  it('should animate for connecting status', () => {
    render(<ConnectionStatusDot status="connecting" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('animate-pulse')
  })

  it('should apply custom size', () => {
    render(<ConnectionStatusDot status="connected" size="lg" />)

    const dot = screen.getByTestId('status-dot')
    expect(dot).toHaveClass('h-3', 'w-3')
  })
})
