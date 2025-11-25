/**
 * Buckets View Component
 * Category-based grid view of document buckets with progress indicators
 * Story: E2.3 - Build Data Room Buckets View (AC: #1-7)
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, RefreshCw, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BucketCard, type BucketItem } from './bucket-card'
import { BucketItemList } from './bucket-item-list'
import { DOCUMENT_CATEGORIES, uploadDocument, type Document } from '@/lib/api/documents'
import type { DocumentCategory } from '@/lib/gcs/client'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface BucketsViewProps {
  projectId: string
}

interface CategoryBucket {
  category: DocumentCategory
  label: string
  uploadedCount: number
  expectedCount: number
  documents: Document[]
  items: BucketItem[]
}

/**
 * Default expected document counts per category
 * Used when no IRL is configured for the project
 */
const DEFAULT_EXPECTED_COUNTS: Record<DocumentCategory, number> = {
  financial: 10,
  legal: 8,
  commercial: 6,
  operational: 5,
  tax: 5,
  hr: 4,
  it: 4,
  environmental: 3,
  regulatory: 4,
  contracts: 8,
  corporate: 5,
  insurance: 3,
  intellectual_property: 4,
  real_estate: 3,
  other: 5,
}

/**
 * Default items per category (when no IRL is configured)
 */
const DEFAULT_CATEGORY_ITEMS: Record<DocumentCategory, string[]> = {
  financial: [
    'Annual Financial Statements (3 years)',
    'Monthly Management Accounts',
    'Cash Flow Projections',
    'Budget vs Actuals',
    'Revenue Breakdown',
    'EBITDA Bridge',
    'Working Capital Analysis',
    'Capital Expenditure Schedule',
    'Debt Schedule',
    'Intercompany Transactions',
  ],
  legal: [
    'Certificate of Incorporation',
    'Articles of Association',
    'Shareholder Agreements',
    'Board Minutes',
    'Material Litigation Summary',
    'Regulatory Licenses',
    'Intellectual Property Schedule',
    'Power of Attorney',
  ],
  commercial: [
    'Customer List & Concentration',
    'Top Customer Contracts',
    'Sales Pipeline',
    'Pricing Strategy',
    'Market Analysis',
    'Competitive Landscape',
  ],
  operational: [
    'Organization Chart',
    'Key Processes Documentation',
    'Supplier Contracts',
    'Quality Certifications',
    'Operational KPIs',
  ],
  tax: [
    'Tax Returns (3 years)',
    'Tax Audit History',
    'Transfer Pricing Documentation',
    'Tax Loss Carryforwards',
    'VAT/GST Returns',
  ],
  hr: [
    'Employee Roster',
    'Employment Contracts (Key)',
    'Compensation & Benefits Summary',
    'HR Policies Handbook',
  ],
  it: [
    'IT Systems Overview',
    'Cybersecurity Assessment',
    'Software Licenses',
    'Data Privacy Compliance',
  ],
  environmental: [
    'Environmental Permits',
    'ESG Report',
    'Environmental Audits',
  ],
  regulatory: [
    'Operating Licenses',
    'Regulatory Correspondence',
    'Compliance Certificates',
    'Industry Certifications',
  ],
  contracts: [
    'Customer Contracts (Material)',
    'Supplier Agreements',
    'Partnership Agreements',
    'Lease Agreements',
    'Service Agreements',
    'License Agreements',
    'Distribution Agreements',
    'Joint Venture Agreements',
  ],
  corporate: [
    'Corporate Structure Chart',
    'Subsidiary List',
    'Minutes of Board Meetings',
    'Shareholder Register',
    'Director/Officer List',
  ],
  insurance: [
    'Insurance Policies Summary',
    'Claims History',
    'Coverage Analysis',
  ],
  intellectual_property: [
    'Patent Portfolio',
    'Trademark Registrations',
    'Trade Secrets Register',
    'IP Assignment Agreements',
  ],
  real_estate: [
    'Property Schedule',
    'Lease Agreements',
    'Property Valuations',
  ],
  other: [
    'Management Presentation',
    'Information Memorandum',
    'Additional Documents',
    'Miscellaneous',
    'Supporting Materials',
  ],
}

export function BucketsView({ projectId }: BucketsViewProps) {
  const [buckets, setBuckets] = useState<CategoryBucket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<DocumentCategory | null>(null)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadItemRef = useRef<{ itemId: string; category: DocumentCategory } | null>(null)

  /**
   * Load documents and calculate category buckets
   */
  const loadBuckets = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('deal_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading documents:', error)
        toast.error('Failed to load documents')
        return
      }

      // Transform to Document type
      const documents: Document[] = (data || []).map((doc) => ({
        id: doc.id,
        projectId: doc.deal_id,
        name: doc.name,
        size: doc.file_size,
        mimeType: doc.mime_type,
        category: (doc.category as DocumentCategory) || null,
        folderPath: doc.folder_path || null,
        uploadStatus: doc.upload_status as Document['uploadStatus'],
        processingStatus: doc.processing_status as Document['processingStatus'],
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))

      // Build buckets from categories
      const categoryBuckets: CategoryBucket[] = DOCUMENT_CATEGORIES.map(({ value, label }) => {
        const categoryDocs = documents.filter((d) => d.category === value)
        const expectedCount = DEFAULT_EXPECTED_COUNTS[value]
        const defaultItems = DEFAULT_CATEGORY_ITEMS[value]

        // Build items list from defaults
        const items: BucketItem[] = defaultItems.map((itemName, index) => {
          // Try to find a matching document
          const matchedDoc = categoryDocs.find(
            (doc) => doc.name.toLowerCase().includes(itemName.toLowerCase().split(' ')[0] || '')
          )

          return {
            id: `${value}-${index}`,
            name: itemName,
            status: matchedDoc
              ? 'uploaded' as const
              : categoryDocs.length > index
                ? 'uploaded' as const
                : 'not_started' as const,
            documentId: matchedDoc?.id || (categoryDocs[index]?.id),
            documentName: matchedDoc?.name || (categoryDocs[index]?.name),
          }
        })

        // Mark additional uploaded items if we have more docs than default items
        if (categoryDocs.length > defaultItems.length) {
          const extraDocs = categoryDocs.slice(defaultItems.length)
          extraDocs.forEach((doc, index) => {
            items.push({
              id: `${value}-extra-${index}`,
              name: doc.name,
              status: 'uploaded',
              documentId: doc.id,
              documentName: doc.name,
            })
          })
        }

        return {
          category: value,
          label,
          uploadedCount: categoryDocs.length,
          expectedCount,
          documents: categoryDocs,
          items,
        }
      })

      setBuckets(categoryBuckets)
    } catch (error) {
      console.error('Error loading buckets:', error)
      toast.error('Failed to load document categories')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    loadBuckets()
  }, [loadBuckets])

  /**
   * Handle bucket card click - toggle expansion
   */
  const handleToggleExpand = useCallback((category: DocumentCategory) => {
    setExpandedCategory((prev) => (prev === category ? null : category))
  }, [])

  /**
   * Handle upload for a specific item
   */
  const handleUploadItem = useCallback((itemId: string, category: DocumentCategory) => {
    pendingUploadItemRef.current = { itemId, category }
    fileInputRef.current?.click()
  }, [])

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !pendingUploadItemRef.current) return

      const { itemId, category } = pendingUploadItemRef.current
      setUploadingItemId(itemId)

      try {
        const result = await uploadDocument(file, {
          projectId,
          category,
        })

        if (result.success) {
          toast.success(`Uploaded "${file.name}"`)
          await loadBuckets() // Refresh to show updated progress
        } else {
          toast.error(result.error || 'Upload failed')
        }
      } catch (error) {
        console.error('Upload error:', error)
        toast.error('Failed to upload file')
      } finally {
        setUploadingItemId(null)
        pendingUploadItemRef.current = null
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [projectId, loadBuckets]
  )

  /**
   * Handle bulk upload for a category
   */
  const handleBulkUpload = useCallback((category: DocumentCategory) => {
    pendingUploadItemRef.current = { itemId: 'bulk', category }
    fileInputRef.current?.click()
  }, [])

  // Get the expanded bucket
  const expandedBucket = buckets.find((b) => b.category === expandedCategory)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading categories...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Action bar */}
      <div className="flex items-center justify-end border-b px-4 py-2">
        <Button variant="outline" size="sm" onClick={loadBuckets}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Buckets grid */}
        <div
          className={cn(
            'flex-1 overflow-auto p-6 transition-all',
            expandedCategory && 'w-1/2'
          )}
        >
          {buckets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">No categories configured</p>
                <p className="text-sm text-muted-foreground">
                  Upload documents to get started
                </p>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-4',
                expandedCategory
                  ? 'grid-cols-1 lg:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {buckets.map((bucket) => (
                <BucketCard
                  key={bucket.category}
                  category={bucket.category}
                  label={bucket.label}
                  uploadedCount={bucket.uploadedCount}
                  expectedCount={bucket.expectedCount}
                  items={bucket.items}
                  isExpanded={expandedCategory === bucket.category}
                  onToggleExpand={() => handleToggleExpand(bucket.category)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Expanded item list panel */}
        {expandedCategory && expandedBucket && (
          <div className="w-1/2 border-l bg-muted/30">
            <BucketItemList
              category={expandedBucket.category}
              label={expandedBucket.label}
              items={expandedBucket.items}
              uploadedCount={expandedBucket.uploadedCount}
              expectedCount={expandedBucket.expectedCount}
              uploadingItemId={uploadingItemId}
              onUploadItem={(itemId) => handleUploadItem(itemId, expandedBucket.category)}
              onBulkUpload={() => handleBulkUpload(expandedBucket.category)}
              onClose={() => setExpandedCategory(null)}
            />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
      />
    </div>
  )
}
