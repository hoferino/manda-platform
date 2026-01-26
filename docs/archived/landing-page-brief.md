# Manda Platform - Landing Page Brief

> **Purpose:** This document provides all context needed to design a compelling landing page for Manda. Optimized for LLM-assisted design workflows.

---

## 1. Product Overview

### What is Manda?

**Manda** is an AI-powered M&A intelligence platform that transforms how investment banking analysts work with complex deal information. It combines the organizational capabilities of a secure data room with the analytical power of a specialized AI agent.

### One-Liner Descriptions (choose based on context)

- **Concise:** "AI-powered M&A intelligence for investment banking"
- **Descriptive:** "The conversational knowledge synthesizer that transforms M&A due diligence"
- **Value-focused:** "From document chaos to deal clarity in minutes, not weeks"

### Core Innovation

Background AI processing builds a persistent knowledge base that the conversational agent queries. This creates a lightweight, responsive chat interface backed by deep, continuous analysis. Unlike generic AI that starts fresh each conversation, Manda builds cumulative deal intelligence.

---

## 2. Target Audience

### Primary User

**M&A Analysts and Associates** working at:
- Investment banks (bulge bracket to boutique)
- Private equity firms
- Corporate development teams
- M&A advisory firms

### User Characteristics

- Highly educated professionals (MBA, finance backgrounds)
- Time-pressured, deadline-driven work environment
- Deal with 100s of documents per transaction
- Need to synthesize information across financial, operational, legal, and market domains
- Extremely detail-oriented (errors have serious consequences)
- Skeptical of AI "hallucinations" - require source attribution

### User Pain Points (emphasize these)

1. **Information Overload**
   - Massive document volume (years of financials, multiple subsidiaries)
   - Risk of missing critical patterns buried in details
   - Context switching between financial, operational, market, and legal domains

2. **CIM Creation Complexity**
   - Manual synthesis across hundreds of documents
   - Time-consuming narrative building
   - Ensuring consistency and source attribution

3. **Knowledge Fragmentation**
   - Findings scattered across Excel sheets, Word docs, analyst memory
   - "Where did I see that revenue number?" problem
   - No cumulative, searchable knowledge system

---

## 3. Value Propositions

### Primary Value Props (use these as headlines)

1. **"Connect the Dots Across Every Document"**
   - Cross-domain pattern detection finds insights humans miss
   - Contradiction detection surfaces inconsistencies automatically
   - Gap analysis identifies missing information

2. **"Every Answer Traced to Its Source"**
   - Strict source attribution (document, page, cell)
   - Confidence scoring for all findings
   - Zero tolerance for hallucination

3. **"Your Deal Intelligence Grows Continuously"**
   - Background processing analyzes documents 24/7
   - Knowledge compounds over weeks of deal work
   - Never start from scratch

4. **"From 100 Documents to Compelling CIM"**
   - AI-guided storybook creation
   - Buyer persona-driven narratives
   - Export-ready slide blueprints

### Supporting Value Props

- **Analyst as Expert:** System supports but doesn't replace analyst judgment
- **Professional Quality:** Output meets investment banking standards
- **Secure by Design:** Deal data is highly confidential - isolated per deal, encrypted

---

## 4. Key Features

### Feature Hierarchy (for landing page sections)

#### Tier 1: Hero Features

1. **Conversational AI Agent**
   - Natural language Q&A about any deal aspect
   - Multi-turn conversations with context preservation
   - Source-cited answers with confidence scores

2. **Intelligent Document Processing**
   - Automatic parsing of Excel (with formulas), PDF, Word
   - Background analysis extracts findings without manual work
   - Financial model integration with metric extraction

3. **CIM Builder**
   - 3-panel NotebookLM-inspired interface
   - Buyer persona-driven narrative generation
   - Wireframe slide preview with click-to-reference

#### Tier 2: Supporting Features

4. **Knowledge Base**
   - Structured storage of findings, insights, contradictions
   - Knowledge graph with relationship mapping
   - Semantic search and retrieval

5. **IRL (Information Request List) Management**
   - Template library for common deal types
   - Auto-generate folder structure from IRL
   - Progress tracking and gap identification

6. **Q&A Co-Creation**
   - AI suggests questions based on knowledge gaps
   - Excel export/import for client round-trips
   - Link answers to source findings

7. **Learning Loop**
   - Analyst corrections improve system over time
   - Confidence calibration from feedback
   - Audit trail for all changes

---

## 5. Technical Differentiators

### For Technical Buyers (secondary landing page section)

- **Knowledge Graph:** Graphiti + Neo4j with temporal facts (tracks when information changes)
- **Hybrid Retrieval:** Vector search + BM25 + graph traversal with Voyage reranking
- **Multi-Model Strategy:** Right LLM for each task (Gemini Flash for extraction, Claude for conversation)
- **Enterprise Security:** Row-Level Security, encrypted at rest/transit, SOC2-ready architecture

### Processing Pipeline (for "How It Works" section)

```
Upload Documents
     |
     v
Automatic Parsing (Docling - preserves Excel formulas, tables, OCR)
     |
     v
Knowledge Extraction (Entities, Facts, Relationships)
     |
     v
Analysis (Findings, Contradictions, Gaps)
     |
     v
Ready to Query (Ask anything, get sourced answers)
```

---

## 6. Use Case Scenarios

### Scenario 1: Due Diligence Deep Dive

> "I just received 50 documents from the target company. Within hours, Manda has analyzed them all, extracted key financial metrics, flagged two contradictions between the management presentation and the financial model, and identified 5 items missing from our IRL."

### Scenario 2: Quick Answer

> "What was Q3 EBITDA margin?"
>
> Manda: "Q3 2024 EBITDA margin was 23.4%, down from 25.1% in Q2. (Source: Financial Model v3.xlsx, Sheet 'P&L Summary', Cell E12, Confidence: 95%)"

### Scenario 3: CIM Creation

> "Help me build a CIM for a strategic buyer focused on market expansion."
>
> Manda guides through buyer persona discovery, proposes investment thesis, collaboratively builds outline, generates slide content with sources, creates wireframe previews.

---

## 7. Competitive Positioning

### What Manda IS NOT

- Not a generic chatbot (it builds cumulative deal knowledge)
- Not just a data room (it has AI intelligence layer)
- Not a document search tool (it understands relationships and contradictions)
- Not a template filler (it guides narrative creation)

### Key Differentiators vs Competitors

| Aspect | Generic AI | Traditional Data Rooms | Manda |
|--------|-----------|----------------------|-------|
| Knowledge Persistence | Resets each chat | None | Cumulative |
| Source Attribution | Often missing | Manual | Automatic |
| Cross-Document Analysis | Limited | None | Core feature |
| Background Processing | None | File storage only | Continuous |
| M&A Domain Expertise | Generic | None | Purpose-built |

---

## 8. Social Proof / Credibility (to be added)

### Metrics to Highlight (when available)

- Documents processed
- Time saved per deal
- Findings extracted automatically
- Accuracy rate with source attribution

### Target Testimonial Themes

- "Finally, an AI I can trust with source citations"
- "Cut our CIM creation time significantly"
- "Found a contradiction we would have missed"
- "It remembers everything across the entire deal"

---

## 9. Design Direction

### Visual Tone

- **Professional:** Investment banking aesthetic, not startup playful
- **Sophisticated:** Clean, minimal, confident
- **Trustworthy:** Emphasize security, accuracy, sources
- **Modern:** Contemporary tech product, not legacy enterprise

### Color Palette Suggestions

- Primary: Deep navy/dark blue (trust, professionalism)
- Accent: Gold/amber (premium, value)
- Neutral: Cool grays, white
- Avoid: Bright primary colors, playful palettes

### Typography

- Headlines: Modern sans-serif (Inter, SF Pro, Söhne)
- Body: Highly readable, professional
- Consider: Monospace accents for technical/data elements

### Imagery Direction

- Abstract data visualizations
- Knowledge graph / network illustrations
- Clean dashboard mockups
- Avoid: Stock photos of people in suits, handshakes

### Key UI Screenshots to Feature

1. **Chat Interface** - Conversational AI with source citations
2. **Knowledge Explorer** - Findings with validation, contradictions view
3. **CIM Builder** - 3-panel layout with wireframe preview
4. **Data Room** - Folder structure with processing status

---

## 10. Page Structure Recommendation

### Hero Section
- Headline: Value-focused (e.g., "M&A Intelligence That Never Forgets")
- Sub-headline: Brief description of the platform
- CTA: "Request Demo" or "Get Early Access"
- Visual: Abstract visualization or key product screenshot

### Problem Section
- Pain points with emotional resonance
- Statistics if available (hours spent, documents per deal)

### Solution Section
- How Manda works (simplified pipeline)
- Core value props as cards/icons

### Features Section
- Tier 1 features with screenshots
- Expandable details for power users

### How It Works
- 3-4 step process visualization
- Emphasize automation and background processing

### Use Cases / Scenarios
- 2-3 concrete examples with quotes

### Security / Trust Section
- Enterprise-grade security
- Source attribution commitment
- Data isolation

### CTA Section
- Demo request form
- Early access waitlist

### Footer
- Contact, legal, social links

---

## 11. Messaging Guidelines

### Tone of Voice

- **Confident but not arrogant:** We solve real problems
- **Professional:** Speak the language of finance
- **Direct:** Analysts are busy, get to the point
- **Substantive:** Claims backed by specific capabilities

### Words to USE

- Intelligence, Insights, Synthesis
- Source-attributed, Cited, Traceable
- Cumulative, Persistent, Continuous
- Precision, Accuracy, Confidence
- Secure, Isolated, Enterprise-grade

### Words to AVOID

- "Magic," "Revolutionary," "Game-changer" (overused)
- "AI-powered" alone (too generic, be specific)
- "Automate everything" (analysts want assistance, not replacement)
- "No hallucinations" (can't promise, say "source-attributed")

### Key Phrases

- "From document chaos to deal clarity"
- "Every answer traced to its source"
- "Your deal intelligence grows with every document"
- "The analyst's intelligent co-pilot"
- "Background intelligence that works while you sleep"

---

## 12. Technical Requirements for Designer

### Responsive Design
- Desktop-first (primary use case)
- Tablet support
- Mobile: simplified, focus on demo request

### Performance
- Fast loading (analysts are impatient)
- Lazy load images/screenshots
- Consider dark mode (analysts work late)

### Accessibility
- WCAG 2.1 AA compliance
- High contrast ratios
- Keyboard navigation

### Integrations to Consider
- Analytics (GA4, Mixpanel)
- Demo booking (Calendly, HubSpot)
- Chat widget (Intercom, Drift)

---

## 13. Appendix: Feature Deep Dives

### CIM Builder Workflow

1. **Buyer Persona Discovery** - Conversational exploration of target buyer
2. **Investment Thesis** - 3-part thesis: The Asset, The Timing, The Opportunity
3. **Agenda Definition** - Collaborative outline creation
4. **Slide Content** - RAG-powered content with source citations
5. **Visual Concepts** - Wireframe generation with layout specs
6. **Export** - PowerPoint or LLM prompt output

### Document Processing Pipeline

1. **Upload** - Drag-drop or chat-based
2. **Parse** - Docling extracts text, tables, formulas
3. **Embed** - Voyage voyage-3.5 (1024d) embeddings
4. **Analyze** - Gemini extracts entities, facts, relationships
5. **Store** - Graphiti + Neo4j knowledge graph
6. **Index** - Hybrid search (vector + BM25 + graph)
7. **Ready** - Query via chat or explore in Knowledge Base

### Security Architecture

- Row-Level Security (RLS) on all data
- Multi-tenant isolation via project_id
- Encrypted at rest (AES-256)
- Encrypted in transit (TLS 1.3)
- No cross-deal data leakage
- Audit logging for all access

---

*Document Version: 1.0*
*Last Updated: 2026-01-07*
*For: Landing Page Design Brief*
