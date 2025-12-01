/**
 * Evaluation Dataset for LLM Integration Testing
 *
 * 10 curated test queries per P7 spec from agent-behavior-spec.md.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Requirements:
 * - Budget: 50,000 tokens per test run
 * - Pass Criteria: ≥ 90% of checks pass (9/10 queries)
 */

/**
 * Expected behavior checkers
 */
export type BehaviorCheck =
  | 'single_answer'           // Response contains one primary answer
  | 'source_cited'            // Contains (source: ...) citation
  | 'structured_format'       // Uses headers, bullets, or tables
  | 'no_confidence_scores'    // No raw 0.x numbers shown
  | 'no_excessive_meta'       // Brief or no meta-commentary
  | 'contradictions_surfaced' // Mentions contradictions/conflicts
  | 'gaps_noted'              // Mentions missing info or gaps
  | 'context_maintained'      // References previous turn correctly
  | 'explains_uncertainty'    // Explains WHY info missing
  | 'offers_next_step'        // Offers Q&A or follow-up action
  | 'shows_both_sources'      // For conflicts, shows both sides
  | 'overview_provided'       // High-level summary given
  | 'drilldown_offered'       // Offers to go deeper

/**
 * Query intent types
 */
export type QueryIntent =
  | 'fact_lookup'
  | 'deep_dive'
  | 'due_diligence'
  | 'comparison'
  | 'synthesis'
  | 'gap_identification'
  | 'exploration'
  | 'multi_turn'
  | 'uncertainty'
  | 'conflict'

/**
 * Evaluation test case
 */
export interface EvaluationTestCase {
  id: string
  query: string
  intent: QueryIntent
  expectedBehaviors: BehaviorCheck[]
  context?: {
    previousQuery?: string
    previousResponse?: string
  }
  exampleGoodResponse?: string
  exampleBadResponse?: string
  estimatedTokens: number
}

/**
 * MVP Evaluation Dataset (10 queries)
 * Per P7 spec table
 */
export const EVALUATION_DATASET: EvaluationTestCase[] = [
  {
    id: 'EVAL-001',
    query: "What's the Q3 revenue?",
    intent: 'fact_lookup',
    expectedBehaviors: ['single_answer', 'source_cited', 'no_excessive_meta'],
    exampleGoodResponse: 'Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12).',
    exampleBadResponse:
      "Let me analyze the revenue data for you. Looking at the financial statements, I'll search the knowledge base to find the Q3 revenue information...",
    estimatedTokens: 3000,
  },
  {
    id: 'EVAL-002',
    query: 'Walk me through the P&L',
    intent: 'deep_dive',
    expectedBehaviors: ['structured_format', 'source_cited', 'no_excessive_meta'],
    exampleGoodResponse: `Here's the P&L breakdown for FY2024:

**Revenue:** €5.2M (+12% YoY)
- Product sales: €4.1M
- Services: €1.1M

**Gross Margin:** 42% (source: Q3_Report.pdf, p.8)`,
    estimatedTokens: 6000,
  },
  {
    id: 'EVAL-003',
    query: 'Any red flags?',
    intent: 'due_diligence',
    expectedBehaviors: [
      'contradictions_surfaced',
      'gaps_noted',
      'structured_format',
      'offers_next_step',
    ],
    exampleGoodResponse: `Here are a few items worth noting:

**Contradictions:**
- Revenue figures differ between the management presentation (€5.0M) and audited financials (€5.2M)

**Gaps:**
- No customer concentration data found

Would you like me to add the gaps to the Q&A list?`,
    estimatedTokens: 5000,
  },
  {
    id: 'EVAL-004',
    query: 'Compare forecast to actual',
    intent: 'comparison',
    expectedBehaviors: ['structured_format', 'source_cited'],
    exampleGoodResponse: `**Revenue: Forecast vs. Actual (Q3 2024)**

| Metric | Forecast | Actual | Variance |
|--------|----------|--------|----------|
| Revenue | €5.0M | €5.2M | +€200K (+4%) |

The revenue beat was driven by higher services revenue (source: Q3_Report.pdf, p.5).`,
    estimatedTokens: 4000,
  },
  {
    id: 'EVAL-005',
    query: 'Summarize the management team',
    intent: 'synthesis',
    expectedBehaviors: ['structured_format', 'source_cited', 'gaps_noted'],
    exampleGoodResponse: `Here's what we know about the management team:

**CEO - Jane Smith**
- Joined 2019, previously VP at CompetitorCo
- Owns 15% equity (source: Cap_Table.xlsx)

**Gaps:** No information found on CTO or VP Sales. Add to Q&A?`,
    estimatedTokens: 5000,
  },
  {
    id: 'EVAL-006',
    query: "What's missing for the IRL?",
    intent: 'gap_identification',
    expectedBehaviors: ['structured_format', 'gaps_noted', 'offers_next_step'],
    exampleGoodResponse: `Here's the coverage analysis against your IRL:

**Financial (3/5 items covered)**
- ✅ P&L statements
- ❌ Cash flow statement
- ❌ Debt schedule

Would you like me to generate Q&A items for the missing information?`,
    estimatedTokens: 4000,
  },
  {
    id: 'EVAL-007',
    query: 'Tell me about the company',
    intent: 'exploration',
    expectedBehaviors: ['overview_provided', 'drilldown_offered'],
    exampleGoodResponse: `Here's a high-level overview:

**Documents uploaded:** 12 files
**Key financials:** FY2023-2024 P&L, Balance Sheet available
**Coverage:** Strong on financials, limited on legal/operational

What would you like to explore?
- Financial deep dive
- Management team
- Gaps and missing information`,
    estimatedTokens: 3000,
  },
  {
    id: 'EVAL-008',
    query: 'And EBITDA?',
    intent: 'multi_turn',
    context: {
      previousQuery: "What's the Q3 revenue?",
      previousResponse: 'Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12).',
    },
    expectedBehaviors: ['single_answer', 'source_cited', 'context_maintained'],
    exampleGoodResponse:
      'For Q3 2024, EBITDA was €1.2M (source: Q3_Report.pdf, p.23).',
    estimatedTokens: 3500,
  },
  {
    id: 'EVAL-009',
    query: 'What are the warranty obligations?',
    intent: 'uncertainty',
    expectedBehaviors: ['explains_uncertainty', 'offers_next_step'],
    exampleGoodResponse: `I couldn't find information about warranty obligations in the uploaded documents. The legal documents we have focus on corporate structure and contracts, but warranty details aren't covered.

Would you like me to add this to the Q&A list for the target company?`,
    estimatedTokens: 3000,
  },
  {
    id: 'EVAL-010',
    query: 'Check revenue numbers across documents',
    intent: 'conflict',
    expectedBehaviors: ['shows_both_sources', 'source_cited', 'no_confidence_scores'],
    exampleGoodResponse: `I found a discrepancy in the Q3 2024 revenue figures:

**Management Presentation:** €5.0M (source: mgmt_deck.pptx, p.4)
**Audited Financials:** €5.2M (source: Q3_Report.pdf, p.12)

The audited financials are the more authoritative source. The management presentation was likely prepared before final numbers were available.`,
    estimatedTokens: 4500,
  },
]

/**
 * Get total estimated tokens for all test cases
 */
export function getTotalEstimatedTokens(): number {
  return EVALUATION_DATASET.reduce((sum, tc) => sum + tc.estimatedTokens, 0)
}

/**
 * Token budget per P7 spec
 */
export const TOKEN_BUDGET = 50000

/**
 * Pass threshold per P7 spec
 */
export const PASS_THRESHOLD = 0.9 // 90%

/**
 * Validate that dataset is within budget
 */
export function validateTokenBudget(): { valid: boolean; estimated: number; budget: number } {
  const estimated = getTotalEstimatedTokens()
  return {
    valid: estimated <= TOKEN_BUDGET,
    estimated,
    budget: TOKEN_BUDGET,
  }
}
