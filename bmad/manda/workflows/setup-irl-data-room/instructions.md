# Setup IRL-Based Data Room - Instructions

<critical>This workflow sets up an intelligent data room structure based on an Information Request List (IRL) or standard M&A checklist</critical>
<critical>Communicate all responses in {communication_language}</critical>

<workflow>

<step n="1" goal="Welcome and understand deal context">
<action>Greet {user_name} warmly</action>

<action>Explain workflow purpose:
"I'll help you set up an intelligent data room structure for your deal. We have two approaches:

1. **IRL-Based** - If you have an Information Request List, I'll parse it and create a folder structure that exactly matches your document requirements
2. **Standard Checklist** - Use a proven M&A due diligence checklist with standard categories

The IRL-based approach is ideal because your data room structure will match the actual documents you need to collect, and the audit workflow can track completeness against the same IRL."
</action>

<ask>Do you have an Information Request List (IRL) for this deal?

[Y] Yes, I have an IRL (Excel or PDF)
[N] No, use standard M&A due diligence checklist
[C] Custom - I'll define my own structure interactively
</ask>
</step>

<step n="2" goal="Process IRL or use standard checklist" if="user-choice">

<check if="choice=Y">
  <step n="2a" goal="Process IRL">
  <ask>Great! Please provide your IRL in one of these ways:

1. **Upload file** - Provide the file path to your IRL (Excel .xlsx or PDF)
2. **Paste content** - Copy/paste the IRL content directly
3. **Describe structure** - Tell me the categories and I'll structure it

Which method would you prefer?
  </ask>

  <action if="file-upload">Parse the IRL file:

**For Excel:**
- Look for columns: Category, Document Name, Sub-category, Priority, Status
- Common patterns: "Section", "Item", "Description", "Requirement"
- Extract hierarchical structure (main categories → sub-categories → documents)
- Identify priority levels (High/Medium/Low or 1/2/3)

**For PDF:**
- Look for numbered/bulleted lists
- Identify section headers (often in bold or larger font)
- Parse hierarchical structure (1., 1.1, 1.1.1 or similar)
- Extract document names and descriptions
  </action>

  <action if="paste-content">Parse pasted IRL:
- Identify structure from formatting
- Extract categories and document lists
- Infer hierarchy from indentation/numbering
  </action>

  <action if="describe">Interactive structure builder:
- Ask for main categories
- For each category, ask for sub-categories
- For each sub-category, ask for required documents
- Build IRL structure from user input
  </action>

  <action>Show parsed structure to user:

"I've analyzed your IRL and identified this structure:

**Main Categories:**
1. Financial Information (12 documents)
   - Audited Financials
   - Management Accounts
   - Revenue Analysis

2. Legal Documents (8 documents)
   - Corporate
   - Contracts
   - IP Documentation

3. Commercial Information (10 documents)
   - Customer Data
   - Pricing
   - Sales Pipeline

[Full list shown...]

**Total:** X categories, Y documents requested

Does this structure look correct?"
  </action>

  <ask>Approve structure or request modifications?

[A] Approve - create this structure
[M] Modify - let me adjust categories or documents
  </ask>

  <action if="modifications">Make requested changes and re-confirm</action>
  </step>
</check>

<check if="choice=N">
  <step n="2b" goal="Use standard M&A checklist">
  <action>Present standard M&A due diligence checklist:

"I'll use our standard M&A due diligence checklist:

**1. Financial Information**
   - Audited financial statements (3 years)
   - Monthly management accounts (current year)
   - Revenue by customer/product analysis
   - Working capital analysis
   - Capex schedule
   - Budget vs actual analysis

**2. Legal Documents**
   - Articles of incorporation
   - Shareholder agreements
   - Material customer contracts (>$X)
   - Material supplier contracts
   - Employee contracts (key personnel)
   - IP documentation (patents, trademarks, copyrights)
   - Litigation summary
   - Compliance documentation

**3. Operational Information**
   - Organizational chart
   - Employee census (roles, salaries, tenure)
   - Process documentation
   - Key performance indicators
   - Systems and technology inventory
   - Facilities information

**4. Commercial Information**
   - Customer list with revenue
   - Customer contracts
   - Pricing structure and policies
   - Sales pipeline
   - Market research and positioning
   - Competitor analysis
   - Marketing materials

**5. Strategic Information**
   - Business plan (3-5 years)
   - Management presentations
   - Board materials
   - Strategic initiatives
   - Growth opportunities
   - Risk assessment

**Total:** 5 main categories, ~60 document types"
  </action>

  <ask>Would you like to:

[A] Accept this standard checklist
[M] Modify - add/remove categories or documents
[S] Simplify - use just the 5 main categories (current default)
  </ask>

  <action if="modify">Make requested modifications</action>
  <action if="simplify">Use simplified 5-category structure</action>
  </step>
</check>

<check if="choice=C">
  <step n="2c" goal="Interactive custom structure">
  <action>Guide user through custom structure creation</action>

  <ask>Let's build your custom structure. How many main categories do you need?</ask>

  <action>For each category:
- Ask for category name
- Ask for description
- Ask for document types needed
- Ask for priority (High/Medium/Low)
  </action>

  <action>Show complete custom structure and confirm</action>
  </step>
</check>

</step>

<step n="3" goal="Generate folder structure">
<action>Create folder structure based on approved IRL/checklist:

**Folder naming conventions:**
- Main categories: lowercase-with-hyphens
- Sub-categories: lowercase-with-hyphens
- Numbering for order: 1-category-name, 2-category-name
- Clear, professional names

**Example structure:**
```
data/deals/
├── irl/
│   ├── irl-original.xlsx          (preserved original)
│   └── irl-checklist.yaml         (parsed structured version)
├── 1-financial-information/
│   ├── audited-financials/
│   ├── management-accounts/
│   └── revenue-analysis/
├── 2-legal-documents/
│   ├── corporate/
│   ├── contracts/
│   └── ip-documentation/
├── 3-operational-information/
│   ├── org-structure/
│   └── systems/
├── 4-commercial-information/
│   ├── customers/
│   ├── pricing/
│   └── sales/
└── 5-strategic-information/
    ├── business-plans/
    └── presentations/
```
  </action>

<action>Create the folder structure:
- Create all main category folders
- Create all sub-category folders
- Add .gitkeep files to preserve empty folders
- Create README.md in each category with upload instructions
  </action>

<action>Show created structure:

"✅ Data room structure created successfully!

**Created:**
- X main categories
- Y sub-categories
- Z total folders

**Location:** {data_room_path}

Each folder includes:
- README.md with upload instructions
- .gitkeep to preserve empty folders in git
- Upload checklist from IRL"
  </action>
</step>

<step n="4" goal="Save IRL for future use">
<action>Store IRL in structured format:

**Create:** {data_room_path}/irl/irl-checklist.yaml

**Format:**
```yaml
# IRL Checklist - Generated from setup
# Date: {current_date}
# Deal: {deal_name}

metadata:
  source: "{irl_source}"
  date_created: "{current_date}"
  total_categories: X
  total_documents: Y
  format: "excel" | "pdf" | "standard" | "custom"

categories:
  - id: 1
    name: "Financial Information"
    folder: "1-financial-information"
    priority: "high"
    documents:
      - id: 1.1
        name: "Audited Financial Statements"
        subfolder: "audited-financials"
        priority: "high"
        status: "pending"
        required_files:
          - "2023-audited-financials.pdf"
          - "2022-audited-financials.pdf"
          - "2021-audited-financials.pdf"
      - id: 1.2
        name: "Management Accounts"
        subfolder: "management-accounts"
        priority: "high"
        status: "pending"

  - id: 2
    name: "Legal Documents"
    folder: "2-legal-documents"
    priority: "high"
    documents:
      - id: 2.1
        name: "Articles of Incorporation"
        subfolder: "corporate"
        priority: "high"
        status: "pending"

# ... (complete structure)
```
  </action>

<action if="irl-original-provided">Copy original IRL file:
- Save to: {data_room_path}/irl/irl-original.{extension}
- Preserve original format for reference
  </action>

<action>Confirm storage:

"✅ IRL saved successfully!

**Stored:**
- Original IRL: data/deals/irl/irl-original.xlsx
- Parsed checklist: data/deals/irl/irl-checklist.yaml

**Usage:**
- Data room audit will check completeness against this IRL
- Upload tracking will update status automatically
- You can modify the checklist anytime"
  </action>
</step>

<step n="5" goal="Create upload tracking and README">
<action>Generate main data room README:

**Create:** {data_room_path}/README.md

**Content:**
```markdown
# Data Room - {deal_name}

**Created:** {current_date}
**IRL-Based:** Yes | No
**Total Documents Required:** X

## Upload Instructions

### Priority Levels
- 🔴 **High Priority** - Critical for initial analysis
- 🟡 **Medium Priority** - Important for comprehensive review
- 🟢 **Low Priority** - Nice to have, supplementary

### Folder Structure

See below for detailed upload instructions per category.

## Document Naming Guidelines

1. **Use descriptive names**: `2023-Audited-Financial-Statements.pdf`
2. **Include dates**: `Customer-List-As-Of-2024-11-10.xlsx`
3. **Mark quality**:
   - `AUDITED-` for audited documents
   - `UNAUDITED-` for management-prepared
   - `DRAFT-` for preliminary versions
4. **Avoid generic names**: Don't use `doc1.pdf`, `financials.pdf`

## Upload Status

Run `/manda:check-irl-status` to see upload progress.

## Categories

### 1. Financial Information
**Priority:** High
**Documents Required:** 12
**Status:** 0/12 uploaded

[See 1-financial-information/README.md for details]

### 2. Legal Documents
**Priority:** High
**Documents Required:** 8
**Status:** 0/8 uploaded

[See 2-legal-documents/README.md for details]

[... for all categories]

---

**Need help?** Contact {user_name} or run the data room audit: `/manda:data-room-audit`
```
  </action>

<action>Generate category-specific READMEs:

For each category folder, create README.md with:
- Category description
- Required documents list (from IRL)
- Upload instructions
- Priority indicators
- Examples of good file names
  </action>

<action>Show completion summary:

"✅ Upload tracking and documentation created!

**Generated:**
- Main README: data/deals/README.md
- X category READMEs (one per folder)
- Upload checklist (from IRL)

**Next Steps:**
1. Share the data room structure with document providers
2. Upload documents to appropriate folders
3. Run `/manda:check-irl-status` to track progress
4. Run `/manda:data-room-audit` when ready for analysis"
  </action>
</step>

<step n="6" goal="Setup auto-update on document upload">
<action>Explain auto-update capability:

"I've configured automatic IRL status updates:

**How it works:**
- Whenever you upload documents to the data room
- The system automatically checks which IRL items are satisfied
- Status updates from 'pending' → 'uploaded'
- Upload timestamp recorded
- Completeness percentage updated

**To manually update:**
Run `/manda:update-irl-status` after uploading documents

**To check current status:**
Run `/manda:check-irl-status` to see detailed progress"
  </action>

<action>Create watcher configuration (for future automation):

**Create:** {data_room_path}/irl/.watcher-config.yaml

```yaml
# Auto-update configuration
watch_paths:
  - "{data_room_path}/**/*"

exclude_patterns:
  - "*/irl/*"
  - "*/.gitkeep"
  - "*/README.md"

on_upload:
  action: "update-irl-status"
  workflow: "{module-root}/workflows/update-irl-status/workflow.yaml"

update_frequency: "realtime"  # or "daily", "manual"
```
  </action>
</step>

<step n="7" goal="Completion summary">
<action>Provide comprehensive summary:

"🎉 **IRL-Based Data Room Setup Complete!**

**Summary:**
- ✅ Data room structure created ({X} categories, {Y} folders)
- ✅ IRL checklist saved (original + parsed version)
- ✅ Upload documentation generated
- ✅ Auto-update configured

**Your Data Room:**
```
{data_room_path}/
├── irl/
│   ├── irl-original.xlsx
│   └── irl-checklist.yaml
├── 1-category/
├── 2-category/
└── README.md
```

**Next Actions:**

1. **Upload Documents**
   - Add files to appropriate category folders
   - Follow naming guidelines in README.md

2. **Track Progress**
   ```
   /manda:check-irl-status
   ```

3. **Update Status** (if auto-update doesn't run)
   ```
   /manda:update-irl-status
   ```

4. **Run Audit** (when ready)
   ```
   /manda:data-room-audit
   ```

The data room audit will now check completeness against YOUR IRL, not a generic checklist!

**Questions?** I'm here to help!"
  </action>
</step>

</workflow>
