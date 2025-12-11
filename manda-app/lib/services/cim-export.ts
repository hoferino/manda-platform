/**
 * CIM Export Service
 *
 * Generates PowerPoint and LLM prompt exports for CIMs.
 * Story: E9.14 - Wireframe PowerPoint Export
 * Story: E9.15 - LLM Prompt Export
 *
 * Features:
 * - Client-side PPTX generation with pptxgenjs
 * - Wireframe styling (muted colors, dashed placeholders)
 * - Component-to-slide mapping (title, subtitle, text, bullet, chart, image, table)
 * - Visual concept metadata in placeholders
 * - 16:9 aspect ratio standard presentation format
 * - LLM prompt generation with structured XML format
 * - Copy to clipboard and download as text file
 */

import pptxgen from 'pptxgenjs'
import type {
  CIM,
  Slide,
  SlideComponent,
  ComponentType,
  ChartType,
  VisualConcept,
  BuyerPersona,
  OutlineSection,
  ChartRecommendation,
} from '@/lib/types/cim'

// ============================================================================
// Wireframe Style Constants (AC #2, #4)
// ============================================================================

/**
 * Wireframe color palette - muted, professional appearance
 */
export const WIREFRAME_COLORS = {
  background: 'FFFFFF',
  text: '333333',
  textMuted: '6B7280',
  placeholder: 'E5E7EB',
  placeholderBorder: '9CA3AF',
  accent: '6B7280',
  headerBg: 'F3F4F6',
} as const

/**
 * Font configuration for wireframe slides
 */
export const WIREFRAME_FONTS = {
  title: {
    fontFace: 'Arial',
    fontSize: 28,
    bold: true,
    color: WIREFRAME_COLORS.text,
  },
  subtitle: {
    fontFace: 'Arial',
    fontSize: 18,
    bold: false,
    color: WIREFRAME_COLORS.textMuted,
  },
  body: {
    fontFace: 'Arial',
    fontSize: 14,
    bold: false,
    color: WIREFRAME_COLORS.text,
  },
  bullet: {
    fontFace: 'Arial',
    fontSize: 14,
    bold: false,
    color: WIREFRAME_COLORS.text,
  },
  placeholder: {
    fontFace: 'Arial',
    fontSize: 12,
    bold: false,
    color: WIREFRAME_COLORS.textMuted,
    italic: true,
  },
  placeholderLabel: {
    fontFace: 'Arial',
    fontSize: 10,
    bold: true,
    color: WIREFRAME_COLORS.accent,
  },
} as const

/**
 * Slide dimensions (16:9 aspect ratio)
 */
export const SLIDE_DIMENSIONS = {
  width: 10, // inches
  height: 5.625, // inches (16:9)
  margin: 0.5,
} as const

/**
 * Layout positions for different component types
 */
export const LAYOUT = {
  title: {
    x: SLIDE_DIMENSIONS.margin,
    y: 0.3,
    w: SLIDE_DIMENSIONS.width - 2 * SLIDE_DIMENSIONS.margin,
    h: 0.8,
  },
  subtitle: {
    x: SLIDE_DIMENSIONS.margin,
    y: 1.1,
    w: SLIDE_DIMENSIONS.width - 2 * SLIDE_DIMENSIONS.margin,
    h: 0.5,
  },
  content: {
    x: SLIDE_DIMENSIONS.margin,
    y: 1.7,
    w: SLIDE_DIMENSIONS.width - 2 * SLIDE_DIMENSIONS.margin,
    h: 3.5,
  },
  placeholder: {
    minHeight: 1.5,
    maxHeight: 2.5,
  },
} as const

// ============================================================================
// Chart Type Labels
// ============================================================================

const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar Chart',
  line: 'Line Chart',
  pie: 'Pie Chart',
  area: 'Area Chart',
  table: 'Data Table',
}

// ============================================================================
// Filename Sanitization (AC #7)
// ============================================================================

/**
 * Sanitize filename for PPTX export
 * Removes special characters that could cause issues: / \ : * ? " < > |
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100) // Limit length
}

/**
 * Generate export filename for CIM
 * Format: "{CIM Name} - Wireframe.pptx"
 */
export function generateExportFilename(cimTitle: string): string {
  const sanitized = sanitizeFilename(cimTitle) || 'CIM'
  return `${sanitized} - Wireframe.pptx`
}

// ============================================================================
// Component Renderers
// ============================================================================

interface TextPosition {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Add title component to slide
 */
function addTitleComponent(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  slide.addText(component.content || 'Untitled', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    ...WIREFRAME_FONTS.title,
    valign: 'top',
  })
}

/**
 * Add subtitle component to slide
 */
function addSubtitleComponent(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  slide.addText(component.content || 'Subtitle', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    ...WIREFRAME_FONTS.subtitle,
    valign: 'top',
  })
}

/**
 * Add text paragraph component to slide
 */
function addTextComponent(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  slide.addText(component.content || '', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    ...WIREFRAME_FONTS.body,
    valign: 'top',
    wrap: true,
  })
}

/**
 * Add bullet point component to slide
 */
function addBulletComponent(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  slide.addText(component.content || '', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    ...WIREFRAME_FONTS.bullet,
    bullet: { type: 'bullet', indent: 10 },
    valign: 'top',
  })
}

/**
 * Add chart placeholder with wireframe styling (AC #4)
 */
function addChartPlaceholder(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  const chartType = (component.metadata?.chartType as ChartType) || 'bar'
  const dataDescription = (component.metadata?.dataDescription as string) || component.content
  const chartLabel = CHART_TYPE_LABELS[chartType] || 'Chart'

  // Placeholder box with dashed border
  slide.addShape('rect', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: Math.max(position.h, LAYOUT.placeholder.minHeight),
    fill: { color: WIREFRAME_COLORS.placeholder },
    line: {
      color: WIREFRAME_COLORS.placeholderBorder,
      dashType: 'dash',
      width: 1.5,
    },
  })

  // Chart type label at top
  slide.addText(`[${chartLabel}]`, {
    x: position.x,
    y: position.y + 0.2,
    w: position.w,
    h: 0.4,
    ...WIREFRAME_FONTS.placeholderLabel,
    align: 'center',
    valign: 'middle',
  })

  // Data description
  if (dataDescription) {
    slide.addText(dataDescription, {
      x: position.x + 0.2,
      y: position.y + 0.6,
      w: position.w - 0.4,
      h: Math.max(position.h - 0.8, 0.5),
      ...WIREFRAME_FONTS.placeholder,
      align: 'center',
      valign: 'middle',
      wrap: true,
    })
  }
}

/**
 * Add image placeholder with wireframe styling (AC #4)
 */
function addImagePlaceholder(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  const suggestion = component.content || 'Image placeholder'

  // Placeholder box with dashed border
  slide.addShape('rect', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: Math.max(position.h, LAYOUT.placeholder.minHeight),
    fill: { color: WIREFRAME_COLORS.placeholder },
    line: {
      color: WIREFRAME_COLORS.placeholderBorder,
      dashType: 'dash',
      width: 1.5,
    },
  })

  // Image icon placeholder (simple rectangle with X)
  const centerX = position.x + position.w / 2
  const centerY = position.y + position.h / 2 - 0.2

  // Draw simple image icon representation
  slide.addShape('rect', {
    x: centerX - 0.4,
    y: centerY - 0.35,
    w: 0.8,
    h: 0.6,
    fill: { color: WIREFRAME_COLORS.placeholderBorder },
    line: { color: WIREFRAME_COLORS.accent, width: 1 },
  })

  // Image type label
  slide.addText('[Image]', {
    x: position.x,
    y: position.y + 0.15,
    w: position.w,
    h: 0.35,
    ...WIREFRAME_FONTS.placeholderLabel,
    align: 'center',
    valign: 'middle',
  })

  // Image suggestion text
  slide.addText(suggestion, {
    x: position.x + 0.2,
    y: position.y + position.h - 0.6,
    w: position.w - 0.4,
    h: 0.5,
    ...WIREFRAME_FONTS.placeholder,
    align: 'center',
    valign: 'middle',
    wrap: true,
  })
}

/**
 * Add table wireframe placeholder (AC #4)
 */
function addTablePlaceholder(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  const rows = Math.min((component.metadata?.rows as number) || 4, 8)
  const columns = Math.min((component.metadata?.columns as number) || 4, 6)
  const description = component.content || 'Data Table'

  // Calculate table dimensions
  const tableHeight = Math.max(position.h, LAYOUT.placeholder.minHeight)
  const rowHeight = (tableHeight - 0.4) / rows
  const colWidth = (position.w - 0.4) / columns

  // Outer border with dashed styling
  slide.addShape('rect', {
    x: position.x,
    y: position.y,
    w: position.w,
    h: tableHeight,
    fill: { color: WIREFRAME_COLORS.placeholder },
    line: {
      color: WIREFRAME_COLORS.placeholderBorder,
      dashType: 'dash',
      width: 1.5,
    },
  })

  // Table grid representation
  const tableData: pptxgen.TableRow[] = []

  // Header row
  const headerRow: pptxgen.TableCell[] = []
  for (let col = 0; col < columns; col++) {
    headerRow.push({
      text: col === 0 ? 'Column' : '',
      options: {
        fill: { color: WIREFRAME_COLORS.headerBg },
        border: { type: 'solid', color: WIREFRAME_COLORS.placeholderBorder, pt: 0.5 },
        fontSize: 8,
        color: WIREFRAME_COLORS.textMuted,
        align: 'center',
        valign: 'middle',
      },
    })
  }
  tableData.push(headerRow)

  // Data rows
  for (let row = 1; row < rows; row++) {
    const dataRow: pptxgen.TableCell[] = []
    for (let col = 0; col < columns; col++) {
      dataRow.push({
        text: '',
        options: {
          fill: { color: 'FFFFFF' },
          border: { type: 'solid', color: WIREFRAME_COLORS.placeholderBorder, pt: 0.5 },
        },
      })
    }
    tableData.push(dataRow)
  }

  slide.addTable(tableData, {
    x: position.x + 0.2,
    y: position.y + 0.2,
    w: position.w - 0.4,
    h: tableHeight - 0.6,
    colW: Array(columns).fill(colWidth),
    rowH: Array(rows).fill(rowHeight),
  })

  // Table description
  slide.addText(`[Table: ${rows}x${columns}] ${description}`, {
    x: position.x,
    y: position.y + tableHeight - 0.25,
    w: position.w,
    h: 0.25,
    fontSize: 8,
    color: WIREFRAME_COLORS.textMuted,
    italic: true,
    align: 'center',
  })
}

// ============================================================================
// Visual Concept Integration (AC #4)
// ============================================================================

/**
 * Add visual concept metadata to slide as notes/annotations
 */
function addVisualConceptNotes(
  slide: pptxgen.Slide,
  visualConcept: VisualConcept | null
): void {
  if (!visualConcept) return

  const notes: string[] = []

  if (visualConcept.layout_type) {
    notes.push(`Layout: ${visualConcept.layout_type.replace('_', ' ')}`)
  }

  if (visualConcept.chart_recommendations?.length) {
    const chartNotes = visualConcept.chart_recommendations
      .map((rec) => `- ${CHART_TYPE_LABELS[rec.type] || rec.type}: ${rec.purpose}`)
      .join('\n')
    notes.push(`\nChart Recommendations:\n${chartNotes}`)
  }

  if (visualConcept.image_suggestions?.length) {
    notes.push(`\nImage Suggestions:\n${visualConcept.image_suggestions.map((s) => `- ${s}`).join('\n')}`)
  }

  if (visualConcept.notes) {
    notes.push(`\nDesign Notes: ${visualConcept.notes}`)
  }

  if (notes.length > 0) {
    slide.addNotes(notes.join('\n'))
  }
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Render a single slide component to PPTX (AC #5)
 */
function renderComponent(
  slide: pptxgen.Slide,
  component: SlideComponent,
  position: TextPosition
): void {
  switch (component.type) {
    case 'title':
      addTitleComponent(slide, component, position)
      break
    case 'subtitle':
      addSubtitleComponent(slide, component, position)
      break
    case 'text':
      addTextComponent(slide, component, position)
      break
    case 'bullet':
      addBulletComponent(slide, component, position)
      break
    case 'chart':
      addChartPlaceholder(slide, component, position)
      break
    case 'image':
      addImagePlaceholder(slide, component, position)
      break
    case 'table':
      addTablePlaceholder(slide, component, position)
      break
    default:
      // Fallback to text rendering
      addTextComponent(slide, component, position)
  }
}

/**
 * Calculate component heights and positions for a slide
 */
function calculateComponentLayout(components: SlideComponent[]): Map<number, TextPosition> {
  const positions = new Map<number, TextPosition>()

  // Find title and subtitle components
  const titleIndex = components.findIndex((c) => c.type === 'title')
  const subtitleIndex = components.findIndex((c) => c.type === 'subtitle')

  // Position title
  if (titleIndex !== -1) {
    positions.set(titleIndex, LAYOUT.title)
  }

  // Position subtitle
  if (subtitleIndex !== -1) {
    positions.set(subtitleIndex, LAYOUT.subtitle)
  }

  // Calculate remaining content area
  let contentStartY: number = LAYOUT.content.y
  if (titleIndex === -1 && subtitleIndex === -1) {
    contentStartY = 0.5 // Start higher if no title/subtitle
  }

  const contentComponents = components.filter(
    (_, idx) => idx !== titleIndex && idx !== subtitleIndex
  )
  const contentHeight = SLIDE_DIMENSIONS.height - contentStartY - SLIDE_DIMENSIONS.margin

  // Distribute remaining components
  const componentCount = contentComponents.length || 1
  const heightPerComponent = Math.min(contentHeight / componentCount, LAYOUT.placeholder.maxHeight)

  let currentY = contentStartY
  components.forEach((component, idx) => {
    if (idx === titleIndex || idx === subtitleIndex) return
    if (positions.has(idx)) return

    // Determine component height based on type
    let componentHeight = heightPerComponent
    if (component.type === 'text' || component.type === 'bullet') {
      componentHeight = Math.min(heightPerComponent, 0.4)
    } else if (component.type === 'chart' || component.type === 'image' || component.type === 'table') {
      componentHeight = Math.max(heightPerComponent, LAYOUT.placeholder.minHeight)
    }

    positions.set(idx, {
      x: LAYOUT.content.x,
      y: currentY,
      w: LAYOUT.content.w,
      h: componentHeight,
    })

    currentY += componentHeight + 0.15 // Small gap between components
  })

  return positions
}

/**
 * Generate a single PPTX slide from CIM slide data (AC #3)
 */
function generateSlide(pres: pptxgen, cimSlide: Slide, slideNumber: number): void {
  const slide = pres.addSlide()

  // Set slide background
  slide.background = { color: WIREFRAME_COLORS.background }

  // Add slide number (small, bottom right)
  slide.addText(`${slideNumber}`, {
    x: SLIDE_DIMENSIONS.width - 0.5,
    y: SLIDE_DIMENSIONS.height - 0.35,
    w: 0.3,
    h: 0.25,
    fontSize: 9,
    color: WIREFRAME_COLORS.textMuted,
    align: 'right',
  })

  // Calculate positions for all components
  const positions = calculateComponentLayout(cimSlide.components)

  // Render each component
  cimSlide.components.forEach((component, idx) => {
    const position = positions.get(idx)
    if (position) {
      renderComponent(slide, component, position)
    }
  })

  // Add visual concept as slide notes
  addVisualConceptNotes(slide, cimSlide.visual_concept)
}

/**
 * Export CIM as wireframe PPTX (AC #2, #3, #5, #6)
 *
 * @param cim - The CIM to export
 * @returns Promise<Blob> - The generated PPTX file as a Blob
 */
export async function exportWireframePPTX(cim: CIM): Promise<Blob> {
  // Create new presentation
  const pres = new pptxgen()

  // Configure presentation properties
  pres.title = cim.title
  pres.subject = 'CIM Wireframe Export'
  pres.author = 'Manda Platform'
  pres.company = 'Manda'

  // Set 16:9 layout
  pres.defineLayout({
    name: 'WIREFRAME_16_9',
    width: SLIDE_DIMENSIONS.width,
    height: SLIDE_DIMENSIONS.height,
  })
  pres.layout = 'WIREFRAME_16_9'

  // Generate slides (one per CIM slide) (AC #3)
  cim.slides.forEach((slide, index) => {
    generateSlide(pres, slide, index + 1)
  })

  // Handle empty CIM - add placeholder slide
  if (cim.slides.length === 0) {
    const emptySlide = pres.addSlide()
    emptySlide.background = { color: WIREFRAME_COLORS.background }
    emptySlide.addText('No slides in CIM', {
      x: 1,
      y: 2,
      w: 8,
      h: 1.5,
      fontSize: 24,
      color: WIREFRAME_COLORS.textMuted,
      align: 'center',
      valign: 'middle',
    })
    emptySlide.addText('Add content through the CIM Builder to generate slides', {
      x: 1,
      y: 3.5,
      w: 8,
      h: 0.5,
      fontSize: 14,
      color: WIREFRAME_COLORS.textMuted,
      italic: true,
      align: 'center',
    })
  }

  // Generate blob (AC #6)
  const blob = await pres.write({ outputType: 'blob' }) as Blob
  return blob
}

/**
 * Trigger browser download of exported PPTX (AC #6, #7)
 *
 * @param blob - The PPTX blob to download
 * @param filename - The filename for the download
 */
export function triggerPPTXDownload(blob: Blob, filename: string): void {
  // Create object URL
  const url = URL.createObjectURL(blob)

  // Create temporary anchor element
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'

  // Trigger download
  document.body.appendChild(anchor)
  anchor.click()

  // Cleanup
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Export result interface
 */
export interface CIMExportResult {
  blob: Blob
  filename: string
  contentType: string
  slideCount: number
}

/**
 * Full export flow: generate PPTX and prepare for download (AC #2, #3, #5, #6, #7)
 *
 * @param cim - The CIM to export
 * @returns CIMExportResult with blob, filename, and metadata
 */
export async function exportCIMAsWireframe(cim: CIM): Promise<CIMExportResult> {
  const blob = await exportWireframePPTX(cim)
  const filename = generateExportFilename(cim.title)

  return {
    blob,
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    slideCount: cim.slides.length,
  }
}

// ============================================================================
// LLM Prompt Export (E9.15)
// ============================================================================

/**
 * LLM Prompt Export Result interface
 * Story: E9.15 - LLM Prompt Export (AC #3)
 */
export interface LLMPromptExportResult {
  /** Full XML-structured prompt */
  prompt: string
  /** Total characters in prompt */
  characterCount: number
  /** Number of outline sections */
  sectionCount: number
  /** Number of slides */
  slideCount: number
  /** Generated filename */
  filename: string
}

/**
 * Generate export filename for LLM prompt
 * Format: "{CIM Name} - LLM Prompt.txt"
 * Story: E9.15 - LLM Prompt Export (AC #5)
 */
export function generateLLMPromptFilename(cimTitle: string): string {
  const sanitized = sanitizeFilename(cimTitle) || 'CIM'
  return `${sanitized} - LLM Prompt.txt`
}

/**
 * Escape XML special characters in text content
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format buyer persona section for LLM prompt
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatBuyerPersonaSection(persona: BuyerPersona | null): string {
  if (!persona) {
    return `  <buyer_persona>Not specified</buyer_persona>`
  }

  const prioritiesItems = persona.priorities.length > 0
    ? persona.priorities.map(p => `      <item>${escapeXml(p)}</item>`).join('\n')
    : '      <item>Not specified</item>'

  const concernsItems = persona.concerns.length > 0
    ? persona.concerns.map(c => `      <item>${escapeXml(c)}</item>`).join('\n')
    : '      <item>Not specified</item>'

  const metricsItems = persona.key_metrics.length > 0
    ? persona.key_metrics.map(m => `      <item>${escapeXml(m)}</item>`).join('\n')
    : '      <item>Not specified</item>'

  return `  <buyer_persona>
    <type>${escapeXml(persona.buyer_type)}</type>
    <description>${escapeXml(persona.buyer_description)}</description>
    <priorities>
${prioritiesItems}
    </priorities>
    <concerns>
${concernsItems}
    </concerns>
    <key_metrics>
${metricsItems}
    </key_metrics>
  </buyer_persona>`
}

/**
 * Format investment thesis section for LLM prompt
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatInvestmentThesisSection(thesis: string | null): string {
  if (!thesis) {
    return `  <investment_thesis>Not specified</investment_thesis>`
  }
  return `  <investment_thesis>${escapeXml(thesis)}</investment_thesis>`
}

/**
 * Format outline section for LLM prompt
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatOutlineSection(outline: OutlineSection[], slides: Slide[]): string {
  if (outline.length === 0) {
    return `  <outline>No sections defined</outline>`
  }

  const sections = outline.map(section => {
    const sectionSlides = slides.filter(s => s.section_id === section.id)
    return `    <section order="${section.order}" status="${section.status}">
      <title>${escapeXml(section.title)}</title>
      <description>${escapeXml(section.description)}</description>
      <slide_count>${sectionSlides.length}</slide_count>
    </section>`
  }).join('\n')

  return `  <outline>
${sections}
  </outline>`
}

/**
 * Format slide component for LLM prompt
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatSlideComponent(component: SlideComponent): string {
  const typeAttr = `type="${component.type}"`
  const metadata = component.metadata || {}

  // Add chart-specific attributes
  let extraAttrs = ''
  if (component.type === 'chart' && metadata.chartType) {
    extraAttrs += ` chart_type="${escapeXml(String(metadata.chartType))}"`
  }
  if (metadata.dataDescription) {
    extraAttrs += ` data_description="${escapeXml(String(metadata.dataDescription))}"`
  }

  return `        <component ${typeAttr}${extraAttrs}>${escapeXml(component.content)}</component>`
}

/**
 * Format chart recommendations for visual concept
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatChartRecommendations(recommendations: ChartRecommendation[] | undefined): string {
  if (!recommendations || recommendations.length === 0) {
    return ''
  }

  const charts = recommendations.map(rec =>
    `          <chart type="${rec.type}" purpose="${escapeXml(rec.purpose)}">${escapeXml(rec.data_description)}</chart>`
  ).join('\n')

  return `        <chart_recommendations>
${charts}
        </chart_recommendations>`
}

/**
 * Format image suggestions for visual concept
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatImageSuggestions(suggestions: string[] | undefined): string {
  if (!suggestions || suggestions.length === 0) {
    return ''
  }

  const items = suggestions.map(s => `          <suggestion>${escapeXml(s)}</suggestion>`).join('\n')

  return `        <image_suggestions>
${items}
        </image_suggestions>`
}

/**
 * Format visual concept for a slide
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatVisualConcept(visualConcept: VisualConcept | null): string {
  if (!visualConcept) {
    return ''
  }

  const parts: string[] = []
  parts.push(`        <layout>${visualConcept.layout_type}</layout>`)

  const chartRecs = formatChartRecommendations(visualConcept.chart_recommendations)
  if (chartRecs) parts.push(chartRecs)

  const imageSugs = formatImageSuggestions(visualConcept.image_suggestions)
  if (imageSugs) parts.push(imageSugs)

  if (visualConcept.notes) {
    parts.push(`        <notes>${escapeXml(visualConcept.notes)}</notes>`)
  }

  return `      <visual_concept>
${parts.join('\n')}
      </visual_concept>`
}

/**
 * Format a single slide for LLM prompt
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatSlide(slide: Slide, outline: OutlineSection[]): string {
  const section = outline.find(s => s.id === slide.section_id)
  const sectionTitle = section?.title || 'Unknown Section'

  const components = slide.components.length > 0
    ? slide.components.map(formatSlideComponent).join('\n')
    : '        <component type="text">No content</component>'

  const visualConcept = formatVisualConcept(slide.visual_concept)

  const slideContent = [
    `      <title>${escapeXml(slide.title)}</title>`,
    `      <components>`,
    components,
    `      </components>`,
  ]

  if (visualConcept) {
    slideContent.push(visualConcept)
  }

  return `    <slide id="${slide.id}" section="${escapeXml(sectionTitle)}" status="${slide.status}">
${slideContent.join('\n')}
    </slide>`
}

/**
 * Format slides section for LLM prompt
 * Story: E9.15 - LLM Prompt Export (AC #2)
 */
function formatSlidesSection(slides: Slide[], outline: OutlineSection[]): string {
  if (slides.length === 0) {
    return `  <slides>No slides defined</slides>`
  }

  const formattedSlides = slides.map(slide => formatSlide(slide, outline)).join('\n')

  return `  <slides>
${formattedSlides}
  </slides>`
}

/**
 * Generate structured LLM prompt from CIM data
 * Story: E9.15 - LLM Prompt Export (AC #2, #3)
 *
 * @param cim - The CIM to export
 * @returns Structured XML prompt string
 */
export function generateLLMPrompt(cim: CIM): string {
  const exportedAt = new Date().toISOString()

  const prompt = `<cim_export version="1.0">
  <instructions>
    This is an exported CIM (Confidential Information Memorandum) for M&amp;A due diligence.
    Use this structured content to generate styled presentations, create variations,
    or refine content in external AI tools.

    Structure:
    - metadata: Basic information about this CIM export
    - buyer_persona: Target buyer profile with priorities, concerns, and key metrics
    - investment_thesis: Core value proposition and investment rationale
    - outline: Section structure with titles, descriptions, and completion status
    - slides: Full slide content with components and visual specifications
  </instructions>

  <metadata>
    <title>${escapeXml(cim.title)}</title>
    <exported_at>${exportedAt}</exported_at>
    <slide_count>${cim.slides.length}</slide_count>
    <section_count>${cim.outline.length}</section_count>
    <version>${cim.version}</version>
  </metadata>

${formatBuyerPersonaSection(cim.buyerPersona)}

${formatInvestmentThesisSection(cim.investmentThesis)}

${formatOutlineSection(cim.outline, cim.slides)}

${formatSlidesSection(cim.slides, cim.outline)}
</cim_export>`

  return prompt
}

/**
 * Trigger browser download of text content
 * Story: E9.15 - LLM Prompt Export (AC #5)
 *
 * @param content - The text content to download
 * @param filename - The filename for the download
 */
export function triggerTextDownload(content: string, filename: string): void {
  // Create blob with text/plain content type
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })

  // Create object URL
  const url = URL.createObjectURL(blob)

  // Create temporary anchor element
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'

  // Trigger download
  document.body.appendChild(anchor)
  anchor.click()

  // Cleanup
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Copy text to clipboard with fallback
 * Story: E9.15 - LLM Prompt Export (AC #4)
 *
 * @param text - The text to copy to clipboard
 * @returns Promise that resolves when copy is complete
 * @throws Error if copy fails
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback using execCommand (for older browsers)
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!successful) {
      throw new Error('Clipboard copy failed')
    }
  } catch (err) {
    document.body.removeChild(textarea)
    throw new Error('Clipboard copy failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
  }
}

/**
 * Full LLM prompt export flow: generate prompt and prepare result
 * Story: E9.15 - LLM Prompt Export (AC #2, #3, #4, #5)
 *
 * @param cim - The CIM to export
 * @returns LLMPromptExportResult with prompt, counts, and filename
 */
export function exportCIMAsLLMPrompt(cim: CIM): LLMPromptExportResult {
  const prompt = generateLLMPrompt(cim)
  const filename = generateLLMPromptFilename(cim.title)

  return {
    prompt,
    characterCount: prompt.length,
    sectionCount: cim.outline.length,
    slideCount: cim.slides.length,
    filename,
  }
}
