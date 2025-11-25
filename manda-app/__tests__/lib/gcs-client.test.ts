/**
 * GCS Client Tests - Story E2.1
 * Tests for file validation functions
 */

import { describe, it, expect } from 'vitest'
import {
  validateFile,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  generateObjectPath,
} from '@/lib/gcs/client'

describe('validateFile', () => {
  describe('file extension validation (AC#3)', () => {
    it('should accept allowed file extensions', () => {
      const allowedFiles = [
        { name: 'document.pdf', type: 'application/pdf' },
        { name: 'spreadsheet.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name: 'report.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { name: 'data.csv', type: 'text/csv' },
        { name: 'notes.txt', type: 'text/plain' },
        { name: 'image.png', type: 'image/png' },
        { name: 'photo.jpg', type: 'image/jpeg' },
      ]

      allowedFiles.forEach(({ name, type }) => {
        const result = validateFile(name, type, 1024)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      })
    })

    it('should reject .exe files', () => {
      const result = validateFile('malware.exe', 'application/x-msdownload', 1024)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('.exe')
      expect(result.error).toContain('not allowed')
    })

    it('should reject .sh files', () => {
      const result = validateFile('script.sh', 'application/x-sh', 1024)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('.sh')
    })

    it('should reject .bat files', () => {
      const result = validateFile('batch.bat', 'application/x-msdos-program', 1024)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('.bat')
    })

    it('should reject unknown extensions', () => {
      const result = validateFile('file.xyz', 'application/octet-stream', 1024)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('.xyz')
    })
  })

  describe('MIME type validation (AC#3)', () => {
    it('should reject invalid MIME types even with valid extension', () => {
      // Valid extension but wrong MIME type
      const result = validateFile('fake.pdf', 'application/x-executable', 1024)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed')
    })
  })

  describe('file size validation (AC#4)', () => {
    it('should accept files under 500MB', () => {
      const result = validateFile('document.pdf', 'application/pdf', 100 * 1024 * 1024) // 100MB
      expect(result.valid).toBe(true)
    })

    it('should accept files exactly at 500MB', () => {
      const result = validateFile('document.pdf', 'application/pdf', MAX_FILE_SIZE)
      expect(result.valid).toBe(true)
    })

    it('should reject files over 500MB', () => {
      const result = validateFile('document.pdf', 'application/pdf', MAX_FILE_SIZE + 1)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds maximum')
      expect(result.error).toContain('500')
    })

    it('should reject very large files', () => {
      const result = validateFile('document.pdf', 'application/pdf', 1024 * 1024 * 1024) // 1GB
      expect(result.valid).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle files with multiple dots in name', () => {
      const result = validateFile('report.2024.final.pdf', 'application/pdf', 1024)
      expect(result.valid).toBe(true)
    })

    it('should handle uppercase extensions', () => {
      // Extension check is case-insensitive via toLowerCase()
      const result = validateFile('document.PDF', 'application/pdf', 1024)
      expect(result.valid).toBe(true)
    })

    it('should handle mixed case extensions', () => {
      const result = validateFile('document.Pdf', 'application/pdf', 1024)
      expect(result.valid).toBe(true)
    })
  })
})

describe('generateObjectPath', () => {
  it('should generate path with project ID and filename', () => {
    const path = generateObjectPath('project-123', 'document.pdf')
    expect(path).toBe('project-123/document.pdf')
  })

  it('should include folder path when provided', () => {
    const path = generateObjectPath('project-123', 'document.pdf', 'Financial/Q3')
    expect(path).toBe('project-123/Financial/Q3/document.pdf')
  })

  it('should sanitize filenames with spaces', () => {
    const path = generateObjectPath('project-123', 'my document.pdf')
    expect(path).toBe('project-123/my_document.pdf')
  })

  it('should prevent path traversal', () => {
    const path = generateObjectPath('project-123', '../../../etc/passwd')
    expect(path).not.toContain('..')
  })

  it('should sanitize special characters', () => {
    const path = generateObjectPath('project-123', 'file<>:"|?*.pdf')
    expect(path).not.toContain('<')
    expect(path).not.toContain('>')
    expect(path).not.toContain(':')
  })
})

describe('constants', () => {
  it('should have MAX_FILE_SIZE set to 500MB', () => {
    expect(MAX_FILE_SIZE).toBe(500 * 1024 * 1024)
  })

  it('should include common M&A document types in ALLOWED_EXTENSIONS', () => {
    expect(ALLOWED_EXTENSIONS).toContain('.pdf')
    expect(ALLOWED_EXTENSIONS).toContain('.xlsx')
    expect(ALLOWED_EXTENSIONS).toContain('.docx')
    expect(ALLOWED_EXTENSIONS).toContain('.pptx')
    expect(ALLOWED_EXTENSIONS).toContain('.csv')
  })

  it('should include corresponding MIME types', () => {
    expect(ALLOWED_MIME_TYPES).toContain('application/pdf')
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(ALLOWED_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })
})
