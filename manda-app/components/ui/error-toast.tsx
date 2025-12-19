'use client'

import { useEffect, useState } from 'react'
import { X, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorToastProps {
  message: string
  isRetryable?: boolean
  onRetry?: () => void
  onDismiss?: () => void
  autoHideMs?: number
}

export function ErrorToast({ message, isRetryable = false, onRetry, onDismiss, autoHideMs = 8000 }: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHideMs > 0) {
      const timer = setTimeout(() => { setIsVisible(false); onDismiss?.() }, autoHideMs)
      return () => clearTimeout(timer)
    }
  }, [autoHideMs, onDismiss])

  if (!isVisible) return null

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 max-w-md animate-in fade-in slide-in-from-bottom-2',
      'rounded-lg border border-destructive/30 bg-destructive/10 p-4 shadow-lg'
    )} role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-destructive">{message}</p>
          {isRetryable && onRetry && (
            <Button variant="outline" size="sm" onClick={() => { onRetry(); setIsVisible(false); onDismiss?.() }}
              className="h-7 border-destructive/30 text-destructive hover:bg-destructive/10">
              <RefreshCw className="mr-1.5 h-3 w-3" />Retry
            </Button>
          )}
        </div>
        <button onClick={() => { setIsVisible(false); onDismiss?.() }} className="text-destructive/70 hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
