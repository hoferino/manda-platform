/**
 * Wizard Layout Component
 * Provides a consistent layout for multi-step wizards with progress indicator
 * Story: E1.5 - Implement Project Creation Wizard (AC: #1, #9)
 */

'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WizardLayoutProps {
  children: ReactNode
  currentStep: number
  totalSteps: number
  title: string
  subtitle?: string
  onNext?: () => void
  onBack?: () => void
  onSubmit?: () => void
  isNextDisabled?: boolean
  isSubmitting?: boolean
  cancelHref?: string
  submitLabel?: string
}

export function WizardLayout({
  children,
  currentStep,
  totalSteps,
  title,
  subtitle,
  onNext,
  onBack,
  onSubmit,
  isNextDisabled = false,
  isSubmitting = false,
  cancelHref = '/projects',
  submitLabel = 'Create Project',
}: WizardLayoutProps) {
  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === totalSteps

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-[800px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={cancelHref}>
                <X className="h-5 w-5" />
                <span className="sr-only">Cancel</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="mx-auto max-w-[800px] px-4 pt-4 sm:px-6">
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < currentStep ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        {children}
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-20 max-w-[800px] items-center justify-between px-4 sm:px-6">
          {/* Back Button */}
          <div>
            {!isFirstStep && onBack && (
              <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {isFirstStep && (
              <Button variant="outline" asChild>
                <Link href={cancelHref}>Cancel</Link>
              </Button>
            )}
          </div>

          {/* Next/Submit Button */}
          <div>
            {!isLastStep && onNext && (
              <Button onClick={onNext} disabled={isNextDisabled || isSubmitting}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            {isLastStep && onSubmit && (
              <Button onClick={onSubmit} disabled={isNextDisabled || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            )}
          </div>
        </div>
      </footer>

      {/* Spacer for fixed footer */}
      <div className="h-20" />
    </div>
  )
}
