# Manda-Standalone POC - Quick Start Guide

## Ready to Test!

The POC is ready with slash commands and sample data.

---

## What's Implemented

✅ **Slash Commands:**
- `/manda-analyze` - Analyze documents and create knowledge base
- `/manda-cim-company-overview` - Create Company Overview chapter with 10-step workflow

✅ **Sample Data:**
- `data/test-company/docs/company-overview.txt` - Comprehensive TechCorp company info

✅ **Intelligent Agent:**
- Extracts structured findings
- Stores in JSON knowledge base
- Guides through BMAD-style workflow
- Applies CIM best practices

---

## How to Use

### Step 1: Analyze Documents

In Claude Code chat, run:
```
/manda-analyze
```

**What happens:**
- Reads `data/test-company/docs/company-overview.txt`
- Extracts structured findings (company history, structure, management, etc.)
- Saves to `data/test-company/knowledge.json`
- Reports what was found

**Expected output:**
```json
{
  "company": "test-company",
  "findings": [
    {
      "id": "finding-001",
      "category": "company_history",
      "finding": "TechCorp was founded in January 2015 by Jane Smith and John Doe...",
      "source": "company-overview.txt",
      "location": "Company Background section, paragraph 1",
      "confidence": 95
    },
    // ... more findings
  ]
}
```

---

### Step 2: Create CIM Chapter

In Claude Code chat, run:
```
/manda-cim-company-overview
```

**What happens:**
- Loads knowledge base
- Launches 10-step conversational workflow
- Asks questions at each step
- Generates Company Overview chapter
- Saves to `data/test-company/outputs/company-overview.md`

**Workflow Steps:**
1. Validate information (check for gaps)
2. Choose narrative approach (Chronological, Structure-First, Vision-Driven)
3. Draft opening hook (3 options)
4. Build Company History section
5. Build Corporate Structure section
6. Build Management Team section
7. Build Geographic Footprint section
8. Build Business Model section
9. Coherence review (buyer's perspective)
10. Export chapter

---

## Example Conversation

```
You: /manda-cim-company-overview

Agent: I've loaded your knowledge base with 42 findings.
       Let me guide you through creating the Company Overview chapter.

       Step 1 of 10: Validate Information

       ✅ Found: Company history (founding, milestones)
       ✅ Found: Corporate structure (3 entities, ownership)
       ✅ Found: Management team (5 executives with backgrounds)
       ✅ Found: Geographic footprint (4 locations)
       ✅ Found: Business model (products, revenue, customers)

       All sections covered! Ready to proceed.

       How would you like to continue?
       1. Proceed with CIM creation
       2. Review findings first
       3. Exit

You: 1

Agent: Step 2 of 10: Choose Narrative Approach

       Based on your company profile, I recommend **Chronological Story**:

       Why this works:
       • Compelling founder story (ex-Google engineers solving real problem)
       • Clear evolution: garage startup → $50M ARR in 9 years
       • Recent momentum: Series B, new CFO, v3.0 launch, $50M ARR
       • Appeals to strategic buyers seeking growth trajectory

       Alternatives:
       • Structure-First: Lead with 3-entity structure (better for complex corps)
       • Vision-Driven: Lead with mission (better for mission-driven buyers)

       What do you think? (chronological / structure / vision / other)

You: chronological sounds perfect

Agent: Excellent! Chronological Story it is.

       Step 3 of 10: Draft Opening Hook

       Here are 3 options to open your Company Overview:

       [Option 1 - Founder Story + Scale]
       "Founded in 2015 by Jane Smith (ex-Google Cloud AI VP, 15 years) and
       John Doe (ex-Google Infrastructure, 12 years), TechCorp has scaled from
       a garage startup to a $50M ARR platform serving 150+ enterprise customers
       including 8 Fortune 500 companies."

       [Option 2 - Market Position + Recent Momentum]
       "TechCorp holds a strong position in the $2.5B AI infrastructure market,
       growing 100% YoY to $50M ARR, backed by $35M from Sequoia and a16z, with
       recent v3.0 platform launch expanding into Fortune 500 accounts."

       [Option 3 - Problem → Solution → Scale]
       "When enterprises struggled to deploy AI at scale, two Google veterans
       built TechCorp to make AI infrastructure 'as easy as flipping a switch.'
       Nine years later, 150+ enterprises trust TechCorp's platform to power
       their AI operations."

       Which hook resonates? (1 / 2 / 3 / suggest your own)

[... continue through all 10 steps]
```

---

## What Gets Generated

**File:** `data/test-company/outputs/company-overview.md`

**Contents:**
- Full Company Overview chapter in markdown
- Proper structure: sections, subsections, bullets
- Source footnotes for every claim
- Professional investment banking tone
- Ready for inclusion in CIM

---

## Testing Checklist

- [ ] Run `/manda-analyze` - check knowledge.json created
- [ ] Run `/manda-cim-company-overview` - complete all 10 steps
- [ ] Review output quality - meets M&A standards?
- [ ] Check source attribution - every claim has footnote?
- [ ] Validate conversation - good questions and suggestions?

---

## What This Proves

If successful, this POC validates:
✅ Document → structured findings → CIM content works
✅ Knowledge base enables reuse (no re-reading docs)
✅ BMAD-style workflow provides clear guidance
✅ Output quality meets investment banking standards
✅ Agent asks smart questions (not generic)
✅ Conversational approach feasible for CIM creation

---

## Next Steps After POC

If validated:
1. Add remaining CIM chapters (Financial, Market, Products, etc.)
2. Integrate into full Manda platform
3. Add more sophisticated document processing
4. Build knowledge graph for cross-domain intelligence
5. Create web UI

---

**Ready to test? Start with `/manda-analyze`**
