/**
 * CIMBuilderLayout Component Tests
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #1 - Three-Panel Responsive Layout
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CIMBuilderLayout } from '@/components/cim-builder/CIMBuilderLayout'

// Mock ResizablePanel components
vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="resizable-panel-group" className={className}>{children}</div>
  ),
  ResizablePanel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}))

// Mock Sheet components
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet">{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-trigger">{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
}))

describe('CIMBuilderLayout', () => {
  const mockSourcesPanel = <div data-testid="sources-panel">Sources Content</div>
  const mockConversationPanel = <div data-testid="conversation-panel">Conversation Content</div>
  const mockPreviewPanel = <div data-testid="preview-panel">Preview Content</div>

  const defaultProps = {
    sourcesPanel: mockSourcesPanel,
    conversationPanel: mockConversationPanel,
    previewPanel: mockPreviewPanel,
  }

  describe('rendering (AC #1)', () => {
    it('should render all three panel contents', () => {
      render(<CIMBuilderLayout {...defaultProps} />)

      expect(screen.getAllByTestId('sources-panel').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('conversation-panel').length).toBeGreaterThan(0)
      expect(screen.getAllByTestId('preview-panel').length).toBeGreaterThan(0)
    })

    it('should render panel headers for desktop layout', () => {
      render(<CIMBuilderLayout {...defaultProps} />)

      // Headers appear multiple times due to responsive layouts
      expect(screen.getAllByText('Sources & Structure').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Conversation').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Preview').length).toBeGreaterThan(0)
    })

    it('should render resizable panel group for desktop', () => {
      render(<CIMBuilderLayout {...defaultProps} />)

      const panelGroups = screen.getAllByTestId('resizable-panel-group')
      expect(panelGroups.length).toBeGreaterThan(0)
    })

    it('should render resizable handles between panels', () => {
      render(<CIMBuilderLayout {...defaultProps} />)

      const handles = screen.getAllByTestId('resizable-handle')
      expect(handles.length).toBeGreaterThan(0)
    })
  })

  describe('mobile layout', () => {
    it('should render tabs for mobile navigation', () => {
      render(<CIMBuilderLayout {...defaultProps} />)

      // Tab triggers should be present
      expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /chat/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /preview/i })).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have accessible collapse button', () => {
      render(<CIMBuilderLayout {...defaultProps} />)

      const collapseButton = screen.getByRole('button', { name: /collapse sources panel/i })
      expect(collapseButton).toBeInTheDocument()
    })
  })
})
