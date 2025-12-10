'use client'

/**
 * CIM Empty State Component
 * Displays when no CIMs exist for a deal
 * Story: E9.2 - CIM List & Entry UI
 * AC: #6 - Empty state displays when no CIMs exist with helpful messaging
 *
 * Features:
 * - Illustration placeholder
 * - Helpful message about what CIMs are
 * - CTA button to create first CIM
 */

import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CIMEmptyStateProps {
  onCreateClick: () => void
}

export function CIMEmptyState({ onCreateClick }: CIMEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {/* Illustration placeholder */}
        <div className="rounded-full bg-muted p-6 mb-6">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>

        <h3 className="text-xl font-semibold mb-2">No CIMs yet</h3>

        <p className="text-muted-foreground max-w-md mb-6">
          Create your first Confidential Information Memorandum (CIM) to start building
          compelling investment materials for potential buyers. Our AI-guided workflow will
          help you craft a professional CIM tailored to your target audience.
        </p>

        <Button onClick={onCreateClick} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Create your first CIM
        </Button>
      </CardContent>
    </Card>
  )
}
