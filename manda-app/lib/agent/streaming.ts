/**
 * Agent Streaming Support
 *
 * Utilities for Server-Sent Events (SSE) streaming of agent responses.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Features:
 * - SSE event formatting
 * - Token streaming
 * - Tool execution events
 * - Error handling
 */

/**
 * SSE Event Types
 */
export type SSEEventType =
  | 'token'         // Streaming token
  | 'tool_start'    // Tool invocation started
  | 'tool_end'      // Tool completed
  | 'sources'       // Source citations
  | 'done'          // Complete response
  | 'error'         // Error occurred

/**
 * SSE Event Payloads
 */
export interface SSETokenEvent {
  type: 'token'
  text: string
}

export interface SSEToolStartEvent {
  type: 'tool_start'
  tool: string
  args: unknown
}

export interface SSEToolEndEvent {
  type: 'tool_end'
  tool: string
  result: unknown
}

export interface SSESourcesEvent {
  type: 'sources'
  citations: Array<{
    documentName: string
    location: string
    documentId?: string
  }>
}

export interface SSEDoneEvent {
  type: 'done'
  message: {
    id: string
    content: string
    role: 'assistant'
  }
  suggestedFollowups?: string[]
}

export interface SSEErrorEvent {
  type: 'error'
  message: string
  code?: string
}

export type SSEEvent =
  | SSETokenEvent
  | SSEToolStartEvent
  | SSEToolEndEvent
  | SSESourcesEvent
  | SSEDoneEvent
  | SSEErrorEvent

/**
 * Format an SSE event for transmission
 */
export function formatSSEEvent(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Create a ReadableStream for SSE
 */
export function createSSEStream(): {
  stream: ReadableStream<Uint8Array>
  writer: {
    write: (event: SSEEvent) => void
    close: () => void
    error: (err: Error) => void
  }
} {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })

  const writer = {
    write: (event: SSEEvent) => {
      const data = formatSSEEvent(event)
      controller.enqueue(encoder.encode(data))
    },
    close: () => {
      controller.close()
    },
    error: (err: Error) => {
      controller.error(err)
    },
  }

  return { stream, writer }
}

/**
 * Create SSE response headers
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  }
}

/**
 * Stream handler that can be used with agent execution
 */
export class AgentStreamHandler {
  private writer: {
    write: (event: SSEEvent) => void
    close: () => void
    error: (err: Error) => void
  }
  private sources: SSESourcesEvent['citations'] = []
  private fullContent: string = ''

  constructor(writer: typeof AgentStreamHandler.prototype.writer) {
    this.writer = writer
  }

  /**
   * Handle a token from the LLM
   */
  onToken(token: string): void {
    this.fullContent += token
    this.writer.write({ type: 'token', text: token })
  }

  /**
   * Handle tool start
   */
  onToolStart(tool: string, input: unknown): void {
    this.writer.write({ type: 'tool_start', tool, args: input })
  }

  /**
   * Handle tool end
   */
  onToolEnd(tool: string, output: unknown): void {
    this.writer.write({ type: 'tool_end', tool, result: output })

    // Extract sources from tool output if present
    this.extractSources(output)
  }

  /**
   * Handle completion
   */
  onComplete(messageId: string, followups?: string[]): void {
    // Send sources if any were collected
    if (this.sources.length > 0) {
      this.writer.write({ type: 'sources', citations: this.sources })
    }

    // Send done event
    this.writer.write({
      type: 'done',
      message: {
        id: messageId,
        content: this.fullContent,
        role: 'assistant',
      },
      suggestedFollowups: followups,
    })

    this.writer.close()
  }

  /**
   * Handle error
   */
  onError(error: Error, code?: string): void {
    this.writer.write({
      type: 'error',
      message: error.message,
      code,
    })
    this.writer.close()
  }

  /**
   * Extract source citations from tool output
   */
  private extractSources(output: unknown): void {
    if (!output || typeof output !== 'string') return

    try {
      const parsed = JSON.parse(output)

      // Check for findings with sources
      if (parsed.data?.findings) {
        for (const finding of parsed.data.findings) {
          if (finding.source) {
            this.addSource({
              documentName: finding.source.documentName,
              location: finding.source.location,
              documentId: finding.source.documentId,
            })
          }
        }
      }

      // Check for direct sources array
      if (parsed.data?.sources) {
        for (const source of parsed.data.sources) {
          this.addSource(source)
        }
      }
    } catch {
      // Not JSON, skip extraction
    }
  }

  /**
   * Add a source (deduplicating)
   */
  private addSource(source: SSESourcesEvent['citations'][0]): void {
    const exists = this.sources.some(
      (s) => s.documentName === source.documentName && s.location === source.location
    )
    if (!exists) {
      this.sources.push(source)
    }
  }

  /**
   * Get collected content
   */
  getContent(): string {
    return this.fullContent
  }

  /**
   * Get collected sources
   */
  getSources(): SSESourcesEvent['citations'] {
    return this.sources
  }
}

/**
 * Parse source citations from response text
 * Extracts (source: filename, location) patterns
 */
export function parseSourceCitations(text: string): SSESourcesEvent['citations'] {
  const sources: SSESourcesEvent['citations'] = []

  // Match (source: filename, location) or (sources: file1 loc1, file2 loc2)
  const singlePattern = /\(source:\s*([^,]+),\s*([^)]+)\)/gi
  const multiPattern = /\(sources:\s*([^)]+)\)/gi

  // Single source matches
  let match
  while ((match = singlePattern.exec(text)) !== null) {
    if (match[1] && match[2]) {
      sources.push({
        documentName: match[1].trim(),
        location: match[2].trim(),
      })
    }
  }

  // Multi source matches
  while ((match = multiPattern.exec(text)) !== null) {
    if (!match[1]) continue
    const parts = match[1].split(',')
    for (const part of parts) {
      // Try to split by last space (filename location)
      const trimmed = part.trim()
      const lastSpace = trimmed.lastIndexOf(' ')
      if (lastSpace > 0) {
        sources.push({
          documentName: trimmed.slice(0, lastSpace).trim(),
          location: trimmed.slice(lastSpace + 1).trim(),
        })
      }
    }
  }

  return sources
}

/**
 * Generate suggested follow-up questions based on response
 */
export function generateFollowupSuggestions(
  content: string,
  topic?: string
): string[] {
  const suggestions: string[] = []

  // If gaps were mentioned, suggest gap-related follow-ups
  if (content.toLowerCase().includes('gap') || content.toLowerCase().includes('missing')) {
    suggestions.push('Would you like me to generate Q&A items for the missing information?')
  }

  // If contradictions were mentioned
  if (content.toLowerCase().includes('contradiction') || content.toLowerCase().includes('conflict')) {
    suggestions.push('Would you like more details on these contradictions?')
  }

  // If financial data was discussed
  if (content.toLowerCase().includes('revenue') || content.toLowerCase().includes('ebitda')) {
    suggestions.push('How does this compare to the previous period?')
    suggestions.push('What are the key drivers behind these numbers?')
  }

  // Generic follow-ups
  if (suggestions.length === 0 && topic) {
    suggestions.push(`What else would you like to know about ${topic}?`)
  }

  return suggestions.slice(0, 3) // Max 3 suggestions
}
