# Intelligent Excel Parser Implementation
**Version:** 2.7
**Date:** 2025-12-12
**Status:** ✅ Implemented

## Overview

The Intelligent Excel Parser is an enhancement to the IRL (Information Request List) import functionality that replaces the original "dumb" column-mapping parser with an intelligent system that can automatically detect and adapt to various Excel file formats.

### Problem Statement

The original parser blindly mapped fixed column positions (e.g., Col1=Category, Col2=Item, Col6=Subcategory) without analyzing the actual file structure. This caused issues when users uploaded files with different column arrangements or hierarchical category structures.

**User Feedback:** "the parser is quite 'dumb'. it did create the items but i think its blindly using the columns and hard maps it to be a folder or sub item. we need some kind of intelligence."

### Solution

Implemented an intelligent parser that:
1. Analyzes Excel header rows to detect column purposes
2. Supports hierarchical category structures (Category Level 1 → Category Level 2)
3. Handles flexible column ordering and naming conventions
4. Provides real-time preview before importing

---

## Features

### 1. Smart Column Detection

The parser intelligently detects column purposes by analyzing header content:

**Supported Column Types:**
- **Category Level 1**: Detects headers like "Category Level 1", "category l1", headers containing both "category" and "1"
- **Category Level 2**: Detects headers like "Category Level 2", "category l2", "Subcategory", "sub-category"
- **Item/Document**: Detects headers containing "item", "document", "information", "required", "name"
- **Status**: Detects headers containing "status" or "fulfilled"
- **Priority**: Detects headers containing "priority"
- **Description/Notes**: Detects headers containing "description", "comment", "detail", "note"

**Implementation:** [`lib/services/irl-import.ts:141-212`](../manda-app/lib/services/irl-import.ts#L141-L212)

```typescript
function detectColumnMapping(headerRow: ExcelJS.Row): ColumnMapping {
  const mapping: ColumnMapping = { item: -1 }

  for (let colNum = 1; colNum <= headerRow.cellCount; colNum++) {
    const header = cell.value?.toString().toLowerCase().trim() || ''

    // Intelligent pattern matching
    if (header.includes('category level 1') ||
        header.includes('category l1') ||
        (header.includes('category') && header.includes('1'))) {
      mapping.categoryLevel1 = colNum
    }
    // ... more detection logic
  }

  return mapping
}
```

### 2. Hierarchical Category Support

The parser supports two-level category hierarchies common in M&A diligence:

**Structure:**
```
Category Level 1 → Category Level 2 → Item
Example:
  Corporate & Legal → Corporate Documents → Articles of Incorporation
  Corporate & Legal → Material Contracts → Customer Contracts
  Financial Information → Statements → Balance Sheet (Last 3 Years)
```

**Features:**
- Automatic detection of 2-level hierarchies
- Support for grouped formats (category only on first row)
- Automatic category name cleaning (removes "1.", "2.", "1.1" numbering)

**Implementation:** [`lib/services/irl-import.ts:238-265`](../manda-app/lib/services/irl-import.ts#L238-L265)

### 3. Real-Time Preview

Users can preview the detected structure before importing:

**Preview API Endpoint:** `/api/irl/preview`
**Implementation:** [`app/api/irl/preview/route.ts`](../manda-app/app/api/irl/preview/route.ts)

**Preview Data Structure:**
```typescript
interface PreviewData {
  totalItems: number          // Total number of items detected
  totalCategories: number     // Number of unique categories
  totalSubcategories: number  // Number of unique subcategories
  categories: string[]        // List of all categories
  subcategories: string[]     // List of all subcategories
  warnings: string[]          // Parsing warnings and column detection info
  structure: CategoryStructure[]  // Hierarchical structure for display
}
```

**UI Components:**
- Loading state with spinner during analysis
- Error handling with clear error messages
- Success state showing item/category/subcategory counts
- Expandable category/subcategory tree
- Summary statistics cards
- Warning messages from parser

**Implementation:** [`components/wizard/Step3IRLTemplate.tsx:75-603`](../manda-app/components/wizard/Step3IRLTemplate.tsx#L75-L603)

### 4. Flexible Format Support

The parser handles multiple Excel formats commonly used in M&A:

**Format 1: Hierarchical with Grouped Categories**
```
No. | Category Level 1      | Category Level 2           | Document Required
1   | 1. Corporate & Legal  | 1.1 Corporate Documents    | Articles of Incorporation
2   |                       |                            | Bylaws
3   |                       | 1.2 Material Contracts     | Customer Contracts
4   | 2. Financial Info     | 2.1 Statements             | Balance Sheet
```

**Format 2: Flat Structure with Subcategory Column**
```
Category | Item                  | Subcategory | Status
Legal    | Articles of Inc       | Corporate   | Not Started
Legal    | IP Assignments        | IP          | Not Started
Financial| Balance Sheet         | Statements  | Not Started
```

**Format 3: Custom Column Names**
```
Category 1 | Category 2      | Information Required        | Priority
Corporate  | Formation Docs  | Articles of Incorporation   | High
Corporate  | Formation Docs  | Operating Agreement         | High
```

---

## Technical Implementation

### Core Parser Functions

#### 1. Header Row Detection
```typescript
// Find header row by searching for keywords
worksheet.eachRow((row, rowNumber) => {
  const rowText = row.values?.toString().toLowerCase()
  if (rowText?.includes('category') ||
      rowText?.includes('item') ||
      rowText?.includes('document')) {
    headerRow = row
    headerRowNumber = rowNumber
  }
})
```

#### 2. Column Mapping
```typescript
interface ColumnMapping {
  categoryLevel1?: number  // Column index for Category Level 1
  categoryLevel2?: number  // Column index for Category Level 2
  item: number            // Item/document name (required)
  status?: number
  description?: number
  priority?: number
  notes?: number
}
```

#### 3. Category Name Cleaning
```typescript
// Remove numbering from categories
const cleanCategory = currentCategoryL1.replace(/^[\d.]+\s*/, '').trim()
// "1. Corporate & Legal" → "Corporate & Legal"
// "1.1 Corporate Documents" → "Corporate Documents"
```

#### 4. Hierarchical Grouping
```typescript
// Track current categories for grouped format
let currentCategoryL1 = ''
let currentCategoryL2 = ''

// Update categories when non-empty values found
if (categoryL1Value) currentCategoryL1 = categoryL1Value
if (categoryL2Value) currentCategoryL2 = categoryL2Value
```

### API Endpoints

#### Preview Endpoint
**Route:** `POST /api/irl/preview`
**Request:** FormData with `file` field
**Response:**
```json
{
  "success": true,
  "preview": {
    "totalItems": 105,
    "totalCategories": 8,
    "totalSubcategories": 21,
    "categories": ["Corporate & Legal", "Financial Information", ...],
    "subcategories": ["Corporate Documents", "Material Contracts", ...],
    "warnings": [
      "Detected columns: Category1=2, Category2=3, Item=4"
    ],
    "structure": [
      {
        "name": "Corporate & Legal",
        "subcategories": {
          "Corporate Documents": {
            "name": "Corporate Documents",
            "items": [
              { "name": "Articles of Incorporation", "priority": "high" }
            ]
          }
        },
        "items": []
      }
    ]
  }
}
```

#### Import Endpoint
**Route:** `POST /api/projects/[id]/irl/import`
**Request:** FormData with `file`, `name`, `generateFolders` fields
**Flow:**
1. Parse Excel/CSV using intelligent parser
2. Create IRL record in database
3. Create IRL items with detected categories/subcategories
4. Optionally generate folder structure in GCS

---

## User Experience Flow

### Wizard Step 3: IRL Template Selection

**Option 1: Use Template**
- User selects pre-built template
- Shows expandable preview of template structure
- Creates project with template-based folders

**Option 2: Empty Project**
- Creates project with no IRL
- User can build structure manually later

**Option 3: Upload Custom** _(Enhanced in v2.7)_
1. User clicks "Upload Custom" card
2. File upload area appears
3. User selects Excel/CSV file
4. **Loading state**: "Analyzing file structure..."
5. **Preview appears**:
   - Green success banner: "File parsed successfully"
   - Summary stats: "105 items in 8 categories and 21 subcategories"
   - Warning messages showing detected columns
   - Expandable tree showing all categories → subcategories → items
6. User reviews structure and confirms it looks correct
7. User clicks "Create Project"
8. System creates project with detected structure

**Screenshot Locations:**
- Wizard Step 3 with upload option: [`/projects/new` step 2]
- File upload with preview: User testing 2025-12-12

---

## Testing

### Test Case 1: User's Hierarchical Excel
**File:** `MA_Information_Request_List.xlsx`
**Structure:**
- 8 Category Level 1 items
- 21 Category Level 2 items
- 105 total items
- Column headers: "Category Level 1", "Category Level 2", "Document/Information Required"

**Expected Result:**
- ✅ Detects all hierarchical categories correctly
- ✅ Cleans category names (removes "1.", "1.1" numbering)
- ✅ Shows preview with expandable tree
- ✅ Creates correct folder structure

**Result:** ✅ PASS (User confirmation: "its working!")

### Test Case 2: Simple CSV Format
**File:** `test-irl-sample.csv`
**Structure:**
- 5 categories
- 10 subcategories
- 16 items
- Column headers: "Category", "Item", "Subcategory"

**Expected Result:**
- ✅ Detects flat structure with subcategory column
- ✅ Maps columns correctly
- ✅ Shows preview

### Test Case 3: Missing Headers
**File:** Excel with no header row

**Expected Result:**
- ⚠️ Warning: "Could not find header row. Using default column mapping."
- Uses fallback mapping: Category1=2, Category2=3, Item=4

---

## Architecture Integration

### Modified Files

**Core Parser:**
- [`lib/services/irl-import.ts`](../manda-app/lib/services/irl-import.ts)
  - Added `ColumnMapping` interface (lines 128-136)
  - Added `detectColumnMapping()` function (lines 141-212)
  - Enhanced `parseExcelIRL()` with intelligent detection (lines 225-277)

**Preview API:**
- [`app/api/irl/preview/route.ts`](../manda-app/app/api/irl/preview/route.ts)
  - New endpoint for previewing file structure
  - Groups items by category and subcategory

**Wizard UI:**
- [`components/wizard/Step3IRLTemplate.tsx`](../manda-app/components/wizard/Step3IRLTemplate.tsx)
  - Added preview state management (lines 57-59)
  - Added `fetchPreview()` function (lines 75-104)
  - Added preview UI components (lines 365-603)
  - Loading spinner, error handling, success message
  - Expandable category/subcategory tree

**Import Flow:**
- [`app/api/projects/[id]/irl/import/route.ts`](../manda-app/app/api/projects/[id]/irl/import/route.ts)
  - Uses enhanced parser
  - Creates hierarchical folder structure in GCS

### Database Schema

No schema changes required. The intelligent parser produces the same output structure as the original parser:

```typescript
interface ImportedIRLItem {
  category: string          // Category name (cleaned)
  subcategory: string | null  // Subcategory name (cleaned) or null
  itemName: string          // Item description
  description: string | null
  priority: string          // 'high' | 'medium' | 'low'
  fulfilled: boolean
  notes: string | null
}
```

---

## Configuration

### Parser Limits

**Constants in [`irl-import.ts`](../manda-app/lib/services/irl-import.ts):**
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB
const MAX_IMPORT_ROWS = 1000             // Max rows to process
```

### Supported File Types

- Excel: `.xlsx`, `.xls` (MIME type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
- CSV: `.csv` (MIME type: `text/csv`)

### Column Detection Keywords

**Category Level 1:**
- "category level 1"
- "category l1"
- Headers containing both "category" and "1"

**Category Level 2:**
- "category level 2"
- "category l2"
- Headers containing both "category" and "2"
- "subcategory"
- "sub-category"

**Item:**
- "item"
- "document"
- "information"
- "required"
- "name"

**Fallback:** If no item column detected, uses column 4 (common for "Document/Information Required")

---

## Future Enhancements

### Potential Improvements
1. **Machine Learning Column Detection** - Train model on historical uploads to improve detection accuracy
2. **Custom Column Mapping UI** - Allow users to manually map columns if auto-detection fails
3. **Multi-Level Hierarchy Support** - Support 3+ levels of categories
4. **Batch Import** - Upload multiple IRL files at once
5. **Template Learning** - Save successful column mappings as reusable templates
6. **Excel Formula Support** - Parse Excel formulas in priority/status columns
7. **Data Validation** - Validate against known category/item lists before import

### Known Limitations
1. Maximum 2 levels of category hierarchy
2. No support for merged cells in Excel
3. Limited to 1000 rows per import
4. Cannot detect columns without header row (uses fallback)

---

## References

### Related Documentation
- [Epic E1: Project Foundation](./sprint-artifacts/epics/epic-E1.md)
- [Epic E6: IRL Management](./sprint-artifacts/epics/epic-E6.md)
- [Story E1-5: Project Creation Wizard](./sprint-artifacts/stories/e1-5-implement-project-creation-wizard.md)
- [Architecture Document](./manda-architecture.md)

### External Dependencies
- [ExcelJS](https://www.npmjs.com/package/exceljs) - Excel file parsing
- [Papa Parse](https://www.papaparse.com/) - CSV parsing (fallback)

### User Feedback
- **Date:** 2025-12-12
- **Feedback:** "its working!" (after implementing intelligent parser with preview)
- **Problem Identified:** Original parser was "dumb" and blindly mapped columns
- **Solution:** Intelligent parser with hierarchical support and real-time preview

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.7 | 2025-12-12 | Initial implementation of intelligent parser with preview |
| | | - Smart column detection with keyword matching |
| | | - Hierarchical category support (Level 1 → Level 2) |
| | | - Real-time preview API endpoint |
| | | - Preview UI with expandable tree |
| | | - Category name cleaning (removes numbering) |
| | | - Support for grouped category formats |

---

**Last Updated:** 2025-12-12
**Author:** Claude Sonnet 4.5
**Status:** ✅ Production Ready
