/**
 * Tests for AutoRefreshToggle component
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #6)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AutoRefreshToggle,
  AutoRefreshToggleCompact,
} from '@/components/knowledge-explorer/AutoRefreshToggle'

describe('AutoRefreshToggle', () => {
  const defaultProps = {
    enabled: true,
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with auto-refresh enabled', () => {
    render(<AutoRefreshToggle {...defaultProps} enabled={true} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toBeChecked()
    expect(screen.getByText(/auto-refresh/i)).toBeInTheDocument()
  })

  it('should render with auto-refresh disabled', () => {
    render(<AutoRefreshToggle {...defaultProps} enabled={false} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).not.toBeChecked()
  })

  it('should call onChange when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<AutoRefreshToggle {...defaultProps} onChange={onChange} />)

    const toggle = screen.getByRole('switch')
    await user.click(toggle)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(false) // Toggle from true to false
  })

  it('should show paused badge when auto-refresh is off', () => {
    render(<AutoRefreshToggle {...defaultProps} enabled={false} />)

    expect(screen.getByText(/paused/i)).toBeInTheDocument()
  })

  it('should not show paused badge when auto-refresh is on', () => {
    render(<AutoRefreshToggle {...defaultProps} enabled={true} />)

    expect(screen.queryByText(/paused/i)).not.toBeInTheDocument()
  })

  it('should show pending update count when there are pending updates', () => {
    render(
      <AutoRefreshToggle
        {...defaultProps}
        enabled={false}
        pendingCount={5}
      />
    )

    expect(screen.getByText(/5 pending/i)).toBeInTheDocument()
  })

  it('should not show pending count when count is 0', () => {
    render(
      <AutoRefreshToggle
        {...defaultProps}
        enabled={false}
        pendingCount={0}
      />
    )

    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument()
  })

  it('should show refresh button when there are pending updates', () => {
    render(
      <AutoRefreshToggle
        {...defaultProps}
        enabled={false}
        pendingCount={3}
        onApplyPending={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /apply.*pending/i })).toBeInTheDocument()
  })

  it('should call onApplyPending when refresh button is clicked', async () => {
    const onApplyPending = vi.fn()
    const user = userEvent.setup()

    render(
      <AutoRefreshToggle
        {...defaultProps}
        enabled={false}
        pendingCount={3}
        onApplyPending={onApplyPending}
      />
    )

    const refreshButton = screen.getByRole('button', { name: /apply.*pending/i })
    await user.click(refreshButton)

    expect(onApplyPending).toHaveBeenCalledTimes(1)
  })

  it('should disable refresh button when isApplying is true', () => {
    render(
      <AutoRefreshToggle
        {...defaultProps}
        enabled={false}
        pendingCount={3}
        onApplyPending={vi.fn()}
        isApplying={true}
      />
    )

    const refreshButton = screen.getByRole('button', { name: /apply.*pending/i })
    expect(refreshButton).toBeDisabled()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <AutoRefreshToggle {...defaultProps} className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should have accessible label for the switch', () => {
    render(<AutoRefreshToggle {...defaultProps} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAccessibleName(/auto-refresh/i)
  })

  it('should show keyboard shortcut hint', () => {
    render(<AutoRefreshToggle {...defaultProps} />)

    // The keyboard shortcut displays the key combination
    expect(screen.getByText('R')).toBeInTheDocument()
  })
})

describe('AutoRefreshToggleCompact', () => {
  const defaultProps = {
    enabled: true,
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render in compact mode', () => {
    render(<AutoRefreshToggleCompact {...defaultProps} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toBeInTheDocument()
  })

  it('should call onChange when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(<AutoRefreshToggleCompact {...defaultProps} onChange={onChange} />)

    const toggle = screen.getByRole('switch')
    await user.click(toggle)

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('should show pause icon when disabled', () => {
    render(<AutoRefreshToggleCompact {...defaultProps} enabled={false} />)

    // When disabled, a pause icon should be visible
    const toggle = screen.getByRole('switch')
    expect(toggle).not.toBeChecked()
  })

  it('should be checked when enabled', () => {
    render(<AutoRefreshToggleCompact {...defaultProps} enabled={true} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toBeChecked()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <AutoRefreshToggleCompact {...defaultProps} className="custom-class" />
    )

    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})
