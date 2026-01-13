'use client'

/**
 * PatternManagement Component
 *
 * UI for viewing, toggling, and deleting learned edit patterns.
 * Story: E7.3 - Enable Response Editing and Learning
 * AC: #5 (Pattern management UI)
 */

import { useState, useEffect, useCallback } from 'react'
import { Trash2, ToggleLeft, ToggleRight, RefreshCw, AlertCircle, Brain, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { EditPattern, PatternType } from '@/lib/types/feedback'

interface PatternManagementProps {
  className?: string
}

const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  word_replacement: 'Word Replacement',
  phrase_removal: 'Phrase Removal',
  tone_adjustment: 'Tone Adjustment',
  structure_change: 'Structure Change',
}

const PATTERN_TYPE_COLORS: Record<PatternType, string> = {
  word_replacement: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  phrase_removal: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  tone_adjustment: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  structure_change: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

/**
 * Hook to manage patterns state and API calls
 */
function usePatterns() {
  const [patterns, setPatterns] = useState<EditPattern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPatterns = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/user/patterns')
      if (!response.ok) {
        throw new Error('Failed to fetch patterns')
      }
      const data = await response.json()
      setPatterns(data.patterns || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patterns')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const togglePattern = useCallback(async (patternId: string, isActive: boolean) => {
    // Optimistic update
    setPatterns((prev) =>
      prev.map((p) => (p.id === patternId ? { ...p, isActive } : p))
    )

    try {
      const response = await fetch('/api/user/patterns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId, isActive }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle pattern')
      }
    } catch (err) {
      // Rollback on error
      setPatterns((prev) =>
        prev.map((p) => (p.id === patternId ? { ...p, isActive: !isActive } : p))
      )
      setError(err instanceof Error ? err.message : 'Failed to toggle pattern')
    }
  }, [])

  const deletePattern = useCallback(async (patternId: string) => {
    // Optimistic update
    setPatterns((prev) => prev.filter((p) => p.id !== patternId))

    try {
      const response = await fetch('/api/user/patterns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete pattern')
      }
    } catch (err) {
      // Refetch on error to restore state
      fetchPatterns()
      setError(err instanceof Error ? err.message : 'Failed to delete pattern')
    }
  }, [fetchPatterns])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  return {
    patterns,
    isLoading,
    error,
    refetch: fetchPatterns,
    togglePattern,
    deletePattern,
  }
}

/**
 * Individual pattern item display
 */
interface PatternItemProps {
  pattern: EditPattern
  onToggle: (patternId: string, isActive: boolean) => void
  onDelete: (patternId: string) => void
}

function PatternItem({ pattern, onToggle, onDelete }: PatternItemProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 p-4 border rounded-lg',
        !pattern.isActive && 'opacity-60'
      )}
      data-testid="pattern-item"
    >
      <div className="flex-1 space-y-2">
        {/* Pattern type badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={PATTERN_TYPE_COLORS[pattern.patternType]}
          >
            {PATTERN_TYPE_LABELS[pattern.patternType]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Hash className="h-3 w-3 mr-1" />
            {pattern.occurrenceCount}x
          </Badge>
        </div>

        {/* Pattern content */}
        <div className="text-sm">
          {pattern.patternType === 'phrase_removal' ? (
            <span>
              Remove: <span className="font-mono bg-muted px-1 rounded">&quot;{pattern.originalPattern}&quot;</span>
            </span>
          ) : (
            <span>
              <span className="font-mono bg-red-100 dark:bg-red-900/30 px-1 rounded line-through">
                &quot;{pattern.originalPattern}&quot;
              </span>
              <span className="mx-2">→</span>
              <span className="font-mono bg-green-100 dark:bg-green-900/30 px-1 rounded">
                &quot;{pattern.replacementPattern}&quot;
              </span>
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground">
          First seen: {new Date(pattern.firstSeen).toLocaleDateString()}
          {' • '}
          Last seen: {new Date(pattern.lastSeen).toLocaleDateString()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Toggle active */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggle(pattern.id, !pattern.isActive)}
          title={pattern.isActive ? 'Disable pattern' : 'Enable pattern'}
          data-testid="toggle-pattern-button"
        >
          {pattern.isActive ? (
            <ToggleRight className="h-5 w-5 text-green-500" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              data-testid="delete-pattern-button"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete pattern?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this learned pattern. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(pattern.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

/**
 * Pattern management panel
 */
export function PatternManagement({ className }: PatternManagementProps) {
  const { patterns, isLoading, error, refetch, togglePattern, deletePattern } = usePatterns()

  const activePatterns = patterns.filter((p) => p.isActive)
  const significantPatterns = patterns.filter((p) => p.occurrenceCount >= 3)

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Learned Patterns</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refetch}
            disabled={isLoading}
            data-testid="refresh-patterns-button"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
        <CardDescription>
          {patterns.length === 0
            ? 'No patterns learned yet. Edit agent responses to teach preferences.'
            : `${activePatterns.length} active of ${patterns.length} patterns • ${significantPatterns.length} significant (3+ occurrences)`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No patterns learned yet</p>
            <p className="text-xs mt-1">
              When you edit agent responses, patterns will be detected and learned
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <PatternItem
                key={pattern.id}
                pattern={pattern}
                onToggle={togglePattern}
                onDelete={deletePattern}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
