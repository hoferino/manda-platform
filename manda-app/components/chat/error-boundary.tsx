'use client'

/**
 * Chat-specific error boundary with recovery options.
 * Integrates with existing app/error.tsx (global) and app/projects/[id]/error.tsx (project-level).
 * This component handles chat-specific errors with inline recovery UI.
 */

import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserFacingError, toUserFacingError } from '@/lib/errors/types'

interface Props {
  children: ReactNode
  onRetry?: () => void
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  userMessage: string
  isRetryable: boolean
}

export class ChatErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null, userMessage: '', isRetryable: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const userError = toUserFacingError(error)
    return {
      hasError: true,
      error,
      userMessage: userError.message,
      isRetryable: userError.isRetryable,
    }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ChatErrorBoundary] Caught error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <Card className="mx-4 my-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base text-amber-800 dark:text-amber-200">
                Oops, something went wrong
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <CardDescription className="text-amber-700 dark:text-amber-300">
              {this.state.userMessage}
            </CardDescription>
            {this.state.isRetryable && (
              <Button variant="outline" size="sm" onClick={this.handleRetry}
                className="border-amber-300 hover:bg-amber-100 dark:border-amber-800">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      )
    }
    return this.props.children
  }
}
