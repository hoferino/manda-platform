# Agent Behavior Specification

**Document Status:** In Progress (Epic 5 Prerequisites)
**Created:** 2025-11-30
**Owner:** Max
**Version:** 1.0

---

## Purpose

This document is the **single source of truth** for how the Manda conversational agent behaves. It covers search architecture, response formatting, intent detection, use case behaviors, and conversation modes.

All Epic 5 implementation must conform to this specification.

---

## Table of Contents

1. [P1: Hybrid/Agentic Search Architecture](#p1-hybridagentic-search-architecture)
2. [P2: Agent Behavior Framework](#p2-agent-behavior-framework)
3. [P3: Expected Behavior per Use Case](#p3-expected-behavior-per-use-case)
4. [P4: Conversation Goal/Mode Framework](#p4-conversation-goalmode-framework)
5. [P7: LLM Integration Test Strategy](#p7-llm-integration-test-strategy)
6. [P8: Correction Chain Detection](#p8-correction-chain-detection)

---

## P1: Hybrid/Agentic Search Architecture

### Overview

The `query_knowledge_base` tool combines pgvector semantic search with Neo4j graph traversal to provide accurate, contextual answers.

### Search Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   query_knowledge_base                       │
├─────────────────────────────────────────────────────────────┤
│  1. Intent Detection (LLM)                                  │
│     - Fact retrieval? → High confidence, single answer      │
│     - Research? → Multiple findings, temporal context       │
│                                                             │
│  2. Semantic Search (pgvector)                              │
│     - match_findings RPC with filters                       │
│     - Internal scoring: similarity × recency × confidence   │
│                                                             │
│  3. Temporal Filtering                                      │
│     - Group by date_referenced                              │
│     - Identify superseded findings (SUPERSEDES relationship)│
│     - For fact retrieval: prefer most recent authoritative  │
│                                                             │
│  4. Conflict Detection (Neo4j)                              │
│     - Query for CONTRADICTS relationships                   │
│     - Only flag if: same period + no SUPERSEDES + diff docs │
│                                                             │
│  5. Response Formatting                                     │
│     - Never show confidence scores                          │
│     - Translate to natural explanations                     │
└─────────────────────────────────────────────────────────────┘
```

### Two Query Modes

#### Mode 1: Fact Retrieval

**Trigger:** User asks for a specific data point
**Examples:** "What was Q3 revenue?", "How many employees?", "What's the EBITDA margin?"

**Behavior:**
- Return the **most current, highest confidence** finding
- Short answer with source attribution
- Only return if confidence is HIGH (internal threshold)
- If confidence is low or conflicts exist → surface uncertainty with explanation

**Example Response:**
> Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12).

#### Mode 2: Research/Exploration

**Trigger:** User asks open-ended questions or wants context
**Examples:** "What do we know about revenue trends?", "Summarize the financial position", "Any concerns about the P&L?"

**Behavior:**
- Return multiple findings across time periods
- Show temporal evolution (Q1 → Q2 → Q3)
- Surface contradictions/corrections explicitly
- Longer, structured response with context

### Conflict vs. Temporal Difference

| Scenario | Is it a Conflict? | Agent Behavior |
|----------|-------------------|----------------|
| 2023 P&L says €4M, 2024 P&L says €5M | **No** — different periods | Return most recent, no warning |
| Two docs from Q3 2024, one says €5M, other says €5.2M | **Maybe** | Check for SUPERSEDES relationship |
| `annual_report.pdf` → `annual_report_CORRECTED.pdf` | **No** — correction chain | Return corrected value, note correction |
| Management deck says €5M, Audited financials say €5.2M (same period) | **Yes** | Flag as conflict, explain both sources |

### Response Formatting Rules

**Critical:** Never show confidence scores to users.

Instead, translate confidence factors into natural explanations:

| Confidence Factor | User-Facing Explanation |
|-------------------|------------------------|
| Older document date | "from a presentation dating 2 months back" |
| Superseded by correction | "this was later corrected in the Q3 report" |
| Forecast vs. actual | "this was a forecast; actuals show..." |
| Different source quality | "from an internal draft" vs "from the audited financials" |
| Partial information | "based on partial Q3 data available at the time" |

**Example with discrepancy:**
> Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12).
>
> Note: An earlier management presentation from October estimated €5.0M — this was before final numbers were reported.

### Technical Components

**pgvector (Supabase):**
- `match_findings` RPC function
- 3072-dim embeddings (OpenAI text-embedding-3-large)
- Filters: deal_id, document_id, domains, statuses, confidence range
- HNSW index for fast similarity search

**Neo4j Graph:**
- Nodes: Deal, Document, Finding, Insight
- Key Relationships:
  - `SUPERSEDES` — correction/update chain
  - `CONTRADICTS` — unresolved conflicts
  - `SUPPORTS` — corroborating evidence
  - `EXTRACTED_FROM` — source attribution

---

## P2: Agent Behavior Framework

### Core Principles

1. **Always structured** — no walls of text
2. **No hard length limits** — focus on relevance instead
3. **Exclude irrelevant information** — concise beats comprehensive
4. **Every factual claim needs a source**

### Response Format

**Adaptive formatting** — let the content dictate the structure:

| Content Type | Format |
|--------------|--------|
| Single data point | Short prose with inline source |
| List of items / comparisons | Bullet points |
| Trend or narrative | Prose with inline sources |
| Multiple topics | Headers + bullets/prose per section |

**Example: List/Comparison**
> **Revenue by Quarter:**
> - Q3 2024: €5.2M (source: Q3_Report.pdf)
> - Q2 2024: €4.8M (source: Q2_Report.pdf)
> - YoY growth: +12%
>
> **Note:** No Q1 2024 data found. Add to Q&A?

**Example: Narrative**
> Revenue has grown from €4.8M in Q2 2024 (Q2_Report.pdf) to €5.2M in Q3 2024 (Q3_Report.pdf), representing 12% YoY growth. I couldn't find Q1 2024 figures — would you like me to add this to the Q&A list?

### Uncertainty Handling

| Situation | Agent Response |
|-----------|----------------|
| No findings at all | "I couldn't find information about X in the uploaded documents. Would you like me to add this to the Q&A list for the target company?" |
| Only dated findings | Show results + explain: "I found references to X, but they're from documents dated [date]. Here's what I found: [results]. Would you like me to flag this as a gap?" |
| Low confidence findings | Show results + explain WHY confidence is low (source quality, partial data, conflicting sources) |
| Outside knowledge base scope | "This question is about [topic] which isn't covered in the uploaded documents. Would you like me to add it to the Q&A list?" |

**Key rule:** Never just say "I don't know" — always explain WHY and offer a next step.

### Proactive Suggestions

**Agent proactively offers to:**
- ✅ Add information gaps to IRL
- ✅ Generate Q&A items for target company follow-up
- ✅ Flag contradictions when detected during search

**Agent does NOT proactively:**
- ❌ Trigger document re-analysis (user-initiated only)
- ❌ Modify knowledge graph relationships (happens automatically)
- ❌ Create findings without user confirmation

### Source Attribution

- Every factual claim must have a source
- Format: `(source: filename.ext, location)`
- Location specificity: page number, cell reference, section name
- Sources are clickable links to exact document location
- Multiple sources allowed: `(sources: doc1.pdf p.5, doc2.xlsx B15)`

---

## P3: Expected Behavior per Use Case

### Core Principle: Inferred Intent

The agent **infers** the user's intent from the query — no explicit mode selection required.
Users shouldn't have to think about modes; the agent adapts automatically.

### Meta-Commentary Rule

**Brief orientation, then deliver.**

- ✅ "Here's the P&L breakdown:" → content
- ❌ "I understand you want me to walk you through the P&L. I'll analyze the financial statements and provide a structured breakdown..." → too much

One short line of commentary max, then get to the content.

### Inferred Use Cases

| Query Pattern | Inferred Intent | Agent Behavior |
|---------------|-----------------|----------------|
| "What's the EBITDA?" | **Fact lookup** | Single answer with source, done |
| "Walk me through the P&L" | **Financial deep dive** | "Here's the P&L breakdown:" → structured by line item, highlight trends/anomalies |
| "Any red flags?" / "What concerns should I have?" | **Due diligence check** | Risk-focused scan, surface contradictions, gaps, unusual items |
| "How does X compare to Y?" | **Comparison** | Side-by-side presentation, calculate variance, note discrepancies |
| "Summarize the management team" | **Synthesis** | "Here's what we know about the management team:" → aggregate across documents |
| "What's missing?" / "What don't we know?" | **Gap identification** | Coverage analysis against IRL, suggest Q&A items |
| "Tell me about the company" | **General exploration** | High-level overview, offer to drill down on specific areas |

### Detailed Behavior by Intent

#### Fact Lookup
**Trigger:** Direct question about a specific data point
**Response:**
- Single authoritative answer
- Source attribution
- If uncertainty exists, explain why (see P1 conflict rules)

**Example:**
> EBITDA for FY2024 was €1.2M (source: Annual_Report_2024.pdf, p.23).

#### Financial Deep Dive
**Trigger:** "Walk me through...", "Explain the...", "Break down..."
**Response:**
- Brief intro line
- Structured breakdown (headers, bullets)
- Highlight trends, YoY changes, anomalies
- Flag items that need attention

**Example:**
> Here's the P&L breakdown for FY2024:
>
> **Revenue:** €5.2M (+12% YoY)
> - Product sales: €4.1M
> - Services: €1.1M
>
> **Gross Margin:** 42% (down from 45% in FY2023)
> - Note: COGS increased due to supply chain costs (source: MD&A, p.8)
>
> **EBITDA:** €1.2M (23% margin)

#### Due Diligence Check
**Trigger:** "Red flags", "concerns", "risks", "issues", "problems"
**Response:**
- Focus on risks and anomalies
- Surface contradictions explicitly
- Highlight gaps in information
- Offer to add to Q&A list

**Example:**
> I found a few items worth noting:
>
> **Contradictions:**
> - Revenue figures differ between the management presentation (€5.0M) and audited financials (€5.2M) for Q3 2024
>
> **Gaps:**
> - No customer concentration data found
> - Missing FY2023 audit report
>
> **Unusual Items:**
> - One-time restructuring charge of €300K in Q2 (source: Q2_Report.pdf, p.12)
>
> Would you like me to add the gaps to the Q&A list?

#### Comparison
**Trigger:** "Compare", "versus", "vs", "difference between", "how does X relate to Y"
**Response:**
- Side-by-side format
- Calculate variance/delta
- Note discrepancies and explain if possible

**Example:**
> **Revenue: Forecast vs. Actual (Q3 2024)**
>
> | Metric | Forecast | Actual | Variance |
> |--------|----------|--------|----------|
> | Revenue | €5.0M | €5.2M | +€200K (+4%) |
> | Gross Margin | 44% | 42% | -2pp |
>
> The revenue beat was driven by higher services revenue. Margin miss attributed to supply chain costs (source: Q3_Report.pdf, p.5).

#### Synthesis
**Trigger:** "Summarize", "what do we know about", "overview of", "tell me about"
**Response:**
- Aggregate information across documents
- Structured by topic/theme
- Note where information is incomplete

**Example:**
> Here's what we know about the management team:
>
> **CEO - Jane Smith**
> - Joined 2019, previously VP at CompetitorCo
> - Owns 15% equity (source: Cap_Table.xlsx)
>
> **CFO - John Doe**
> - Joined 2021, CPA with Big4 background
> - No equity stake listed
>
> **Gaps:** No information found on CTO or VP Sales. Add to Q&A?

#### Gap Identification
**Trigger:** "What's missing", "what don't we know", "gaps", "IRL coverage"
**Response:**
- Coverage analysis against IRL checklist
- Categorize by priority/domain
- Offer to generate Q&A items

**Example:**
> Here's the coverage analysis against your IRL:
>
> **Financial (3/5 items covered)**
> - ✅ P&L statements
> - ✅ Balance sheet
> - ✅ Revenue breakdown
> - ❌ Cash flow statement
> - ❌ Debt schedule
>
> **Legal (1/4 items covered)**
> - ✅ Corporate structure
> - ❌ Material contracts
> - ❌ Litigation history
> - ❌ IP portfolio
>
> Would you like me to generate Q&A items for the missing information?

#### General Exploration
**Trigger:** Broad questions like "Tell me about the company", "What do we have?"
**Response:**
- High-level overview
- Offer drill-down options
- Don't overwhelm with detail

**Example:**
> Here's a high-level overview of what we have on TargetCo:
>
> **Documents uploaded:** 12 files
> **Key financials:** FY2023-2024 P&L, Balance Sheet available
> **Coverage:** Strong on financials, limited on legal/operational
>
> What would you like to explore?
> - Financial deep dive
> - Management team
> - Gaps and missing information

---

## P4: Conversation Goal/Mode Framework

### Multi-Turn Context

The agent maintains conversation context across turns. Follow-up questions inherit context from previous exchanges.

**Context Handling Rules:**

| Situation | Agent Behavior |
|-----------|----------------|
| Clear follow-up | Assume same context, state assumption briefly |
| Ambiguous follow-up | Ask for clarification |
| Topic shift | Treat as new query, reset context |

**Example: Clear follow-up**
> **User:** What's the Q3 revenue?
> **Agent:** Q3 2024 revenue was €5.2M (source: Q3_Report.pdf)
>
> **User:** And EBITDA?
> **Agent:** For Q3 2024, EBITDA was €1.2M (source: Q3_Report.pdf, p.23).

Note: Agent states "For Q3 2024" to confirm the assumed context.

**Example: Ambiguous follow-up**
> **User:** What's the revenue?
> **Agent:** [provides Q3 2024 revenue]
>
> **User:** What about last year?
> **Agent:** Do you mean Q3 2023 (same quarter) or FY2023 (full year)?

**Example: Topic shift**
> **User:** What's the Q3 revenue?
> **Agent:** [provides answer]
>
> **User:** Tell me about the management team.
> **Agent:** [new query, no context carried from revenue discussion]

### Intent Detection

Intent is inferred from query patterns (see P3 for full list):
- Direct questions → Fact lookup
- "Walk me through..." → Deep dive
- "Red flags" / "concerns" → Due diligence
- "Compare" / "vs" → Comparison
- "Summarize" / "what do we know" → Synthesis
- "What's missing" → Gap identification
- Broad questions → General exploration

### Guiding Users

**Defer to testing and iteration.**

Initial implementation will not include proactive guidance. After Epic 5 is live, we'll evaluate:
- When users seem stuck
- What follow-up suggestions are helpful
- How to steer vague queries

This will be refined based on real usage patterns.

### Conversation State

Stored in `conversations` and `messages` tables:
- Conversation ID
- Message history (user + agent messages)
- Tool calls and results
- Timestamps

Context window: Last N messages passed to LLM (configurable, start with 10).

---

## P7: LLM Integration Test Strategy

### Test Pyramid

| Test Type | When | Cost | Purpose |
|-----------|------|------|---------|
| Unit tests (mocked) | Every commit, CI | Free | Code logic, tool routing, error handling |
| Integration tests (live) | Manual before release | ~50K tokens/run | E2E validation, prompt quality |
| Evaluation dataset | Periodic | Variable | Search quality, behavior compliance |

### Unit Tests (Mocked)

**Scope:**
- Tool selection logic
- Response formatting
- Error handling paths
- Context management
- State transitions

**Implementation:**
- Mock LLM responses with deterministic fixtures
- Fast, run on every commit
- No API costs

### Integration Tests (Live API)

**Cost Control:**
- **Budget:** 50,000 tokens per test run
- Track token usage per test
- Fail suite if budget exceeded
- Log actual costs for monitoring

**Scope:**
- Full E2E conversation flows
- Tool invocation and response
- Prompt behavior validation
- Multi-turn context handling

**When to Run:**
- Before releases
- After prompt changes
- After tool modifications
- NOT on every commit

**Test Categories:**

1. **Basic Tool Invocation**
   - Agent calls correct tool for query type
   - Tool returns expected data structure
   - Agent formats response correctly

2. **Prompt Behavior Compliance**
   - Sources are cited (see P2)
   - Structured formatting used (see P2)
   - Uncertainty handled correctly (see P2)
   - Meta-commentary is brief (see P3)

3. **Workflow E2E** (especially important for Epic 9+)
   - CIM generation workflow
   - Q&A co-creation workflow
   - IRL auto-generation

### Evaluation Dataset

Curated set of test queries with expected behaviors. Each test case defines:

```yaml
- id: EVAL-001
  query: "What's the Q3 revenue?"
  intent: fact_lookup
  expected_behavior:
    - single_answer: true
    - source_cited: true
    - no_unnecessary_info: true
  example_good_response: "Q3 2024 revenue was €5.2M (source: Q3_Report.pdf, p.12)."
  example_bad_response: "Let me analyze the revenue data for you. Looking at the financial statements..."
```

**Initial Evaluation Set (MVP):**

| ID | Query | Intent | Key Checks |
|----|-------|--------|------------|
| EVAL-001 | "What's the Q3 revenue?" | Fact lookup | Single answer, source cited |
| EVAL-002 | "Walk me through the P&L" | Deep dive | Structured, headers, trends noted |
| EVAL-003 | "Any red flags?" | Due diligence | Contradictions surfaced, gaps noted |
| EVAL-004 | "Compare forecast to actual" | Comparison | Side-by-side, variance calculated |
| EVAL-005 | "Summarize the management team" | Synthesis | Aggregated, gaps noted |
| EVAL-006 | "What's missing for the IRL?" | Gap identification | Coverage analysis, Q&A offered |
| EVAL-007 | "Tell me about the company" | Exploration | Overview, drill-down offered |
| EVAL-008 | "What's the EBITDA?" → "And gross margin?" | Multi-turn | Context maintained, assumption stated |
| EVAL-009 | [query with no data] | Uncertainty | Explains WHY, offers Q&A |
| EVAL-010 | [query with conflicting data] | Conflict | Both sources shown, explained |

**Scoring:**
- Pass/Fail per check
- Overall score: % of checks passed
- Threshold for release: 90%+

### Test Data Management

**Fixtures:**
- Sample project with known documents
- Pre-populated findings with known values
- Controlled contradictions and gaps

**Isolation:**
- Tests use dedicated test project
- No interference with production data
- Reset between test runs

### Future: Automated Evaluation

Post-MVP, consider:
- LLM-as-judge for response quality
- Automated regression testing
- A/B testing for prompt variations

---

## P8: Correction Chain Detection

### Overview

Detect when documents/findings supersede earlier versions and create `SUPERSEDES` relationships in Neo4j.

### Detection Methods

#### Method 1: Filename Pattern Detection (MVP)

Detect at document upload time:

| Pattern | Example | Action |
|---------|---------|--------|
| `_CORRECTED` | `annual_report_CORRECTED.pdf` | Find `annual_report.pdf`, create SUPERSEDES |
| `_v2`, `_v3` | `forecast_v2.xlsx` | Find `forecast.xlsx` or `forecast_v1.xlsx` |
| `_FINAL` | `presentation_FINAL.pptx` | Find `presentation.pptx` |
| `_updated` | `financials_updated.xlsx` | Find `financials.xlsx` |
| `(1)`, `(2)` | `report (2).pdf` | Find `report.pdf` or `report (1).pdf` |

**Implementation:** Add to document upload webhook handler.

#### Method 2: Content-Based Detection (Future)

Detect phrases inside documents:
- "This corrects our earlier estimate..."
- "Updated from previous report..."
- "Supersedes version dated..."

**Implementation:** Add to LLM analysis pipeline (Epic 3 extension).

#### Method 3: Metadata Matching (Future)

- Same document title, different dates
- Same author, same topic, newer version

### Graph Updates

When SUPERSEDES relationship is created:

1. Create relationship: `(new_doc)-[:SUPERSEDES]->(old_doc)`
2. For each finding in old_doc that has a corresponding finding in new_doc:
   - Create: `(new_finding)-[:SUPERSEDES]->(old_finding)`
   - Mark old_finding.superseded = true

### Query-Time Behavior

When `query_knowledge_base` retrieves findings:
1. Check for SUPERSEDES relationships
2. If finding is superseded, prefer the superseding finding
3. Optionally mention: "Note: This was updated in [newer_doc]"

### Priority

- **MVP (P8):** Filename pattern detection only
- **Future:** Content-based and metadata matching

---

## Appendix: Tool Prioritization

From Epic 4 Retrospective:

**Must Have (4):**
- `query_knowledge_base`
- `get_document_info`
- `detect_contradictions`
- `find_gaps`

**Should Have (3):**
- `validate_finding`
- `update_knowledge_base`
- `suggest_questions`

**Nice to Have (4):**
- `create_irl`
- `add_to_qa`
- `trigger_analysis`
- `update_knowledge_graph`

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-30 | Max + John (PM) | Initial draft: P1 complete, P8 added |
| 1.1 | 2025-11-30 | Max + John (PM) | All prerequisites complete (P1-P4, P7-P8). Ready for Epic 5. |
