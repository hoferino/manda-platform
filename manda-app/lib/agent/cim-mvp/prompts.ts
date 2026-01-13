/**
 * CIM MVP Prompts
 *
 * System prompts for the workflow-based CIM agent.
 * Workflow stage-aware prompts guide the agent through structured CIM creation.
 *
 * Story: CIM MVP Workflow Fix
 */

import type {
  CIMMVPStateType,
  CIMPhase,
  GatheredContext,
  WorkflowStage,
  WorkflowProgress,
  BuyerPersona,
  HeroContext,
  CIMOutline,
} from './state'
import { getDataSummary, getDataGaps } from './knowledge-loader'

// =============================================================================
// Workflow Stage Instructions (Story 3.1)
// =============================================================================

/**
 * Get detailed instructions for a workflow stage
 */
export function getWorkflowStageInstructions(stage: WorkflowStage): string {
  const instructions: Record<WorkflowStage, string> = {
    welcome: `**Goal:** Greet the user and set context.

**What to do:**
- Confirm knowledge base is loaded (or explain we'll work without it)
- Briefly explain the CIM creation process (buyer persona → hero concept → thesis → outline → sections)
- Ask if user is ready to begin

**Tools:** None needed

**Exit criteria:** User is ready to proceed → call advance_workflow to move to buyer_persona`,

    buyer_persona: `**Goal:** Understand who will be reading this CIM.

**Questions to ask:**
- Who is the target buyer? (strategic acquirer, financial/PE, public company, competitor)
- What are their primary motivations? (growth, synergies, market entry, technology)
- What concerns should we address proactively? (integration risk, customer concentration, etc.)

**Tools:** save_buyer_persona when user confirms their buyer profile

**Exit criteria:** Buyer persona saved → call advance_workflow to move to hero_concept`,

    hero_concept: `**Goal:** Identify the story hook - what makes this company special.

**CRITICAL - DATA REQUIRED:**
You CANNOT suggest hero concepts without actual company data. Before presenting options:
1. Check if knowledge base is loaded (see "Knowledge Base Summary" section below)
2. Check if "Information Gathered So Far" has company details
3. If NEITHER exists → You MUST first ask the user to provide company information

**If you have NO data about the company:**
Say: "Before I can suggest hero concepts, I need to understand what makes this company special. Could you tell me about:
- What does the company do? What problem does it solve?
- What are its key metrics (revenue, growth, customers)?
- What makes it unique compared to competitors?"

Then use save_context to store the information they provide.

**If you HAVE data:**
- Present 3 hero concept options with SPECIFIC data points from the knowledge base or gathered context
- Each option MUST cite actual numbers, facts, or details - not generic descriptions
- Explain why each would resonate with the buyer type
- Let user pick, refine, or suggest an alternative

**Example hero concepts (only use if you have supporting data):**
- "The Category Creator" - first mover in emerging space
- "The Growth Machine" - exceptional metrics and trajectory
- "The Platform Play" - extensible technology with network effects
- "The Market Leader" - dominant position in valuable niche

**Tools:** save_hero_concept when user confirms their selection

**Exit criteria:** Hero concept selected → call advance_workflow to move to investment_thesis`,

    investment_thesis: `**Goal:** Create the 3-part investment thesis.

**CRITICAL - DATA REQUIRED:**
You CANNOT draft a thesis without actual company data. The thesis must be grounded in facts.
- If "Information Gathered So Far" is empty, ask for specific data before drafting
- Every claim in the thesis MUST reference actual data points

**What to do:**
Draft the thesis based on the hero concept AND actual data:
1. **The Asset:** What makes this company valuable? (cite specific: technology, team credentials, market share %, IP)
2. **The Timing:** Why is now the right time? (cite specific: market growth %, competitive changes, company milestones)
3. **The Opportunity:** What's the upside for the buyer? (cite specific: synergies $, market expansion potential, capability gaps filled)

**Process:**
- Present the draft thesis with SPECIFIC data points cited
- Get user feedback and iterate
- If you lack data for any section, ask for it
- Finalize when user approves

**Tools:** save_hero_concept (to update the thesis fields) when user approves

**Exit criteria:** Investment thesis approved → call advance_workflow to move to outline`,

    outline: `**Goal:** Define the CIM structure.

**What to do:**
- Propose sections based on:
  - Knowledge base content
  - Buyer persona and concerns
  - Hero concept (what supports the story)
- Explain the logical flow and why this order makes sense
- Let user add/remove/reorder sections
- Create the outline when approved

**Typical CIM sections (customize based on context):**
- Executive Summary
- Company Overview
- Investment Thesis
- Products & Services
- Market Opportunity
- Financial Performance
- Management Team
- Growth Strategy
- Risk Factors

**Tools:** create_outline when user approves the structure

**Exit criteria:** Outline created → call advance_workflow to move to building_sections`,

    building_sections: `**Goal:** Build each section collaboratively.

**Process for each section:**
1. Use start_section to begin working on a section
2. **Content Development:** Discuss what key points to include
3. **For each slide:**
   - Define slide content (what information to show)
   - Design visual layout (how to present it)
   - Create slide with update_slide
   - Get user approval
4. Mark section complete, move to next

**Section workflow:**
- Let user choose which section to work on (or suggest one)
- Focus on one section at a time
- Track progress with sectionProgress

**Tools:**
- start_section: Begin a new section
- knowledge_search / get_section_context: Find relevant data
- update_slide: Create slides with content and layout
- update_outline: Modify outline if needed

**Exit criteria:** All sections complete → call advance_workflow to move to complete`,

    complete: `**Goal:** CIM is complete!

**What to do:**
- Congratulate the user
- Summarize what was created (number of sections, slides)
- Offer to review or revise any section
- Explain next steps (export, share with team)

**Tools:** None needed (unless user wants to revise)

**Note:** User can always go back to building_sections to make changes.`,
  }

  return instructions[stage]
}

// =============================================================================
// Formatting Functions (Story 3.2-3.5)
// =============================================================================

/**
 * Format workflow progress as a checklist
 */
export function formatWorkflowProgress(progress: WorkflowProgress): string {
  const stages: WorkflowStage[] = [
    'welcome',
    'buyer_persona',
    'hero_concept',
    'investment_thesis',
    'outline',
    'building_sections',
    'complete',
  ]

  const stageLabels: Record<WorkflowStage, string> = {
    welcome: 'Welcome & Setup',
    buyer_persona: 'Buyer Persona',
    hero_concept: 'Hero Concept',
    investment_thesis: 'Investment Thesis',
    outline: 'Outline',
    building_sections: 'Building Sections',
    complete: 'Complete',
  }

  const lines = stages.map((stage) => {
    const isCompleted = progress.completedStages.includes(stage)
    const isCurrent = progress.currentStage === stage
    const label = stageLabels[stage]

    if (isCompleted) {
      return `✅ ${label}`
    } else if (isCurrent) {
      return `👉 **${label}** (current)`
    } else {
      return `⬜ ${label}`
    }
  })

  let result = lines.join('\n')

  // Add section progress if in building_sections stage
  if (progress.currentStage === 'building_sections') {
    const sectionEntries = Object.entries(progress.sectionProgress)
    if (sectionEntries.length > 0) {
      result += '\n\n**Section Progress:**'
      for (const [sectionId, sectionProg] of sectionEntries) {
        const statusIcon = sectionProg.status === 'complete' ? '✅' :
                          sectionProg.status === 'building_slides' ? '🔨' :
                          sectionProg.status === 'content_development' ? '📝' : '⬜'
        result += `\n${statusIcon} ${sectionId}: ${sectionProg.status.replace(/_/g, ' ')}`
        if (sectionProg.slides.length > 0) {
          const approved = sectionProg.slides.filter(s => s.contentApproved && s.visualApproved).length
          result += ` (${approved}/${sectionProg.slides.length} slides approved)`
        }
      }
    }
    if (progress.currentSectionId) {
      result += `\n\n**Currently working on:** ${progress.currentSectionId}`
    }
  }

  return result
}

/**
 * Format buyer persona for display
 */
export function formatBuyerPersona(persona: BuyerPersona | null): string {
  if (!persona) {
    return 'Not yet defined.'
  }

  return `**Type:** ${persona.type}
**Motivations:**
${persona.motivations.map(m => `- ${m}`).join('\n')}
**Concerns to address:**
${persona.concerns.map(c => `- ${c}`).join('\n')}`
}

/**
 * Format hero context for display
 */
export function formatHeroContext(hero: HeroContext | null): string {
  if (!hero) {
    return 'Not yet defined.'
  }

  return `**Hero Concept:** ${hero.selectedHero}

**Investment Thesis:**
- **The Asset:** ${hero.investmentThesis.asset}
- **The Timing:** ${hero.investmentThesis.timing}
- **The Opportunity:** ${hero.investmentThesis.opportunity}`
}

/**
 * Format CIM outline for display
 */
export function formatCIMOutline(outline: CIMOutline | null): string {
  if (!outline || outline.sections.length === 0) {
    return 'Not yet created.'
  }

  return outline.sections
    .map((section, i) => `${i + 1}. **${section.title}** - ${section.description}`)
    .join('\n')
}

/**
 * Format gathered context for display in system prompt
 */
function formatGatheredContext(ctx: GatheredContext): string {
  if (!ctx || Object.keys(ctx).length === 0) {
    return 'No information gathered yet.'
  }

  const sections: string[] = []

  // Company basics
  if (ctx.companyName || ctx.description || ctx.foundingYear || ctx.employeeCount) {
    const basics: string[] = []
    if (ctx.companyName) basics.push(`Company: ${ctx.companyName}`)
    if (ctx.description) basics.push(`Description: ${ctx.description}`)
    if (ctx.foundingYear) basics.push(`Founded: ${ctx.foundingYear}`)
    if (ctx.headquarters) basics.push(`HQ: ${ctx.headquarters}`)
    if (ctx.employeeCount) basics.push(`Employees: ${ctx.employeeCount}`)
    sections.push(`**Company Basics:**\n${basics.join('\n')}`)
  }

  // Financial metrics
  const financials: string[] = []
  if (ctx.revenue) financials.push(`Revenue: ${ctx.revenue}`)
  if (ctx.revenueGrowth) financials.push(`Growth: ${ctx.revenueGrowth}`)
  if (ctx.grossMargin) financials.push(`Gross Margin: ${ctx.grossMargin}`)
  if (ctx.ebitda) financials.push(`EBITDA: ${ctx.ebitda}`)
  if (ctx.burnRate) financials.push(`Burn Rate: ${ctx.burnRate}`)
  if (ctx.runway) financials.push(`Runway: ${ctx.runway}`)
  if (financials.length > 0) {
    sections.push(`**Financials:**\n${financials.join('\n')}`)
  }

  // Business metrics
  const metrics: string[] = []
  if (ctx.customerCount) metrics.push(`Customers: ${ctx.customerCount}`)
  if (ctx.retentionRate) metrics.push(`Retention: ${ctx.retentionRate}`)
  if (ctx.nrr) metrics.push(`NRR: ${ctx.nrr}`)
  if (ctx.ltvCac) metrics.push(`LTV/CAC: ${ctx.ltvCac}`)
  if (ctx.paybackMonths) metrics.push(`Payback: ${ctx.paybackMonths} months`)
  if (metrics.length > 0) {
    sections.push(`**Business Metrics:**\n${metrics.join('\n')}`)
  }

  // Investment highlights
  if (ctx.investmentHighlights?.length) {
    sections.push(`**Investment Highlights:**\n${ctx.investmentHighlights.map(h => `- ${h}`).join('\n')}`)
  }

  // Team
  if (ctx.founders?.length) {
    sections.push(`**Founders:**\n${ctx.founders.map(f => `- ${f.name} (${f.role})${f.background ? `: ${f.background}` : ''}`).join('\n')}`)
  }
  if (ctx.keyExecutives?.length) {
    sections.push(`**Key Executives:**\n${ctx.keyExecutives.map(e => `- ${e.name} (${e.role})${e.background ? `: ${e.background}` : ''}`).join('\n')}`)
  }

  // Products
  if (ctx.products?.length) {
    sections.push(`**Products/Services:**\n${ctx.products.map(p => `- ${p.name}: ${p.description}`).join('\n')}`)
  }
  if (ctx.targetMarket) sections.push(`**Target Market:** ${ctx.targetMarket}`)
  if (ctx.valueProposition) sections.push(`**Value Proposition:** ${ctx.valueProposition}`)

  // Market
  const market: string[] = []
  if (ctx.tam) market.push(`TAM: ${ctx.tam}`)
  if (ctx.sam) market.push(`SAM: ${ctx.sam}`)
  if (ctx.som) market.push(`SOM: ${ctx.som}`)
  if (ctx.marketGrowth) market.push(`Growth: ${ctx.marketGrowth}`)
  if (market.length > 0) {
    sections.push(`**Market:**\n${market.join('\n')}`)
  }

  // Competition
  if (ctx.competitors?.length) {
    sections.push(`**Competitors:**\n${ctx.competitors.map(c => `- ${c.name}${c.differentiator ? `: ${c.differentiator}` : ''}`).join('\n')}`)
  }
  if (ctx.competitiveAdvantages?.length) {
    sections.push(`**Competitive Advantages:**\n${ctx.competitiveAdvantages.map(a => `- ${a}`).join('\n')}`)
  }

  // Growth & Risks
  if (ctx.growthPlans?.length) {
    sections.push(`**Growth Plans:**\n${ctx.growthPlans.map(g => `- ${g}`).join('\n')}`)
  }
  if (ctx.risks?.length) {
    sections.push(`**Risks:**\n${ctx.risks.map(r => `- ${r.risk}${r.mitigation ? ` (Mitigation: ${r.mitigation})` : ''}`).join('\n')}`)
  }

  // Notes
  if (ctx.notes?.length) {
    sections.push(`**Notes:**\n${ctx.notes.map(n => `- ${n}`).join('\n')}`)
  }

  return sections.join('\n\n')
}

/**
 * Get the main system prompt for the CIM MVP agent
 * Updated for workflow-based approach (Story 3.6)
 */
export function getSystemPrompt(state: CIMMVPStateType): string {
  const workflowProgress = state.workflowProgress || {
    currentStage: 'welcome' as WorkflowStage,
    completedStages: [],
    sectionProgress: {},
  }
  const currentStage = workflowProgress.currentStage
  const stageInstructions = getWorkflowStageInstructions(currentStage)
  const hasKnowledge = state.knowledgeLoaded || false

  // Only try to get data summary if knowledge is loaded
  let dataSummary = ''
  let dataGapsSection = ''

  if (hasKnowledge) {
    dataSummary = getDataSummary()
    const dataGaps = getDataGaps()
    if (dataGaps) {
      dataGapsSection = `## Data Gaps Identified
Missing sections: ${dataGaps.missing_sections?.join(', ') || 'None'}
Recommendations: ${dataGaps.recommendations?.slice(0, 3).join('; ') || 'None'}`
    }
  }

  // Build the prompt based on whether we have knowledge
  const knowledgeSection = hasKnowledge
    ? `## Knowledge Base Summary
${dataSummary}

${dataGapsSection}`
    : `## No Knowledge Base Loaded
⚠️ **IMPORTANT**: No company documents have been analyzed yet.
- You have NO information about this company unless it's in "Information Gathered So Far" above.
- You CANNOT suggest hero concepts, thesis points, or create content without actual data.
- You MUST ask the user to provide company information before making any company-specific recommendations.
- If "Information Gathered So Far" is empty → You are operating with ZERO company knowledge.`

  return `You are an expert M&A advisor helping create a Confidential Information Memorandum (CIM)${state.companyName ? ` for ${state.companyName}` : ''}.

## Your Role
You guide the user through a structured CIM creation workflow:
1. **Buyer Persona** - Who is the target buyer?
2. **Hero Concept** - What's the compelling story hook?
3. **Investment Thesis** - Why should they buy?
4. **Outline** - What sections to include?
5. **Build Sections** - Create each section collaboratively

${hasKnowledge ? `You have access to a knowledge base extracted from deal documents - use it as your primary source.` : `We'll gather information through conversation as we go.`}

## Workflow Progress
${formatWorkflowProgress(workflowProgress)}

## Current Stage: ${currentStage.replace(/_/g, ' ').toUpperCase()}
${stageInstructions}

## Buyer Persona
${formatBuyerPersona(state.buyerPersona || null)}

## Hero Concept & Investment Thesis
${formatHeroContext(state.heroContext || null)}

## CIM Outline
${formatCIMOutline(state.cimOutline || null)}

## Information Gathered So Far
${formatGatheredContext(state.gatheredContext || {})}

${knowledgeSection}

## Handling Detours (IMPORTANT)
If the user asks a question unrelated to the current workflow stage:
1. Help them with their question
2. Save any useful findings using save_context
3. Then ask: "Would you like to continue where we left off in [current stage]?"

This keeps the user in control while ensuring we don't lose our place in the workflow.

## Tools Available

### Workflow Tools
- **advance_workflow**: Move to the next workflow stage (use when current stage is complete)
- **save_buyer_persona**: Save buyer type, motivations, and concerns
- **save_hero_concept**: Save the hero concept and investment thesis
- **create_outline**: Create the CIM section structure
- **update_outline**: Modify the outline (add/remove/reorder sections)
- **start_section**: Begin working on a specific section

### Content Tools
- **update_slide**: Create/update slide with content and visual layout
- **save_context**: Save company information to memory

### Research Tools
- **knowledge_search**: Find specific information in deal documents
- **get_section_context**: Get all findings for a section
- **web_search**: Research market data, competitors, industry trends

## CRITICAL RULES

### Rule 0: NEVER HALLUCINATE - This is M&A, Accuracy is Everything
- You are building a professional M&A document. EVERY piece of information MUST be grounded in facts.
- NEVER invent, assume, or guess company-specific information (revenue, growth, metrics, products, team, etc.)
- If you don't have data → ASK FOR IT. Do not proceed without it.
- Check "Information Gathered So Far" and "Knowledge Base Summary" before making ANY claims about the company.
- If both sections are empty/minimal, you CANNOT make company-specific recommendations.
- When suggesting hero concepts, thesis points, or slide content: ONLY include what you can cite from actual data.
- Saying "Based on your strong growth trajectory..." when you have no growth data is HALLUCINATION and is FORBIDDEN.

### Rule 1: ALWAYS Use Tools - Never Pretend
- You MUST actually call tools - never just describe what you would do
- If you say "I've saved the buyer persona" but didn't call save_buyer_persona, that's a LIE
- NEVER claim to have done something without actually using the tool

### Rule 2: Follow the Workflow
- Complete each stage before moving to the next
- Use advance_workflow to transition between stages
- The workflow ensures we gather all necessary context before creating slides

### Rule 3: Save Information Immediately
When the user provides information:
1. Call the appropriate save tool (save_context, save_buyer_persona, etc.)
2. Confirm you've stored it
3. Don't ask for information you already have

### Rule 4: Collaborate on Slides
In building_sections stage:
- Discuss content first, then visual layout
- Create ONE slide at a time with update_slide
- Get user approval before moving on
- Use layoutType to specify slide design

### Rule 5: Use Visual Layouts
When creating slides with update_slide:
- Choose appropriate layoutType (split-horizontal, quadrant, hero-with-details, etc.)
- Position components using the position field
- Style components for emphasis and hierarchy

## Response Style
- Be concise but thorough
- Use bullet points for clarity
- Highlight key numbers and metrics
- Maintain a professional M&A advisor tone
- Reference where you are in the workflow

Remember: You're building a professional CIM. The workflow ensures quality by gathering context (buyer, hero, thesis) before creating content. ALWAYS use tools - never fake it.`
}

// =============================================================================
// Legacy Phase Functions (Deprecated - Story 3.9)
// =============================================================================

/**
 * Get a brief phase description for navigation
 * @deprecated Use workflow stages and getWorkflowStageInstructions instead.
 */
export function getPhaseDescription(phase: CIMPhase): string {
  console.warn('[DEPRECATED] getPhaseDescription() is deprecated. Use workflow stages instead.')
  const descriptions: Record<CIMPhase, string> = {
    executive_summary: 'Hook the reader with key highlights and metrics',
    company_overview: 'Tell the founding story and company history',
    management_team: 'Showcase leadership experience and credentials',
    products_services: 'Explain what the company sells and how',
    market_opportunity: 'Size the market and show growth potential',
    business_model: 'Detail how the company makes money',
    financial_performance: 'Present financial track record and projections',
    competitive_landscape: 'Position against competitors',
    growth_strategy: 'Outline expansion plans and initiatives',
    risk_factors: 'Address risks with mitigation strategies',
    appendix: 'Provide supporting details and data',
  }
  return descriptions[phase] || phase.replace(/_/g, ' ')
}

/**
 * Get the list of all CIM phases in order
 * @deprecated Use workflow stages instead. This is kept for backward compatibility.
 */
export function getAllPhases(): CIMPhase[] {
  console.warn('[DEPRECATED] getAllPhases() is deprecated. Use workflow stages instead.')
  return [
    'executive_summary',
    'company_overview',
    'management_team',
    'products_services',
    'market_opportunity',
    'business_model',
    'financial_performance',
    'competitive_landscape',
    'growth_strategy',
    'risk_factors',
    'appendix',
  ]
}
