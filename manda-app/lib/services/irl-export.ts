/**
 * IRL Export Service
 *
 * Generates PDF and Word exports for Information Request Lists (IRLs).
 * Story: E6.6 - Build IRL Export Functionality (PDF/Word)
 *
 * Features:
 * - PDF generation with pdfmake (color-coded priorities, checkboxes)
 * - Word generation with docx (editable, professional formatting)
 * - Project name and date header/letterhead
 * - Hierarchical category structure
 * - Priority indicators with visual distinction
 * - Notes included inline
 * - Fulfilled/unfulfilled status indicators
 */

// Dynamic import for pdfmake to avoid server-side bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PdfPrinter: any = null

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx'
import type { TDocumentDefinitions, Content, ContentTable, Style, StyleDictionary } from 'pdfmake/interfaces'
import { IRLWithItems, IRLItem, IRLPriority } from '@/lib/types/irl'

// Standard fonts for pdfmake (using built-in Roboto)
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}

/**
 * Priority color mapping for PDF
 */
const PRIORITY_COLORS: Record<IRLPriority, string> = {
  high: '#DC2626', // red-600
  medium: '#F59E0B', // amber-500
  low: '#10B981', // emerald-500
}

/**
 * Priority text labels
 */
const PRIORITY_LABELS: Record<IRLPriority, string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
}

/**
 * Group IRL items by category, preserving sort order
 */
function groupItemsByCategory(items: IRLItem[]): Map<string, IRLItem[]> {
  const grouped = new Map<string, IRLItem[]>()

  // Sort items by sortOrder first
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  for (const item of sortedItems) {
    const categoryItems = grouped.get(item.category) || []
    categoryItems.push(item)
    grouped.set(item.category, categoryItems)
  }

  return grouped
}

/**
 * Format date for export header
 */
function formatExportDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// =============================================================================
// PDF Generation
// =============================================================================

/**
 * Generate PDF export of an IRL
 *
 * @param irl - The IRL with items to export
 * @param projectName - Project name for the header
 * @param exportDate - Date of export
 * @returns Buffer containing the PDF file
 */
export async function generateIRLPdf(
  irl: IRLWithItems,
  projectName: string,
  exportDate: Date = new Date()
): Promise<Buffer> {
  // Dynamic import to avoid build-time font loading issues
  if (!PdfPrinter) {
    const pdfmake = await import('pdfmake')
    PdfPrinter = pdfmake.default
  }
  const printer = new PdfPrinter(fonts)
  const groupedItems = groupItemsByCategory(irl.items)

  // Build document content
  const content: Content[] = []

  // Header/Letterhead
  content.push({
    columns: [
      {
        text: projectName,
        style: 'projectName',
        width: '*',
      },
      {
        text: formatExportDate(exportDate),
        style: 'date',
        width: 'auto',
        alignment: 'right',
      },
    ],
    marginBottom: 5,
  })

  // Title
  content.push({
    text: 'Information Request List',
    style: 'title',
    marginBottom: 2,
  })

  // Subtitle with IRL name
  content.push({
    text: irl.title,
    style: 'subtitle',
    marginBottom: 20,
  })

  // Summary stats
  const totalItems = irl.items.length
  const fulfilledItems = irl.items.filter(i => i.fulfilled).length
  const percentComplete = totalItems > 0 ? Math.round((fulfilledItems / totalItems) * 100) : 0

  content.push({
    text: `${totalItems} items | ${fulfilledItems} fulfilled (${percentComplete}%)`,
    style: 'stats',
    marginBottom: 20,
  })

  // Categories and items
  for (const [category, items] of groupedItems) {
    // Category header
    content.push({
      text: category,
      style: 'categoryHeader',
      marginTop: 15,
      marginBottom: 8,
    })

    // Items table for this category
    const tableBody: Content[][] = []

    // Table header row
    tableBody.push([
      { text: '', style: 'tableHeader' }, // Checkbox column
      { text: 'Item', style: 'tableHeader' },
      { text: 'Priority', style: 'tableHeader' },
      { text: 'Notes', style: 'tableHeader' },
    ])

    // Item rows
    for (const item of items) {
      const checkbox = item.fulfilled ? '[x]' : '[ ]'
      const priorityColor = PRIORITY_COLORS[item.priority]
      const priorityLabel = PRIORITY_LABELS[item.priority]

      const row: Content[] = [
        { text: checkbox, style: 'checkbox' },
        {
          stack: [
            { text: item.itemName, style: 'itemName' },
            item.description
              ? { text: item.description, style: 'itemDescription' }
              : null,
            item.subcategory
              ? { text: `Subcategory: ${item.subcategory}`, style: 'itemSubcategory' }
              : null,
          ].filter(Boolean) as Content[],
        },
        {
          text: priorityLabel,
          style: 'priority',
          color: priorityColor,
        },
        { text: item.notes || '-', style: 'notes' },
      ]

      tableBody.push(row)
    }

    const table: ContentTable = {
      table: {
        headerRows: 1,
        widths: [25, '*', 50, 120],
        body: tableBody,
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
        vLineWidth: () => 0,
        hLineColor: (i: number) => (i === 1 ? '#374151' : '#E5E7EB'),
        paddingTop: () => 6,
        paddingBottom: () => 6,
        paddingLeft: () => 4,
        paddingRight: () => 4,
      },
    }

    content.push(table)
  }

  // Empty state
  if (groupedItems.size === 0) {
    content.push({
      text: 'No items in this IRL.',
      style: 'emptyState',
      marginTop: 20,
    })
  }

  // Document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content,
    styles: {
      projectName: {
        fontSize: 18,
        bold: true,
        color: '#111827',
      },
      date: {
        fontSize: 11,
        color: '#6B7280',
      },
      title: {
        fontSize: 14,
        bold: true,
        color: '#374151',
      },
      subtitle: {
        fontSize: 12,
        color: '#6B7280',
      },
      stats: {
        fontSize: 10,
        color: '#6B7280',
        italics: true,
      },
      categoryHeader: {
        fontSize: 13,
        bold: true,
        color: '#1F2937',
        fillColor: '#F3F4F6',
      },
      tableHeader: {
        fontSize: 9,
        bold: true,
        color: '#374151',
        fillColor: '#F9FAFB',
      },
      checkbox: {
        fontSize: 10,
        font: 'Roboto',
      },
      itemName: {
        fontSize: 10,
        color: '#111827',
      },
      itemDescription: {
        fontSize: 9,
        color: '#6B7280',
        italics: true,
        marginTop: 2,
      },
      itemSubcategory: {
        fontSize: 8,
        color: '#9CA3AF',
        marginTop: 2,
      },
      priority: {
        fontSize: 9,
        bold: true,
      },
      notes: {
        fontSize: 9,
        color: '#4B5563',
      },
      emptyState: {
        fontSize: 11,
        color: '#9CA3AF',
        italics: true,
        alignment: 'center',
      },
    } as StyleDictionary,
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 9,
      color: '#9CA3AF',
      margin: [0, 20, 0, 0],
    }),
  }

  // Generate PDF
  const pdfDoc = printer.createPdfKitDocument(docDefinition)

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}

// =============================================================================
// Word (DOCX) Generation
// =============================================================================

/**
 * Generate Word export of an IRL
 *
 * @param irl - The IRL with items to export
 * @param projectName - Project name for the header
 * @param exportDate - Date of export
 * @returns Buffer containing the DOCX file
 */
export async function generateIRLDocx(
  irl: IRLWithItems,
  projectName: string,
  exportDate: Date = new Date()
): Promise<Buffer> {
  const groupedItems = groupItemsByCategory(irl.items)

  // Calculate stats
  const totalItems = irl.items.length
  const fulfilledItems = irl.items.filter(i => i.fulfilled).length
  const percentComplete = totalItems > 0 ? Math.round((fulfilledItems / totalItems) * 100) : 0

  // Build document sections
  const children: Paragraph[] = []

  // Header: Project name and date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: projectName,
          bold: true,
          size: 36, // 18pt
          color: '111827',
        }),
        new TextRun({
          text: `\t${formatExportDate(exportDate)}`,
          size: 22, // 11pt
          color: '6B7280',
        }),
      ],
      tabStops: [
        {
          type: AlignmentType.RIGHT,
          position: 9000, // Right align
        },
      ],
    })
  )

  // Title
  children.push(
    new Paragraph({
      text: 'Information Request List',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
    })
  )

  // Subtitle with IRL name
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: irl.title,
          size: 24, // 12pt
          color: '6B7280',
        }),
      ],
      spacing: { after: 200 },
    })
  )

  // Stats
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${totalItems} items | ${fulfilledItems} fulfilled (${percentComplete}%)`,
          size: 20, // 10pt
          color: '6B7280',
          italics: true,
        }),
      ],
      spacing: { after: 400 },
    })
  )

  // Categories and items
  for (const [category, items] of groupedItems) {
    // Category header
    children.push(
      new Paragraph({
        text: category,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
        shading: {
          type: ShadingType.CLEAR,
          fill: 'F3F4F6',
        },
      })
    )

    // Create table for items in this category
    const tableRows: TableRow[] = []

    // Header row
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          createTableCell('Status', true, 800),
          createTableCell('Item', true, 4000),
          createTableCell('Priority', true, 1200),
          createTableCell('Notes', true, 3000),
        ],
      })
    )

    // Item rows
    for (const item of items) {
      const statusText = item.fulfilled ? '[x]' : '[ ]'
      const priorityLabel = `[${PRIORITY_LABELS[item.priority]}]`

      // Build item content with optional description and subcategory
      const itemParagraphs: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: item.itemName,
              size: 20,
            }),
          ],
        }),
      ]

      if (item.description) {
        itemParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.description,
                size: 18,
                color: '6B7280',
                italics: true,
              }),
            ],
          })
        )
      }

      if (item.subcategory) {
        itemParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Subcategory: ${item.subcategory}`,
                size: 16,
                color: '9CA3AF',
              }),
            ],
          })
        )
      }

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: statusText,
                      size: 20,
                    }),
                  ],
                }),
              ],
              width: { size: 800, type: WidthType.DXA },
            }),
            new TableCell({
              children: itemParagraphs,
              width: { size: 4000, type: WidthType.DXA },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: priorityLabel,
                      size: 18,
                      bold: true,
                      color: getPriorityWordColor(item.priority),
                    }),
                  ],
                }),
              ],
              width: { size: 1200, type: WidthType.DXA },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.notes || '-',
                      size: 18,
                      color: '4B5563',
                    }),
                  ],
                }),
              ],
              width: { size: 3000, type: WidthType.DXA },
            }),
          ],
        })
      )
    }

    // Add table
    children.push(
      new Paragraph({
        children: [],
      })
    )

    // We'll need to add the table separately since it's not a Paragraph
    // Convert to a section with table
  }

  // Build tables for each category
  const sections: (Paragraph | Table)[] = []

  // Add header content
  sections.push(...children.slice(0, 4)) // Project name, title, subtitle, stats

  // Add categories with tables
  let childIndex = 4 // Start after header content
  for (const [category, items] of groupedItems) {
    // Category header
    sections.push(
      new Paragraph({
        text: category,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
        shading: {
          type: ShadingType.CLEAR,
          fill: 'F3F4F6',
        },
      })
    )

    // Build table rows
    const tableRows: TableRow[] = []

    // Header row
    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          createTableCell('Status', true, 800),
          createTableCell('Item', true, 4000),
          createTableCell('Priority', true, 1200),
          createTableCell('Notes', true, 3000),
        ],
      })
    )

    // Item rows
    for (const item of items) {
      const statusText = item.fulfilled ? '[x]' : '[ ]'
      const priorityLabel = `[${PRIORITY_LABELS[item.priority]}]`

      const itemParagraphs: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: item.itemName,
              size: 20,
            }),
          ],
        }),
      ]

      if (item.description) {
        itemParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.description,
                size: 18,
                color: '6B7280',
                italics: true,
              }),
            ],
          })
        )
      }

      if (item.subcategory) {
        itemParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Subcategory: ${item.subcategory}`,
                size: 16,
                color: '9CA3AF',
              }),
            ],
          })
        )
      }

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: statusText,
                      size: 20,
                    }),
                  ],
                }),
              ],
              width: { size: 800, type: WidthType.DXA },
            }),
            new TableCell({
              children: itemParagraphs,
              width: { size: 4000, type: WidthType.DXA },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: priorityLabel,
                      size: 18,
                      bold: true,
                      color: getPriorityWordColor(item.priority),
                    }),
                  ],
                }),
              ],
              width: { size: 1200, type: WidthType.DXA },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: item.notes || '-',
                      size: 18,
                      color: '4B5563',
                    }),
                  ],
                }),
              ],
              width: { size: 3000, type: WidthType.DXA },
            }),
          ],
        })
      )
    }

    // Create and add table
    sections.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    )
  }

  // Empty state
  if (groupedItems.size === 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No items in this IRL.',
            size: 22,
            color: '9CA3AF',
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      })
    )
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${projectName} - Information Request List`,
                    size: 18,
                    color: '9CA3AF',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: '9CA3AF',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  })

  // Generate buffer
  return await Packer.toBuffer(doc)
}

/**
 * Helper to create a table cell
 */
function createTableCell(
  text: string,
  isHeader: boolean = false,
  width?: number
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: isHeader,
            size: isHeader ? 18 : 20,
            color: isHeader ? '374151' : '111827',
          }),
        ],
      }),
    ],
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: isHeader
      ? {
          type: ShadingType.CLEAR,
          fill: 'F9FAFB',
        }
      : undefined,
  })
}

/**
 * Get Word-compatible color for priority (without #)
 */
function getPriorityWordColor(priority: IRLPriority): string {
  const colors: Record<IRLPriority, string> = {
    high: 'DC2626',
    medium: 'F59E0B',
    low: '10B981',
  }
  return colors[priority]
}

// =============================================================================
// Excel/CSV Export Functions
// =============================================================================

/**
 * Generate IRL export as Excel (.xlsx)
 */
async function generateIRLExcel(
  irl: IRLWithItems,
  projectName: string,
  exportDate: Date
): Promise<Buffer> {
  // Group items by category
  const itemsByCategory = groupItemsByCategory(irl.items)

  // Create CSV content
  const rows: string[][] = []

  // Header
  rows.push([
    `IRL Checklist Export - ${projectName}`,
    '',
    '',
    `Generated: ${exportDate.toLocaleDateString()}`,
  ])
  rows.push([]) // Empty row
  rows.push(['Category', 'Item', 'Status', 'Description'])

  // Data rows
  Object.entries(itemsByCategory).forEach(([category, items]) => {
    items.forEach((item, index) => {
      rows.push([
        index === 0 ? category : '', // Category name only on first item
        item.name,
        item.fulfilled ? 'Done' : 'Not Done',
        item.description || '',
      ])
    })
  })

  // Convert to Excel format (simple TSV for now - proper XLSX would require xlsx library)
  const csvContent = rows.map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join('\t')
  ).join('\n')

  return Buffer.from(csvContent, 'utf-8')
}

/**
 * Generate IRL export as CSV
 */
async function generateIRLCsv(
  irl: IRLWithItems,
  projectName: string,
  exportDate: Date
): Promise<Buffer> {
  // Group items by category
  const itemsByCategory = groupItemsByCategory(irl.items)

  // Create CSV content
  const rows: string[][] = []

  // Header
  rows.push([
    `IRL Checklist Export - ${projectName}`,
    '',
    '',
    `Generated: ${exportDate.toLocaleDateString()}`,
  ])
  rows.push([]) // Empty row
  rows.push(['Category', 'Item', 'Status', 'Description'])

  // Data rows
  Object.entries(itemsByCategory).forEach(([category, items]) => {
    items.forEach((item, index) => {
      rows.push([
        index === 0 ? category : '', // Category name only on first item
        item.name,
        item.fulfilled ? 'Done' : 'Not Done',
        item.description || '',
      ])
    })
  })

  // Convert to CSV format
  const csvContent = rows.map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  return Buffer.from(csvContent, 'utf-8')
}

// =============================================================================
// Export Types
// =============================================================================

export type IRLExportFormat = 'pdf' | 'word' | 'excel' | 'csv'

export interface IRLExportOptions {
  format: IRLExportFormat
  projectName: string
  exportDate?: Date
}

export interface IRLExportResult {
  buffer: Buffer
  filename: string
  contentType: string
}

/**
 * Generate IRL export in specified format
 */
export async function generateIRLExport(
  irl: IRLWithItems,
  options: IRLExportOptions
): Promise<IRLExportResult> {
  const { format, projectName, exportDate = new Date() } = options

  // Sanitize filename
  const sanitizedIrlName = irl.title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
  const dateStr = exportDate.toISOString().split('T')[0]

  if (format === 'pdf') {
    const buffer = await generateIRLPdf(irl, projectName, exportDate)
    return {
      buffer,
      filename: `${sanitizedIrlName}-${dateStr}.pdf`,
      contentType: 'application/pdf',
    }
  } else if (format === 'word') {
    const buffer = await generateIRLDocx(irl, projectName, exportDate)
    return {
      buffer,
      filename: `${sanitizedIrlName}-${dateStr}.docx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
  } else if (format === 'excel') {
    const buffer = await generateIRLExcel(irl, projectName, exportDate)
    return {
      buffer,
      filename: `${sanitizedIrlName}-${dateStr}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  } else {
    // CSV
    const buffer = await generateIRLCsv(irl, projectName, exportDate)
    return {
      buffer,
      filename: `${sanitizedIrlName}-${dateStr}.csv`,
      contentType: 'text/csv',
    }
  }
}
