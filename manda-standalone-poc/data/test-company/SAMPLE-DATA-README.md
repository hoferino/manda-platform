# Test Company - Sample Data

This directory contains sample data for testing the Manda-Standalone POC.

## Company: TechCorp Inc.

**Fictional company** for testing CIM creation workflow.

### Industry
AI Infrastructure / SaaS

### Profile
- Founded: 2015
- Founders: 2 (ex-Google engineers)
- Revenue: $50M ARR
- Employees: ~90
- Market Position: #2 player, 15% market share
- Market: $2.5B, growing 18% CAGR

---

## Documents Needed for Testing

Place these documents in `docs/` folder:

### 1. Company Background (PDF or DOCX)
**Filename:** `company-background.pdf`

**Should Contain:**
- Founding story (who, when, why)
- Company mission and vision
- Major milestones (2015-2024)
- Strategic pivots or acquisitions
- Current market position

### 2. Corporate Structure (PDF or DOCX)
**Filename:** `corporate-structure.pdf`

**Should Contain:**
- Legal entity names and jurisdictions
- Ownership structure (founders, investors, ESOP)
- Subsidiary relationships
- Board composition

### 3. Organization Chart (PDF or Image)
**Filename:** `org-chart.pdf`

**Should Contain:**
- Management team (names, titles)
- Reporting structure
- Brief backgrounds of key executives
- Board members and advisors

### 4. Geographic Footprint (PDF or DOCX) [OPTIONAL]
**Filename:** `geographic-footprint.pdf`

**Should Contain:**
- Office locations
- Facility details
- Regional employee distribution

### 5. Business Model Overview (PDF or DOCX) [OPTIONAL]
**Filename:** `business-model.pdf`

**Should Contain:**
- Product/service offerings
- Revenue model (subscription, usage-based, etc.)
- Target customers
- Go-to-market strategy

---

## Expected Extraction Results

After running `python main.py analyze`, the system should extract:

### Company History
- Founding date: 2015
- Founders: Jane Smith, John Doe
- Founding story: "Started in a garage to solve..."
- Key milestones: [list with dates]

### Corporate Structure
- Parent entity: TechCorp Inc. (Delaware C-Corp)
- Subsidiaries: [list]
- Ownership: Founders 60%, Investors 30%, ESOP 10%

### Management Team
- CEO: Jane Smith (background)
- CTO: John Doe (background)
- CFO: [name] (background)
- VP Sales: [name] (background)
- VP Engineering: [name] (background)

### Geographic Footprint
- HQ: San Francisco, CA
- Offices: New York, Austin, London
- Total locations: 4

### Business Model
- SaaS platform for AI infrastructure
- Subscription-based (annual contracts)
- Enterprise customers (150+)
- Average contract size: $330K

---

## Creating Test Documents

### Option 1: Use Real Documents (Anonymized)
- Redact sensitive company names
- Replace with "TechCorp"
- Ensure no confidential information

### Option 2: Generate Synthetic Documents
- Use Claude or Gemini to generate realistic company documents
- Follow the structure above
- Make it realistic (not generic)

### Option 3: Use Public Filings
- Find public company Form 10-K or similar
- Extract relevant sections
- Adapt for fictional TechCorp

---

## Testing the POC

1. **Add documents to `docs/` folder**
2. **Run analysis:** `python main.py analyze`
3. **Check extraction:** Review `knowledge.json`
4. **Create CIM:** `python main.py cim create --chapter company-overview`
5. **Review output:** Check `outputs/company-overview.md`

---

## Success Criteria for Test Data

Test data is sufficient if:
-  Covers all 5 Company Overview sections
-  Provides specific details (not generic)
-  Includes source locations (page numbers)
-  Has some complexity (e.g., subsidiary structure)
-  Realistic for M&A context

---

**Note:** This is a POC. Real production use would have much more extensive documentation.
