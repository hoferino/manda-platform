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
  LayoutType,
  CHART_TYPES,
  ChartType,
  SOURCE_TYPES,
  DependencyGraph,
  NarrativeRole,
  NARRATIVE_ROLES,
} from '@/lib/types/cim'
import {
  updateGraphOnSlideChange,
  getDependents,
  getReferences,
  validateGraph,
  getGraphStats,
} from '@/lib/agent/cim/utils/dependency-graph'
import {
  suggestNarrativeRoleForSlide,
  getNarrativeRoleLabel,
  checkContentRoleCompatibility,
  suggestReorganization,
  validateNarrativeStructure,
} from '@/lib/agent/cim/utils/narrative-structure'
import {
  checkNavigationCoherence,
  getNavigationContextSummary,
  shouldRequireConfirmation,
  formatNavigationWarnings,
  getRecommendedNextSection,
} from '@/lib/agent/cim/utils/navigation-coherence'
// E10.8: generateEmbedding removed - Graphiti handles embeddings via hybrid search
import {
  retrieveContentForSlide,
  RankedContentItem,
} from '@/lib/agent/cim/utils/content-retrieval'
import {
  buildContentCreationContext,
  generateContentOpeningMessage,
} from '@/lib/agent/cim/utils/context'

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
 * Generate slide content using hybrid RAG search
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 *
 * Features:
 * - Hybrid search: Q&A answers (priority 1) > Findings (priority 2) > Document chunks (priority 3)
 * - Neo4j enrichment for SUPPORTS/CONTRADICTS relationships
 * - Context flow: buyer persona, thesis, prior slides
 * - Contradiction warnings
 * - Source citations for all content
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

      // Find the section
      const section = cim.outline.find(s => s.id === input.sectionId)
      if (!section) {
        return formatError('Section not found')
      }

      // Build context for content creation (AC #7: Forward Context Flow)
      const context = buildContentCreationContext(
        cim.buyerPersona,
        cim.investmentThesis,
        cim.slides,
        cim.outline,
        input.sectionId
      )

      // Check if this is the first section
      const isFirstSection = cim.outline.findIndex(s => s.id === input.sectionId) === 0

      // Generate opening message with context
      const openingMessage = generateContentOpeningMessage(
        section.title,
        section.description,
        cim.buyerPersona,
        cim.investmentThesis,
        isFirstSection
      )

      // Perform hybrid content retrieval (AC #2: Q&A > Findings > Documents)
      const retrievalResult = await retrieveContentForSlide(
        supabase,
        cim.dealId,
        input.topic,
        {
          qaLimit: 5,
          findingsLimit: 10,
          chunksLimit: 5,
          confidenceThreshold: 0.3,
          includeNeo4jEnrichment: true,
        }
      )

      // Separate by source type for structured response
      const qaItems = retrievalResult.items.filter(i => i.sourceType === 'qa')
      const findingItems = retrievalResult.items.filter(i => i.sourceType === 'finding')
      const documentItems = retrievalResult.items.filter(i => i.sourceType === 'document')

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

      // Build source references from retrieved content
      const sourceRefs: SourceReference[] = retrievalResult.items.slice(0, 5).map(item => ({
        type: item.sourceType === 'qa' ? 'qa' as const : item.sourceType === 'finding' ? 'finding' as const : 'document' as const,
        id: item.id,
        title: item.citation,
        excerpt: item.content.slice(0, 200),
      }))

      // Add content component
      if (input.contentType === 'bullet') {
        components.push({
          id: crypto.randomUUID(),
          type: 'bullet',
          content: input.content || '',
          source_refs: sourceRefs,
        })
      } else {
        components.push({
          id: crypto.randomUUID(),
          type: 'text',
          content: input.content || '',
          source_refs: sourceRefs,
        })
      }

      // E9.12: Auto-assign narrative role based on content and position
      const sectionSlides = cim.slides.filter(s => s.section_id === input.sectionId)
      const existingRoles = sectionSlides
        .map(s => s.narrative_role)
        .filter((r): r is NarrativeRole => r !== undefined)
      const slideContent = input.content || input.topic || input.title
      const narrativeRole = suggestNarrativeRoleForSlide(
        slideContent,
        sectionSlides.length, // Position is current length (0-indexed)
        sectionSlides.length + 1, // Total after adding this slide
        existingRoles,
        section.title
      )

      // Create new slide with narrative role
      const newSlide: Slide = {
        id: slideId,
        section_id: input.sectionId,
        title: input.title,
        components,
        visual_concept: null,
        status: 'draft',
        narrative_role: narrativeRole,
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

      // Format content options with citations for agent to present (AC #4)
      const contentOptions = retrievalResult.items.slice(0, 10).map(item => ({
        content: item.content,
        citation: item.citation,
        sourceType: item.sourceType,
        hasContradiction: item.hasContradiction || false,
        contradictionInfo: item.contradictionInfo,
      }))

      return formatSuccess({
        message: 'Slide content generated with hybrid RAG search',
        slideId,
        slide: newSlide,
        // E9.12: Narrative role information
        narrativeRole: {
          assigned: narrativeRole,
          label: getNarrativeRoleLabel(narrativeRole),
        },
        // Context information for agent (AC #7)
        context: {
          openingMessage,
          sectionIndex: context.currentSectionIndex,
          totalSections: context.totalSections,
          buyerPersona: context.buyerPersonaContext,
          thesis: context.thesisContext,
          priorSlides: context.priorSlidesContext.length,
        },
        // Content retrieval results by source type (AC #2, #3)
        retrieval: {
          qaCount: qaItems.length,
          findingsCount: findingItems.length,
          documentsCount: documentItems.length,
          totalItems: retrievalResult.items.length,
        },
        // Formatted content options with citations (AC #4)
        contentOptions,
        // Contradiction warnings (AC #8)
        contradictionWarnings: retrievalResult.contradictionWarnings,
      })
    } catch (err) {
      console.error('[generate_slide_content] Error:', err)
      return formatError('Failed to generate slide content')
    }
  },
  {
    name: 'generate_slide_content',
    description: `Generate content for a slide using hybrid RAG search on deal documents.

**Features:**
- Searches Q&A answers (highest priority), findings, and document chunks
- Returns content options with source citations
- Includes buyer persona and thesis context for alignment
- Flags data contradictions from Neo4j relationships

**Use this tool to:**
1. Search for relevant content for a section
2. Get formatted content options with citations to present to user
3. Create draft slides for user selection/approval`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().describe('The section ID to add the slide to'),
      title: z.string().describe('Slide title'),
      topic: z.string().describe('Topic/keywords to search for relevant content'),
      content: z.string().optional().describe('Initial content (will be enriched with RAG results)'),
      contentType: z.enum(['text', 'bullet', 'table']).default('bullet').describe('Type of content'),
    }),
  }
)

/**
 * Select content option and update slide
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 * AC #5: Content Selection Flow
 *
 * Use this tool when user selects an option (e.g., "Option A", "I like B")
 */
export const selectContentOptionTool = tool(
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

      // Update the slide's content component with selected option
      const updatedComponents: SlideComponent[] = existingSlide.components.map(comp => {
        if (comp.type === 'bullet' || comp.type === 'text') {
          return {
            ...comp,
            content: input.content,
            source_refs: input.sourceRefs?.map(ref => ({
              type: ref.sourceType as 'qa' | 'finding' | 'document',
              id: ref.id,
              title: ref.citation,
              excerpt: ref.excerpt,
            })) || comp.source_refs,
          }
        }
        return comp
      })

      const updatedSlide: Slide = {
        ...existingSlide,
        components: updatedComponents,
        updated_at: new Date().toISOString(),
      }

      const updatedSlides = cim.slides.map((s, i) =>
        i === slideIndex ? updatedSlide : s
      )

      await updateCIM(supabase, input.cimId, {
        slides: updatedSlides,
      })

      return formatSuccess({
        message: 'Content option selected and slide updated',
        slideId: input.slideId,
        slide: updatedSlide,
      })
    } catch (err) {
      console.error('[select_content_option] Error:', err)
      return formatError('Failed to select content option')
    }
  },
  {
    name: 'select_content_option',
    description: `Select a content option and update the slide. Use this when user chooses from presented options (e.g., "Option A", "I like B", "Go with the second one").

**Common triggers:**
- "Option A" / "I'll go with A"
- "I like the second one"
- "Use the growth-focused version"`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID to update'),
      content: z.string().describe('The selected content to use'),
      sourceRefs: z.array(z.object({
        id: z.string(),
        sourceType: z.enum(['qa', 'finding', 'document']),
        citation: z.string(),
        excerpt: z.string().optional(),
      })).optional().describe('Source references for the selected content'),
    }),
  }
)

/**
 * Approve slide content and move to next section
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 * AC #6: Content Approval Flow
 *
 * Recognizes approval phrases: "looks good", "approve", "that works", "yes", "perfect"
 */
export const approveSlideContentTool = tool(
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

      // Update slide status to 'approved'
      const updatedSlide: Slide = {
        ...existingSlide,
        status: 'approved',
        updated_at: new Date().toISOString(),
      }

      const updatedSlides = cim.slides.map((s, i) =>
        i === slideIndex ? updatedSlide : s
      )

      // Also update section status to 'in_progress' or 'complete'
      const section = cim.outline.find(s => s.id === existingSlide.section_id)
      let updatedOutline = cim.outline

      if (section) {
        const sectionSlides = updatedSlides.filter(s => s.section_id === section.id)
        const allApproved = sectionSlides.every(s => s.status === 'approved')
        const sectionStatus = allApproved ? 'complete' : 'in_progress'

        updatedOutline = cim.outline.map(s => {
          if (s.id === section.id) {
            return { ...s, status: sectionStatus as OutlineSection['status'] }
          }
          return s
        })
      }

      await updateCIM(supabase, input.cimId, {
        slides: updatedSlides,
        outline: updatedOutline,
      })

      // Find next section to work on
      const currentSectionIndex = cim.outline.findIndex(s => s.id === existingSlide.section_id)
      const nextSection = currentSectionIndex < cim.outline.length - 1
        ? cim.outline[currentSectionIndex + 1]
        : null

      // Check if all slides are approved
      const allSlidesApproved = updatedSlides.every(s => s.status === 'approved')

      return formatSuccess({
        message: `✅ Slide approved!${nextSection ? ` Moving to "${nextSection.title}" section.` : ' All sections complete!'}`,
        slideId: input.slideId,
        slideStatus: 'approved',
        sectionStatus: section ? updatedOutline.find(s => s.id === section.id)?.status : undefined,
        nextSection: nextSection ? {
          id: nextSection.id,
          title: nextSection.title,
          description: nextSection.description,
        } : null,
        allSlidesApproved,
        canTransitionToVisualConcepts: allSlidesApproved && cim.outline.every(s =>
          updatedSlides.filter(sl => sl.section_id === s.id).length > 0
        ),
      })
    } catch (err) {
      console.error('[approve_slide_content] Error:', err)
      return formatError('Failed to approve slide content')
    }
  },
  {
    name: 'approve_slide_content',
    description: `Approve slide content and update status. Use this when user approves content.

**Common approval triggers:**
- "Looks good" / "That looks good"
- "Approve" / "Approved"
- "That works" / "Works for me"
- "Yes" / "Perfect" / "Great"
- "Let's move on"

**After approval:**
- Slide status set to 'approved'
- Section status updated if all slides approved
- Returns next section info for continuation`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID to approve'),
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
        narrative_role: (input.narrativeRole as NarrativeRole) ?? existingSlide.narrative_role,
        created_at: existingSlide.created_at,
        updated_at: new Date().toISOString(),
      }

      const updatedSlides = cim.slides.map((s, i) =>
        i === slideIndex ? updatedSlide : s
      )

      await updateCIM(supabase, input.cimId, {
        slides: updatedSlides,
      })

      // E9.12: Check content-role compatibility if role was changed
      let compatibilityCheck = null
      if (input.narrativeRole && updatedSlide.narrative_role) {
        const content = updatedSlide.components.map(c => c.content).join(' ')
        compatibilityCheck = checkContentRoleCompatibility(content, updatedSlide.narrative_role)
      }

      return formatSuccess({
        message: 'Slide updated successfully',
        slide: updatedSlide,
        // E9.12: Include compatibility check if role was changed
        ...(compatibilityCheck && {
          narrativeRoleCheck: {
            isCompatible: compatibilityCheck.isCompatible,
            compatibilityLevel: compatibilityCheck.compatibilityLevel,
            detectedRole: compatibilityCheck.detectedRole,
            assignedRole: compatibilityCheck.assignedRole,
            warning: compatibilityCheck.mismatchDetails,
          },
        }),
      })
    } catch (err) {
      console.error('[update_slide] Error:', err)
      return formatError('Failed to update slide')
    }
  },
  {
    name: 'update_slide',
    description: 'Update an existing slide. Use this to modify slide content, status, or narrative role.',
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID to update'),
      title: z.string().optional().describe('New slide title'),
      status: z.enum(['draft', 'approved', 'locked']).optional().describe('Slide status'),
      narrativeRole: z.enum(NARRATIVE_ROLES).optional().describe('Narrative role for this slide (E9.12)'),
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
 * Generate visual concept for a slide based on content and buyer persona
 * Story: E9.10 - Visual Concept Generation
 * AC #1: Visual Concept Trigger - After slide content is approved, generate visual blueprint
 * AC #3: Narrative Rationale - Explain WHY visuals support the buyer persona narrative
 */
export const generateVisualConceptTool = tool(
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

      const slide = cim.slides.find(s => s.id === input.slideId)
      if (!slide) {
        return formatError('Slide not found')
      }

      // Build context for visual concept generation
      const buyerPersona = cim.buyerPersona

      // Analyze slide components to determine content type
      const componentTypes = slide.components.map(c => c.type)
      const hasChart = componentTypes.includes('chart')
      const contentTexts = slide.components.filter(c => c.type === 'text' || c.type === 'bullet').map(c => c.content).join(' ')

      // Determine recommended layout based on content
      let recommendedLayout: LayoutType = 'content'
      if (slide.title?.toLowerCase().includes('executive summary') ||
          slide.title?.toLowerCase().includes('overview')) {
        recommendedLayout = 'title_slide'
      } else if (hasChart || contentTexts.toLowerCase().includes('chart') ||
                 contentTexts.toLowerCase().includes('graph') ||
                 contentTexts.toLowerCase().includes('%') ||
                 contentTexts.toLowerCase().includes('$')) {
        recommendedLayout = 'chart_focus'
      } else if (contentTexts.toLowerCase().includes('compare') ||
                 contentTexts.toLowerCase().includes('versus') ||
                 contentTexts.toLowerCase().includes(' vs ')) {
        recommendedLayout = 'two_column'
      } else if (contentTexts.toLowerCase().includes('team') ||
                 contentTexts.toLowerCase().includes('photo') ||
                 contentTexts.toLowerCase().includes('logo')) {
        recommendedLayout = 'image_focus'
      }

      // Generate chart recommendations based on content analysis
      const chartRecommendations: { type: ChartType; data_description: string; purpose: string }[] = []

      // Look for data patterns in content
      if (contentTexts.toLowerCase().includes('growth') ||
          contentTexts.toLowerCase().includes('trend') ||
          contentTexts.toLowerCase().includes('over time')) {
        chartRecommendations.push({
          type: 'line',
          data_description: 'Trend data showing growth trajectory',
          purpose: 'Line charts effectively show progress over time, demonstrating momentum',
        })
      }

      if (contentTexts.toLowerCase().includes('compare') ||
          contentTexts.toLowerCase().includes('versus') ||
          contentTexts.toLowerCase().includes('ltv') ||
          contentTexts.toLowerCase().includes('cac')) {
        chartRecommendations.push({
          type: 'bar',
          data_description: 'Comparative metrics side by side',
          purpose: 'Bar charts make comparisons visually striking, highlighting advantages',
        })
      }

      if (contentTexts.toLowerCase().includes('breakdown') ||
          contentTexts.toLowerCase().includes('distribution') ||
          contentTexts.toLowerCase().includes('share') ||
          contentTexts.toLowerCase().includes('segment')) {
        chartRecommendations.push({
          type: 'pie',
          data_description: 'Distribution or composition breakdown',
          purpose: 'Pie charts show proportional relationships at a glance',
        })
      }

      // Generate image suggestions
      const imageSuggestions: string[] = []
      if (contentTexts.toLowerCase().includes('team') ||
          contentTexts.toLowerCase().includes('leadership')) {
        imageSuggestions.push('Leadership team headshots with titles')
      }
      if (contentTexts.toLowerCase().includes('office') ||
          contentTexts.toLowerCase().includes('facility') ||
          contentTexts.toLowerCase().includes('location')) {
        imageSuggestions.push('Office/facility photography')
      }
      if (contentTexts.toLowerCase().includes('product') ||
          contentTexts.toLowerCase().includes('technology') ||
          contentTexts.toLowerCase().includes('platform')) {
        imageSuggestions.push('Product screenshot or technology diagram')
      }
      if (contentTexts.toLowerCase().includes('customer') ||
          contentTexts.toLowerCase().includes('client') ||
          contentTexts.toLowerCase().includes('logo')) {
        imageSuggestions.push('Customer/client logo grid')
      }

      // Build buyer-persona-aware rationale (AC #3)
      let rationale = ''
      if (buyerPersona) {
        const buyerType = buyerPersona.buyer_type
        const priorities = buyerPersona.priorities.slice(0, 2).join(' and ')
        const metrics = buyerPersona.key_metrics.slice(0, 2).join(' and ')

        rationale = `**Why this works for your ${buyerType} buyer:**\n`

        if (recommendedLayout === 'chart_focus') {
          rationale += `- ${buyerType === 'financial' ? 'Financial sponsors' : buyerType === 'strategic' ? 'Strategic buyers' : 'This buyer type'} prioritize data-driven decisions. A chart-focused layout puts the numbers front and center.\n`
          rationale += `- Visual representation of ${metrics || 'key metrics'} helps ${priorities ? `address their focus on ${priorities}` : 'reinforce your value proposition'}.\n`
        } else if (recommendedLayout === 'two_column') {
          rationale += `- Side-by-side comparisons help ${buyerType} buyers quickly assess competitive advantages.\n`
          rationale += `- This layout efficiently addresses ${priorities || 'key priorities'} by showing contrasts clearly.\n`
        } else if (recommendedLayout === 'title_slide') {
          rationale += `- A clean title slide establishes credibility and sets the right tone for ${buyerType} buyers.\n`
          rationale += `- First impressions matter - this layout signals professionalism.\n`
        } else {
          rationale += `- A content-focused layout ensures ${buyerType} buyers can quickly scan key points.\n`
          rationale += `- Clear bullet structure helps address ${priorities || 'their key priorities'} systematically.\n`
        }

        if (chartRecommendations.length > 0) {
          rationale += `\n**Chart rationale:**\n`
          for (const chart of chartRecommendations) {
            rationale += `- ${chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} chart: ${chart.purpose}\n`
          }
        }
      } else {
        rationale = `**Layout recommendation:** ${recommendedLayout} layout based on slide content type.`
        if (chartRecommendations.length > 0) {
          rationale += `\n\n**Chart suggestions:** ${chartRecommendations.map(c => c.type).join(', ')} to visualize the data effectively.`
        }
      }

      // Build designer notes
      const notes = `Layout: ${recommendedLayout}. ${chartRecommendations.length > 0 ? `Charts: ${chartRecommendations.map(c => c.type).join(', ')}. ` : ''}${imageSuggestions.length > 0 ? `Images: ${imageSuggestions.join('; ')}. ` : ''}Based on ${slide.title} slide content analysis.`

      return formatSuccess({
        message: 'Visual concept generated',
        slideId: input.slideId,
        slideTitle: slide.title,
        slideStatus: slide.status,
        visualConcept: {
          layout_type: recommendedLayout,
          chart_recommendations: chartRecommendations.map(c => ({
            type: c.type,
            data_description: c.data_description,
            purpose: c.purpose,
          })),
          image_suggestions: imageSuggestions,
          notes,
        },
        rationale,
        buyerContext: buyerPersona ? {
          buyer_type: buyerPersona.buyer_type,
          priorities: buyerPersona.priorities,
          key_metrics: buyerPersona.key_metrics,
        } : null,
      })
    } catch (err) {
      console.error('[generate_visual_concept] Error:', err)
      return formatError('Failed to generate visual concept')
    }
  },
  {
    name: 'generate_visual_concept',
    description: `Generate a visual concept blueprint for an approved slide based on its content and the buyer persona.

**Features:**
- Analyzes slide content to recommend optimal layout type
- Suggests appropriate chart types based on data patterns
- Provides image suggestions where relevant
- Explains WHY each visual choice supports the buyer persona narrative

**Use this tool when:**
1. A slide's content has been approved (status = 'approved')
2. The slide doesn't have a visual_concept yet
3. User asks to generate visuals for a slide

**Output includes:**
- layout_type: title_slide, content, two_column, chart_focus, or image_focus
- chart_recommendations: Array of {type, data_description, purpose}
- image_suggestions: Array of image descriptions
- rationale: Explanation of why these visuals support the narrative`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID to generate visual concept for'),
    }),
  }
)

/**
 * Regenerate visual concept with user modifications
 * Story: E9.10 - Visual Concept Generation
 * AC #4: Alternative Requests - User can request alternative visual concepts
 */
export const regenerateVisualConceptTool = tool(
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

      const slide = cim.slides.find(s => s.id === input.slideId)
      if (!slide) {
        return formatError('Slide not found')
      }

      const buyerPersona = cim.buyerPersona
      const contentTexts = slide.components.filter(c => c.type === 'text' || c.type === 'bullet').map(c => c.content).join(' ')

      // Apply user preferences to layout selection
      let recommendedLayout: LayoutType = 'content'
      const preference = input.preference?.toLowerCase() || ''

      // Parse user preference to determine layout
      if (preference.includes('chart') || preference.includes('data') || preference.includes('metric')) {
        recommendedLayout = 'chart_focus'
      } else if (preference.includes('compare') || preference.includes('column') || preference.includes('side')) {
        recommendedLayout = 'two_column'
      } else if (preference.includes('image') || preference.includes('photo') || preference.includes('visual')) {
        recommendedLayout = 'image_focus'
      } else if (preference.includes('title') || preference.includes('simple') || preference.includes('clean')) {
        recommendedLayout = 'title_slide'
      } else if (preference.includes('text') || preference.includes('content') || preference.includes('bullet')) {
        recommendedLayout = 'content'
      } else if (input.preferredLayout) {
        recommendedLayout = input.preferredLayout as LayoutType
      }

      // Generate chart recommendations based on preference
      const chartRecommendations: { type: ChartType; data_description: string; purpose: string }[] = []

      // Apply preferred chart type if specified
      if (input.preferredChartType) {
        chartRecommendations.push({
          type: input.preferredChartType as ChartType,
          data_description: 'User-specified chart type',
          purpose: `User requested ${input.preferredChartType} chart for this data`,
        })
      } else {
        // Parse chart preference from text
        if (preference.includes('bar')) {
          chartRecommendations.push({
            type: 'bar',
            data_description: 'Comparative data',
            purpose: 'Bar charts effectively show comparisons',
          })
        }
        if (preference.includes('pie')) {
          chartRecommendations.push({
            type: 'pie',
            data_description: 'Distribution breakdown',
            purpose: 'Pie charts show proportions at a glance',
          })
        }
        if (preference.includes('line') || preference.includes('trend')) {
          chartRecommendations.push({
            type: 'line',
            data_description: 'Trend over time',
            purpose: 'Line charts show progression and momentum',
          })
        }
        if (preference.includes('area')) {
          chartRecommendations.push({
            type: 'area',
            data_description: 'Cumulative data',
            purpose: 'Area charts emphasize volume over time',
          })
        }
        if (preference.includes('table')) {
          chartRecommendations.push({
            type: 'table',
            data_description: 'Detailed data',
            purpose: 'Tables allow precise data comparison',
          })
        }
      }

      // Generate image suggestions if image-focused
      const imageSuggestions: string[] = []
      if (recommendedLayout === 'image_focus' || preference.includes('image')) {
        if (contentTexts.toLowerCase().includes('team')) {
          imageSuggestions.push('Leadership team photos')
        }
        if (contentTexts.toLowerCase().includes('product')) {
          imageSuggestions.push('Product screenshots')
        }
        if (contentTexts.toLowerCase().includes('customer')) {
          imageSuggestions.push('Customer logos')
        }
        if (imageSuggestions.length === 0) {
          imageSuggestions.push('Relevant visual to support the content')
        }
      }

      // Build rationale
      let rationale = `**Modified visual concept based on your request: "${input.preference}"**\n\n`
      rationale += `**Layout:** ${recommendedLayout}\n`

      if (buyerPersona) {
        rationale += `\n**Buyer alignment:**\n`
        rationale += `- Tailored for your ${buyerPersona.buyer_type} buyer\n`
        if (buyerPersona.priorities.length > 0) {
          rationale += `- Supports their focus on ${buyerPersona.priorities.slice(0, 2).join(' and ')}\n`
        }
      }

      if (chartRecommendations.length > 0) {
        rationale += `\n**Charts:**\n`
        for (const chart of chartRecommendations) {
          rationale += `- ${chart.type}: ${chart.purpose}\n`
        }
      }

      const notes = `Layout: ${recommendedLayout}. Modified per user request: "${input.preference}". ${chartRecommendations.length > 0 ? `Charts: ${chartRecommendations.map(c => c.type).join(', ')}. ` : ''}`

      return formatSuccess({
        message: 'Visual concept regenerated with your preferences',
        slideId: input.slideId,
        slideTitle: slide.title,
        userPreference: input.preference,
        visualConcept: {
          layout_type: recommendedLayout,
          chart_recommendations: chartRecommendations,
          image_suggestions: imageSuggestions,
          notes,
        },
        rationale,
      })
    } catch (err) {
      console.error('[regenerate_visual_concept] Error:', err)
      return formatError('Failed to regenerate visual concept')
    }
  },
  {
    name: 'regenerate_visual_concept',
    description: `Regenerate a visual concept with user modifications or preferences.

**Use this tool when user requests:**
- "try a different layout"
- "use a pie chart instead"
- "more data-focused"
- "simpler layout"
- "show as comparison"
- "use two columns"

**Parameters:**
- preference: User's modification request (e.g., "use bar chart", "more visual")
- preferredLayout: Specific layout type if user mentioned one
- preferredChartType: Specific chart type if user requested one`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().uuid().describe('The slide ID to regenerate visual concept for'),
      preference: z.string().describe('User preference/modification request (e.g., "use pie chart", "simpler layout")'),
      preferredLayout: z.enum(LAYOUT_TYPES).optional().describe('Specific layout type if requested'),
      preferredChartType: z.enum(CHART_TYPES).optional().describe('Specific chart type if requested'),
    }),
  }
)

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
// Dependency Tracking Tools (E9.11)
// ============================================================================

/**
 * Track slide dependencies - updates the dependency graph when a slide references other slides
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 * AC #1: Agent maintains a dependency graph between slides
 */
export const trackDependenciesTool = tool(
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

      // Validate that the slide exists
      const slide = cim.slides.find(s => s.id === input.slideId)
      if (!slide) {
        return formatError(`Slide ${input.slideId} not found`)
      }

      // Validate that all referenced slides exist
      const validSlideIds = new Set(cim.slides.map(s => s.id))
      const invalidRefs = input.referencedSlideIds.filter(id => !validSlideIds.has(id))
      if (invalidRefs.length > 0) {
        return formatError(`Referenced slides not found: ${invalidRefs.join(', ')}`)
      }

      // Update the dependency graph
      const updatedGraph = updateGraphOnSlideChange(
        cim.dependencyGraph,
        input.slideId,
        input.referencedSlideIds
      )

      // Persist to database
      await updateCIM(supabase, input.cimId, {
        dependencyGraph: updatedGraph,
      })

      // Get stats for response
      const stats = getGraphStats(updatedGraph)
      const validation = validateGraph(updatedGraph)

      return formatSuccess({
        message: 'Dependencies tracked successfully',
        slideId: input.slideId,
        referencedSlides: input.referencedSlideIds,
        graphStats: {
          totalSlides: stats.totalSlides,
          totalEdges: stats.totalEdges,
        },
        graphValid: validation.isValid,
      })
    } catch (err) {
      console.error('[track_dependencies] Error:', err)
      return formatError('Failed to track dependencies')
    }
  },
  {
    name: 'track_dependencies',
    description: `Track dependencies between slides. Call this when a slide references content from other slides.

**When to use:**
- After creating/updating slide content that references other slides
- When slide mentions data points, metrics, or narrative from other slides
- After approving slide content to record detected dependencies

**Example references to detect:**
- "As shown in slide 3..." → references s3
- "Building on our revenue of $10M" (from slide 3) → references s3
- Executive summary referencing multiple slides → references all cited slides`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().describe('The slide ID that references other slides (e.g., "s7")'),
      referencedSlideIds: z.array(z.string()).describe('Array of slide IDs this slide references (e.g., ["s3", "s5"])'),
    }),
  }
)

/**
 * Get slides that depend on a given slide
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 * AC #2: When user edits slide N, agent identifies all slides that depend on it
 */
export const getDependentSlidesTool = tool(
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

      // Validate that the slide exists
      const slide = cim.slides.find(s => s.id === input.slideId)
      if (!slide) {
        return formatError(`Slide ${input.slideId} not found`)
      }

      // Get dependents from the graph
      const dependentIds = getDependents(cim.dependencyGraph, input.slideId)

      // Get slide details for each dependent
      const dependentSlides = dependentIds
        .map(id => cim.slides.find(s => s.id === id))
        .filter((s): s is Slide => s !== undefined)
        .map(s => ({
          id: s.id,
          title: s.title,
          sectionId: s.section_id,
          status: s.status,
        }))

      // Get section titles for context
      const dependentSlidesWithSections = dependentSlides.map(s => {
        const section = cim.outline.find(sec => sec.id === s.sectionId)
        return {
          ...s,
          sectionTitle: section?.title || 'Unknown Section',
        }
      })

      const hasDependents = dependentSlidesWithSections.length > 0

      return formatSuccess({
        message: hasDependents
          ? `Found ${dependentSlidesWithSections.length} slide(s) that depend on slide "${slide.title}"`
          : `No slides depend on slide "${slide.title}"`,
        slideId: input.slideId,
        slideTitle: slide.title,
        dependentSlides: dependentSlidesWithSections,
        dependentCount: dependentSlidesWithSections.length,
        hasDependents,
        // Proactive suggestion for agent to communicate (AC #4)
        proactiveSuggestion: hasDependents
          ? `⚠️ **Attention:** Changes to "${slide.title}" may affect ${dependentSlidesWithSections.length} other slide(s):\n${dependentSlidesWithSections.map(s => `- ${s.title} (${s.sectionTitle})`).join('\n')}\n\nConsider reviewing these slides after making changes.`
          : null,
      })
    } catch (err) {
      console.error('[get_dependent_slides] Error:', err)
      return formatError('Failed to get dependent slides')
    }
  },
  {
    name: 'get_dependent_slides',
    description: `Get all slides that depend on a given slide. Use this to warn users about potential impacts when editing slide content.

**When to use:**
- Before or after a slide is edited
- When user clicks on a slide to modify it
- To check what might be affected by a change

**Response includes:**
- List of dependent slides with titles and sections
- Proactive warning message for user communication
- Whether any dependents exist`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().describe('The slide ID to check dependents for'),
    }),
  }
)

/**
 * Validate narrative coherence across slides
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 * AC #6: Agent validates narrative flow and flags inconsistencies
 */
export const validateCoherenceTool = tool(
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

      const issues: Array<{
        type: 'conflict' | 'broken_reference' | 'narrative_gap'
        severity: 'warning' | 'error'
        slideId: string
        slideTitle: string
        description: string
        relatedSlideId?: string
      }> = []

      // Get slides with content to analyze
      const slidesWithContent = cim.slides.filter(s =>
        s.components && s.components.length > 0
      )

      // Check 1: Broken references - slides that reference non-existent slides
      for (const slideId of Object.keys(cim.dependencyGraph.references || {})) {
        const refs = cim.dependencyGraph.references[slideId] || []
        const slide = cim.slides.find(s => s.id === slideId)

        for (const refId of refs) {
          const refSlide = cim.slides.find(s => s.id === refId)
          if (!refSlide) {
            issues.push({
              type: 'broken_reference',
              severity: 'error',
              slideId,
              slideTitle: slide?.title || slideId,
              description: `References deleted slide ${refId}`,
            })
          } else if (refSlide.status === 'draft' && slide?.status === 'approved') {
            issues.push({
              type: 'broken_reference',
              severity: 'warning',
              slideId,
              slideTitle: slide?.title || slideId,
              description: `References draft slide "${refSlide.title}" - content may not be finalized`,
              relatedSlideId: refId,
            })
          }
        }
      }

      // Check 2: Find potential data conflicts across slides
      // Extract numeric values from slide content for comparison
      const numericPatterns: Array<{
        slideId: string
        slideTitle: string
        pattern: string
        value: string
        context: string
      }> = []

      for (const slide of slidesWithContent) {
        for (const component of slide.components) {
          const content = component.content || ''
          // Match common financial/metric patterns: $X, X%, X million, etc.
          const matches = content.match(/\$[\d,.]+\s*(?:M|B|K|million|billion)?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:million|billion|M|B|K)/gi)

          if (matches) {
            matches.forEach(match => {
              numericPatterns.push({
                slideId: slide.id,
                slideTitle: slide.title,
                pattern: match.toLowerCase().replace(/[\s,]/g, ''),
                value: match,
                context: content.substring(0, 50),
              })
            })
          }
        }
      }

      // Look for conflicting values that might represent the same metric
      // This is a heuristic - we flag similar-looking values that differ
      const valueGroups = new Map<string, typeof numericPatterns>()
      for (const p of numericPatterns) {
        // Group by rough category ($ values, % values, etc.)
        const category = p.pattern.includes('$') ? 'currency' :
                        p.pattern.includes('%') ? 'percentage' : 'number'
        const key = category
        const group = valueGroups.get(key) || []
        group.push(p)
        valueGroups.set(key, group)
      }

      // For each category, check if there are significantly different values
      // that appear in dependent slides
      for (const slideId of Object.keys(cim.dependencyGraph.dependencies || {})) {
        const dependents = cim.dependencyGraph.dependencies[slideId] || []
        const sourceSlide = cim.slides.find(s => s.id === slideId)

        if (dependents.length > 0 && sourceSlide) {
          // Get values from source slide
          const sourcePatterns = numericPatterns.filter(p => p.slideId === slideId)

          for (const dependent of dependents) {
            const dependentPatterns = numericPatterns.filter(p => p.slideId === dependent)
            const dependentSlide = cim.slides.find(s => s.id === dependent)

            // Check if dependent slide has different values for similar patterns
            for (const sp of sourcePatterns) {
              for (const dp of dependentPatterns) {
                // Same category but different value
                const sameCategory = (sp.pattern.includes('$') && dp.pattern.includes('$')) ||
                                   (sp.pattern.includes('%') && dp.pattern.includes('%'))

                if (sameCategory && sp.pattern !== dp.pattern) {
                  // Only flag if values are "close" enough to potentially be the same metric
                  // e.g., $10M vs $12M might be the same metric with different values
                  const sv = parseFloat(sp.pattern.replace(/[^0-9.]/g, ''))
                  const dv = parseFloat(dp.pattern.replace(/[^0-9.]/g, ''))

                  if (!isNaN(sv) && !isNaN(dv)) {
                    const ratio = Math.max(sv, dv) / Math.min(sv, dv)
                    // Flag if values are within 2x of each other but not equal
                    if (ratio < 2 && ratio > 1.05) {
                      issues.push({
                        type: 'conflict',
                        severity: 'warning',
                        slideId: dependent,
                        slideTitle: dependentSlide?.title || dependent,
                        description: `Value "${dp.value}" differs from "${sp.value}" in "${sourceSlide.title}"`,
                        relatedSlideId: slideId,
                      })
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Check 3: Narrative gaps - look for approved slides with no dependencies
      // that come after slides with dependencies (potential flow issue)
      const approvedSlides = cim.slides.filter(s => s.status === 'approved')
      const sortedApproved = [...approvedSlides].sort((a, b) => {
        const sectionA = cim.outline.find(o => o.id === a.section_id)
        const sectionB = cim.outline.find(o => o.id === b.section_id)
        return (sectionA?.order || 0) - (sectionB?.order || 0)
      })

      let previousHadDependencies = false
      for (const slide of sortedApproved) {
        const refs = getReferences(cim.dependencyGraph, slide.id)
        const hasDeps = refs.length > 0

        // Skip first few slides (intro/overview often has no deps)
        const slideOrder = cim.outline.find(o => o.id === slide.section_id)?.order || 0
        if (slideOrder > 2 && previousHadDependencies && !hasDeps) {
          // This slide has no references but previous ones did
          // Could indicate a narrative gap
          issues.push({
            type: 'narrative_gap',
            severity: 'warning',
            slideId: slide.id,
            slideTitle: slide.title,
            description: 'No cross-references to other slides - potential narrative disconnect',
          })
        }

        previousHadDependencies = hasDeps
      }

      // Deduplicate issues
      const uniqueIssues = issues.filter((issue, index, self) =>
        index === self.findIndex(i =>
          i.slideId === issue.slideId && i.type === issue.type && i.description === issue.description
        )
      )

      const hasIssues = uniqueIssues.length > 0
      const errorCount = uniqueIssues.filter(i => i.severity === 'error').length
      const warningCount = uniqueIssues.filter(i => i.severity === 'warning').length

      return formatSuccess({
        message: hasIssues
          ? `Found ${uniqueIssues.length} coherence issue(s): ${errorCount} error(s), ${warningCount} warning(s)`
          : 'No coherence issues found',
        hasIssues,
        issues: uniqueIssues,
        summary: {
          totalIssues: uniqueIssues.length,
          errors: errorCount,
          warnings: warningCount,
          brokenReferences: uniqueIssues.filter(i => i.type === 'broken_reference').length,
          conflicts: uniqueIssues.filter(i => i.type === 'conflict').length,
          narrativeGaps: uniqueIssues.filter(i => i.type === 'narrative_gap').length,
        },
        // Formatted message for agent to present to user
        formattedMessage: hasIssues
          ? `⚠️ **Coherence Check Results**\n\n${uniqueIssues.map(i =>
              `- **${i.slideTitle}**: ${i.description}${i.relatedSlideId ? ` (see slide ${i.relatedSlideId})` : ''}`
            ).join('\n')}\n\nWould you like me to help address these issues?`
          : '✅ All slides are coherent - no conflicts, broken references, or narrative gaps detected.',
      })
    } catch (err) {
      console.error('[validate_coherence] Error:', err)
      return formatError('Failed to validate coherence')
    }
  },
  {
    name: 'validate_coherence',
    description: `Validate narrative coherence across all CIM slides. Checks for:
- **Conflicting data**: Same metrics with different values across slides
- **Broken references**: Slides referencing deleted or incomplete content
- **Narrative gaps**: Disconnected slides that break narrative flow

**When to use:**
- After multiple slides have been edited
- When user navigates non-linearly through the CIM
- Before finalizing/exporting the CIM
- When user asks to "check for issues" or "validate the document"

Returns a summary of issues with specific slide references for correction.`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID to validate'),
    }),
  }
)

// ============================================================================
// Narrative Structure Tools (E9.12)
// ============================================================================

/**
 * Check content-role compatibility for a slide
 * Story: E9.12 - Narrative Structure Dependencies
 * AC #3, #4: Content-role compatibility checking
 */
export const checkNarrativeCompatibilityTool = tool(
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

      const slide = cim.slides.find(s => s.id === input.slideId)
      if (!slide) {
        return formatError('Slide not found')
      }

      if (!slide.narrative_role) {
        return formatSuccess({
          message: 'Slide has no assigned narrative role',
          slideId: input.slideId,
          slideTitle: slide.title,
          hasRole: false,
        })
      }

      // Get slide content
      const content = slide.components.map(c => c.content).join(' ')

      // Check compatibility
      const result = checkContentRoleCompatibility(content, slide.narrative_role)

      return formatSuccess({
        message: result.isCompatible
          ? `Content is compatible with "${getNarrativeRoleLabel(slide.narrative_role)}" role`
          : `⚠️ Content-role mismatch detected`,
        slideId: input.slideId,
        slideTitle: slide.title,
        hasRole: true,
        assignedRole: slide.narrative_role,
        assignedRoleLabel: getNarrativeRoleLabel(slide.narrative_role),
        isCompatible: result.isCompatible,
        compatibilityLevel: result.compatibilityLevel,
        detectedRole: result.detectedRole,
        detectedRoleLabel: result.detectedRole ? getNarrativeRoleLabel(result.detectedRole) : null,
        mismatchDetails: result.mismatchDetails,
        suggestedRole: result.suggestedRole,
        suggestedRoleLabel: result.suggestedRole ? getNarrativeRoleLabel(result.suggestedRole) : null,
      })
    } catch (err) {
      console.error('[check_narrative_compatibility] Error:', err)
      return formatError('Failed to check narrative compatibility')
    }
  },
  {
    name: 'check_narrative_compatibility',
    description: `Check if a slide's content is compatible with its assigned narrative role.

**Use this tool when:**
- User modifies slide content
- User questions if content fits the slide's purpose
- Before approving slide content
- When reviewing section narrative flow

**Returns:**
- Whether content matches the assigned role
- The detected role based on content analysis
- Suggestion for a better-fitting role if mismatched`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      slideId: z.string().describe('The slide ID to check'),
    }),
  }
)

/**
 * Get reorganization suggestions for a section
 * Story: E9.12 - Narrative Structure Dependencies
 * AC #5: Reorganization suggestions
 */
export const getSectionReorganizationTool = tool(
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

      const section = cim.outline.find(s => s.id === input.sectionId)
      if (!section) {
        return formatError('Section not found')
      }

      // Get slides for this section
      const sectionSlides = cim.slides.filter(s => s.section_id === input.sectionId)

      if (sectionSlides.length === 0) {
        return formatSuccess({
          message: 'No slides in this section yet',
          sectionId: input.sectionId,
          sectionTitle: section.title,
          suggestions: [],
        })
      }

      // Get reorganization suggestions
      const suggestions = suggestReorganization(sectionSlides, section)

      // Format suggestions with slide titles
      const formattedSuggestions = suggestions.map(s => ({
        type: s.type,
        slideId: s.slideId,
        slideTitle: s.slideTitle,
        currentRole: s.currentRole,
        currentRoleLabel: s.currentRole ? getNarrativeRoleLabel(s.currentRole) : null,
        suggestedRole: s.suggestedRole,
        suggestedRoleLabel: getNarrativeRoleLabel(s.suggestedRole),
        reason: s.reason,
        targetPosition: s.targetPosition,
      }))

      const hasSuggestions = formattedSuggestions.length > 0

      return formatSuccess({
        message: hasSuggestions
          ? `Found ${formattedSuggestions.length} suggestion(s) to improve narrative flow`
          : 'Section narrative structure looks good!',
        sectionId: input.sectionId,
        sectionTitle: section.title,
        slideCount: sectionSlides.length,
        hasSuggestions,
        suggestions: formattedSuggestions,
        // Proactive message for agent to present
        proactiveMessage: hasSuggestions
          ? `📋 **Narrative Structure Suggestions for "${section.title}":**\n\n${formattedSuggestions.map((s, i) =>
              `${i + 1}. **${s.slideTitle}**: ${s.reason}`
            ).join('\n')}\n\nWould you like me to apply any of these suggestions?`
          : null,
      })
    } catch (err) {
      console.error('[get_section_reorganization] Error:', err)
      return formatError('Failed to get reorganization suggestions')
    }
  },
  {
    name: 'get_section_reorganization',
    description: `Get suggestions for reorganizing slides within a section to improve narrative flow.

**Use this tool when:**
- User asks to improve section flow
- After adding multiple slides to a section
- When reviewing section structure
- User asks "is this section organized well?"

**Returns:**
- List of suggestions (role changes, reordering)
- Explanation for each suggestion
- Proactive message to present to user`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().describe('The section ID to analyze'),
    }),
  }
)

/**
 * Validate narrative structure for a section or entire CIM
 * Story: E9.12 - Narrative Structure Dependencies
 * AC #6: Extends coherence validation with narrative checks
 */
export const validateNarrativeStructureTool = tool(
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

      // If sectionId provided, validate just that section
      // Otherwise validate all sections
      const sectionsToValidate = input.sectionId
        ? cim.outline.filter(s => s.id === input.sectionId)
        : cim.outline

      if (sectionsToValidate.length === 0) {
        return formatError('No sections to validate')
      }

      interface SectionValidation {
        sectionId: string
        sectionTitle: string
        isValid: boolean
        completeness: number
        issueCount: number
        suggestionCount: number
        issues: Array<{
          type: string
          severity: string
          slideId?: string
          slideTitle?: string
          description: string
        }>
      }

      const sectionResults: SectionValidation[] = []
      let totalIssues = 0
      let totalSuggestions = 0

      for (const section of sectionsToValidate) {
        const sectionSlides = cim.slides.filter(s => s.section_id === section.id)
        const result = validateNarrativeStructure(sectionSlides, section)

        sectionResults.push({
          sectionId: section.id,
          sectionTitle: section.title,
          isValid: result.isValid,
          completeness: result.completeness,
          issueCount: result.issues.length,
          suggestionCount: result.suggestions.length,
          issues: result.issues,
        })

        totalIssues += result.issues.length
        totalSuggestions += result.suggestions.length
      }

      const allValid = sectionResults.every(r => r.isValid)
      const averageCompleteness = sectionResults.length > 0
        ? Math.round(sectionResults.reduce((sum, r) => sum + r.completeness, 0) / sectionResults.length)
        : 100

      // Build formatted message
      let formattedMessage = ''
      if (allValid && totalIssues === 0) {
        formattedMessage = '✅ **Narrative Structure Valid**\n\nAll sections have proper narrative flow with no issues detected.'
      } else {
        formattedMessage = `⚠️ **Narrative Structure Issues Found**\n\n`
        formattedMessage += `- Sections checked: ${sectionResults.length}\n`
        formattedMessage += `- Total issues: ${totalIssues}\n`
        formattedMessage += `- Suggestions available: ${totalSuggestions}\n\n`

        for (const section of sectionResults) {
          if (section.issueCount > 0) {
            formattedMessage += `**${section.sectionTitle}** (${section.completeness}% complete):\n`
            for (const issue of section.issues) {
              formattedMessage += `  - ${issue.description}\n`
            }
            formattedMessage += '\n'
          }
        }

        formattedMessage += '\nWould you like me to show reorganization suggestions?'
      }

      return formatSuccess({
        message: allValid ? 'Narrative structure is valid' : 'Narrative structure has issues',
        isValid: allValid,
        averageCompleteness,
        totalIssues,
        totalSuggestions,
        sectionResults,
        formattedMessage,
      })
    } catch (err) {
      console.error('[validate_narrative_structure] Error:', err)
      return formatError('Failed to validate narrative structure')
    }
  },
  {
    name: 'validate_narrative_structure',
    description: `Validate narrative structure for a section or the entire CIM.

**Checks for:**
- Missing required narrative roles
- Roles out of expected order
- Content-role mismatches
- Duplicate roles where only one is expected

**Use this tool when:**
- Before finalizing a section
- When user asks to review structure
- After significant content changes
- Before exporting the CIM

**Returns:**
- Validity status per section
- Completeness percentage
- List of issues and suggestions`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().optional().describe('Specific section ID (optional, validates all if omitted)'),
    }),
  }
)

// ============================================================================
// Navigation Tools (E9.13 - Non-Linear Navigation with Context)
// ============================================================================

/**
 * Navigate to a specific section in the CIM
 * Story: E9.13 - Non-Linear Navigation with Context
 *
 * This tool:
 * 1. Checks for incomplete dependencies at the target section
 * 2. Provides context summary for the agent
 * 3. Returns warnings if jumping ahead may cause issues
 */
export const navigateToSectionTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      // Find target section
      const targetSection = cim.outline.find((s) => s.id === input.sectionId)
      if (!targetSection) {
        return formatError('Section not found')
      }

      // Find current section index if provided
      let fromIndex: number | null = null
      if (input.fromSectionId) {
        const fromSection = cim.outline.find((s) => s.id === input.fromSectionId)
        if (fromSection) {
          fromIndex = cim.outline.findIndex((s) => s.id === input.fromSectionId)
        }
      }

      const toIndex = cim.outline.findIndex((s) => s.id === input.sectionId)

      // Perform coherence check unless explicitly skipped
      let warnings: ReturnType<typeof checkNavigationCoherence> = []
      let requiresConfirmation = false

      if (!input.skipCoherenceCheck) {
        warnings = checkNavigationCoherence(
          input.sectionId,
          cim.outline,
          cim.slides,
          cim.dependencyGraph
        )
        requiresConfirmation = shouldRequireConfirmation(warnings)
      }

      // Get context summary for the agent
      const contextSummary = getNavigationContextSummary(
        input.sectionId,
        cim.outline,
        cim.slides,
        cim.dependencyGraph
      )

      // Get slides in this section
      const sectionSlides = cim.slides
        .filter((s) => s.section_id === input.sectionId)
        .map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          narrativeRole: s.narrative_role,
        }))

      // Determine navigation type
      let navigationType: 'sequential' | 'jump' | 'backward' | 'forward' = 'sequential'
      if (fromIndex !== null) {
        const diff = toIndex - fromIndex
        if (diff === 1) {
          navigationType = 'sequential'
        } else if (diff === -1) {
          navigationType = 'backward'
        } else if (diff > 1) {
          navigationType = 'jump'
        } else if (diff < -1) {
          navigationType = 'backward'
        }
      }

      // Build formatted message for user
      let formattedMessage = `**Navigating to: ${targetSection.title}**\n\n`
      formattedMessage += contextSummary + '\n\n'

      if (warnings.length > 0) {
        formattedMessage += formatNavigationWarnings(warnings)

        if (requiresConfirmation && !input.acknowledgeWarnings) {
          formattedMessage += '\n\n⚠️ This section has incomplete dependencies. Proceeding may result in placeholder content that needs updating later.'
        }
      }

      // Get recommended next section for agent context
      const recommendedNext = getRecommendedNextSection(
        cim.outline,
        cim.slides,
        cim.dependencyGraph
      )

      return formatSuccess({
        message: requiresConfirmation && !input.acknowledgeWarnings
          ? 'Navigation requires confirmation due to incomplete dependencies'
          : 'Navigation successful',
        sectionId: input.sectionId,
        sectionTitle: targetSection.title,
        sectionStatus: targetSection.status,
        sectionDescription: targetSection.description,
        navigationType,
        slides: sectionSlides,
        warnings: warnings.map((w) => ({
          type: w.type,
          message: w.message,
          severity: w.severity,
          incompleteDependencies: w.incompleteDependencies,
        })),
        requiresConfirmation: requiresConfirmation && !input.acknowledgeWarnings,
        contextSummary,
        recommendedNextSection: recommendedNext,
        formattedMessage,
      })
    } catch (err) {
      console.error('[navigate_to_section] Error:', err)
      return formatError('Failed to navigate to section')
    }
  },
  {
    name: 'navigate_to_section',
    description: `Navigate to a specific section in the CIM to work on it.

**This tool:**
- Checks for incomplete dependencies at the target section
- Warns if jumping ahead may cause content issues
- Provides context about the section and its relationships

**Use this tool when:**
- User requests to jump to a specific section
- User clicks on a section in the structure tree
- Moving to the next section in workflow
- User wants to review a previously completed section

**Returns:**
- Section details and status
- Warnings about incomplete dependencies
- Context summary for understanding the section
- Recommendation for next section to work on

**IMPORTANT:** If requiresConfirmation is true, ask user before proceeding with content creation.`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
      sectionId: z.string().uuid().describe('The section ID to navigate to'),
      fromSectionId: z.string().uuid().optional().describe('Current section ID (for determining navigation type)'),
      skipCoherenceCheck: z.boolean().optional().describe('Skip dependency coherence check (not recommended)'),
      acknowledgeWarnings: z.boolean().optional().describe('User has acknowledged warnings about incomplete dependencies'),
    }),
  }
)

/**
 * Get recommended next section to work on
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const getNextSectionTool = tool(
  async (input) => {
    try {
      const supabase = await createClient()

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatError('Authentication required')
      }

      const cim = await getCIM(supabase, input.cimId)
      if (!cim) {
        return formatError('CIM not found')
      }

      const recommendedId = getRecommendedNextSection(
        cim.outline,
        cim.slides,
        cim.dependencyGraph
      )

      if (!recommendedId) {
        return formatSuccess({
          message: 'All sections are complete!',
          hasNextSection: false,
          sectionId: null,
          sectionTitle: null,
        })
      }

      const section = cim.outline.find((s) => s.id === recommendedId)
      const warnings = checkNavigationCoherence(
        recommendedId,
        cim.outline,
        cim.slides,
        cim.dependencyGraph
      )

      return formatSuccess({
        message: `Recommended next section: "${section?.title}"`,
        hasNextSection: true,
        sectionId: recommendedId,
        sectionTitle: section?.title,
        sectionStatus: section?.status,
        warningCount: warnings.length,
        formattedMessage: section
          ? `📍 **Recommended:** ${section.title}\n${section.description || 'No description'}\nStatus: ${section.status}`
          : 'No next section available',
      })
    } catch (err) {
      console.error('[get_next_section] Error:', err)
      return formatError('Failed to get next section')
    }
  },
  {
    name: 'get_next_section',
    description: `Get the recommended next section to work on based on dependencies.

**Recommends sections that:**
- Have all dependencies complete
- Are not yet complete
- Are in the optimal order

**Use this tool when:**
- User asks "what's next?"
- After completing a section
- User wants guidance on workflow order`,
    schema: z.object({
      cimId: z.string().uuid().describe('The CIM ID'),
    }),
  }
)

// ============================================================================
// Export All Tools
// ============================================================================

export const cimTools = [
  // Persona tools
  saveBuyerPersonaTool,
  // Thesis tools
  saveInvestmentThesisTool,
  // Outline tools
  createOutlineSectionTool,
  updateOutlineSectionTool,
  deleteOutlineSectionTool,
  reorderOutlineSectionsTool,
  // Slide content tools (E9.7)
  generateSlideContentTool,
  selectContentOptionTool,  // AC #5: Content Selection
  approveSlideContentTool,  // AC #6: Content Approval
  updateSlideTool,
  // Visual concept tools (E9.10)
  generateVisualConceptTool,  // AC #1, #3: Visual Concept Generation
  regenerateVisualConceptTool,  // AC #4: Alternative Visual Concept Requests
  setVisualConceptTool,  // AC #5: Visual Concept Persistence
  // Dependency tracking tools (E9.11)
  trackDependenciesTool,  // AC #1: Track dependencies between slides
  getDependentSlidesTool,  // AC #2, #4: Get dependent slides with proactive suggestion
  validateCoherenceTool,  // AC #6: Coherence validation
  // Narrative structure tools (E9.12)
  checkNarrativeCompatibilityTool,  // AC #3, #4: Content-role compatibility
  getSectionReorganizationTool,  // AC #5: Reorganization suggestions
  validateNarrativeStructureTool,  // AC #6: Narrative structure validation
  // Navigation tools (E9.13)
  navigateToSectionTool,  // AC #1, #2, #4, #5: Jump to section with coherence check
  getNextSectionTool,  // AC #1: Get recommended next section
  // Workflow tools
  transitionPhaseTool,
]

export const CIM_TOOL_COUNT = cimTools.length
