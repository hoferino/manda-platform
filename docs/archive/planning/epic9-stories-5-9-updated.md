# Epic 9 Stories E9.5-E9.9 (Updated for CIM v3)

## Replace lines 4389-4571 in epics.md with this content:

#### Story E9.5: Content-First, Then Visual Workflow

**As an** analyst
**I want** to approve slide content before visual design
**So that** I can focus on message first, then presentation

**Description:**
Implement the two-step slide creation process within Phases 4-11: (1) content elements with sources from RAG, (2) visual concept design with extreme precision. Each step requires separate approval.

**Technical Details:**
- **Content Phase** (for each slide):
  - Query knowledge base via `query_knowledge_base(slide_topic, filters)`
  - Present 3 content options with specific data points and sources
  - User selects, modifies, or suggests alternative
  - Content locked after approval
- **Visual Phase** (only after content approved):
  - Call `generate_slide_blueprint(slide_topic, narrative_context, content_elements)`
  - Generate visual concept with extreme precision:
    - Type, layout description, main visual element
    - ALL content elements positioned (position, format, styling, icon)
    - Data viz details, color scheme, visual hierarchy
    - Graphics/icons specs, designer guidance
  - User approves or requests modifications
  - Visual concept regenerated if modifications requested
  - Slide locked after both approvals
- Validation: Check ALL content elements have positioning specs

**Acceptance Criteria:**

```gherkin
Given I'm building a slide about "Founding Story"
When the content phase begins
Then the system queries RAG for relevant findings
And presents 3 content options:
  - Option A: Chronological narrative (founders, date, pivots)
  - Option B: Problem-solution framing
  - Option C: Credibility-first approach
And each option has 3-5 specific data points with sources

Given I select Option A and approve content
When the visual phase begins
Then the system generates visual concept:
  - Type: Timeline infographic
  - Layout: Horizontal timeline with milestone markers
  - ALL 5 content elements positioned precisely
  - Color scheme: Brand colors specified
  - Visual hierarchy: What viewer sees 1st, 2nd, 3rd
And I can approve or request changes

Given I request "add a rocket graphic to show momentum"
When I submit the modification
Then the system regenerates visual concept
And incorporates rocket with specs (size, position, style, purpose)
And I see updated visual concept for approval

Given visual concept is missing positioning for 1 content element
When validation runs
Then an error is raised
And I'm told which element is missing specs
```

**Related FR:** FR-CIM-002, FR-CIM-003

**Definition of Done:**
- [ ] Two-step approval workflow per slide
- [ ] Content phase queries RAG knowledge base
- [ ] 3 content options presented with sources
- [ ] Visual phase generates extreme precision specs
- [ ] ALL content elements positioning validated
- [ ] User modifications incorporated immediately
- [ ] Both approvals required before locking slide

---

#### Story E9.6: Extreme Visual Precision Generation and Validation

**As an** analyst
**I want** visual concepts with extreme precision
**So that** designers have complete specifications without ambiguity

**Description:**
Implement visual concept generation that specifies position, format, styling, and icons for EVERY content element on each slide with validation to ensure nothing is missed.

**Technical Details:**
- LLM prompt engineering for extreme visual precision
- Required specifications for each slide visual concept:
  - **Type**: Chart/infographic/timeline/diagram
  - **Layout Description**: What goes where on slide
  - **Main Visual Element**: Chart description, dimensions, dominance
  - **ALL Content Elements Positioned**: For EVERY data point:
    - Position (top left, center, bottom right, etc.)
    - Format (callout box, text annotation, chart label)
    - Styling (font size, color, background)
    - Icon/graphic (if applicable with specs)
  - **Data Visualization Details** (if chart): Type, axes, data points, scale, comparisons
  - **Color Scheme**: Primary, secondary, accent, text colors with usage
  - **Visual Hierarchy**: 1st, 2nd, 3rd what viewer sees
  - **Graphics/Icons/Images**: Each with placement, size, style, purpose
  - **Designer Guidance**: Spacing, alignment, emphasis notes
- Examples embedded in prompt (good vs bad visual concepts)
- Validation: Count content elements vs positioned elements (must match)

**Acceptance Criteria:**

```gherkin
Given a slide has 5 content elements
When the visual concept is generated
Then ALL 5 elements have positioning specified
And NONE are missing from visual concept

Given content includes "LTV $1.3M" and "CAC $80K"
When visual concept is bar chart
Then the specification includes:
  - Chart type: Vertical bar chart
  - Y-axis: Dollar values (scale 0-$1.5M)
  - Bars: Left bar (CAC, gray, 1 unit), Right bar (LTV, green gradient, 16 units)
  - Labels: "$80K CAC" above left bar, "$1.3M LTV" above right bar
  - Position: Each label center-aligned above respective bar
  - Format: Bold, medium size
  - Color: Dark gray for CAC, dark green for LTV

Given user requests "add a rocket graphic"
When visual concept regenerates
Then rocket specifications include:
  - Position: Top of LTV bar, angled 45° upward-right
  - Size: ~20% of slide height
  - Style: Flat design, brand colors, with motion trail
  - Purpose: Symbolizes fast growth trajectory
And ALL other elements remain positioned

Given visual concept generator misses 1 element
When validation runs
Then error raised: "Missing positioning for element 'growth_rate'"
And generation retries automatically
```

**Related FR:** FR-CIM-002, FR-CIM-003

**Definition of Done:**
- [ ] Visual concept prompt generates extreme precision
- [ ] All content elements positioned (validation check)
- [ ] Chart specifications complete (type, axes, scale, data)
- [ ] Color scheme specified
- [ ] Visual hierarchy defined
- [ ] Graphics/icons specified with full details
- [ ] Designer guidance included
- [ ] Validation prevents incomplete visual concepts
- [ ] Examples in prompt prevent vague outputs

---

#### Story E9.7: Continuous Balance Checks and Coherence Validation

**As an** analyst
**I want** continuous narrative balance checks
**So that** I can ensure the story remains coherent and well-proportioned

**Description:**
Implement balance checks after each section completion (Phases 4-11) and comprehensive coherence validation from buyer's perspective in Phase 12.

**Technical Details:**
- **After each section (Phases 4-11):**
  - Calculate section size (number of slides)
  - Compare emphasis across completed sections
  - Evaluate against buyer persona priorities
  - Present balance assessment to user
  - Allow retroactive adjustments
- **Phase 12 (Coherence & Risk Assessment):**
  - Agent adopts buyer POV
  - Reviews investment thesis delivery
  - Checks storytelling arc (setup → climax → resolution)
  - Assesses risk transparency
  - Validates growth driver clarity
  - Provides honest assessment + suggestions
  - User can accept or address issues

**Acceptance Criteria:**

```gherkin
Given I complete "Company History" section (3 slides)
When the balance check runs
Then the system shows:
  - ✅ Company History: 3 slides
  - ⏳ Corporate Structure: pending
And asks: "We've emphasized [founding story] heavily - does that feel right for your [Strategic] buyer?"

Given all sections completed
When Phase 12 coherence review begins
Then the agent reviews from buyer's perspective:
  - Investment thesis validation
  - Storytelling arc assessment
  - Risk transparency check
  - Growth driver clarity
  - Overall impression
And provides specific suggestions for improvement
And I can choose to address or proceed

Given the agent flags "Missing: employee retention story"
When I accept the suggestion
Then the system offers to add a slide
And I can build it or decline

Given emphasis is heavily on history (40% of slides)
When balance check runs
Then system asks: "History is 40% of deck - rebalance toward [business model] for strategic buyer?"
```

**Related FR:** FR-CIM-002, FR-CIM-005

**Definition of Done:**
- [ ] Balance checks after each section
- [ ] Emphasis comparison across sections
- [ ] Buyer persona alignment validation
- [ ] Phase 12 buyer POV review implemented
- [ ] Investment thesis delivery check
- [ ] Storytelling arc assessment
- [ ] Risk transparency validation
- [ ] Retroactive adjustment capability

---

#### Story E9.8: Non-Linear Workflow and Special Commands

**As an** analyst
**I want** to navigate the workflow non-linearly and use special commands
**So that** I have flexibility to build the CIM my way

**Description:**
Implement non-linear workflow navigation (jump between sections, go back, reorder) and special commands (undo, history, save version, explain, etc.) available throughout the workflow.

**Technical Details:**
- **Non-Linear Navigation:**
  - Section selection menu (user chooses which section to build next)
  - Go back capability (return to previous phase)
  - Reorder slides within sections (drag-and-drop or command)
- **Special Commands** (available anytime during workflow):
  - **Navigation**: `undo`, `restart [step/section]`, `history`, `save version [name]`, `show structure`
  - **Analysis**: `explain [topic]`, `why [decision]`, `alternatives`, `data score`, `balance check`
  - **Content**: `add finding`, `correct [detail]`, `questions for seller`, `strengthen [section]`
- Workflow state tracks: current phase, completed phases, pending sections, user decisions
- Command parser in chat interface (frontend + backend)

**Acceptance Criteria:**

```gherkin
Given I've completed "Company History" section
When I'm asked "Which section should we tackle next?"
Then I see a list of pending sections:
  - Corporate Structure
  - Management Team
  - Geographic Footprint
  - Business Model
And I can choose any section (non-sequential)

Given I'm in "Management Team" section
When I type "/go back to Company History"
Then the workflow navigates back
And I can edit previous slides

Given I type "/show structure"
When the command executes
Then I see the current organization:
  - ✅ Company History (3 slides)
  - 🔄 Management Team (in progress, 1 slide)
  - ⏳ Corporate Structure (pending)
  - ⏳ Geographic Footprint (pending)
  - ⏳ Business Model (pending)

Given I type "/explain LTV"
When the educational moment triggers
Then the system explains:
  - Definition: Lifetime Value
  - Formula: Average revenue per customer × customer lifetime
  - Benchmarks: SaaS typically 3-5x CAC
  - Context: Why it matters for this buyer type

Given I'm satisfied with current state
When I type "/save version Pitch to Acme Ventures"
Then the workflow state is saved with that name
And I can restore it later
```

**Related FR:** FR-CIM-005

**Definition of Done:**
- [ ] Non-linear section selection works
- [ ] Go back navigation works
- [ ] Slide reordering works
- [ ] All special navigation commands implemented
- [ ] All analysis commands implemented
- [ ] All content commands implemented
- [ ] Command parser functional (frontend + backend)
- [ ] Workflow state tracks all context

---

#### Story E9.9: Multi-Format Export with RAG Source Citations

**As an** analyst
**I want** to export the CIM in multiple formats with RAG-sourced citations
**So that** I can use it as a guide, LLM prompt, or presentation base

**Description:**
Implement Phase 14 export functionality for 4 formats: (1) Content Markdown, (2) Slide Blueprints Markdown, (3) Guide Markdown, (4) LLM Prompt Template. All exports include source citations from RAG knowledge base.

**Technical Details:**
- **Export formats:**
  1. **company-overview-content.md**: Full narrative text for all sections with source citations throughout
  2. **company-overview-slides.md**: Slide blueprints (title, purpose, content elements, visual concepts, designer guidance)
  3. **company-overview-guide.md**: How to use blueprints, design tips, implementation workflow
  4. **company-overview-prompt.txt**: LLM prompt template (includes buyer persona, narrative arc, slide specs, knowledge base context)
- Source citations link to PostgreSQL findings (via RAG queries during workflow)
- Save to project's CIM output folder: `/projects/[id]/cim-outputs/`
- Version control: Track iterations with timestamps

**Acceptance Criteria:**

```gherkin
Given I complete the workflow
When I reach Phase 14 (Export)
Then I see export format options:
  - Content Markdown
  - Slide Blueprints Markdown
  - Guide Markdown
  - LLM Prompt Template
  - All formats (recommended)

Given I select "All formats"
When export completes
Then 4 files are created in `/projects/[deal_id]/cim-outputs/`:
  - company-overview-content.md
  - company-overview-slides.md
  - company-overview-guide.md
  - company-overview-prompt.txt
And each file includes source citations from knowledge base

Given I open company-overview-slides.md
Then I see for each slide:
  - **Slide N: [Action Title]**
  - Purpose: [What this slide accomplishes]
  - Content Elements: [Specific data points with sources]
  - Visual Concept: [Extreme precision specifications]
  - Source: [PostgreSQL findings with IDs and citations]

Given I open company-overview-prompt.txt
Then I see a comprehensive prompt that includes:
  - Buyer persona and priorities
  - Investment thesis (Asset, Timing, Opportunity)
  - Narrative arc
  - Each slide's purpose and requirements
  - Knowledge base context (relevant findings)
  - Formatting and tone expectations
And I can paste this into Claude/GPT to generate actual CIM content
```

**Related FR:** FR-CIM-003, FR-CIM-006

**Definition of Done:**
- [ ] Content markdown export works
- [ ] Slide blueprints markdown export works
- [ ] Guide markdown export works
- [ ] LLM prompt template export works
- [ ] All exports include RAG source citations
- [ ] Files saved to project output folder
- [ ] Version control implemented (timestamp + version name)
- [ ] Export summary shown to user
