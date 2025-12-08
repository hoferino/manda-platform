/**
 * Review Queue Page
 *
 * Full page view of items flagged for review due to correction propagation.
 * Story: E7.6 - Propagate Corrections to Related Insights (AC: #3)
 */

import type { Metadata } from 'next'
import { ReviewQueuePageClient } from './ReviewQueuePageClient'

export const metadata: Metadata = {
  title: 'Review Queue - Manda',
  description: 'Items flagged for review due to corrections',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReviewQueuePage({ params }: Props) {
  const { id: projectId } = await params

  return <ReviewQueuePageClient projectId={projectId} />
}
