/**
 * Error State Component
 * Displayed when there's an error loading projects
 * Story: E1.4 - Build Projects Overview Screen (AC: #9)
 */

'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      // Default behavior: reload the page
      window.location.reload()
    }
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <h3 className="mt-6 text-xl font-semibold">Failed to load projects</h3>

      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {message ?? 'An error occurred while loading your projects. Please try again.'}
      </p>

      <Button onClick={handleRetry} className="mt-6" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  )
}
