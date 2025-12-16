# CIM Workflow - Portable Slash Command

A self-contained Claude Code slash command for creating professional CIM (Confidential Information Memorandum) Company Overview chapters.

## Installation

Copy the slash command to your target repo:

```bash
# From your target repo root
mkdir -p .claude/commands
cp /path/to/cim-workflow/cim-workflow.md .claude/commands/cim-workflow.md
```

Or manually copy `cim-workflow.md` to `<your-repo>/.claude/commands/cim-workflow.md`

## Usage

```bash
/cim-workflow ./path/to/your/knowledge.md
```

The command accepts a path to your knowledge file (markdown or JSON format).

## Knowledge File Format

The knowledge file should contain structured information about the company, including:

- Company History (founding, milestones, evolution)
- Corporate Structure (entities, ownership, board)
- Management Team (executives, backgrounds, achievements)
- Geographic Footprint (locations, facilities)
- Business Model (products, revenue, customers, financials)

Example structure:

```markdown
# Knowledge Base: Company Name

## Company History
- Founded in 2015 by Jane Smith and John Doe
- Key milestone: Series A in 2017 ($10M)
- Current ARR: $50M

## Management Team
### Jane Smith - CEO
- Background: Ex-Google Cloud AI Lead
- Experience: 15 years in enterprise software
...
```

## Output Files

The workflow generates three files in `<knowledge-file-directory>/outputs/`:

1. **company-overview-content.md** - Full narrative text with source citations
2. **company-overview-slides.md** - Slide blueprints with detailed visual concepts
3. **company-overview-guide.md** - Design tips and implementation workflow

## Workflow Phases

The interactive workflow guides you through 14 phases:

1. Understand Buyer Context
2. Investment Thesis Development
3. Discover Structure Together
4. Build Sections (User Chooses Order)
5. Build Section - Content First
6. Build Slide Content
7. Design Visual Concept
8. Slide Approved - Next Slide
9. Section Completion
10. Continuous Evolution & Balance
11. Completion Check
12. Coherence & Risk Assessment
13. Deck Optimization
14. Export

## Special Commands

During the workflow, you can use these commands:

**Navigation:**
- `undo` - Revert last change
- `restart [step/section]` - Go back to specific point
- `history` - Show all decisions made
- `show structure` - Display current organization

**Analysis:**
- `explain [topic]` - Deep dive on a concept
- `why [decision]` - Explain reasoning
- `balance check` - Evaluate emphasis across sections

**Content:**
- `add finding` - Manually add data
- `correct [detail]` - Fix specific information
- `strengthen [section]` - Ideas to enhance area

## Requirements

- Claude Code CLI
- A knowledge file with company information
