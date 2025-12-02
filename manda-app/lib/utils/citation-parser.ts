/**
 * Citation Parser Utility
 *
 * Parses source citations from LLM responses in P2-compliant format.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #1 (Parse Citations), #4 (Multiple Citations)
 *
 * Supported formats:
 * - (source: filename.ext, location)
 * - (source: doc.xlsx, Sheet 'P&L', Cell B15)
 * - (source: report.pdf, p.15)
 * - (sources: doc1.pdf p.5, doc2.xlsx B15)
 */

/**
 * Parsed citation with extracted metadata
 */
export interface ParsedCitation {
  /** Original document filename */
  documentName: string
  /** Location string (e.g., "p.15", "Sheet 'P&L', Cell B15") */
  location: string
  /** Extracted sheet name for Excel files */
  sheetName?: string
  /** Extracted cell reference for Excel files */
  cellReference?: string
  /** Extracted page number for PDFs */
  pageNumber?: number
  /** The original matched text including parentheses */
  originalMatch: string
  /** Start index in the original text */
  startIndex: number
  /** End index in the original text */
  endIndex: number
}

/**
 * Result of parsing text for citations
 */
export interface ParseResult {
  /** Array of parsed citations */
  citations: ParsedCitation[]
  /** Whether any citations were found */
  hasCitations: boolean
}

// Regex patterns for citation formats
// Single source: (source: filename, location)
const SINGLE_SOURCE_REGEX = /\(source:\s*([^,)]+),\s*([^)]+)\)/gi

// Multiple sources: (sources: doc1.pdf p.5, doc2.xlsx B15)
const MULTI_SOURCE_REGEX = /\(sources:\s*([^)]+)\)/gi

// Sheet name extraction: Sheet 'Name' or Sheet "Name"
const SHEET_REGEX = /Sheet\s+['"]([^'"]+)['"]/i

// Cell reference extraction: Cell A1 or Cell AB123
const CELL_REGEX = /Cell\s+([A-Z]+\d+)/i

// Page number extraction: p.15 or page 15 or p15
const PAGE_REGEX = /p\.?\s*(\d+)|page\s+(\d+)/i

/**
 * Parse location string to extract structured metadata
 */
function parseLocation(location: string): {
  sheetName?: string
  cellReference?: string
  pageNumber?: number
} {
  const result: {
    sheetName?: string
    cellReference?: string
    pageNumber?: number
  } = {}

  // Extract sheet name
  const sheetMatch = location.match(SHEET_REGEX)
  if (sheetMatch?.[1]) {
    result.sheetName = sheetMatch[1]
  }

  // Extract cell reference
  const cellMatch = location.match(CELL_REGEX)
  if (cellMatch?.[1]) {
    result.cellReference = cellMatch[1]
  }

  // Extract page number
  const pageMatch = location.match(PAGE_REGEX)
  if (pageMatch) {
    const pageNum = pageMatch[1] || pageMatch[2]
    if (pageNum) {
      result.pageNumber = parseInt(pageNum, 10)
    }
  }

  return result
}

/**
 * Parse a single source citation match
 */
function parseSingleCitation(
  match: RegExpExecArray,
  originalText: string
): ParsedCitation | null {
  const fullMatch = match[0]
  const documentName = match[1]?.trim()
  const location = match[2]?.trim()

  if (!documentName || !location) {
    return null
  }

  const locationMeta = parseLocation(location)

  return {
    documentName,
    location,
    ...locationMeta,
    originalMatch: fullMatch,
    startIndex: match.index,
    endIndex: match.index + fullMatch.length,
  }
}

/**
 * Parse multiple sources from a single (sources: ...) citation
 */
function parseMultiSourceCitation(
  match: RegExpExecArray,
  originalText: string
): ParsedCitation[] {
  const fullMatch = match[0]
  const sourcesContent = match[1]?.trim()

  if (!sourcesContent) {
    return []
  }

  const citations: ParsedCitation[] = []

  // Split by comma, but be careful about commas inside locations
  // Simple heuristic: split by patterns like "doc.ext location, " or end of string
  const sourcePattern = /([^\s,]+\.[a-zA-Z]+)\s+([^,]+?)(?=,\s*[^\s,]+\.[a-zA-Z]+|$)/g

  let sourceMatch
  while ((sourceMatch = sourcePattern.exec(sourcesContent)) !== null) {
    const documentName = sourceMatch[1]?.trim()
    const location = sourceMatch[2]?.trim()

    if (documentName && location) {
      const locationMeta = parseLocation(location)

      citations.push({
        documentName,
        location,
        ...locationMeta,
        originalMatch: fullMatch, // All share the same original match
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
      })
    }
  }

  return citations
}

/**
 * Parse text content for source citations
 *
 * @param text - The text content to parse
 * @returns ParseResult with array of parsed citations
 *
 * @example
 * ```ts
 * const result = parseCitations("Revenue was €5.2M (source: Q3_Report.pdf, p.12)")
 * // result.citations[0].documentName === "Q3_Report.pdf"
 * // result.citations[0].pageNumber === 12
 * ```
 */
export function parseCitations(text: string): ParseResult {
  if (!text || typeof text !== 'string') {
    return { citations: [], hasCitations: false }
  }

  const citations: ParsedCitation[] = []

  // Parse single source citations
  let match
  const singleRegex = new RegExp(SINGLE_SOURCE_REGEX.source, 'gi')
  while ((match = singleRegex.exec(text)) !== null) {
    const citation = parseSingleCitation(match, text)
    if (citation) {
      citations.push(citation)
    }
  }

  // Parse multiple source citations
  const multiRegex = new RegExp(MULTI_SOURCE_REGEX.source, 'gi')
  while ((match = multiRegex.exec(text)) !== null) {
    const multiCitations = parseMultiSourceCitation(match, text)
    citations.push(...multiCitations)
  }

  // Sort by start index
  citations.sort((a, b) => a.startIndex - b.startIndex)

  return {
    citations,
    hasCitations: citations.length > 0,
  }
}

/**
 * Check if text contains any citations without full parsing
 * Faster check for conditional rendering
 */
export function hasCitations(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }

  return (
    /\(source:/i.test(text) ||
    /\(sources:/i.test(text)
  )
}

/**
 * Extract unique document names from citations
 */
export function getUniqueDocumentNames(citations: ParsedCitation[]): string[] {
  const names = new Set<string>()
  for (const citation of citations) {
    names.add(citation.documentName)
  }
  return Array.from(names)
}

/**
 * Split text into segments with citation boundaries
 * Useful for rendering text with embedded citation components
 */
export interface TextSegment {
  type: 'text' | 'citation'
  content: string
  citation?: ParsedCitation
}

export function splitTextWithCitations(text: string): TextSegment[] {
  if (!text) {
    return []
  }

  const { citations } = parseCitations(text)

  if (citations.length === 0) {
    return [{ type: 'text', content: text }]
  }

  const segments: TextSegment[] = []
  let lastIndex = 0

  for (const citation of citations) {
    // Add text before citation
    if (citation.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, citation.startIndex),
      })
    }

    // Add citation segment
    segments.push({
      type: 'citation',
      content: citation.originalMatch,
      citation,
    })

    lastIndex = citation.endIndex
  }

  // Add remaining text after last citation
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return segments
}
