/**
 * Error types for E12.6 - Error Handling & Graceful Degradation
 * All user-facing errors extend UserFacingError which guarantees
 * a human-readable message that's safe to display.
 */

export class UserFacingError extends Error {
  readonly statusCode: number
  readonly isRetryable: boolean
  override readonly cause?: Error

  constructor(
    message: string,
    options?: { statusCode?: number; isRetryable?: boolean; cause?: Error }
  ) {
    super(message)
    this.name = 'UserFacingError'
    this.statusCode = options?.statusCode ?? 500
    this.isRetryable = options?.isRetryable ?? false
    this.cause = options?.cause
  }
}

export class RateLimitError extends UserFacingError {
  readonly retryAfterMs: number

  constructor(provider: string, retryAfterMs: number = 1000, cause?: Error) {
    super(`I'm receiving too many requests right now. Please wait a moment and try again.`, {
      statusCode: 429,
      isRetryable: true,
      cause,
    })
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class GraphitiConnectionError extends UserFacingError {
  constructor(cause?: Error) {
    super(
      `I'm having trouble accessing some of my knowledge right now. I can still help with document search, but some features may be limited.`,
      { statusCode: 503, isRetryable: true, cause }
    )
    this.name = 'GraphitiConnectionError'
  }
}

export class DocumentParsingError extends UserFacingError {
  readonly reason: 'unsupported_type' | 'corrupted' | 'password_protected' | 'too_large' | 'unknown'

  constructor(reason: DocumentParsingError['reason'], cause?: Error) {
    const messages: Record<DocumentParsingError['reason'], string> = {
      unsupported_type: `This file type isn't supported yet. Please upload a PDF, Word document, Excel file, or PowerPoint.`,
      corrupted: `This file appears to be corrupted or damaged. Please try uploading a different version.`,
      password_protected: `This file is password-protected. Please remove the password and upload again.`,
      too_large: `This file is too large to process. Please try a smaller file (under 100MB).`,
      unknown: `There was an issue processing this file. Please try again or upload a different format.`,
    }
    super(messages[reason], { statusCode: 400, isRetryable: reason === 'unknown', cause })
    this.name = 'DocumentParsingError'
    this.reason = reason
  }
}

export class LLMServiceError extends UserFacingError {
  readonly provider: string

  constructor(provider: string, cause?: Error) {
    super(`I'm experiencing some technical difficulties. Please try again in a moment.`, {
      statusCode: 503,
      isRetryable: true,
      cause,
    })
    this.name = 'LLMServiceError'
    this.provider = provider
  }
}

export class NetworkError extends UserFacingError {
  constructor(cause?: Error) {
    super(`The request timed out or couldn't connect. Please check your connection and try again.`, {
      statusCode: 504,
      isRetryable: true,
      cause,
    })
    this.name = 'NetworkError'
  }
}

/** Map any error to a user-safe error. Detection patterns must match Python classify_error(). */
export function toUserFacingError(error: unknown): UserFacingError {
  if (error instanceof UserFacingError) return error

  const originalError = error instanceof Error ? error : new Error(String(error))
  const message = originalError.message?.toLowerCase() ?? ''

  // Rate limit detection
  if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
    return new RateLimitError('unknown', 1000, originalError)
  }
  // Neo4j/Graphiti detection
  if (message.includes('neo4j') || message.includes('graphiti') || message.includes('graph database')) {
    return new GraphitiConnectionError(originalError)
  }
  // Network/timeout detection
  if (message.includes('timeout') || message.includes('network') || message.includes('econnrefused') || message.includes('socket')) {
    return new NetworkError(originalError)
  }
  // LLM service error detection (503, service unavailable)
  if (message.includes('503') || message.includes('service unavailable') || message.includes('overloaded')) {
    return new LLMServiceError('unknown', originalError)
  }
  // Document parsing detection
  if (message.includes('password') && (message.includes('protect') || message.includes('encrypt'))) {
    return new DocumentParsingError('password_protected', originalError)
  }
  if (message.includes('corrupt') || message.includes('malformed')) {
    return new DocumentParsingError('corrupted', originalError)
  }

  return new UserFacingError(`Something went wrong. Please try again or contact support if the issue persists.`, {
    statusCode: 500,
    isRetryable: true,
    cause: originalError,
  })
}
