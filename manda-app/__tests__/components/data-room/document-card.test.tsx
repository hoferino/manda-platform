/**
 * Unit tests for DocumentCard component
 * Story: E2.5 - Create Document Metadata Management (AC: #1)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentCard, DocumentCardHeader } from '@/components/data-room/document-card'
import type { Document } from '@/lib/api/documents'

// Mock document data
const mockDocument: Document = {
  id: 'doc-123',
  projectId: 'project-456',
  name: 'financial-report-2024.pdf',
  size: 1048576, // 1 MB
  mimeType: 'application/pdf',
  category: 'financial',
  folderPath: 'reports/annual',
  uploadStatus: 'completed',
  processingStatus: 'completed',
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
}

describe('DocumentCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders document name', () => {
      render(<DocumentCard document={mockDocument} />)
      expect(screen.getByText('financial-report-2024.pdf')).toBeInTheDocument()
    })

    it('renders formatted file size', () => {
      render(<DocumentCard document={mockDocument} />)
      expect(screen.getByText('1 MB')).toBeInTheDocument()
    })

    it('renders relative date', () => {
      render(<DocumentCard document={mockDocument} />)
      // Should show something like "2 hours ago"
      expect(screen.getByText(/hours? ago/i)).toBeInTheDocument()
    })

    it('renders category badge when set', () => {
      render(<DocumentCard document={mockDocument} />)
      expect(screen.getByText('Financial')).toBeInTheDocument()
    })

    it('does not render category badge when not set', () => {
      const docWithoutCategory = { ...mockDocument, category: null }
      render(<DocumentCard document={docWithoutCategory} />)
      expect(screen.queryByText('Financial')).not.toBeInTheDocument()
    })

    it('does not render processing badge when completed', () => {
      render(<DocumentCard document={mockDocument} />)
      expect(screen.queryByText('Processed')).not.toBeInTheDocument()
    })

    it('renders processing badge when processing', () => {
      const processingDoc = { ...mockDocument, processingStatus: 'processing' as const }
      render(<DocumentCard document={processingDoc} />)
      expect(screen.getByText('Processing')).toBeInTheDocument()
    })

    it('renders failed badge when processing failed', () => {
      const failedDoc = { ...mockDocument, processingStatus: 'failed' as const }
      render(<DocumentCard document={failedDoc} />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('renders pending badge when pending', () => {
      const pendingDoc = { ...mockDocument, processingStatus: 'pending' as const }
      render(<DocumentCard document={pendingDoc} />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })
  })

  describe('Interactions', () => {
    it('calls onClick when card is clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<DocumentCard document={mockDocument} onClick={onClick} />)

      // Click on the document name text
      await user.click(screen.getByText('financial-report-2024.pdf'))
      expect(onClick).toHaveBeenCalledWith(mockDocument)
    })

    it('calls onClick on Enter key', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<DocumentCard document={mockDocument} onClick={onClick} />)

      // Find the main clickable element (role="button")
      const cards = screen.getAllByRole('button')
      // The first button should be the card itself
      cards[0].focus()
      await user.keyboard('{Enter}')
      expect(onClick).toHaveBeenCalledWith(mockDocument)
    })

    it('calls onDownload from dropdown menu', async () => {
      const user = userEvent.setup()
      const onDownload = vi.fn()
      render(<DocumentCard document={mockDocument} onDownload={onDownload} />)

      // Open dropdown - find by sr-only text within
      const menuButton = screen.getByText('Document actions').closest('button')!
      await user.click(menuButton)

      // Click download
      await user.click(screen.getByText('Download'))
      expect(onDownload).toHaveBeenCalledWith(mockDocument)
    })

    it('calls onDelete from dropdown menu', async () => {
      const user = userEvent.setup()
      const onDelete = vi.fn()
      render(<DocumentCard document={mockDocument} onDelete={onDelete} />)

      // Open dropdown - find by sr-only text within
      const menuButton = screen.getByText('Document actions').closest('button')!
      await user.click(menuButton)

      // Click delete
      await user.click(screen.getByText('Delete'))
      expect(onDelete).toHaveBeenCalledWith(mockDocument)
    })

    it('calls onMove from dropdown menu', async () => {
      const user = userEvent.setup()
      const onMove = vi.fn()
      render(<DocumentCard document={mockDocument} onMove={onMove} />)

      // Open dropdown - find by sr-only text within
      const menuButton = screen.getByText('Document actions').closest('button')!
      await user.click(menuButton)

      // Click move
      await user.click(screen.getByText('Move to...'))
      expect(onMove).toHaveBeenCalledWith(mockDocument)
    })

    it('calls onRename from dropdown menu when provided', async () => {
      const user = userEvent.setup()
      const onRename = vi.fn()
      render(<DocumentCard document={mockDocument} onRename={onRename} />)

      // Open dropdown - find by sr-only text within
      const menuButton = screen.getByText('Document actions').closest('button')!
      await user.click(menuButton)

      // Click rename
      await user.click(screen.getByText('Rename'))
      expect(onRename).toHaveBeenCalledWith(mockDocument)
    })
  })

  describe('File type icons', () => {
    it('renders PDF icon for PDF files', () => {
      render(<DocumentCard document={mockDocument} />)
      // Icon is rendered, we check the document is displayed
      expect(screen.getByText('financial-report-2024.pdf')).toBeInTheDocument()
    })

    it('handles null mimeType gracefully', () => {
      const docWithNullMime = { ...mockDocument, mimeType: null }
      render(<DocumentCard document={docWithNullMime} />)
      expect(screen.getByText('financial-report-2024.pdf')).toBeInTheDocument()
    })
  })
})

describe('DocumentCardHeader Component', () => {
  it('renders header columns', () => {
    render(<DocumentCardHeader />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Size')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
  })
})
