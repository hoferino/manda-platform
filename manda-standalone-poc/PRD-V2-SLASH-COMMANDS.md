# Manda-Standalone POC - Slash Command Architecture
## PRD v2.0 - Updated for Claude Code Integration

**Date:** 2025-11-21
**Change:** Removed CLI, using Claude Code slash commands instead

---

## Architecture Change

### OLD (v1.0): Standalone CLI
```bash
python main.py analyze
python main.py cim create --chapter company-overview
```

### NEW (v2.0): Claude Code Slash Commands
```
/manda-analyze
/manda-cim-company-overview
```

---

## Slash Commands

### `/manda-analyze`
**Purpose:** Analyze documents and extract structured findings

**Behavior:**
1. Scans `data/test-company/docs/` for PDF/DOCX files
2. Extracts structured findings (company history, structure, management, etc.)
3. Stores in `data/test-company/knowledge.json`
4. Reports what was found

**Expected Output:**
```
Analyzing documents in data/test-company/docs/...

✅ company-background.pdf
   - Extracted: Company history, founding story, milestones
   - Source attribution: 15 findings with page numbers

✅ corporate-structure.docx
   - Extracted: Legal entities, ownership structure
   - Source attribution: 8 findings

✅ org-chart.pdf
   - Extracted: Management team bios
   - Source attribution: 5 findings

Knowledge base saved to: data/test-company/knowledge.json
Total findings: 28
```

---

### `/manda-cim-company-overview`
**Purpose:** Guide user through creating Company Overview chapter

**Behavior:**
1. Loads knowledge base from `data/test-company/knowledge.json`
2. Launches 10-step conversational workflow
3. Validates, suggests, asks questions at each step
4. Generates markdown output
5. Saves to `data/test-company/outputs/company-overview.md`

**Workflow Steps:**
1. Validate information (check gaps)
2. Choose narrative approach
3. Draft opening hook
4. Build Company History section
5. Build Corporate Structure section
6. Build Management Team section
7. Build Geographic Footprint section
8. Build Business Model section
9. Coherence review
10. Export chapter

**Conversation Example:**
```
User: /manda-cim-company-overview

Agent: I've loaded your knowledge base with 28 findings from 3 documents.
       Let me guide you through creating the Company Overview chapter.

       Step 1 of 10: Validate Information

       ✅ Found: Company history, founding story, key milestones
       ✅ Found: Corporate structure (3 entities, ownership breakdown)
       ✅ Found: Management team (5 executives with backgrounds)
       ⚠️  Missing: Recent milestones (last 12 months)
       ❌ Missing: Employee count and growth

       How would you like to proceed?
       1. Continue with available information
       2. I'll provide the missing info now
       3. Skip this chapter for now

User: 2

Agent: Great! Please provide:
       - Recent milestones (last 12 months):
       - Current employee count:
       - Employee growth trajectory:

User: Recent milestones: Series B funding $30M in March 2024,
      hired new CFO in June 2024, launched v3.0 platform in Sept 2024.
      Employees: 90 total, up from 65 in Jan 2024.

Agent: ✅ Added to knowledge base with source "User input - 2025-11-21"

       Step 2 of 10: Choose Narrative Approach

       For Company Overview, I recommend a **Chronological Story** approach:
       - Start with founding in 2015
       - Show evolution through key pivots (2018, 2020)
       - Demonstrate recent momentum (Series B, team growth, platform launch)

       This works well because:
       • Compelling founder story (ex-Google engineers)
       • Clear inflection points show strategic thinking
       • Recent milestones demonstrate continued momentum
       • Appeals to strategic buyers looking for growth trajectory

       Alternatives:
       • Structure-First: Lead with corporate entities (better for complex structures)
       • Vision-Driven: Lead with mission (better for mission-driven buyers)

       What do you think?

User: Chronological Story sounds perfect

Agent: Excellent! Proceeding with Chronological Story narrative.

       Step 3 of 10: Draft Opening Hook

       Here are 3 opening options:

       [Option 1 - Growth Story]
       "Founded in 2015 by two Google Cloud veterans, TechCorp has scaled
       from a 2-person startup to a $50M ARR platform serving 150+ enterprise
       customers, raising $30M Series B in 2024 to accelerate market leadership."

       [Option 2 - Market Position]
       "TechCorp holds the #2 position in the $2.5B AI infrastructure market
       with 15% market share, leveraging proprietary technology and 8 years
       of enterprise customer relationships to compete against incumbents
       10x its size."

       [Option 3 - Recent Momentum]
       "With $30M Series B funding, 90-person team (up 38% in 2024), and
       v3.0 platform launch capturing Fortune 500 customers, TechCorp is
       accelerating toward market leadership in AI infrastructure."

       Which hook resonates? (1, 2, 3, or suggest your own)

[Continue through steps 4-10...]
```

---

## Technical Architecture

### File Structure
```
manda-standalone-poc/
├── .claude/
│   └── commands/
│       ├── manda-analyze.md              # Slash command definition
│       └── manda-cim-company-overview.md # Slash command definition
│
├── agent/
│   ├── prompts.py            # CIM training & system prompts
│   └── workflows.py          # Workflow orchestration
│
├── knowledge/
│   ├── extractor.py          # Document → structured findings
│   ├── knowledge_base.py     # Storage & retrieval
│   └── schemas.py            # Pydantic models
│
├── processing/
│   ├── document_parser.py    # PDF/DOCX parsing
│   └── analyzer.py           # LLM-based extraction
│
├── training/
│   ├── best_practices.md     # CIM guidelines
│   └── cim_examples/         # Good/bad examples
│
└── data/test-company/
    ├── docs/                 # Input documents
    ├── knowledge.json        # Extracted findings
    └── outputs/              # Generated CIM
```

### How Slash Commands Work

**Slash Command File Format:**
```markdown
# .claude/commands/manda-analyze.md

Analyze all documents in data/test-company/docs/ and extract structured findings.

CRITICAL INSTRUCTIONS:
1. Load and execute processing/analyzer.py
2. For each PDF/DOCX file in data/test-company/docs/:
   - Parse document using document_parser.py
   - Extract findings using extractor.py
   - Store with source attribution
3. Save all findings to data/test-company/knowledge.json
4. Report results to user

Follow the extraction schema defined in knowledge/schemas.py.
Use CIM training from training/best_practices.md to guide extraction.
```

---

## Implementation Changes

### What's Removed:
- ❌ `main.py` CLI entry point
- ❌ Click library
- ❌ Rich terminal formatting
- ❌ CLI command routing

### What's Added:
- ✅ `.claude/commands/` directory
- ✅ Slash command definitions (markdown files)
- ✅ Direct Claude Code integration

### What Stays the Same:
- ✅ Document processing logic
- ✅ Knowledge base storage
- ✅ CIM training materials
- ✅ Workflow orchestration
- ✅ Pydantic schemas
- ✅ All business logic

---

## Updated Requirements

```txt
# No CLI dependencies needed
# anthropic SDK not needed (Claude Code provides runtime)

# Document Processing
PyPDF2>=3.0.0
python-docx>=1.1.0

# Data Validation
pydantic>=2.9.0

# Utilities
pyyaml>=6.0.0
```

---

## Updated User Workflow

**Complete Flow:**

1. **Prepare Documents**
   - Place PDFs/DOCX in `data/test-company/docs/`

2. **Analyze Documents (in Claude Code)**
   ```
   User: /manda-analyze
   Agent: [Executes analysis, saves findings]
   ```

3. **Create CIM Chapter (in Claude Code)**
   ```
   User: /manda-cim-company-overview
   Agent: [Launches 10-step workflow]
   User: [Answers questions, makes decisions]
   Agent: [Generates chapter]
   ```

4. **Review Output**
   - Open `data/test-company/outputs/company-overview.md`

---

## Success Criteria (Unchanged)

POC validates the approach if:
- ✅ Document extraction works accurately (90%+)
- ✅ Knowledge base enables reuse
- ✅ Workflow provides clear guidance
- ✅ Output meets investment banking standards
- ✅ Agent provides smart questions
- ✅ Max confirms feasibility

---

## Implementation Plan (Updated)

### Phase 1: Core Infrastructure
1. Create slash command definitions
2. Implement document parsing
3. Implement knowledge extraction
4. Implement knowledge storage

### Phase 2: CIM Training
1. Write best practices guide
2. Collect CIM examples
3. Create system prompts

### Phase 3: Workflow
1. Implement 10-step Company Overview workflow
2. Add validation checkpoints
3. Test conversation quality

### Phase 4: Testing
1. Test with sample documents
2. Validate extraction accuracy
3. Validate output quality
4. Get user confirmation

---

## Key Advantages of Slash Command Approach

1. **No CLI complexity** - Just markdown files
2. **Native Claude Code** - No separate runtime needed
3. **Conversational by default** - Claude Code handles interaction
4. **Easy iteration** - Edit markdown, test immediately
5. **Simpler codebase** - No CLI routing logic

---

**This v2.0 architecture is cleaner, simpler, and leverages Claude Code's strengths.**
