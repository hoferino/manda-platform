# M&A Deal Intelligence Platform - Quick Start Guide

## Installation

```bash
bmad install manda
```

During installation, you'll be prompted to configure:
1. **Data Room Path** - Where deal documents are stored
2. **Output Location** - Where generated reports/CIMs will be saved
3. **Knowledge Base Path** - Where indexed data is stored (usually auto-managed)
4. **Template Preference** - Standard or custom CIM templates
5. **Inconsistency Sensitivity** - How aggressively to flag discrepancies (relaxed/standard/strict)

## First-Time Setup (5 minutes)

### Step 1: Upload Deal Documents

Navigate to your data room directory and upload documents:

```
data/deals/[your-deal]/
├── financials/
│   ├── 2023-Audited-Financials.pdf
│   ├── 2024-Q1-Financials.xlsx
│   └── Revenue-by-Customer-2023.xlsx
├── legal/
│   ├── Articles-of-Incorporation.pdf
│   └── Customer-Contracts/
├── operational/
│   ├── Org-Chart-2024.pdf
│   └── Employee-Census.xlsx
├── commercial/
│   ├── Customer-List.xlsx
│   └── Pricing-Analysis.xlsx
└── strategic/
    ├── Business-Plan-2024.pdf
    └── Management-Presentation.pptx
```

**Tip:** Use descriptive filenames with dates. This helps the Information Vault understand document types and vintage.

### Step 2: Activate the Module

```bash
/manda:deal-orchestrator
```

This activates the Deal Orchestrator, your primary interface to the platform.

### Step 3: Run Data Room Audit

```bash
/manda:data-room-audit
```

The platform will:
- ✅ Scan all uploaded documents
- ✅ Compare against M&A due diligence checklist
- ✅ Identify what you have vs. what's missing
- ✅ Run inconsistency detection across documents
- ✅ Generate actionable next steps

**Output:** A comprehensive audit report in your output directory.

### Step 4: Develop Investment Storyline

```bash
/manda:investment-storyline-workshop
```

This launches an interactive workshop to develop your investment narrative:
- 🎯 Investment thesis development
- 📊 Core theme identification
- 📖 Narrative arc construction
- ✅ Evidence mapping
- 📄 Teaser and CIM outline generation

**Duration:** 30-90 minutes depending on depth level selected

## Common Workflows

### Scenario 1: New Deal (No Documents Yet)

Even without documents, you can start developing the storyline:

1. Activate Deal Orchestrator: `/manda:deal-orchestrator`
2. Start storyline workshop: `/manda:investment-storyline-workshop`
3. The Story Architect will work with you to capture your knowledge
4. Document gaps will be identified for future collection

### Scenario 2: Comprehensive Due Diligence

You have a full data room and need complete analysis:

1. Upload all documents to data room
2. Run data room audit: `/manda:data-room-audit`
3. Review gaps and request missing documents
4. Ask Deal Orchestrator: "Analyze the company's financial performance"
5. Ask: "What are the business strengths and competitive positioning?"
6. Run storyline workshop when ready: `/manda:investment-storyline-workshop`

### Scenario 3: Quick Teaser Creation

You need a one-page teaser ASAP:

1. Upload key documents (financials, customer list, business overview)
2. Run quick storyline workshop (30 min mode): `/manda:investment-storyline-workshop`
   - Select "quick" depth level
   - Enable teaser generation
3. Receive investment teaser in output directory

## Agent Quick Reference

You work with the **Deal Orchestrator** - you never manually switch agents. Behind the scenes, the Orchestrator coordinates:

### Information Vault
- **What it does:** High-speed data retrieval from knowledge base
- **When it's used:** Every time you ask a factual question
- **Example:** "What was 2023 revenue?" → Vault retrieves from financials

### Company Analyst
- **What it does:** Business intelligence (products, customers, operations, market)
- **When it's used:** Business-focused questions
- **Example:** "Who are the top customers?" → Analyst synthesizes from multiple sources

### Finance Analyst
- **What it does:** Financial analysis, valuation, inconsistency detection
- **When it's used:** Financial questions and analysis requests
- **Example:** "Run a valuation analysis" → Analyst performs DCF, comps, precedents

### Story Architect
- **What it does:** Narrative development and storyline creation
- **When it's used:** CIM development, teaser creation, storyline workshops
- **Example:** "Develop investment storyline" → Architect facilitates workshop

## Common Questions

### "What can I ask the Deal Orchestrator?"

Anything related to the deal:
- **Factual queries:** "What was 2023 EBITDA?"
- **Analysis requests:** "Analyze customer concentration risk"
- **Document requests:** "Show me all references to revenue projections"
- **Workflow triggers:** "Run a data room audit"
- **Inconsistency checks:** "Are there any discrepancies in revenue figures?"
- **Storyline development:** "Help me develop an investment thesis"

### "How do I know what data is available?"

Ask the Deal Orchestrator:
```
/analysis-status
```

This shows:
- ✅ Data completeness (what you have vs. need)
- 📊 Available analyses (what can be performed now)
- 🔴 Critical gaps (what's blocking work)
- 📋 Recommended next steps

### "Can I validate assumptions?"

Yes! The platform cross-checks your assumptions against the knowledge base:

**You:** "I believe this company has 95% customer retention"
**Orchestrator:** [Queries Information Vault] → "Customer retention is 92% according to Customer Success Dashboard Q4 2023. Close to your assumption but not exact."

### "How does inconsistency detection work?"

The Finance Analyst automatically compares metrics across documents:
- ✅ Audited financials vs. management presentations
- ✅ Customer revenue across different sources
- ✅ Employee counts in various documents
- ✅ Forecast assumptions vs. historical actuals

Sensitivity is configurable:
- **Strict:** Flags any discrepancy >1%
- **Standard:** Flags discrepancies >5% or material contradictions
- **Relaxed:** Only flags clear contradictions

### "What if I don't have all the documents?"

No problem! The platform adapts to available data:
1. Data room audit identifies gaps
2. You can still develop storyline with partial data
3. Claims without supporting evidence are flagged
4. Recommendations provided for what to request from company

### "How do I create a CIM?"

Two approaches:

**Approach 1: Storyline-First (Recommended)**
1. Run investment storyline workshop
2. Develop narrative in prose form
3. Generate CIM outline from storyline
4. Convert narrative to slides (future workflow)

**Approach 2: Request Directly**
Ask Deal Orchestrator: "Create a CIM"
- Orchestrator will run storyline workshop automatically
- Generates narrative CIM outline
- Provides next steps for slide creation

## Tips for Best Results

### 1. Use Descriptive Document Names
✅ `2023-Audited-Financial-Statements.pdf`
❌ `financials.pdf`

### 2. Organize by Category
Place documents in correct data room folders (financials, legal, etc.)

### 3. Mark Data Quality
Use filenames to indicate:
- `AUDITED-2023-Financials.pdf` (high quality)
- `DRAFT-Management-Projections.xlsx` (lower quality)
- `UNAUDITED-Q1-2024.pdf` (flag as unaudited)

### 4. Ask Follow-Up Questions
The Orchestrator maintains context:
```
You: "What was 2023 revenue?"
Orchestrator: "$47.2M"

You: "How does that compare to 2022?"
Orchestrator: "23% growth from $38.4M in 2022"

You: "What drove that growth?"
[Orchestrator coordinates Company Analyst to provide drivers]
```

### 5. Use Workflows for Structured Tasks
- Data completeness check → `/manda:data-room-audit`
- Storyline development → `/manda:investment-storyline-workshop`
- Quick status → `/analysis-status`

### 6. Validate Everything
Ask for sources: "What's the source for that revenue number?"
All responses include citations to original documents.

## Keyboard Shortcuts & Commands

### Essential Commands
- `/manda:deal-orchestrator` - Activate module
- `/manda:data-room-audit` - Run data room audit
- `/manda:investment-storyline-workshop` - Start storyline workshop
- `/analysis-status` - Get analysis readiness overview
- `/upload-documents` - Document upload workflow

### Quick Actions (via Deal Orchestrator)
Just ask in natural language:
- "Show me the data room audit report"
- "What's the status of our analysis?"
- "Are there any inconsistencies in the financials?"
- "Create an investment teaser"
- "What data do we still need?"

## Troubleshooting

### "Information Vault can't find data"
- Check document is uploaded to correct data room folder
- Verify file format is supported (PDF, Excel, Word, PPT)
- Allow time for indexing (large documents may take 1-2 minutes)

### "Inconsistencies flagged incorrectly"
- Adjust sensitivity: Edit install-config.yaml → `inconsistency_sensitivity: relaxed`
- Some differences are timing-based (e.g., unaudited Q1 vs. audited FY)

### "Storyline workshop feels stuck"
- Ensure you have basic financial data uploaded
- Answer Discovery questions with your knowledge (even without docs)
- Select "quick" mode if you want faster process

### "Generated documents aren't in my style"
- Customize templates in `/bmad/manda/cim-templates/`
- Adjust `template_preference` in install-config.yaml
- Provide feedback during storyline workshop for refinement

## Next Steps

Now that you're set up:

1. **Upload Your First Documents** → Start with financials and customer data
2. **Run Data Room Audit** → Understand what you have and what's missing
3. **Explore with Questions** → Ask Deal Orchestrator anything about the deal
4. **Develop Your Storyline** → Run investment storyline workshop
5. **Generate Marketing Materials** → Teaser, CIM outline, presentations

**Need help?** Ask the Deal Orchestrator anything. It's designed to guide you through the entire process.

---

**Ready to begin?**

```bash
/manda:deal-orchestrator
```
