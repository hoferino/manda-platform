/**
 * CIM Service
 *
 * CRUD operations for CIM entities stored in Supabase.
 * Story: E9.1 - CIM Database Schema & Deal Integration
 *
 * Features:
 * - Create, read, update, delete CIM entities
 * - Workflow state management
 * - Deal-scoped queries with pagination
 * - Summary statistics
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Json } from '@/lib/supabase/database.types'
import {
  CIM,
  CIMListItem,
  CreateCIMInput,
  UpdateCIMInput,
  WorkflowState,
  mapDbRowToCIM,
  cimToListItem,
  createDefaultWorkflowState,
  createDefaultDependencyGraph,
} from '@/lib/types/cim'

// Type alias for Supabase client with our database types
type SupabaseClientTyped = SupabaseClient<Database>

// Database row type from generated types
type CIMRow = Database['public']['Tables']['cims']['Row']

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new CIM for a deal
 * AC: #4 - Basic CRUD for CIM entities (Create)
 */
export async function createCIM(
  supabase: SupabaseClientTyped,
  dealId: string,
  input: CreateCIMInput,
  userId: string
): Promise<CIM> {
  const workflowState = createDefaultWorkflowState()
  const dependencyGraph = createDefaultDependencyGraph()

  const { data, error } = await supabase
    .from('cims')
    .insert({
      deal_id: dealId,
      title: input.title,
      user_id: userId,
      workflow_state: workflowState as unknown as Json,
      buyer_persona: null,
      investment_thesis: null,
      outline: [] as Json,
      slides: [] as Json,
      dependency_graph: dependencyGraph as unknown as Json,
      conversation_history: [] as Json,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating CIM:', error)
    throw new Error(`Failed to create CIM: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to create CIM: No data returned')
  }

  return mapDbRowToCIM(data as CIMRow)
}

/**
 * Get a single CIM by ID
 * AC: #4 - Basic CRUD for CIM entities (Read)
 */
export async function getCIM(
  supabase: SupabaseClientTyped,
  cimId: string
): Promise<CIM | null> {
  const { data, error } = await supabase.from('cims').select('*').eq('id', cimId).single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null
    }
    console.error('Error fetching CIM:', error)
    throw new Error(`Failed to fetch CIM: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapDbRowToCIM(data as CIMRow)
}

/**
 * Get CIMs for a deal
 * AC: #4 - Basic CRUD for CIM entities (List)
 */
export async function getCIMsForDeal(
  supabase: SupabaseClientTyped,
  dealId: string,
  options?: {
    limit?: number
    offset?: number
  }
): Promise<CIMListItem[]> {
  let query = supabase
    .from('cims')
    .select('*')
    .eq('deal_id', dealId)
    .order('updated_at', { ascending: false })

  // Apply pagination
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching CIMs:', error)
    throw new Error(`Failed to fetch CIMs: ${error.message}`)
  }

  return (data || []).map((row) => cimToListItem(mapDbRowToCIM(row as CIMRow)))
}

/**
 * Update a CIM
 * AC: #4 - Basic CRUD for CIM entities (Update)
 */
export async function updateCIM(
  supabase: SupabaseClientTyped,
  cimId: string,
  input: UpdateCIMInput
): Promise<CIM> {
  // Build update data with proper Json casting
  const updateData: Record<string, Json | string | null> = {}
  if (input.title !== undefined) updateData.title = input.title
  if (input.workflowState !== undefined) updateData.workflow_state = input.workflowState as unknown as Json
  if (input.buyerPersona !== undefined) updateData.buyer_persona = input.buyerPersona as unknown as Json
  if (input.investmentThesis !== undefined) updateData.investment_thesis = input.investmentThesis
  if (input.outline !== undefined) updateData.outline = input.outline as unknown as Json
  if (input.slides !== undefined) updateData.slides = input.slides as unknown as Json
  if (input.dependencyGraph !== undefined) updateData.dependency_graph = input.dependencyGraph as unknown as Json
  if (input.conversationHistory !== undefined) updateData.conversation_history = input.conversationHistory as unknown as Json

  if (Object.keys(updateData).length === 0) {
    // No actual updates, just return current item
    const currentCIM = await getCIM(supabase, cimId)
    if (!currentCIM) {
      throw new Error('CIM not found')
    }
    return currentCIM
  }

  const { data, error } = await supabase
    .from('cims')
    .update(updateData)
    .eq('id', cimId)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating CIM:', error)
    throw new Error(`Failed to update CIM: ${error.message}`)
  }

  if (!data) {
    throw new Error('Failed to update CIM: No data returned')
  }

  return mapDbRowToCIM(data as CIMRow)
}

/**
 * Delete a CIM
 * AC: #4 - Basic CRUD for CIM entities (Delete)
 */
export async function deleteCIM(
  supabase: SupabaseClientTyped,
  cimId: string
): Promise<boolean> {
  const { error } = await supabase.from('cims').delete().eq('id', cimId)

  if (error) {
    console.error('Error deleting CIM:', error)
    throw new Error(`Failed to delete CIM: ${error.message}`)
  }

  return true
}

// ============================================================================
// Workflow State Management
// ============================================================================

/**
 * Update the workflow state of a CIM
 */
export async function updateCIMWorkflowState(
  supabase: SupabaseClientTyped,
  cimId: string,
  workflowState: WorkflowState
): Promise<CIM> {
  return updateCIM(supabase, cimId, { workflowState })
}

/**
 * Mark a phase as complete and advance to the next phase
 */
export async function advanceCIMPhase(
  supabase: SupabaseClientTyped,
  cimId: string
): Promise<CIM> {
  const cim = await getCIM(supabase, cimId)
  if (!cim) {
    throw new Error('CIM not found')
  }

  const { workflowState } = cim
  const currentPhase = workflowState.current_phase

  // Add current phase to completed phases if not already there
  const completedPhases = [...workflowState.completed_phases]
  if (!completedPhases.includes(currentPhase)) {
    completedPhases.push(currentPhase)
  }

  // Determine next phase
  const phases = [
    'persona',
    'thesis',
    'outline',
    'content_creation',
    'visual_concepts',
    'review',
    'complete',
  ] as const
  type Phase = (typeof phases)[number]
  const currentIndex = phases.indexOf(currentPhase)
  const nextPhaseValue = phases[currentIndex + 1]
  const nextPhase: Phase = nextPhaseValue !== undefined && currentIndex < phases.length - 1
    ? nextPhaseValue
    : 'complete'

  const newWorkflowState: WorkflowState = {
    ...workflowState,
    current_phase: nextPhase,
    completed_phases: completedPhases,
    is_complete: nextPhase === 'complete',
  }

  return updateCIM(supabase, cimId, { workflowState: newWorkflowState })
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Get count of CIMs for a deal
 */
export async function getCIMCount(
  supabase: SupabaseClientTyped,
  dealId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('cims')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId)

  if (error) {
    console.error('Error counting CIMs:', error)
    throw new Error(`Failed to count CIMs: ${error.message}`)
  }

  return count ?? 0
}

/**
 * Check if a CIM exists
 */
export async function cimExists(
  supabase: SupabaseClientTyped,
  cimId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('cims')
    .select('id', { count: 'exact', head: true })
    .eq('id', cimId)

  if (error) {
    console.error('Error checking CIM existence:', error)
    return false
  }

  return (count ?? 0) > 0
}

/**
 * Get the latest CIM for a deal (most recently updated)
 */
export async function getLatestCIMForDeal(
  supabase: SupabaseClientTyped,
  dealId: string
): Promise<CIM | null> {
  const { data, error } = await supabase
    .from('cims')
    .select('*')
    .eq('deal_id', dealId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null
    }
    console.error('Error fetching latest CIM:', error)
    throw new Error(`Failed to fetch latest CIM: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapDbRowToCIM(data as CIMRow)
}

/**
 * Get CIM summary stats for a deal
 */
export async function getCIMSummaryForDeal(
  supabase: SupabaseClientTyped,
  dealId: string
): Promise<{
  total: number
  complete: number
  inProgress: number
  byPhase: Record<string, number>
}> {
  const { data, error } = await supabase
    .from('cims')
    .select('workflow_state')
    .eq('deal_id', dealId)

  if (error) {
    console.error('Error fetching CIM summary:', error)
    throw new Error(`Failed to fetch CIM summary: ${error.message}`)
  }

  const items = data || []

  const summary = {
    total: items.length,
    complete: 0,
    inProgress: 0,
    byPhase: {} as Record<string, number>,
  }

  for (const item of items) {
    const workflowState = (item.workflow_state as unknown as WorkflowState) ?? createDefaultWorkflowState()

    if (workflowState.is_complete) {
      summary.complete++
    } else {
      summary.inProgress++
    }

    const phase = workflowState.current_phase
    summary.byPhase[phase] = (summary.byPhase[phase] || 0) + 1
  }

  return summary
}
