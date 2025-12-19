import { describe, it, expect } from 'vitest'
import { UserFacingError, RateLimitError, GraphitiConnectionError, DocumentParsingError, NetworkError, LLMServiceError, toUserFacingError } from '@/lib/errors/types'

describe('Error Types', () => {
  describe('toUserFacingError', () => {
    it('returns UserFacingError as-is', () => {
      const original = new RateLimitError('test', 1000)
      expect(toUserFacingError(original)).toBe(original)
    })

    it('detects rate limit from message', () => {
      expect(toUserFacingError(new Error('Error 429: Too many requests'))).toBeInstanceOf(RateLimitError)
    })

    it('detects rate limit from "rate limit" text', () => {
      expect(toUserFacingError(new Error('Rate limit exceeded'))).toBeInstanceOf(RateLimitError)
    })

    it('detects Neo4j errors', () => {
      expect(toUserFacingError(new Error('neo4j connection failed'))).toBeInstanceOf(GraphitiConnectionError)
    })

    it('detects Graphiti errors', () => {
      expect(toUserFacingError(new Error('Graphiti service unavailable'))).toBeInstanceOf(GraphitiConnectionError)
    })

    it('detects network errors from timeout', () => {
      expect(toUserFacingError(new Error('Request timeout'))).toBeInstanceOf(NetworkError)
    })

    it('detects network errors from ECONNREFUSED', () => {
      expect(toUserFacingError(new Error('ECONNREFUSED'))).toBeInstanceOf(NetworkError)
    })

    it('detects LLM service errors from 503', () => {
      expect(toUserFacingError(new Error('Error 503: Service unavailable'))).toBeInstanceOf(LLMServiceError)
    })

    it('detects LLM service errors from overloaded', () => {
      expect(toUserFacingError(new Error('API is overloaded'))).toBeInstanceOf(LLMServiceError)
    })

    it('detects password protected documents', () => {
      const result = toUserFacingError(new Error('File is password protected'))
      expect(result).toBeInstanceOf(DocumentParsingError)
      expect((result as DocumentParsingError).reason).toBe('password_protected')
    })

    it('detects corrupted files', () => {
      const result = toUserFacingError(new Error('File is corrupted'))
      expect(result).toBeInstanceOf(DocumentParsingError)
      expect((result as DocumentParsingError).reason).toBe('corrupted')
    })

    it('creates generic error for unknown types with cause preserved', () => {
      const original = new Error('Something unexpected')
      const result = toUserFacingError(original)
      expect(result).toBeInstanceOf(UserFacingError)
      expect(result.cause).toBe(original)
      expect(result.message).not.toContain('unexpected') // User-friendly
    })

    it('handles non-Error inputs', () => {
      const result = toUserFacingError('string error')
      expect(result).toBeInstanceOf(UserFacingError)
      expect(result.isRetryable).toBe(true)
    })
  })

  describe('DocumentParsingError', () => {
    it.each([
      ['password_protected', 'password'],
      ['corrupted', 'corrupted'],
      ['unsupported_type', 'supported'],
      ['too_large', 'large'],
    ] as const)('reason %s includes keyword %s in message', (reason, keyword) => {
      const error = new DocumentParsingError(reason)
      expect(error.message.toLowerCase()).toContain(keyword)
    })

    it('is retryable only for unknown reason', () => {
      expect(new DocumentParsingError('unknown').isRetryable).toBe(true)
      expect(new DocumentParsingError('corrupted').isRetryable).toBe(false)
    })
  })

  describe('RateLimitError', () => {
    it('has correct properties', () => {
      const error = new RateLimitError('anthropic', 5000)
      expect(error.statusCode).toBe(429)
      expect(error.isRetryable).toBe(true)
      expect(error.retryAfterMs).toBe(5000)
    })
  })

  describe('GraphitiConnectionError', () => {
    it('has correct properties', () => {
      const error = new GraphitiConnectionError()
      expect(error.statusCode).toBe(503)
      expect(error.isRetryable).toBe(true)
    })

    it('preserves cause', () => {
      const cause = new Error('Original error')
      const error = new GraphitiConnectionError(cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe('LLMServiceError', () => {
    it('has correct properties', () => {
      const error = new LLMServiceError('anthropic')
      expect(error.statusCode).toBe(503)
      expect(error.isRetryable).toBe(true)
      expect(error.provider).toBe('anthropic')
    })
  })

  describe('NetworkError', () => {
    it('has correct properties', () => {
      const error = new NetworkError()
      expect(error.statusCode).toBe(504)
      expect(error.isRetryable).toBe(true)
    })
  })
})
