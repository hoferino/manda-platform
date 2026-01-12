/**
 * CIM MVP Types
 *
 * TypeScript interfaces for the knowledge file and related structures.
 *
 * Story: CIM MVP Fast Track
 */

// Knowledge file finding
export interface Finding {
  id: string
  content: string
  source: {
    document: string
    location: string
  }
  confidence: 'high' | 'medium' | 'low' | 'inferred'
  category?: string
}

// Executive finding
export interface Executive {
  name: string
  title: string
  background: string
  achievements?: string[]
  source: {
    document: string
    location: string
  }
}

// Location information
export interface Location {
  city: string
  country: string
  type: string
  employees?: number
  source: {
    document: string
    location: string
  }
}

// Historical financial record
export interface HistoricalFinancial {
  period: string
  revenue?: number
  growth?: number
  ebitda?: number
  margin?: number
  source: {
    document: string
    location: string
  }
}

// Competitor information
export interface Competitor {
  name: string
  description?: string
  differentiator?: string
  source: {
    document: string
    location: string
  }
}

// Section with findings
export interface FindingsSection {
  findings: Finding[]
}

// Knowledge file structure
export interface KnowledgeFile {
  metadata: {
    analyzed_at: string
    documents: Array<{
      name: string
      pages?: number
      sheets?: number
      type: string
    }>
    company_name: string
    data_sufficiency_score: number
  }
  sections: {
    executive_summary: FindingsSection
    company_overview: {
      history: FindingsSection
      mission_vision: FindingsSection
      milestones: FindingsSection
    }
    management_team: {
      executives: Executive[]
    }
    products_services: FindingsSection
    market_opportunity: {
      market_size: FindingsSection
      growth_drivers: FindingsSection
      target_segments: FindingsSection
    }
    business_model: {
      revenue_model: FindingsSection
      pricing: FindingsSection
      unit_economics: FindingsSection
    }
    financial_performance: {
      revenue: FindingsSection
      profitability: FindingsSection
      growth_metrics: FindingsSection
      historical_financials: HistoricalFinancial[]
    }
    competitive_landscape: {
      competitors: Competitor[]
      competitive_advantages: FindingsSection
      market_position: FindingsSection
    }
    growth_strategy: FindingsSection
    risk_factors: FindingsSection
    geographic_footprint: {
      locations: Location[]
      employee_distribution: FindingsSection
    }
  }
  raw_extractions: {
    all_findings: Array<{
      id: string
      content: string
      source: {
        document: string
        location: string
      }
      extracted_from_section: string
    }>
  }
  data_gaps?: {
    missing_sections: string[]
    incomplete_data: Array<{
      section: string
      missing: string
    }>
    recommendations: string[]
  }
}

// Stream event types for SSE
export type CIMMVPStreamEvent =
  | { type: 'token'; content: string; timestamp: string }
  | { type: 'slide_update'; slide: import('./state').SlideUpdate; timestamp: string }
  | { type: 'sources'; sources: import('./state').SourceCitation[]; timestamp: string }
  | { type: 'phase_change'; phase: import('./state').CIMPhase; timestamp: string }
  | { type: 'tool_start'; tool: string; timestamp: string }
  | { type: 'tool_end'; tool: string; result?: unknown; timestamp: string }
  | { type: 'done'; conversationId: string; timestamp: string }
  | { type: 'error'; message: string; timestamp: string }
