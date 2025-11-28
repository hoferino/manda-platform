/**
 * FindingSearch Component Tests
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #1, #5, #6)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FindingSearch, EmptySearchResults } from '@/components/knowledge-explorer/findings/FindingSearch'

describe('FindingSearch', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSearch: vi.fn(),
    onClear: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('renders search input with placeholder', () => {
      render(<FindingSearch {...defaultProps} />)

      const input = screen.getByTestId('finding-search-input')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', "Search findings (e.g., 'revenue growth Q3')")
    })

    it('renders custom placeholder', () => {
      render(<FindingSearch {...defaultProps} placeholder="Custom placeholder" />)

      const input = screen.getByTestId('finding-search-input')
      expect(input).toHaveAttribute('placeholder', 'Custom placeholder')
    })

    it('shows search icon when not searching', () => {
      render(<FindingSearch {...defaultProps} />)

      // Search icon should be visible (via SVG)
      expect(screen.getByLabelText('Search findings')).toBeInTheDocument()
    })

    it('shows loading spinner when searching', () => {
      render(<FindingSearch {...defaultProps} isSearching={true} />)

      // Loading spinner has animate-spin class
      const container = document.querySelector('.animate-spin')
      expect(container).toBeInTheDocument()
    })

    it('does not show clear button when input is empty', () => {
      render(<FindingSearch {...defaultProps} value="" />)

      expect(screen.queryByTestId('finding-search-clear')).not.toBeInTheDocument()
    })

    it('shows clear button when input has value', () => {
      render(<FindingSearch {...defaultProps} value="test query" />)

      expect(screen.getByTestId('finding-search-clear')).toBeInTheDocument()
    })
  })

  describe('Search Results Info', () => {
    it('shows result count when search has results', () => {
      render(
        <FindingSearch
          {...defaultProps}
          value="test"
          resultCount={15}
          searchTime={250}
        />
      )

      expect(screen.getByTestId('search-results-badge')).toBeInTheDocument()
      expect(screen.getByText(/Showing 15 results/)).toBeInTheDocument()
      expect(screen.getByText(/250ms/)).toBeInTheDocument()
    })

    it('uses singular form for single result', () => {
      render(
        <FindingSearch
          {...defaultProps}
          value="test"
          resultCount={1}
        />
      )

      expect(screen.getByText(/Showing 1 result/)).toBeInTheDocument()
    })

    it('does not show result count when not in search mode', () => {
      render(
        <FindingSearch
          {...defaultProps}
          value=""
          resultCount={undefined}
        />
      )

      expect(screen.queryByTestId('search-results-badge')).not.toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('calls onChange when user types', async () => {
      const onChange = vi.fn()
      render(<FindingSearch {...defaultProps} onChange={onChange} />)

      const input = screen.getByTestId('finding-search-input')
      fireEvent.change(input, { target: { value: 'test' } })

      expect(onChange).toHaveBeenCalledWith('test')
    })

    it('debounces search call (300ms)', async () => {
      const onSearch = vi.fn()
      render(<FindingSearch {...defaultProps} onSearch={onSearch} />)

      const input = screen.getByTestId('finding-search-input')
      fireEvent.change(input, { target: { value: 'test' } })

      // Should not call immediately
      expect(onSearch).not.toHaveBeenCalled()

      // Advance timer by 300ms (debounce delay)
      vi.advanceTimersByTime(300)

      expect(onSearch).toHaveBeenCalledWith('test')
    })

    it('cancels pending search on new input', async () => {
      const onSearch = vi.fn()
      render(<FindingSearch {...defaultProps} onSearch={onSearch} />)

      const input = screen.getByTestId('finding-search-input')

      // Type first query
      fireEvent.change(input, { target: { value: 'first' } })

      // Advance partially
      vi.advanceTimersByTime(150)

      // Type second query
      fireEvent.change(input, { target: { value: 'second' } })

      // Advance past first debounce
      vi.advanceTimersByTime(300)

      // Only the second query should be searched
      expect(onSearch).toHaveBeenCalledTimes(1)
      expect(onSearch).toHaveBeenCalledWith('second')
    })

    it('triggers immediate search on Enter key', async () => {
      const onSearch = vi.fn()
      render(<FindingSearch {...defaultProps} onSearch={onSearch} />)

      const input = screen.getByTestId('finding-search-input')
      fireEvent.change(input, { target: { value: 'test query' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(onSearch).toHaveBeenCalledWith('test query')
    })

    it('clears search on Escape key', async () => {
      const onClear = vi.fn()
      const onChange = vi.fn()
      render(
        <FindingSearch
          {...defaultProps}
          value="test"
          onChange={onChange}
          onClear={onClear}
        />
      )

      const input = screen.getByTestId('finding-search-input')
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(onClear).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith('')
    })

    it('clears search when clear button clicked', async () => {
      const onClear = vi.fn()
      const onChange = vi.fn()
      render(
        <FindingSearch
          {...defaultProps}
          value="test"
          onChange={onChange}
          onClear={onClear}
        />
      )

      const clearButton = screen.getByTestId('finding-search-clear')
      fireEvent.click(clearButton)

      expect(onClear).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith('')
    })
  })

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<FindingSearch {...defaultProps} disabled={true} />)

      const input = screen.getByTestId('finding-search-input')
      expect(input).toBeDisabled()
    })

    it('disables input when searching', () => {
      render(<FindingSearch {...defaultProps} isSearching={true} />)

      const input = screen.getByTestId('finding-search-input')
      expect(input).toBeDisabled()
    })

    it('disables clear button when searching', () => {
      render(
        <FindingSearch
          {...defaultProps}
          value="test"
          isSearching={true}
        />
      )

      const clearButton = screen.getByTestId('finding-search-clear')
      expect(clearButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has accessible label', () => {
      render(<FindingSearch {...defaultProps} />)

      const input = screen.getByLabelText('Search findings')
      expect(input).toBeInTheDocument()
    })

    it('clear button has accessible label', () => {
      render(<FindingSearch {...defaultProps} value="test" />)

      const clearButton = screen.getByLabelText('Clear search')
      expect(clearButton).toBeInTheDocument()
    })
  })
})

describe('EmptySearchResults', () => {
  it('renders empty state with query', () => {
    const onClear = vi.fn()
    render(<EmptySearchResults query="test query" onClear={onClear} />)

    expect(screen.getByTestId('empty-search-results')).toBeInTheDocument()
    expect(screen.getByText(/No findings match your search/)).toBeInTheDocument()
    expect(screen.getByText(/"test query"/)).toBeInTheDocument()
  })

  it('shows clear button', () => {
    const onClear = vi.fn()
    render(<EmptySearchResults query="test" onClear={onClear} />)

    expect(screen.getByText(/Clear search and view all findings/)).toBeInTheDocument()
  })

  it('calls onClear when button clicked', async () => {
    const onClear = vi.fn()
    render(<EmptySearchResults query="test" onClear={onClear} />)

    const button = screen.getByText(/Clear search and view all findings/)
    await userEvent.click(button)

    expect(onClear).toHaveBeenCalled()
  })
})
