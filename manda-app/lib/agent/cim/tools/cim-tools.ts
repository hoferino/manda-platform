/**
 * CIM-Specific Agent Tools
 *
 * Tools for CIM Builder workflow operations.
 * Story: E9.4 - Agent Orchestration Core
 *
 * Features:
 * - Buyer persona management
 * - Investment thesis management
 * - Outline operations
 * - Slide content generation
 * - Visual concept assignment
 * - Phase transitions
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCIM, updateCIM } from '@/lib/services/cim'
import {
  BuyerPersona,
  BuyerType,
  BUYER_TYPES,
  OutlineSection,
  Slide,
  SlideComponent,
  VisualConcept,
  SourceReference,
  CIMPhase,
  CIM_PHASES,
  COMPONENT_TYPES,
  LAYOUT_TYPES,
  CHART_TYPES,
  ChartType,
  SOURCE_TYPES,
} from '@/lib/types/cim'
import { generateEmbedding } from '@/lib/services/embeddings'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a successful tool response
 */
function formatSuccess(data: unknown): string {
  return JSON.stringify({ success: true, data })
}

/**
 * Format an error tool response
 */
function formatError(message: string): string {
  return JSON.stringify({ success: false, error: message })
}

// ============================================================================
// Buyer Persona Tools
// ============================================================================

/**
 * Save buyer persona to CIM
 */
export const saveBuyerPersonaTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const persona: BuyerPersona = {
        buyer_type: input.buyerType as BuyerType,
        buyer_description: input.buyerDescription,
        priorities: input.priorities,
        concerns: input.concerns || [],
        key_metrics: input.keyMetrics || [],
      }

      await updateCIM(supabase, input.cimId, {
        buyerPersona: persona,
      })

      return formatSuccess({
        message: 'Buyer persona saved successfully',
        persona,
      })
    } catch (err) {
      console.error('[save_buyer_persona] Error:', err)
      return formatError('Failed to save buyer persona')
    }
  },
  {
    name: 'save_buyer_persona',
    description: 'Save the defined buyer persona to the CIM. Use this after collaboratively defining the target buyer.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      buyerType: z.enum(BUYER_TYPES).describe('Type of buyer: strategic, financial, management, or other'),
      buyerDescription: z.string().min(10).describe('Detailed description of the buyer'),
      priorities: z.array(z.string()).min(1).describe('Key priorities for this buyer'),
      concerns: z.array(z.string()).optional().describe('Potential concerns or objections'),
      keyMetrics: z.array(z.string()).optional().describe('Metrics this buyer cares about'),
    }),
  }
)

// ============================================================================
// Investment Thesis Tools
// ============================================================================

/**
 * Save investment thesis to CIM
 */
export const saveInvestmentThesisTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      await updateCIM(supabase, input.cimId, {
        investmentThesis: input.thesis,
      })

      return formatSuccess({
        message: 'Investment thesis saved successfully',
        thesis: input.thesis,
      })
    } catch (err) {
      console.error('[save_investment_thesis] Error:', err)
      return formatError('Failed to save investment thesis')
    }
  },
  {
    name: 'save_investment_thesis',
    description: 'Save the finalized investment thesis to the CIM. Use this after co-creating and refining the thesis.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      thesis: z.string().min(50).max(500).describe('The investment thesis (2-3 sentences)'),
    }),
  }
)

// ============================================================================
// Outline Tools
// ============================================================================

/**
 * Create outline section
 */
export const createOutlineSectionTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const sectionId = crypto.randomUUID()
      const newSection: OutlineSection = {
        id: sectionId,
        title: input.title,
        description: input.description,
        order: input.order ?? cim.outline.length,
        status: 'pending',
        slide_ids: [],
      }

      const updatedOutline = [...cim.outline, newSection]
      // Sort by order
      updatedOutline.sort((a, b) => a.order - b.order)

      await updateCIM(supabase, input.cimId, {
        outline: updatedOutline,
      })

      return formatSuccess({
        message: 'Section created successfully',
        sectionId,
        section: newSection,
      })
    } catch (err) {
      console.error('[create_outline_section] Error:', err)
      return formatError('Failed to create outline section')
    }
  },
  {
    name: 'create_outline_section',
    description: 'Add a new section to the CIM outline. Use this to build the document structure.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      title: z.string().min(1).describe('Section title'),
      description: z.string().describe('Description of what this section will contain'),
      order: z.number().int().min(0).optional().describe('Position in outline (defaults to end)'),
    }),
  }
)

/**
 * Update outline section
 */
export const updateOutlineSectionTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const sectionIndex = cim.outline.findIndex(s => s.id === input.sectionId)
      if (sectionIndex === -1) {
        return formatError('Section not found')
      }

      const existingSection = cim.outline[sectionIndex]
      if (!existingSection) {
        return formatError('Section not found')
      }

      const updatedSection: OutlineSection = {
        id: existingSection.id,
        title: input.title ?? existingSection.title,
        description: input.description ?? existingSection.description,
        order: existingSection.order,
        status: (input.status as OutlineSection['status']) ?? existingSection.status,
        slide_ids: existingSection.slide_ids,
      }

      const updatedOutline = cim.outline.map((s, i) =>
        i === sectionIndex ? updatedSection : s
      )

      await updateCIM(supabase, input.cimId, {
        outline: updatedOutline,
      })

      return formatSuccess({
        message: 'Section updated successfully',
        section: updatedSection,
      })
    } catch (err) {
      console.error('[update_outline_section] Error:', err)
      return formatError('Failed to update outline section')
    }
  },
  {
    name: 'update_outline_section',
    description: 'Update an existing outline section. Use this to modify section details.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().describe('The section ID to update'),
      title: z.string().min(1).optional().describe('New section title'),
      description: z.string().optional().describe('New section description'),
      status: z.enum(['pending', 'in_progress', 'complete']).optional().describe('Section status'),
    }),
  }
)

/**
 * Delete outline section
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 */
export const deleteOutlineSectionTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const sectionIndex = cim.outline.findIndex(s => s.id === input.sectionId)
      if (sectionIndex === -1) {
        return formatError('Section not found')
      }

      const deletedSection = cim.outline[sectionIndex]
      if (!deletedSection) {
        return formatError('Section not found')
      }

      // Remove the section from the outline
      const updatedOutline = cim.outline.filter(s => s.id !== input.sectionId)

      // Re-index the remaining sections to maintain contiguous order
      const reindexedOutline = updatedOutline.map((section, index) => ({
        ...section,
        order: index,
      }))

      // Also remove any slides associated with this section
      const updatedSlides = cim.slides.filter(s => s.section_id !== input.sectionId)

      await updateCIM(supabase, input.cimId, {
        outline: reindexedOutline,
        slides: updatedSlides,
      })

      return formatSuccess({
        message: 'Section deleted successfully',
        deletedSectionId: input.sectionId,
        deletedSectionTitle: deletedSection.title,
        remainingSectionCount: reindexedOutline.length,
        deletedSlideCount: cim.slides.length - updatedSlides.length,
      })
    } catch (err) {
      console.error('[delete_outline_section] Error:', err)
      return formatError('Failed to delete outline section')
    }
  },
  {
    name: 'delete_outline_section',
    description: 'Remove a section from the CIM outline. This also removes any slides associated with the section. Use this when the user wants to remove a section from the outline.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().describe('The section ID to delete'),
    }),
  }
)

/**
 * Reorder outline sections
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 */
export const reorderOutlineSectionsTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      // Validate all section IDs exist
      const existingIds = new Set(cim.outline.map(s => s.id))
      const invalidIds = input.sectionOrder.filter(id => !existingIds.has(id))
      if (invalidIds.length > 0) {
        return formatError(`Invalid section IDs: ${invalidIds.join(', ')}`)
      }

      // Validate all sections are included (no missing IDs)
      if (input.sectionOrder.length !== cim.outline.length) {
        return formatError(`Section order must include all ${cim.outline.length} sections, but got ${input.sectionOrder.length}`)
      }

      // Create a map for quick lookup
      const sectionMap = new Map(cim.outline.map(s => [s.id, s]))

      // Reorder sections according to the new order
      const reorderedOutline: OutlineSection[] = input.sectionOrder.map((id, index) => {
        const section = sectionMap.get(id)!
        return {
          ...section,
          order: index,
        }
      })

      await updateCIM(supabase, input.cimId, {
        outline: reorderedOutline,
      })

      return formatSuccess({
        message: 'Sections reordered successfully',
        newOrder: reorderedOutline.map(s => ({ id: s.id, title: s.title, order: s.order })),
      })
    } catch (err) {
      console.error('[reorder_outline_sections] Error:', err)
      return formatError('Failed to reorder outline sections')
    }
  },
  {
    name: 'reorder_outline_sections',
    description: 'Change the order of sections in the CIM outline. Provide the section IDs in the desired new order. Use this when the user wants to move or swap sections.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionOrder: z.array(z.string().uuid()).min(1).describe('Array of section IDs in the desired new order'),
    }),
  }
)

// ============================================================================
// Slide Tools
// ============================================================================

/**
 * Generate slide content using RAG
 */
export const generateSlideContentTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      // Find or create section
      const section = cim.outline.find(s => s.id === input.sectionId)
      if (!section) {
        return formatError('Section not found')
      }

      // Search for relevant content using embeddings
      let relevantFindings: Array<{ text: string; source_document: string; confidence: number }> = []

      try {
        const queryEmbedding = await generateEmbedding(input.topic)

        const { data: findings } = await supabase.rpc('match_findings', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.3,
          match_count: 10,
          p_deal_id: cim.dealId,
        })

        if (findings && Array.isArray(findings)) {
          relevantFindings = findings as Array<{ text: string; source_document: string; confidence: number }>
        }
      } catch (embeddingError) {
        console.warn('[generate_slide_content] Embedding search failed:', embeddingError)
      }

      // Create slide ID
      const slideId = crypto.randomUUID()

      // Create components based on content type
      const components: SlideComponent[] = [
        {
          id: crypto.randomUUID(),
          type: 'title',
          content: input.title,
        },
      ]

      // Add content component
      if (input.contentType === 'bullet') {
        components.push({
          id: crypto.randomUUID(),
          type: 'bullet',
          content: input.content || '',
          source_refs: relevantFindings.slice(0, 3).map(f => ({
            type: 'finding' as const,
            id: crypto.randomUUID(),
            title: f.source_document,
            excerpt: f.text.slice(0, 200),
          })),
        })
      } else {
        components.push({
          id: crypto.randomUUID(),
          type: 'text',
          content: input.content || '',
          source_refs: relevantFindings.slice(0, 3).map(f => ({
            type: 'finding' as const,
            id: crypto.randomUUID(),
            title: f.source_document,
            excerpt: f.text.slice(0, 200),
          })),
        })
      }

      // Create new slide
      const newSlide: Slide = {
        id: slideId,
        section_id: input.sectionId,
        title: input.title,
        components,
        visual_concept: null,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Update slides and section
      const updatedSlides = [...cim.slides, newSlide]
      const updatedOutline = cim.outline.map(s => {
        if (s.id === input.sectionId) {
          return { ...s, slide_ids: [...s.slide_ids, slideId] }
        }
        return s
      })

      await updateCIM(supabase, input.cimId, {
        slides: updatedSlides,
        outline: updatedOutline,
      })

      return formatSuccess({
        message: 'Slide content generated',
        slideId,
        slide: newSlide,
        relevantSourceCount: relevantFindings.length,
      })
    } catch (err) {
      console.error('[generate_slide_content] Error:', err)
      return formatError('Failed to generate slide content')
    }
  },
  {
    name: 'generate_slide_content',
    description: 'Generate content for a slide using RAG search on deal documents. Creates a new slide in the specified section.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().describe('The section ID to add the slide to'),
      title: z.string().describe('Slide title'),
      topic: z.string().describe('Topic to search for relevant content'),
      content: z.string().optional().describe('Initial content (will be enriched with RAG)'),
      contentType: z.enum(['text', 'bullet', 'table']).default('bullet').describe('Type of content'),
    }),
  }
)

/**
 * Update slide content
 */
export const updateSlideTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const slideIndex = cim.slides.findIndex(s => s.id === input.slideId)
      if (slideIndex === -1) {
        return formatError('Slide not found')
      }

      const existingSlide = cim.slides[slideIndex]
      if (!existingSlide) {
        return formatError('Slide not found')
      }

      const updatedSlide: Slide = {
        id: existingSlide.id,
        section_id: existingSlide.section_id,
        title: input.title ?? existingSlide.title,
        components: (input.components as SlideComponent[]) ?? existingSlide.components,
        visual_concept: existingSlide.visual_concept,
        status: (input.status as Slide['status']) ?? existingSlide.status,
        created_at: existingSlide.created_at,
        updated_at: new Date().toISOString(),
      }

      const updatedSlides = cim.slides.map((s, i) =>
        i === slideIndex ? updatedSlide : s
      )

      await updateCIM(supabase, input.cimId, {
        slides: updatedSlides,
      })

      return formatSuccess({
        message: 'Slide updated successfully',
        slide: updatedSlide,
      })
    } catch (err) {
      console.error('[update_slide] Error:', err)
      return formatError('Failed to update slide')
    }
  },
  {
    name: 'update_slide',
    description: 'Update an existing slide. Use this to modify slide content or status.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID to update'),
      title: z.string().optional().describe('New slide title'),
      status: z.enum(['draft', 'approved', 'locked']).optional().describe('Slide status'),
      components: z.array(z.object({
        id: z.string(),
        type: z.enum(COMPONENT_TYPES),
        content: z.string(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        source_refs: z.array(z.object({
          type: z.enum(SOURCE_TYPES),
          id: z.string(),
          title: z.string(),
          excerpt: z.string().optional(),
        })).optional(),
      })).optional().describe('Updated components'),
    }),
  }
)

// ============================================================================
// Visual Concept Tools
// ============================================================================

/**
 * Set visual concept for a slide
 */
export const setVisualConceptTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const slideIndex = cim.slides.findIndex(s => s.id === input.slideId)
      if (slideIndex === -1) {
        return formatError('Slide not found')
      }

      const existingSlide = cim.slides[slideIndex]
      if (!existingSlide) {
        return formatError('Slide not found')
      }

      const visualConcept: VisualConcept = {
        layout_type: input.layoutType as VisualConcept['layout_type'],
        chart_recommendations: input.chartRecommendations?.map(c => ({
          type: c.type as ChartType,
          data_description: c.dataDescription,
          purpose: c.purpose,
        })),
        image_suggestions: input.imageSuggestions,
        notes: input.notes || '',
      }

      const updatedSlide: Slide = {
        id: existingSlide.id,
        section_id: existingSlide.section_id,
        title: existingSlide.title,
        components: existingSlide.components,
        visual_concept: visualConcept,
        status: existingSlide.status,
        created_at: existingSlide.created_at,
        updated_at: new Date().toISOString(),
      }

      const updatedSlides = cim.slides.map((s, i) =>
        i === slideIndex ? updatedSlide : s
      )

      await updateCIM(supabase, input.cimId, {
        slides: updatedSlides,
      })

      return formatSuccess({
        message: 'Visual concept set successfully',
        visualConcept,
      })
    } catch (err) {
      console.error('[set_visual_concept] Error:', err)
      return formatError('Failed to set visual concept')
    }
  },
  {
    name: 'set_visual_concept',
    description: 'Set the visual concept for a slide including layout type and chart recommendations.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID'),
      layoutType: z.enum(LAYOUT_TYPES).describe('The layout type for this slide'),
      chartRecommendations: z.array(z.object({
        type: z.enum(CHART_TYPES),
        dataDescription: z.string(),
        purpose: z.string(),
      })).optional().describe('Recommended charts'),
      imageSuggestions: z.array(z.string()).optional().describe('Suggested images'),
      notes: z.string().optional().describe('Additional notes for the designer'),
    }),
  }
)

// ============================================================================
// Workflow Tools
// ============================================================================

/**
 * Transition to next workflow phase
 */
export const transitionPhaseTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const currentPhase = cim.workflowState.current_phase
      const currentIndex = CIM_PHASES.indexOf(currentPhase)

      // Determine next phase
      let nextPhase: CIMPhase
      if (input.targetPhase) {
        nextPhase = input.targetPhase as CIMPhase
      } else {
        if (currentIndex >= CIM_PHASES.length - 1) {
          return formatError('Already at final phase')
        }
        nextPhase = CIM_PHASES[currentIndex + 1] as CIMPhase
      }

      // Update completed phases
      const completedPhases = [...cim.workflowState.completed_phases]
      if (!completedPhases.includes(currentPhase)) {
        completedPhases.push(currentPhase)
      }

      await updateCIM(supabase, input.cimId, {
        workflowState: {
          ...cim.workflowState,
          current_phase: nextPhase,
          completed_phases: completedPhases,
          is_complete: nextPhase === 'complete',
        },
      })

      return formatSuccess({
        message: `Transitioned from ${currentPhase} to ${nextPhase}`,
        previousPhase: currentPhase,
        currentPhase: nextPhase,
        completedPhases,
      })
    } catch (err) {
      console.error('[transition_phase] Error:', err)
      return formatError('Failed to transition phase')
    }
  },
  {
    name: 'transition_phase',
    description: 'Move the workflow to the next phase or a specific target phase. Use this after completing a phase with user approval.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      targetPhase: z.enum(CIM_PHASES).optional().describe('Specific phase to transition to (defaults to next phase)'),
    }),
  }
)

// ============================================================================
// Export All Tools
// ============================================================================

export const cimTools = [
  saveBuyerPersonaTool,
  saveInvestmentThesisTool,
  createOutlineSectionTool,
  updateOutlineSectionTool,
  deleteOutlineSectionTool,
  reorderOutlineSectionsTool,
  generateSlideContentTool,
  updateSlideTool,
  setVisualConceptTool,
  transitionPhaseTool,
]

export const CIM_TOOL_COUNT = cimTools.length
