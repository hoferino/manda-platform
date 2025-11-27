/**
 * Unit tests for useDocumentUpdates hook
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  didProcessingStatusChange,
  didProcessingComplete,
  didProcessingFail,
} from '@/lib/hooks/useDocumentUpdates'
import type { Document } from '@/lib/api/documents'

// Mock document data factory
function createMockDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-123',
    projectId: 'project-456',
    name: 'test-document.pdf',
    size: 1024,
    mimeType: 'application/pdf',
    category: null,
    folderPath: null,
    uploadStatus: 'completed',
    processingStatus: 'pending',
    processingError: null,
    findingsCount: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('didProcessingStatusChange', () => {
  it('returns true when processing status changed', () => {
    const oldDoc = createMockDocument({ processingStatus: 'pending' })
    const newDoc = createMockDocument({ processingStatus: 'parsing' })
    expect(didProcessingStatusChange(oldDoc, newDoc)).toBe(true)
  })

  it('returns false when processing status did not change', () => {
    const oldDoc = createMockDocument({ processingStatus: 'parsing' })
    const newDoc = createMockDocument({ processingStatus: 'parsing' })
    expect(didProcessingStatusChange(oldDoc, newDoc)).toBe(false)
  })

  it('returns false when oldDoc is undefined', () => {
    const newDoc = createMockDocument({ processingStatus: 'parsing' })
    expect(didProcessingStatusChange(undefined, newDoc)).toBe(false)
  })
})

describe('didProcessingComplete', () => {
  it('returns true when status changed from pending to complete', () => {
    const oldDoc = createMockDocument({ processingStatus: 'pending' })
    const newDoc = createMockDocument({ processingStatus: 'complete' })
    expect(didProcessingComplete(oldDoc, newDoc)).toBe(true)
  })

  it('returns true when status changed from analyzing to complete', () => {
    const oldDoc = createMockDocument({ processingStatus: 'analyzing' })
    const newDoc = createMockDocument({ processingStatus: 'complete' })
    expect(didProcessingComplete(oldDoc, newDoc)).toBe(true)
  })

  it('returns false when status is already complete', () => {
    const oldDoc = createMockDocument({ processingStatus: 'complete' })
    const newDoc = createMockDocument({ processingStatus: 'complete' })
    expect(didProcessingComplete(oldDoc, newDoc)).toBe(false)
  })

  it('returns false when status changed but not to complete', () => {
    const oldDoc = createMockDocument({ processingStatus: 'pending' })
    const newDoc = createMockDocument({ processingStatus: 'parsing' })
    expect(didProcessingComplete(oldDoc, newDoc)).toBe(false)
  })

  it('returns false when oldDoc is undefined', () => {
    const newDoc = createMockDocument({ processingStatus: 'complete' })
    expect(didProcessingComplete(undefined, newDoc)).toBe(false)
  })
})

describe('didProcessingFail', () => {
  it('returns true when status changed from parsing to failed', () => {
    const oldDoc = createMockDocument({ processingStatus: 'parsing' })
    const newDoc = createMockDocument({ processingStatus: 'failed' })
    expect(didProcessingFail(oldDoc, newDoc)).toBe(true)
  })

  it('returns true when status changed from analyzing to analysis_failed', () => {
    const oldDoc = createMockDocument({ processingStatus: 'analyzing' })
    const newDoc = createMockDocument({ processingStatus: 'analysis_failed' })
    expect(didProcessingFail(oldDoc, newDoc)).toBe(true)
  })

  it('returns false when status is already failed', () => {
    const oldDoc = createMockDocument({ processingStatus: 'failed' })
    const newDoc = createMockDocument({ processingStatus: 'failed' })
    expect(didProcessingFail(oldDoc, newDoc)).toBe(false)
  })

  it('returns false when status changed but not to failed', () => {
    const oldDoc = createMockDocument({ processingStatus: 'pending' })
    const newDoc = createMockDocument({ processingStatus: 'parsing' })
    expect(didProcessingFail(oldDoc, newDoc)).toBe(false)
  })

  it('returns false when oldDoc is undefined', () => {
    const newDoc = createMockDocument({ processingStatus: 'failed' })
    expect(didProcessingFail(undefined, newDoc)).toBe(false)
  })

  it('returns true for analysis_failed from non-failed state', () => {
    const oldDoc = createMockDocument({ processingStatus: 'analyzing' })
    const newDoc = createMockDocument({ processingStatus: 'analysis_failed' })
    expect(didProcessingFail(oldDoc, newDoc)).toBe(true)
  })
})
