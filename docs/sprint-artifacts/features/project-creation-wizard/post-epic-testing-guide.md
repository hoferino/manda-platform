# IRL Workflow Testing Guide - Complete Integration
**Date:** 2025-12-11 19:30 CET
**PM:** John
**Fixes:** Complete IRL workflow integration

---

## What Was Fixed

### 1. Server Action Created
**File:** `app/actions/create-deal-with-irl.ts`
- Integrated workflow: Deal creation → IRL creation → Folder generation
- Template name mapping (wizard names → template IDs)
- Handles all three options: template, empty, upload

### 2. Wizard Updated
**File:** `app/projects/new/page.tsx`
- Uses new `createDealWithIRL()` server action
- Shows success message with folder count
- Proper handling of 'none' and 'upload' options

### 3. Template Names Fixed
**File:** `components/wizard/Step3IRLTemplate.tsx`
- Updated template names to match backend:
  - "Tech M&A Standard IRL" → "Tech M&A"
  - "Industrial M&A IRL" → "Industrial"
  - "Pharma M&A IRL" → "Pharma"
  - "General M&A IRL" → "General M&A"
- Added "Financial Services" template

### 4. UX Improvements
**File:** `components/wizard/Step3IRLTemplate.tsx`
- ✅ Removed "Change Template" button
- ✅ Dropdown always visible
- ✅ Better "What Happens Next" summary

---

## Testing Instructions

### Prerequisites
✅ Next.js dev server running (already started)
✅ Docker running
✅ Neo4j container running
✅ Processing service (not needed for this test)

---

## Test Case 1: Create Project with Tech M&A Template

**Expected Result:**
- ✅ Deal created
- ✅ IRL record created with template data
- ✅ 5 folders created in data room
- ✅ IRL checklist populated with items
- ✅ Success toast shows folder count

### Steps

1. **Navigate to Project Creation**
   - Open: http://localhost:3000
   - Login if needed
   - Click "Create New Project" (or navigate to `/projects/new`)

2. **Step 1: Basic Info**
   - Project Name: "Tech Acquisition Test"
   - Company Name: "TechCo Inc"
   - Industry: Select any
   - Click "Next"

3. **Step 2: IRL Template**
   - Should see 3 option cards: Use Template | Empty Project | Upload Custom
   - Click "Use Template" card (should be selected/highlighted)
   - **✅ CHECK**: Dropdown is ALWAYS visible (no "Change Template" button)
   - **✅ CHECK**: Dropdown shows 5 templates:
     - Tech M&A
     - Industrial
     - Pharma
     - Financial Services
     - General M&A
   - Select "Tech M&A" from dropdown
   - Click "Preview Template Sections" to expand
   - **✅ CHECK**: Shows 6 sections (Company Info, Financial, Tech Stack, Contracts, Employee, Legal)
   - Read "What Happens Next" summary
   - **✅ CHECK**: Says "Folders will be automatically created in your data room..."

4. **Create Project**
   - Click "Create Project" button
   - **Wait for success toast**

5. **Verify Success Toast**
   - **✅ EXPECTED**: "Project created successfully! Generated 5 folders from IRL template."
   - **❌ FAIL IF**: Generic message or error

6. **Verify Data Room**
   - Should redirect to `/projects/{id}/dashboard`
   - Navigate to "Data Room" tab
   - **✅ EXPECTED**: 5 folders appear:
     - Financial
     - Legal
     - Technical
     - Operational
     - Commercial
   - **❌ FAIL IF**: Data room is empty

7. **Verify IRL Checklist**
   - Look for IRL checklist panel (right side or collapsible)
   - **✅ EXPECTED**: IRL items appear grouped by category
   - Each category shows multiple items
   - Items have checkboxes (unfulfilled)
   - **⚠️ NOTE**: If checklist is empty but folders exist, this is a separate issue with `irl_items` table

---

## Test Case 2: Create Project with Empty Option

**Expected Result:**
- ✅ Deal created
- ✅ NO IRL created
- ✅ NO folders created
- ✅ Data room empty (as expected)

### Steps

1. Navigate to `/projects/new`
2. Step 1: Enter "Empty Project Test" as name
3. Step 2: Click "Empty Project" card
4. **✅ CHECK**: "What Happens Next" says "empty data room"
5. Click "Create Project"
6. **✅ EXPECTED**: Success toast: "Project created successfully!"
7. Navigate to Data Room
8. **✅ EXPECTED**: Data room is empty (no folders)

---

## Test Case 3: Create Project with Upload Custom

**Expected Result:**
- ✅ Deal created
- ✅ NO IRL created yet
- ✅ Ready for Excel upload

### Steps

1. Navigate to `/projects/new`
2. Step 1: Enter "Custom IRL Test" as name
3. Step 2: Click "Upload Custom" card
4. **✅ CHECK**: Shows dashed border card explaining upload after creation
5. **✅ CHECK**: "What Happens Next" mentions Excel file parsing
6. Click "Create Project"
7. **✅ EXPECTED**: Success toast: "Project created! You can now upload your custom IRL."
8. **Next step (not implemented yet)**: User should be able to upload Excel IRL

---

## Test Case 4: All Templates Work

Test each template to ensure mapping is correct:

### Tech M&A
- Select "Tech M&A"
- Create project
- **✅ EXPECTED**: 5 folders (Financial, Legal, Technical, Operational, Commercial)

### Industrial
- Select "Industrial"
- Create project
- **✅ EXPECTED**: 5 folders (Financial, Legal, Operations, Environmental, Safety)

### Pharma
- Select "Pharma"
- Create project
- **✅ EXPECTED**: 5 folders (Financial, Legal, Regulatory, R&D, Manufacturing)

### Financial Services
- Select "Financial Services"
- Create project
- **✅ EXPECTED**: 5 folders (Financial, Legal, Compliance, Risk, Operations)

### General M&A
- Select "General M&A"
- Create project
- **✅ EXPECTED**: 6 folders (Company Info, Financial, Contracts, Legal, Operations, Strategic)

---

## Success Criteria

### ✅ Test PASSES if:

1. **Dropdown Always Visible**
   - No "Change Template" button
   - Dropdown shows all 5 templates
   - Can change template without extra clicks

2. **Template Selection Works**
   - All 5 templates selectable
   - Preview sections update when template changes
   - "What Happens Next" is clear and accurate

3. **Deal Creation Creates Everything**
   - Deal record in database
   - IRL record created (when template selected)
   - Folders created in data room (matching template categories)
   - Success toast shows folder count

4. **Empty & Upload Options Work**
   - Empty project creates no IRL/folders
   - Upload option prepares for Excel upload

5. **No Template Name Errors**
   - No console errors about "Unknown IRL template"
   - Template mapping works correctly

### ❌ Test FAILS if:

1. **Dropdown Issues**
   - "Change Template" button still exists
   - Dropdown hidden by default
   - Missing templates in dropdown

2. **Creation Fails**
   - Folders not created
   - Console shows "Unknown IRL template: {name}"
   - Template name mismatch errors

3. **Empty Data Room**
   - Selected template but no folders created
   - Same as old bug (BUG-001 not fixed)

---

## Debugging Steps

### If Folders Not Created:

1. **Check Browser Console**
   ```
   Look for:
   - "[Deal Creation] Creating IRL from template..."
   - "[Deal Creation] IRL created: {id}"
   - "[Deal Creation] Generated X folders..."
   ```

2. **Check Server Logs**
   ```bash
   # In terminal running npm run dev
   # Look for [Deal Creation] logs
   ```

3. **Check Template Mapping**
   ```
   If you see: "Unknown IRL template: Tech M&A Standard IRL"
   → Template name not updated in wizard
   → Should be just "Tech M&A"
   ```

4. **Check Database**
   - Open Supabase dashboard
   - Table Editor → `irls` table
   - Should see IRL record with `template_type: "tech-ma"`
   - Table Editor → `folders` table
   - Should see 5-6 folder records

### If TypeScript Errors:

1. **Restart TypeScript Server**
   - VSCode: Cmd+Shift+P → "TypeScript: Restart TS Server"

2. **Check Import Path**
   ```typescript
   import { createDealWithIRL } from '@/app/actions/create-deal-with-irl'
   ```

---

## What to Report

### If Test PASSES ✅

Reply with:
```
✅ IRL WORKFLOW FIXED
- Template: <template name>
- Folders created: <count>
- Data room populated: Yes
- IRL checklist: <populated or empty>
- Dropdown always visible: Yes
```

### If Test FAILS ❌

Reply with:
1. **Which template:** Tech M&A / Industrial / etc.
2. **What you saw:** Empty data room / Error / etc.
3. **Console errors:** Copy error messages
4. **Server logs:** Copy [Deal Creation] logs
5. **Success toast:** What message appeared?

---

## Known Limitations

1. **IRL Checklist May Be Empty**
   - If `irl_items` table exists but checklist is empty, this is separate from folder generation
   - IRL data stored in `sections` JSONB column
   - May need separate fix for checklist population

2. **Excel Upload Not Implemented**
   - "Upload Custom" creates deal but no upload UI yet
   - This is a future feature

3. **Template Sections vs Real Items**
   - Wizard shows generic sections
   - Actual templates have detailed items
   - Preview shows generic sections (acceptable for now)

---

**Ready to test, Max! Start with Test Case 1 (Tech M&A) and let me know what you see.**
