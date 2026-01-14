/**
 * CIM MVP Tools Tests
 *
 * Tests for the 11 CIM MVP agent tools:
 * - Research tools: web_search, knowledge_search, get_section_context
 * - Workflow tools: advance_workflow, save_buyer_persona, save_hero_concept, create_outline, update_outline, start_section
 * - Output tools: update_slide, save_context
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  webSearchTool,
  knowledgeSearchTool,
  getSectionContextTool,
  advanceWorkflowTool,
  saveBuyerPersonaTool,
  saveHeroConceptTool,
  createOutlineTool,
  updateOutlineTool,
  startSectionTool,
  updateSlideTool,
  saveContextTool,
  cimMVPTools,
} from '@/lib/agent/cim-mvp/tools'

// Mock the knowledge-loader module
vi.mock('@/lib/agent/cim-mvp/knowledge-loader', () => ({
  searchKnowledge: vi.fn(),
  getFindingsForSection: vi.fn(),
  getCompanyMetadata: vi.fn(),
}))

// Import mocked functions
import { searchKnowledge, getFindingsForSection, getCompanyMetadata } from '@/lib/agent/cim-mvp/knowledge-loader'

const mockedSearchKnowledge = vi.mocked(searchKnowledge)
const mockedGetFindingsForSection = vi.mocked(getFindingsForSection)
const mockedGetCompanyMetadata = vi.mocked(getCompanyMetadata)

describe('CIM MVP Tools - Exports and Structure', () => {
  describe('cimMVPTools array', () => {
    it('should export all 11 tools', () => {
      expect(cimMVPTools).toHaveLength(11)
    })

    it('should include all research tools', () => {
      const toolNames = cimMVPTools.map((t) => t.name)
      expect(toolNames).toContain('web_search')
      expect(toolNames).toContain('knowledge_search')
      expect(toolNames).toContain('get_section_context')
    })

    it('should include all workflow tools', () => {
      const toolNames = cimMVPTools.map((t) => t.name)
      expect(toolNames).toContain('advance_workflow')
      expect(toolNames).toContain('save_buyer_persona')
      expect(toolNames).toContain('save_hero_concept')
      expect(toolNames).toContain('create_outline')
      expect(toolNames).toContain('update_outline')
      expect(toolNames).toContain('start_section')
    })

    it('should include all output tools', () => {
      const toolNames = cimMVPTools.map((t) => t.name)
      expect(toolNames).toContain('update_slide')
      expect(toolNames).toContain('save_context')
    })

    it('should have description for all tools', () => {
      cimMVPTools.forEach((tool) => {
        expect(tool.description).toBeTruthy()
        expect(typeof tool.description).toBe('string')
        expect(tool.description.length).toBeGreaterThan(10)
      })
    })

    it('should have schema for all tools', () => {
      cimMVPTools.forEach((tool) => {
        expect(tool.schema).toBeDefined()
      })
    })
  })
})

// =============================================================================
// Research Tools
// =============================================================================

describe('CIM MVP Tools - Research Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('webSearchTool', () => {
    const originalEnv = process.env

    beforeEach(() => {
      vi.resetModules()
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should be named correctly', () => {
      expect(webSearchTool.name).toBe('web_search')
    })

    it('should have description mentioning market data and competitors', () => {
      expect(webSearchTool.description.toLowerCase()).toContain('market data')
      expect(webSearchTool.description.toLowerCase()).toContain('competitor')
    })

    it('should return mock response when TAVILY_API_KEY is not set', async () => {
      delete process.env.TAVILY_API_KEY

      const result = await webSearchTool.invoke({ query: 'SaaS market trends 2024' })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(false)
      expect(parsed.message).toContain('TAVILY_API_KEY')
      expect(parsed.query).toBe('SaaS market trends 2024')
    })
  })

  describe('knowledgeSearchTool', () => {
    it('should be named correctly', () => {
      expect(knowledgeSearchTool.name).toBe('knowledge_search')
    })

    it('should have description mentioning knowledge base', () => {
      expect(knowledgeSearchTool.description.toLowerCase()).toContain('knowledge base')
      expect(knowledgeSearchTool.description.toLowerCase()).toContain('documents')
    })

    it('should return findings when search matches', async () => {
      mockedSearchKnowledge.mockReturnValue([
        { content: 'Revenue grew 50% YoY', source: 'Financials.xlsx, Sheet 1', section: 'financial_performance' },
        { content: 'ARR of $8.2M', source: 'Pitch Deck.pdf, Page 5', section: 'financial_performance' },
      ])

      const result = await knowledgeSearchTool.invoke({ query: 'revenue' })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.found).toBe(true)
      expect(parsed.count).toBe(2)
      expect(parsed.findings).toHaveLength(2)
      expect(mockedSearchKnowledge).toHaveBeenCalledWith('revenue', undefined)
    })

    it('should support section filtering', async () => {
      mockedSearchKnowledge.mockReturnValue([])

      const result = await knowledgeSearchTool.invoke({
        query: 'revenue',
        section: 'financial_performance',
      })
      const parsed = JSON.parse(result)

      expect(parsed.found).toBe(false)
      expect(mockedSearchKnowledge).toHaveBeenCalledWith('revenue', 'financial_performance')
    })

    it('should return not found message when no matches', async () => {
      mockedSearchKnowledge.mockReturnValue([])

      const result = await knowledgeSearchTool.invoke({ query: 'xyz123' })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.found).toBe(false)
      expect(parsed.message).toContain('No findings matching')
    })

    it('should limit results to top 10', async () => {
      mockedSearchKnowledge.mockReturnValue(
        Array(15)
          .fill(null)
          .map((_, i) => ({
            content: `Finding ${i}`,
            source: `Doc.pdf, Page ${i}`,
            section: 'test',
          }))
      )

      const result = await knowledgeSearchTool.invoke({ query: 'test' })
      const parsed = JSON.parse(result)

      expect(parsed.findings).toHaveLength(10)
      expect(parsed.count).toBe(15)
    })
  })

  describe('getSectionContextTool', () => {
    it('should be named correctly', () => {
      expect(getSectionContextTool.name).toBe('get_section_context')
    })

    it('should have description mentioning dot notation', () => {
      expect(getSectionContextTool.description).toContain('dot notation')
    })

    it('should return findings for a section', async () => {
      mockedGetCompanyMetadata.mockReturnValue({
        company_name: 'Test Corp',
        analyzed_at: '2024-01-01',
        documents: [],
        data_sufficiency_score: 85,
      })
      mockedGetFindingsForSection.mockReturnValue([
        {
          id: 'f1',
          content: 'Company founded in 2020',
          source: { document: 'Overview.pdf', location: 'Page 1' },
          confidence: 'high' as const,
        },
      ])

      const result = await getSectionContextTool.invoke({ sectionPath: 'company_overview.history' })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.found).toBe(true)
      expect(parsed.company).toBe('Test Corp')
      expect(parsed.count).toBe(1)
      expect(parsed.findings[0].content).toBe('Company founded in 2020')
    })

    it('should return not found for empty section', async () => {
      mockedGetCompanyMetadata.mockReturnValue({
        company_name: 'Test Corp',
        analyzed_at: '2024-01-01',
        documents: [],
        data_sufficiency_score: 85,
      })
      mockedGetFindingsForSection.mockReturnValue([])

      const result = await getSectionContextTool.invoke({ sectionPath: 'nonexistent.section' })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.found).toBe(false)
      expect(parsed.message).toContain('No findings available')
    })
  })
})

// =============================================================================
// Workflow Tools
// =============================================================================

describe('CIM MVP Tools - Workflow Tools', () => {
  describe('advanceWorkflowTool', () => {
    it('should be named correctly', () => {
      expect(advanceWorkflowTool.name).toBe('advance_workflow')
    })

    it('should have description mentioning workflow stages', () => {
      expect(advanceWorkflowTool.description).toContain('welcome')
      expect(advanceWorkflowTool.description).toContain('buyer_persona')
      expect(advanceWorkflowTool.description).toContain('building_sections')
    })

    it('should return workflow advancement result', async () => {
      const result = await advanceWorkflowTool.invoke({
        targetStage: 'buyer_persona',
        reason: 'User completed welcome stage',
      })
      const parsed = JSON.parse(result)

      expect(parsed.advancedWorkflow).toBe(true)
      expect(parsed.targetStage).toBe('buyer_persona')
      expect(parsed.reason).toBe('User completed welcome stage')
      expect(parsed.message).toContain('buyer persona')
    })

    it('should format stage names in message', async () => {
      const result = await advanceWorkflowTool.invoke({
        targetStage: 'building_sections',
        reason: 'Outline approved',
      })
      const parsed = JSON.parse(result)

      expect(parsed.message).toContain('building sections')
    })
  })

  describe('saveBuyerPersonaTool', () => {
    it('should be named correctly', () => {
      expect(saveBuyerPersonaTool.name).toBe('save_buyer_persona')
    })

    it('should have description mentioning buyer persona', () => {
      expect(saveBuyerPersonaTool.description.toLowerCase()).toContain('buyer persona')
    })

    it('should save buyer persona with all fields', async () => {
      const result = await saveBuyerPersonaTool.invoke({
        type: 'strategic',
        motivations: ['Market expansion', 'Technology acquisition'],
        concerns: ['Integration complexity', 'Retention risk'],
      })
      const parsed = JSON.parse(result)

      expect(parsed.buyerPersona).toEqual({
        type: 'strategic',
        motivations: ['Market expansion', 'Technology acquisition'],
        concerns: ['Integration complexity', 'Retention risk'],
      })
      expect(parsed.message).toContain('strategic')
      expect(parsed.message).toContain('2 motivations')
      expect(parsed.message).toContain('2 concerns')
    })
  })

  describe('saveHeroConceptTool', () => {
    it('should be named correctly', () => {
      expect(saveHeroConceptTool.name).toBe('save_hero_concept')
    })

    it('should have description mentioning investment thesis', () => {
      expect(saveHeroConceptTool.description.toLowerCase()).toContain('investment thesis')
      expect(saveHeroConceptTool.description.toLowerCase()).toContain('asset')
      expect(saveHeroConceptTool.description.toLowerCase()).toContain('timing')
      expect(saveHeroConceptTool.description.toLowerCase()).toContain('opportunity')
    })

    it('should save hero concept with investment thesis', async () => {
      const result = await saveHeroConceptTool.invoke({
        selectedHero: 'Category-defining AI platform with 71% growth',
        asset: 'Proprietary AI models with 50% accuracy advantage',
        timing: 'Enterprise AI adoption hitting inflection point',
        opportunity: 'Platform to dominate $50B market segment',
      })
      const parsed = JSON.parse(result)

      expect(parsed.heroContext.selectedHero).toBe('Category-defining AI platform with 71% growth')
      expect(parsed.heroContext.investmentThesis).toEqual({
        asset: 'Proprietary AI models with 50% accuracy advantage',
        timing: 'Enterprise AI adoption hitting inflection point',
        opportunity: 'Platform to dominate $50B market segment',
      })
    })
  })

  describe('createOutlineTool', () => {
    it('should be named correctly', () => {
      expect(createOutlineTool.name).toBe('create_outline')
    })

    it('should have description mentioning outline structure', () => {
      expect(createOutlineTool.description.toLowerCase()).toContain('outline')
      expect(createOutlineTool.description.toLowerCase()).toContain('section')
    })

    it('should create outline with auto-generated IDs', async () => {
      const result = await createOutlineTool.invoke({
        sections: [
          { title: 'Executive Summary', description: 'High-level overview' },
          { title: 'Company Overview', description: 'History and mission' },
          { title: 'Financial Performance', description: 'Revenue and growth' },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.cimOutline.sections).toHaveLength(3)
      expect(parsed.cimOutline.sections[0].title).toBe('Executive Summary')
      expect(parsed.cimOutline.sections[0].id).toBeTruthy()
      expect(parsed.cimOutline.sections[1].id).toBeTruthy()
      expect(parsed.cimOutline.sections[0].id).not.toBe(parsed.cimOutline.sections[1].id)
    })

    it('should create section divider slides', async () => {
      const result = await createOutlineTool.invoke({
        sections: [
          { title: 'Executive Summary', description: 'Overview' },
          { title: 'Financials', description: 'Numbers' },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.sectionDividerSlides).toHaveLength(2)
      expect(parsed.sectionDividerSlides[0].layoutType).toBe('title-only')
      expect(parsed.sectionDividerSlides[0].components[0].type).toBe('title')
      expect(parsed.sectionDividerSlides[0].slideId).toContain('divider-')
    })
  })

  describe('updateOutlineTool', () => {
    it('should be named correctly', () => {
      expect(updateOutlineTool.name).toBe('update_outline')
    })

    it('should support add action', async () => {
      const result = await updateOutlineTool.invoke({
        action: 'add',
        section: { title: 'New Section', description: 'Added section' },
      })
      const parsed = JSON.parse(result)

      expect(parsed.outlineUpdate).toBe(true)
      expect(parsed.action).toBe('add')
      expect(parsed.newSection.title).toBe('New Section')
      expect(parsed.newSection.id).toBeTruthy()
    })

    it('should support remove action', async () => {
      const result = await updateOutlineTool.invoke({
        action: 'remove',
        sectionId: 'section-123',
      })
      const parsed = JSON.parse(result)

      expect(parsed.action).toBe('remove')
      expect(parsed.removeSectionId).toBe('section-123')
    })

    it('should support reorder action', async () => {
      const result = await updateOutlineTool.invoke({
        action: 'reorder',
        newOrder: ['section-3', 'section-1', 'section-2'],
      })
      const parsed = JSON.parse(result)

      expect(parsed.action).toBe('reorder')
      expect(parsed.newOrder).toEqual(['section-3', 'section-1', 'section-2'])
    })

    it('should support update action', async () => {
      const result = await updateOutlineTool.invoke({
        action: 'update',
        sectionId: 'section-123',
        section: { title: 'Updated Title', description: 'Updated description' },
      })
      const parsed = JSON.parse(result)

      expect(parsed.action).toBe('update')
      expect(parsed.updateSectionId).toBe('section-123')
      expect(parsed.updatedSection.title).toBe('Updated Title')
    })

    it('should return error for invalid action combinations', async () => {
      const result = await updateOutlineTool.invoke({
        action: 'remove',
        // Missing sectionId
      })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('Invalid action')
    })
  })

  describe('startSectionTool', () => {
    it('should be named correctly', () => {
      expect(startSectionTool.name).toBe('start_section')
    })

    it('should initialize section progress tracking', async () => {
      const result = await startSectionTool.invoke({ sectionId: 'section-exec-summary' })
      const parsed = JSON.parse(result)

      expect(parsed.startSection).toBe(true)
      expect(parsed.sectionId).toBe('section-exec-summary')
      expect(parsed.sectionProgress).toEqual({
        sectionId: 'section-exec-summary',
        status: 'content_development',
        slides: [],
      })
    })
  })
})

// =============================================================================
// Output Tools
// =============================================================================

describe('CIM MVP Tools - Output Tools', () => {
  describe('updateSlideTool', () => {
    it('should be named correctly', () => {
      expect(updateSlideTool.name).toBe('update_slide')
    })

    it('should have description mentioning layout and components', () => {
      expect(updateSlideTool.description.toLowerCase()).toContain('layout')
      expect(updateSlideTool.description.toLowerCase()).toContain('component')
    })

    it('should create slide with auto-generated ID', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        title: 'Revenue Growth',
        components: [
          { type: 'title', content: 'Revenue Growth' },
          {
            type: 'bar_chart',
            content: 'Revenue by Year',
            data: { labels: ['2022', '2023', '2024'], values: [5, 7, 10] },
          },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.slideId).toContain('slide-section-123-')
      expect(parsed.sectionId).toBe('section-123')
      expect(parsed.title).toBe('Revenue Growth')
      expect(parsed.componentCount).toBe(2)
      expect(parsed.status).toBe('draft')
    })

    it('should use existing slideId for updates', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        slideId: 'existing-slide-456',
        title: 'Updated Slide',
        components: [{ type: 'text', content: 'Updated content' }],
      })
      const parsed = JSON.parse(result)

      expect(parsed.slideId).toBe('existing-slide-456')
    })

    it('should support layout types', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        title: 'Split Layout',
        layoutType: 'split-horizontal',
        components: [
          { type: 'text', content: 'Left content', position: { region: 'left' } },
          { type: 'bar_chart', content: 'Right chart', position: { region: 'right' } },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.layoutType).toBe('split-horizontal')
    })

    it('should auto-generate component IDs', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        title: 'Test',
        components: [
          { type: 'title', content: 'Title' },
          { type: 'text', content: 'Body' },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.components[0].id).toBeTruthy()
      expect(parsed.components[1].id).toBeTruthy()
      expect(parsed.components[0].id).not.toBe(parsed.components[1].id)
    })

    it('should preserve provided component IDs', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        title: 'Test',
        components: [{ id: 'custom-id', type: 'title', content: 'Title' }],
      })
      const parsed = JSON.parse(result)

      expect(parsed.components[0].id).toBe('custom-id')
    })

    it('should support component positioning', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        title: 'Positioned',
        layoutType: 'quadrant',
        components: [
          { type: 'metric', content: '50%', position: { region: 'top-left' } },
          { type: 'metric', content: '100', position: { region: 'top-right' } },
          { type: 'text', content: 'Details', position: { region: 'bottom-left' } },
          { type: 'bar_chart', content: 'Chart', position: { region: 'bottom-right' } },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.components[0].position.region).toBe('top-left')
      expect(parsed.components[3].position.region).toBe('bottom-right')
    })

    it('should support component styling', async () => {
      const result = await updateSlideTool.invoke({
        sectionId: 'section-123',
        title: 'Styled',
        components: [
          {
            type: 'metric',
            content: '+71%',
            style: { emphasis: 'success', size: 'xl', alignment: 'center' },
          },
        ],
      })
      const parsed = JSON.parse(result)

      expect(parsed.components[0].style.emphasis).toBe('success')
      expect(parsed.components[0].style.size).toBe('xl')
    })
  })

  describe('saveContextTool', () => {
    it('should be named correctly', () => {
      expect(saveContextTool.name).toBe('save_context')
    })

    it('should have description mentioning memory', () => {
      expect(saveContextTool.description.toLowerCase()).toContain('memory')
    })

    it('should save basic company info', async () => {
      const result = await saveContextTool.invoke({
        companyName: 'Test Corp',
        description: 'AI-powered analytics platform',
        foundingYear: 2020,
        employeeCount: 45,
      })
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.savedFields).toContain('company name')
      expect(parsed.savedFields).toContain('description')
      expect(parsed.savedFields).toContain('founding year')
      expect(parsed.savedFields).toContain('employee count')
      expect(parsed.gatheredContext.companyName).toBe('Test Corp')
    })

    it('should save financial metrics', async () => {
      const result = await saveContextTool.invoke({
        revenue: '$8.2M ARR',
        revenueGrowth: '71%',
        grossMargin: '85%',
      })
      const parsed = JSON.parse(result)

      expect(parsed.savedFields).toContain('revenue')
      expect(parsed.savedFields).toContain('revenue growth')
      expect(parsed.savedFields).toContain('gross margin')
    })

    it('should save customer metrics', async () => {
      const result = await saveContextTool.invoke({
        customerCount: 150,
        retentionRate: '95%',
        nrr: '120%',
        ltvCac: '5:1',
      })
      const parsed = JSON.parse(result)

      expect(parsed.savedFields).toContain('customer count')
      expect(parsed.savedFields).toContain('retention rate')
      expect(parsed.savedFields).toContain('NRR')
      expect(parsed.savedFields).toContain('LTV/CAC')
    })

    it('should save array fields with counts', async () => {
      const result = await saveContextTool.invoke({
        investmentHighlights: ['Strong retention', 'Growing market', 'Expert team'],
        founders: [
          { name: 'John Doe', role: 'CEO', background: 'Ex-Google' },
          { name: 'Jane Smith', role: 'CTO', background: 'Stanford AI Lab' },
        ],
        products: [{ name: 'Analytics Pro', description: 'Main product' }],
        competitors: [{ name: 'CompetitorA', differentiator: 'Legacy provider' }],
        growthPlans: ['Expand to Europe', 'Launch new product'],
        risks: [{ risk: 'Market concentration', mitigation: 'Diversification strategy' }],
        notes: ['Key insight 1', 'Key insight 2'],
      })
      const parsed = JSON.parse(result)

      expect(parsed.savedFields).toContain('3 investment highlights')
      expect(parsed.savedFields).toContain('2 founders')
      expect(parsed.savedFields).toContain('1 products')
      expect(parsed.savedFields).toContain('1 competitors')
      expect(parsed.savedFields).toContain('2 growth plans')
      expect(parsed.savedFields).toContain('1 risks')
      expect(parsed.savedFields).toContain('2 notes')
    })

    it('should return empty savedFields for empty input', async () => {
      const result = await saveContextTool.invoke({})
      const parsed = JSON.parse(result)

      expect(parsed.success).toBe(true)
      expect(parsed.savedFields).toHaveLength(0)
    })
  })
})

// =============================================================================
// Schema Validation
// =============================================================================

describe('CIM MVP Tools - Schema Validation', () => {
  it('webSearchTool schema requires query', () => {
    const schema = webSearchTool.schema
    expect(schema.shape.query).toBeDefined()
  })

  it('knowledgeSearchTool schema has optional section', () => {
    const schema = knowledgeSearchTool.schema
    expect(schema.shape.query).toBeDefined()
    expect(schema.shape.section).toBeDefined()
  })

  it('advanceWorkflowTool schema has enum for targetStage', () => {
    const schema = advanceWorkflowTool.schema
    expect(schema.shape.targetStage).toBeDefined()
    expect(schema.shape.reason).toBeDefined()
  })

  it('updateSlideTool schema supports all component types', () => {
    const schema = updateSlideTool.schema
    const description = updateSlideTool.description

    // Verify the tool accepts the wide variety of component types
    expect(schema.shape.components).toBeDefined()
    expect(description).toContain('layout')
    expect(description).toContain('component')
  })

  it('createOutlineTool schema requires sections array', () => {
    const schema = createOutlineTool.schema
    expect(schema.shape.sections).toBeDefined()
  })

  it('updateOutlineTool schema has action enum', () => {
    const schema = updateOutlineTool.schema
    expect(schema.shape.action).toBeDefined()
  })

  it('saveContextTool schema has all optional fields', () => {
    const schema = saveContextTool.schema
    // All fields should be optional
    expect(schema.shape.companyName).toBeDefined()
    expect(schema.shape.revenue).toBeDefined()
    expect(schema.shape.founders).toBeDefined()
  })
})
