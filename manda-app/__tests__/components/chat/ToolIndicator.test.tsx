/**
 * ToolIndicator Component Tests
 * Story: E5.3 - Build Chat Interface with Conversation History
 * TD-013: Deferred tests from E5.3 implementation
 *
 * Tests for the tool indicator component that displays:
 * - Tool execution status with friendly messages
 * - Loading spinner during tool execution
 * - Contextual icons for different tools
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolIndicator, TypingIndicator } from '@/components/chat/ToolIndicator'

// Mock the getToolDisplayMessage function
vi.mock('@/lib/types/chat', () => ({
  getToolDisplayMessage: (toolName: string) => {
    const messages: Record<string, string> = {
      query_knowledge_base: 'Searching knowledge base...',
      update_knowledge_base: 'Updating knowledge base...',
      validate_finding: 'Validating finding...',
      update_knowledge_graph: 'Updating knowledge graph...',
      detect_contradictions: 'Checking for contradictions...',
      find_gaps: 'Analyzing gaps...',
      get_document_info: 'Looking up document...',
      trigger_analysis: 'Triggering analysis...',
      suggest_questions: 'Generating questions...',
      add_to_qa: 'Adding to Q&A...',
      create_irl: 'Creating IRL...',
    }
    return messages[toolName] || `Running ${toolName}...`
  },
}))

describe('ToolIndicator', () => {
  describe('rendering', () => {
    it('renders nothing when toolName is null', () => {
      const { container } = render(<ToolIndicator toolName={null} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('renders badge when toolName is provided', () => {
      render(<ToolIndicator toolName="query_knowledge_base" />)
      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument()
    })

    it('renders with custom className', () => {
      const { container } = render(
        <ToolIndicator toolName="query_knowledge_base" className="custom-class" />
      )
      // The badge should have the custom class
      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('tool display messages (AC: #4)', () => {
    it('shows "Searching knowledge base..." for query_knowledge_base', () => {
      render(<ToolIndicator toolName="query_knowledge_base" />)
      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument()
    })

    it('shows "Checking for contradictions..." for detect_contradictions', () => {
      render(<ToolIndicator toolName="detect_contradictions" />)
      expect(screen.getByText('Checking for contradictions...')).toBeInTheDocument()
    })

    it('shows "Analyzing gaps..." for find_gaps', () => {
      render(<ToolIndicator toolName="find_gaps" />)
      expect(screen.getByText('Analyzing gaps...')).toBeInTheDocument()
    })

    it('shows "Looking up document..." for get_document_info', () => {
      render(<ToolIndicator toolName="get_document_info" />)
      expect(screen.getByText('Looking up document...')).toBeInTheDocument()
    })

    it('shows "Validating finding..." for validate_finding', () => {
      render(<ToolIndicator toolName="validate_finding" />)
      expect(screen.getByText('Validating finding...')).toBeInTheDocument()
    })

    it('shows "Updating knowledge base..." for update_knowledge_base', () => {
      render(<ToolIndicator toolName="update_knowledge_base" />)
      expect(screen.getByText('Updating knowledge base...')).toBeInTheDocument()
    })

    it('shows "Updating knowledge graph..." for update_knowledge_graph', () => {
      render(<ToolIndicator toolName="update_knowledge_graph" />)
      expect(screen.getByText('Updating knowledge graph...')).toBeInTheDocument()
    })

    it('shows "Triggering analysis..." for trigger_analysis', () => {
      render(<ToolIndicator toolName="trigger_analysis" />)
      expect(screen.getByText('Triggering analysis...')).toBeInTheDocument()
    })

    it('shows "Generating questions..." for suggest_questions', () => {
      render(<ToolIndicator toolName="suggest_questions" />)
      expect(screen.getByText('Generating questions...')).toBeInTheDocument()
    })

    it('shows "Adding to Q&A..." for add_to_qa', () => {
      render(<ToolIndicator toolName="add_to_qa" />)
      expect(screen.getByText('Adding to Q&A...')).toBeInTheDocument()
    })

    it('shows "Creating IRL..." for create_irl', () => {
      render(<ToolIndicator toolName="create_irl" />)
      expect(screen.getByText('Creating IRL...')).toBeInTheDocument()
    })

    it('shows fallback message for unknown tool', () => {
      render(<ToolIndicator toolName="unknown_tool" />)
      expect(screen.getByText('Running unknown_tool...')).toBeInTheDocument()
    })
  })

  describe('tool icons', () => {
    it('displays search icon for query_knowledge_base', () => {
      render(<ToolIndicator toolName="query_knowledge_base" />)
      expect(screen.getByText('🔍')).toBeInTheDocument()
    })

    it('displays pencil icon for update_knowledge_base', () => {
      render(<ToolIndicator toolName="update_knowledge_base" />)
      expect(screen.getByText('📝')).toBeInTheDocument()
    })

    it('displays check icon for validate_finding', () => {
      render(<ToolIndicator toolName="validate_finding" />)
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('displays link icon for update_knowledge_graph', () => {
      render(<ToolIndicator toolName="update_knowledge_graph" />)
      expect(screen.getByText('🔗')).toBeInTheDocument()
    })

    it('displays lightning icon for detect_contradictions', () => {
      render(<ToolIndicator toolName="detect_contradictions" />)
      expect(screen.getByText('⚡')).toBeInTheDocument()
    })

    it('displays chart icon for find_gaps', () => {
      render(<ToolIndicator toolName="find_gaps" />)
      expect(screen.getByText('📊')).toBeInTheDocument()
    })

    it('displays document icon for get_document_info', () => {
      render(<ToolIndicator toolName="get_document_info" />)
      expect(screen.getByText('📄')).toBeInTheDocument()
    })

    it('displays gear icon for trigger_analysis', () => {
      render(<ToolIndicator toolName="trigger_analysis" />)
      expect(screen.getByText('⚙️')).toBeInTheDocument()
    })

    it('displays question icon for suggest_questions', () => {
      render(<ToolIndicator toolName="suggest_questions" />)
      expect(screen.getByText('❓')).toBeInTheDocument()
    })

    it('displays clipboard icon for add_to_qa', () => {
      render(<ToolIndicator toolName="add_to_qa" />)
      expect(screen.getByText('📋')).toBeInTheDocument()
    })

    it('displays pencil icon for create_irl', () => {
      render(<ToolIndicator toolName="create_irl" />)
      expect(screen.getByText('✏️')).toBeInTheDocument()
    })

    it('displays fallback wrench icon for unknown tool', () => {
      render(<ToolIndicator toolName="unknown_tool" />)
      expect(screen.getByText('🔧')).toBeInTheDocument()
    })
  })

  describe('loading spinner', () => {
    it('renders loading spinner', () => {
      const { container } = render(<ToolIndicator toolName="query_knowledge_base" />)

      // Loader2 component has animate-spin class
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('pulse animation', () => {
    it('has pulse animation on badge', () => {
      const { container } = render(<ToolIndicator toolName="query_knowledge_base" />)

      // Badge should have animate-pulse class
      expect(container.firstChild).toHaveClass('animate-pulse')
    })
  })
})

describe('TypingIndicator', () => {
  describe('rendering', () => {
    it('renders three bouncing dots', () => {
      const { container } = render(<TypingIndicator />)

      const dots = container.querySelectorAll('.animate-bounce')
      expect(dots).toHaveLength(3)
    })

    it('applies custom className', () => {
      const { container } = render(<TypingIndicator className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('dots have staggered animation delays', () => {
      const { container } = render(<TypingIndicator />)

      const dots = container.querySelectorAll('.animate-bounce')

      expect(dots[0]).toHaveStyle({ animationDelay: '0ms' })
      expect(dots[1]).toHaveStyle({ animationDelay: '150ms' })
      expect(dots[2]).toHaveStyle({ animationDelay: '300ms' })
    })

    it('dots have correct size', () => {
      const { container } = render(<TypingIndicator />)

      const dots = container.querySelectorAll('.animate-bounce')

      dots.forEach(dot => {
        expect(dot).toHaveClass('h-2', 'w-2')
      })
    })

    it('dots are round', () => {
      const { container } = render(<TypingIndicator />)

      const dots = container.querySelectorAll('.animate-bounce')

      dots.forEach(dot => {
        expect(dot).toHaveClass('rounded-full')
      })
    })
  })
})
