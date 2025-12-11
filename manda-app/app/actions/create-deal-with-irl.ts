/**
 * Server Action: Create Deal with IRL
 * Handles complete project creation workflow with IRL template integration
 *
 * Workflow:
 * 1. Create deal record
 * 2. If template selected, create IRL from template
 * 3. Auto-generate folders from IRL categories
 * 4. Return complete deal data
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/services/irl-templates'
import { createFoldersFromIRL } from '@/lib/services/folders'
import type { Deal } from '@/lib/supabase/types'

// Map wizard template names to template IDs
// These must match the template names in Step3IRLTemplate.tsx
const TEMPLATE_NAME_TO_ID: Record<string, string> = {
  'Tech M&A': 'tech-ma',
  'Industrial': 'industrial',
  'Pharma': 'pharma',
  'Financial Services': 'financial',
  'General M&A': 'custom',
}

export interface CreateDealWithIRLInput {
  name: string
  company_name?: string | null
  industry?: string | null
  irl_template?: string | null
  status?: string
}

export interface CreateDealWithIRLResponse {
  data: Deal | null
  error: string | null
  irlCreated?: boolean
  foldersCreated?: number
}

/**
 * Create a new deal with integrated IRL and folder generation
 */
export async function createDealWithIRL(
  input: CreateDealWithIRLInput
): Promise<CreateDealWithIRLResponse> {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: null, error: 'Authentication required. Please sign in.' }
  }

  // 2. Create deal record
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      name: input.name,
      company_name: input.company_name || null,
      industry: input.industry || null,
      irl_template: input.irl_template,
      status: input.status || 'active',
    })
    .select()
    .single()

  if (dealError) {
    console.error('Error creating deal:', dealError)

    // Handle specific error cases
    if (dealError.code === '23505') {
      return { data: null, error: 'A project with this name already exists' }
    }
    if (dealError.code === '23503') {
      return { data: null, error: 'Invalid reference data' }
    }
    if (dealError.code === 'PGRST301') {
      return { data: null, error: 'Authentication required. Please sign in.' }
    }

    return { data: null, error: dealError.message }
  }

  let irlCreated = false
  let foldersCreated = 0

  // 3. If IRL template selected, create IRL + folders
  // Skip if 'none' (empty project) or 'upload' (user will upload custom IRL)
  if (
    input.irl_template &&
    input.irl_template !== 'none' &&
    input.irl_template !== 'upload'
  ) {
    try {
      // Map wizard template name to template ID
      const templateId = TEMPLATE_NAME_TO_ID[input.irl_template]

      if (!templateId) {
        console.warn(
          `[Deal Creation] Unknown IRL template: ${input.irl_template}. Skipping IRL creation.`
        )
        return { data: deal, error: null, irlCreated: false, foldersCreated: 0 }
      }

      // Load template from JSON files
      const template = await getTemplate(templateId)
      if (!template) {
        console.warn(
          `[Deal Creation] Template not found: ${templateId}. Skipping IRL creation.`
        )
        return { data: deal, error: null, irlCreated: false, foldersCreated: 0 }
      }

      console.log(
        `[Deal Creation] Creating IRL from template "${template.name}" for deal ${deal.id}`
      )

      // 4. Create IRL record with template data
      const sectionsData = template.categories.map((cat) => ({
        name: cat.name,
        items: cat.items.map((item) => ({
          name: item.name,
          description: item.description || '',
          priority: item.priority,
          status: 'not_started',
          subcategory: item.subcategory,
        })),
      }))

      const { data: irl, error: irlError } = await supabase
        .from('irls')
        .insert({
          deal_id: deal.id,
          user_id: user.id,
          name: `${input.name} - IRL`,
          template_type: templateId,
          sections: sectionsData,
          progress_percent: 0,
        })
        .select()
        .single()

      if (irlError) {
        console.error('[Deal Creation] Failed to create IRL:', irlError)
        // Don't fail deal creation if IRL fails
        return { data: deal, error: null, irlCreated: false, foldersCreated: 0 }
      }

      irlCreated = true
      console.log(`[Deal Creation] IRL created: ${irl.id}`)

      // 5. Create IRL items in irl_items table for interactivity (marking as fulfilled, etc.)
      try {
        const irlItems = template.categories.flatMap((cat, catIndex) =>
          cat.items.map((item, itemIndex) => ({
            irl_id: irl.id,
            category: cat.name,
            subcategory: item.subcategory || null,
            item_name: item.name,
            description: item.description || null,
            priority: item.priority || 'medium',
            status: 'not_started',
            sort_order: catIndex * 1000 + itemIndex,
          }))
        )

        const { error: itemsError } = await supabase.from('irl_items').insert(irlItems)

        if (itemsError) {
          console.error('[Deal Creation] Failed to create IRL items:', itemsError)
          // Continue anyway - items can be created manually
        } else {
          console.log(`[Deal Creation] Created ${irlItems.length} IRL items`)
        }
      } catch (itemsError) {
        console.error('[Deal Creation] Error creating IRL items:', itemsError)
        // Don't fail - items can be created manually
      }

      // 6. Generate folders from IRL categories
      try {
        const folderResult = await createFoldersFromIRL(supabase, deal.id, irl.id)
        foldersCreated = folderResult.created

        console.log(
          `[Deal Creation] Generated ${folderResult.created} folders from IRL ` +
            `(skipped ${folderResult.skipped} existing)`
        )
      } catch (folderError) {
        console.error('[Deal Creation] Failed to generate folders:', folderError)
        // Don't fail deal creation if folder generation fails
        // User can manually create folders or regenerate later
      }
    } catch (error) {
      console.error('[Deal Creation] Error in IRL/folder creation:', error)
      // Don't fail the deal creation - user can create IRL manually
    }
  } else if (input.irl_template === 'upload') {
    console.log(
      `[Deal Creation] Deal created with 'upload' option. User will upload custom IRL.`
    )
  } else {
    console.log(`[Deal Creation] Deal created without IRL template (empty project).`)
  }

  return {
    data: deal,
    error: null,
    irlCreated,
    foldersCreated,
  }
}
