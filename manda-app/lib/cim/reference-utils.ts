/**
 * Utilities for component reference formatting and parsing (E9.9)
 *
 * Format:
 * 📍 [componentId] "content excerpt..." -
 */

export function formatComponentReference(componentId: string, content: string): string {
  const safeContent = (content ?? '').trim()
  const shouldTruncate = safeContent.length > 30
  const excerpt = shouldTruncate ? `${safeContent.slice(0, 30).trimEnd()}...` : `${safeContent}...`
  return `📍 [${componentId}] "${excerpt}" -`
}

export function parseComponentReference(message: string): {
  componentId: string | null
  instruction: string
} {
  if (!message) {
    return { componentId: null, instruction: '' }
  }

  // Use [\s\S] instead of . with s flag for compatibility
  const pattern = /^📍 \[([^\]]+)\]\s+"[^"]*"\s*-?\s*([\s\S]*)$/
  const match = message.match(pattern)

  if (!match) {
    return { componentId: null, instruction: message.trim() }
  }

  const [, componentId, instruction] = match
  return {
    componentId: componentId ?? null,
    instruction: (instruction ?? '').trim(),
  }
}
