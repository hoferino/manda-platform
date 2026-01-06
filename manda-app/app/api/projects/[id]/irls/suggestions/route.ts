/**
 * IRL Suggestions API Route
 * POST - Generate AI-assisted IRL suggestions
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLLMClient } from '@/lib/llm/client'
import { listTemplates, getTemplate } from '@/lib/services/irl-templates'
import { getIRLWithItems } from '@/lib/services/irls'
import { z } from 'zod'

interface RouteContext {
  params: Promise<{ id: string }>
}

const SuggestionsRequestSchema = z.object({
  irlId: z.string().uuid().optional(),
  dealType: z.string().optional(),
})

/**
 * Map deal type string to template ID
 */
function mapDealTypeToTemplateId(dealType: string): string | null {
  const mapping: Record<string, string> = {
    tech_ma: 'tech-ma',
    tech: 'tech-ma',
    software: 'tech-ma',
    saas: 'tech-ma',
    industrial: 'industrial',
    manufacturing: 'industrial',
    pharma: 'pharma',
    healthcare: 'pharma',
    biotech: 'pharma',
    financial: 'financial-services',
    financial_services: 'financial-services',
    fintech: 'financial-services',
    banking: 'financial-services',
  }

  const normalized = dealType.toLowerCase().replace(/[^a-z_]/g, '_')
  return mapping[normalized] || null
}

/**
 * POST /api/projects/[id]/irls/suggestions
 * Generate IRL suggestions based on deal context
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params
    const body = await request.json()

    // Validate request body
    const parseResult = SuggestionsRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { irlId, dealType } = parseResult.data
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project and get deal info
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, name, irl_template, industry')
      .eq('id', projectId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get current IRL items if IRL ID provided
    let currentIRLItems: Array<{ category: string; itemName: string }> = []
    if (irlId) {
      const irl = await getIRLWithItems(supabase, irlId)
      if (irl) {
        currentIRLItems = irl.items.map((item) => ({
          category: item.category,
          itemName: item.itemName,
        }))
      }
    }

    // Get uploaded documents for context
    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, mime_type, folder_path')
      .eq('deal_id', projectId)

    const documentNames = (documents || []).map((d) => d.name)

    // Resolve deal type
    const resolvedDealType = dealType || deal.irl_template || 'general'

    // Get template items for comparison
    const templateId = mapDealTypeToTemplateId(resolvedDealType)
    let templateItems: Array<{ category: string; name: string; priority: string; description?: string }> = []

    if (templateId) {
      const template = await getTemplate(templateId)
      if (template) {
        templateItems = template.categories.flatMap((cat) =>
          cat.items.map((item) => ({
            category: cat.name,
            name: item.name,
            priority: item.priority ?? 'medium',
            description: item.description,
          }))
        )
      }
    }

    // Find missing template items (simple comparison)
    const currentItemNames = new Set(
      currentIRLItems.map((item) => item.itemName.toLowerCase().trim())
    )

    const missingItems = templateItems.filter(
      (item) => !currentItemNames.has(item.name.toLowerCase().trim())
    )

    // Generate suggestions (up to 10)
    const suggestions = missingItems.slice(0, 10).map((item) => ({
      category: item.category,
      itemName: item.name,
      priority: item.priority as 'high' | 'medium' | 'low',
      rationale: item.description || `Standard ${resolvedDealType} due diligence requirement`,
    }))

    return NextResponse.json({
      suggestions,
      total: suggestions.length,
      dealType: resolvedDealType,
      documentsAnalyzed: documentNames.length,
      currentIRLItemCount: currentIRLItems.length,
    })
  } catch (error) {
    console.error('Error in POST /api/projects/[id]/irls/suggestions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
