/**
 * Chat Section Page
 * Conversational AI assistant with conversation history
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #1 (Chat Page UI)
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ChatInterface } from '@/components/chat'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Chat - Manda',
  description: 'AI-powered conversational assistant for M&A due diligence',
}

interface ChatPageProps {
  params: Promise<{ id: string }>
}

function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar skeleton */}
      <div className="hidden lg:block w-[280px] border-r p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>

      {/* Main area skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-20 flex-1 max-w-[80%]" />
            </div>
          ))}
        </div>
        <div className="border-t p-4">
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id: projectId } = await params

  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatInterface projectId={projectId} />
    </Suspense>
  )
}
