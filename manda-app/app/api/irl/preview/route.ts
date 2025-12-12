/**
 * IRL Preview API
 * POST /api/irl/preview
 *
 * Previews an uploaded Excel/CSV file without importing it
 * Returns detected structure for user verification
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseExcelIRL, parseCSVIRL, validateIRLFile } from '@/lib/services/irl-import'

/**
 * POST /api/irl/preview
 * Preview IRL file structure without importing
 */
export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file
    const validation = validateIRLFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse file based on MIME type
    let preview
    try {
      if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx')) {
        preview = await parseExcelIRL(buffer)
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        preview = await parseCSVIRL(buffer)
      } else {
        return NextResponse.json(
          { error: 'Unsupported file format' },
          { status: 400 }
        )
      }
    } catch (parseError) {
      console.error('[IRL Preview API] Parse error:', parseError)
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : 'Failed to parse file',
        },
        { status: 400 }
      )
    }

    // Return preview data
    return NextResponse.json({
      success: true,
      preview: {
        totalItems: preview.totalItems,
        totalCategories: preview.categories.length,
        totalSubcategories: preview.subcategories.length,
        categories: preview.categories,
        subcategories: preview.subcategories,
        warnings: preview.warnings,
        // Group items by category for preview
        structure: groupItemsByCategory(preview.items),
      },
    })
  } catch (error) {
    console.error('[IRL Preview API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Group items by category and subcategory for preview display
 */
function groupItemsByCategory(items: any[]) {
  const grouped: Record<string, any> = {}

  items.forEach((item) => {
    const category = item.category || 'Uncategorized'

    if (!grouped[category]) {
      grouped[category] = {
        name: category,
        subcategories: {},
        items: [],
      }
    }

    if (item.subcategory) {
      if (!grouped[category].subcategories[item.subcategory]) {
        grouped[category].subcategories[item.subcategory] = {
          name: item.subcategory,
          items: [],
        }
      }
      grouped[category].subcategories[item.subcategory].items.push({
        name: item.itemName,
        priority: item.priority,
      })
    } else {
      grouped[category].items.push({
        name: item.itemName,
        priority: item.priority,
      })
    }
  })

  return Object.values(grouped)
}
