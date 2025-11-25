/**
 * Chat Section Page
 * Conversational AI assistant (placeholder)
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #4, #5)
 */

import type { Metadata } from 'next'
import { MessageSquare } from 'lucide-react'
import { PlaceholderSection } from '@/components/workspace'

export const metadata: Metadata = {
  title: 'Chat - Manda',
  description: 'Conversational AI assistant',
}

export default function ChatPage() {
  return (
    <PlaceholderSection
      title="Chat"
      description="Ask questions about your deal documents and get AI-powered answers with source citations from the data room."
      epic={5}
      icon={MessageSquare}
    />
  )
}
