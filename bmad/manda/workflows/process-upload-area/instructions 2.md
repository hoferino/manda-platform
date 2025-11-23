# Process Upload Area - Instructions

<critical>This workflow processes all documents in the upload area using the Document Classifier agent</critical>
<critical>Hybrid classification: Rules first, then AI for ambiguous cases</critical>
<critical>Auto-move if confidence >90%, suggest if 70-90%, manual review if <70%</critical>

<workflow>

<step n="1" goal="Initialize and check upload area">
<action>Greet {user_name} and explain the process:

"I'll process all documents in your upload area using intelligent classification.

**How it works:**
1. Scan upload folder for new documents
2. Analyze each document (including ZIP extraction, OCR for images)
3. Match to IRL requirements (if IRL exists)
4. Classify with confidence scoring
5. Auto-move high-confidence matches (>90%)
6. Flag medium/low confidence for your review

**Files will be preserved** - originals archived, never lost."
</action>

<action>Check upload folder structure:

**Expected structure:**
```
{upload_path}/
├── pending/        # Drop new files here
├── processed/      # Successfully classified (archived)
├── review/         # Needs manual review
└── failed/         # Processing errors
```

If folders don't exist, create them automatically.
</action>

<action>Scan for uploaded files:

**Scan:** {upload_path}/pending/

**Count:**
- Total files
- By type (PDF, Excel, Word, ZIP, Images, etc.)
- Total size

**Report findings:**
"📂 **Upload Area Status**

**Pending files:** {count}
- PDFs: {pdf_count}
- Excel: {excel_count}
- Word: {word_count}
- PowerPoint: {ppt_count}
- Images: {img_count}
- ZIP archives: {zip_count}

**Total size:** {size} MB

Ready to process?"
</action>

<ask if="files-found">Proceed with processing? [Y/N]</ask>
<action if="no-files">
"No files found in upload/pending/ folder.

**To upload documents:**
1. Place files in: {upload_path}/pending/
2. Run this workflow again

Or drop files now and I'll wait..."
</action>
</step>

<step n="2" goal="Load IRL checklist if available">
<action>Check for IRL:

**Load:** {irl_checklist_path}

If IRL exists:
- Parse all categories and requirements
- Note priorities (High/Medium/Low)
- Prepare IRL matching engine
- "✅ IRL checklist loaded - will prioritize IRL requirements"

If no IRL:
- Use standard M&A classification
- "ℹ️ No IRL found - using standard M&A categories"
</action>
</step>

<step n="3" goal="Pre-process special file types">
<action>Handle ZIP files first:

**For each ZIP file:**
1. Extract to temporary location
2. Preserve any meaningful folder structure
3. Add extracted files to processing queue
4. Move original ZIP to processed/ with metadata
5. Log extraction: "{zip_name} → {count} files extracted"

**Report:**
"📦 **ZIP Processing**
- {zip_count} ZIP files found
- {total_extracted} files extracted
- Ready for classification"
</action>

<action>Prepare images for OCR:

**For each image file (.jpg, .png, .tiff):**
1. Check if scanned document (vs photo)
2. Pre-process for OCR (contrast, orientation)
3. Flag for OCR processing
4. "📸 {img_count} images prepared for OCR"
</action>
</step>

<step n="4" goal="Batch document classification">
<action>Process documents in batches (50 at a time):

**For each document, invoke Document Classifier agent:**

**Phase 1: Quick Analysis (Metadata & Filename)**
- Extract filename patterns
- Parse dates, versions, quality indicators
- Quick rule-based classification
- Initial confidence score

**Phase 2: Content Analysis**
- Extract text (OCR if needed)
- Identify document type signatures
- Extract key entities (amounts, dates, names)
- Keyword matching

**Phase 3: IRL Matching** (if IRL exists)
- Match against IRL requirements
- Check if document satisfies specific IRL items
- Boost confidence if strong IRL match
- Note priority level

**Phase 4: AI Classification** (if confidence < 90%)
- LLM analyzes document content
- Provides classification reasoning
- Final confidence score

**Classification Result:**
```yaml
document: "ACME-2023-Audited-Financials.pdf"
analysis:
  filename_match: "audited financial"
  content_keywords: ["audit opinion", "KPMG", "consolidated balance sheet"]
  doc_type: "Audited Financial Statements"
  year: 2023
  quality: "AUDITED"
irl_match:
  requirement: "Audited Financial Statements (High Priority)"
  irl_id: 1.1
  priority: "high"
  confidence: 0.96
classification:
  category: "Financial Information"
  folder: "1-financial-information/audited-financials"
  filename_suggestion: "2023-AUDITED-ACME-Financials.pdf"
  confidence: 0.96
  action: "auto_move"  # >90% confidence
```

**Progress display:**
Show real-time progress:
"Processing documents... [████████░░] 45/50
- Classified: 40
- High confidence: 35
- Needs review: 5"
</action>
</step>

<step n="5" goal="Execute classification decisions">
<action>For HIGH CONFIDENCE classifications (>90%):

**Auto-move documents:**
1. Check if target folder exists
2. If not, create with proper naming
3. Check for duplicates
4. Move file to target location
5. Log action
6. If IRL match, update IRL status

**Report:**
"✅ **Auto-Classified ({count} documents)**

| Document | Category | Destination | Confidence |
|----------|----------|-------------|------------|
| 2023-Audited-Financials.pdf | Financial | audited-financials/ | 96% |
| Customer-List-2024.xlsx | Commercial | customers/ | 94% |
| Articles-Inc.pdf | Legal | corporate/ | 98% |

**IRL Items Completed:**
✅ Audited Financial Statements (High Priority)
✅ Customer List (High Priority)"
</action>

<action>For MEDIUM CONFIDENCE classifications (70-90%):

**Stage for review:**
1. Move to review/ folder
2. Create suggestion file with metadata
3. Prepare for user review in next step

**Example suggestion:**
```yaml
document: "misc-financial-report.pdf"
confidence: 0.82
suggested_category: "Financial Information"
suggested_folder: "1-financial-information/management-accounts"
reasoning: "Contains monthly financial data, appears to be management accounts"
irl_match: "Management Accounts (High Priority)"
alternatives:
  - category: "Financial Information"
    folder: "forecasts-budgets"
    confidence: 0.68
```
</action>

<action>For LOW CONFIDENCE classifications (<70%):

**Flag for manual review:**
1. Move to review/ folder
2. Note low confidence
3. Extract what information is available
4. Prepare for manual classification

**Example:**
```yaml
document: "unknown-document.pdf"
confidence: 0.45
issue: "Document content ambiguous"
extracted_info:
  - Contains tables and charts
  - Date: Q3 2024
  - Low text content
possible_categories:
  - Strategic Information
  - Operational Information
action_needed: "Manual classification required"
```
</action>
</step>

<step n="6" goal="Review medium/low confidence documents">
<action>Present documents needing review:

"📋 **Documents Needing Your Review ({count})**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. misc-financial-report.pdf**
**Confidence:** 82% (Medium)

**Suggested Classification:**
📁 Financial Information → management-accounts/
{if IRL} ✅ Matches IRL: "Management Accounts" (High Priority)

**Reasoning:**
- Contains monthly financial data
- Management-prepared (unaudited)
- Matches format of management accounts

**Your Options:**
[A] Accept suggestion - move to management-accounts/
[C] Choose different category
[R] Rename file first
[S] Skip for now

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**2. presentation-deck.pptx**
**Confidence:** 75% (Medium)

**Suggested Classification:**
📁 Strategic Information → presentations/

**Reasoning:**
- PowerPoint presentation format
- Contains business overview slides
- Likely board or investor deck

**Your Options:**
[A] Accept suggestion
[C] Choose different category
[R] Rename file first
[S] Skip for now

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Review all {count} documents...]"
</action>

<ask>Process these reviews:

For each document, enter:
- **A** = Accept suggestion
- **C** = Choose different category (I'll show options)
- **R** = Rename file first
- **S** = Skip for now
- **Q** = Queue all for later review

Your choices (format: 1A, 2C, 3A):
</ask>

<action>Process user decisions:

For each choice:
- **Accept**: Move to suggested folder, update IRL if matched
- **Choose different**: Show category menu, get selection, move
- **Rename**: Prompt for new name, then suggest category again
- **Skip**: Leave in review/ folder
- **Queue all**: Save state, user can resume later
</action>
</step>

<step n="7" goal="Handle duplicates and conflicts">
<action>Check for duplicate files:

For each classified document:
1. Generate file hash
2. Check if identical file exists in target folder
3. If duplicate found:

**If identical (same hash):**
"ℹ️ **Duplicate Detected**

File: customer-list.xlsx
Already exists: 4-commercial-information/customers/customer-list.xlsx
Hash match: Identical file

**Action:** Skip (file already in data room)"

**If different (same name, different content):**
"⚠️ **Version Conflict Detected**

File: customer-list.xlsx
Existing: customer-list.xlsx (Modified: Nov 5, 2024)
New version: customer-list.xlsx (Modified: Nov 10, 2024)

**Options:**
[V] Version control - save as customer-list-v2.xlsx
[O] Overwrite existing file
[K] Keep both - save as customer-list-2024-11-10.xlsx
[C] Compare files first

Your choice:"
</action>

<action>Handle user's duplicate decisions and execute</action>
</step>

<step n="8" goal="Create new folders if needed">
<action>Review classification results:

Check if any documents were classified into categories that don't exist yet.

**If new folders needed:**
"📁 **New Folders Needed**

The following documents don't match existing categories:

1. **tax-filings.pdf**
   Suggested new category: Financial Information → tax-returns/
   Reasoning: Tax documents, separate from financials

2. **insurance-policies.pdf**
   Suggested new category: Legal Documents → insurance/
   Reasoning: Insurance and risk documentation

**Create these new folders?**
[A] Accept all - create new folders
[R] Review individually
[C] Classify into existing categories instead"
</action>

<ask if="new-folders-needed">Create new folders? [A/R/C]</ask>

<action if="accept-new-folders">
Create new folders:
1. Create folder with proper naming
2. Add README.md with folder purpose
3. Move documents to new folders
4. Update data room structure
5. Log new folders created
</action>

<action if="review-individually">
For each new folder:
- Show document and reasoning
- Ask to approve or suggest alternative
- Create approved folders
- Reclassify declined documents
</action>

<action if="classify-existing">
Show existing categories
User selects where to place documents
No new folders created
</action>
</step>

<step n="9" goal="Update IRL status">
<action>If IRL exists and documents matched IRL requirements:

**Update IRL checklist:**
1. For each IRL match with high confidence:
   - Update status: "pending" → "uploaded"
   - Record upload date
   - Record filename
2. Calculate new completion percentages
3. Identify newly completed categories
4. Save updated irl-checklist.yaml

**Report IRL updates:**
"📊 **IRL Status Updated**

**Newly Completed Items:**
✅ Audited Financial Statements (High Priority)
✅ Customer List (High Priority)
✅ Articles of Incorporation (High Priority)

**Progress Update:**
- Overall: 45% → 67% (+22%)
- High Priority: 60% → 80% (+20%)
- Financial Category: 50% → 90% (+40%)

**Remaining High-Priority:**
❌ Management Accounts
❌ Customer Concentration Analysis"
</action>
</step>

<step n="10" goal="Archive processed files">
<action>Move all processed files:

**Successfully classified files:**
- Move from pending/ to processed/
- Preserve with timestamp
- Maintain for audit trail

**Structure:**
```
upload/processed/
└── 2024-11-10/
    ├── batch-001/
    │   ├── 2023-Audited-Financials.pdf
    │   ├── Customer-List-2024.xlsx
    │   └── classification-metadata.yaml
    └── batch-002/
        └── ...
```

**Metadata file includes:**
- Original filename
- Target location
- Confidence score
- Timestamp
- IRL match (if any)
</action>
</step>

<step n="11" goal="Generate comprehensive report">
<action>Create detailed processing report:

**Save to:** {output_location}/upload-processing-report-{timestamp}.yaml

**Content:**
```yaml
processing_report:
  timestamp: "2024-11-10T18:45:00Z"
  user: "{user_name}"

  summary:
    total_files: 47
    successfully_classified: 42
    high_confidence_auto: 35
    medium_confidence_reviewed: 7
    low_confidence_manual: 3
    failed: 2
    duplicates_skipped: 3

  by_category:
    financial_information: 18
    legal_documents: 8
    operational_information: 5
    commercial_information: 9
    strategic_information: 2
    new_categories: 0

  irl_updates:
    items_completed: 5
    progress_before: "45%"
    progress_after: "67%"
    high_priority_remaining: 3

  confidence_distribution:
    "90-100%": 35
    "80-90%": 5
    "70-80%": 2
    "60-70%": 2
    "<60%": 3

  processing_time:
    total_seconds: 127
    avg_per_document: 2.7

  special_processing:
    zip_files_extracted: 3
    total_extracted_files: 24
    ocr_processed: 5
    ocr_failures: 1

  files_needing_review:
    - filename: "ambiguous-doc.pdf"
      confidence: 0.68
      current_location: "upload/review/"
      suggested: "Strategic Information"

  failed_processing:
    - filename: "corrupted.pdf"
      error: "File corrupted or encrypted"
      action: "Moved to upload/failed/"

  new_folders_created: []

  duplicates_handled:
    - filename: "customer-list.xlsx"
      action: "skipped"
      reason: "Identical file exists"

  irl_items_completed:
    - id: 1.1
      name: "Audited Financial Statements"
      priority: "high"
      files: ["2023-Audited-Financials.pdf", "2022-Audited-Financials.pdf"]

classified_documents:
  - filename: "2023-Audited-Financials.pdf"
    source: "upload/pending/"
    destination: "deals/1-financial-information/audited-financials/"
    category: "Financial Information"
    subfolder: "audited-financials"
    confidence: 0.96
    irl_match: "Audited Financial Statements"
    irl_priority: "high"
    classification_method: "hybrid"
    action: "auto_moved"
    timestamp: "2024-11-10T18:42:15Z"

  # ... (all documents)
```
</action>

<action>Display summary to user:

"🎉 **Upload Processing Complete!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 SUMMARY

**Processed:** {total} documents
- ✅ Successfully classified: {success}
- ⚡ High confidence (auto-moved): {auto}
- 👀 Reviewed with you: {reviewed}
- ⚠️  Still needs review: {pending_review}
- ❌ Failed: {failed}

**Processing Time:** {time} seconds ({avg}s per document)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📂 BY CATEGORY

| Category | Documents | % of Total |
|----------|-----------|------------|
| 💰 Financial | {count} | {percent}% |
| ⚖️  Legal | {count} | {percent}% |
| 🏭 Operational | {count} | {percent}% |
| 📊 Commercial | {count} | {percent}% |
| 🎯 Strategic | {count} | {percent}% |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ✅ IRL UPDATES (if applicable)

**Progress:** 45% → 67% (+22%)

**Newly Completed:**
✅ Audited Financial Statements (High Priority)
✅ Customer List (High Priority)
✅ Articles of Incorporation (High Priority)

**Remaining High-Priority:**
❌ Management Accounts
❌ Customer Concentration Analysis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 NEXT ACTIONS

{if review_needed}
**{count} documents need your review:**
- Run: `/manda:review-uploads`
- Location: {upload_path}/review/
{end}

{if failed}
**{count} documents failed processing:**
- Location: {upload_path}/failed/
- Check errors in report
{end}

{if ready_for_audit}
**Data room is {percent}% complete:**
- Ready for comprehensive audit!
- Run: `/manda:data-room-audit`
{end}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Detailed Report:** {output_location}/upload-processing-report-{timestamp}.yaml

**Questions?** I'm here to help!"
</action>
</step>

<step n="12" goal="Cleanup and finalization">
<action>Final cleanup:

1. Verify all files accounted for
2. Clear temporary OCR files
3. Clear ZIP extraction temp folders
4. Update data room README if structure changed
5. Log completion

"✅ All done! Your data room is organized and up to date."
</action>
</step>

</workflow>
