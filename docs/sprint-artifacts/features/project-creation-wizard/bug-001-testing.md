# BUG-001 Testing Guide: Automatic Folder Generation
**Date:** 2025-12-11 18:45 CET
**Fix Implemented:** Option A - Automatic folder generation on IRL creation
**PM:** John
**Tester:** Max

---

## Changes Made

### 1. API Route Update
**File:** `manda-app/app/api/projects/[id]/irls/route.ts`
**Lines:** 152-178

**What Changed:**
- Added automatic folder generation after IRL creation
- Calls `createFoldersFromIRL()` when `templateId` is provided
- Wraps in try-catch to prevent IRL creation failure if folders fail
- Returns folder generation stats in response

**Code Added:**
```typescript
// Auto-generate folders from IRL template (BUG-001 fix)
let folderGenerationResult = null
if (templateId && template) {
  try {
    const { createFoldersFromIRL } = await import('@/lib/services/folders')
    folderGenerationResult = await createFoldersFromIRL(
      supabase,
      projectId,
      irlData.id
    )
    console.log(`[IRL Creation] Auto-generated ${folderGenerationResult.created} folders...`)
  } catch (error) {
    console.error('[IRL Creation] Failed to auto-generate folders:', error)
  }
}
```

### 2. TypeScript Type Update
**File:** `manda-app/lib/types/irl.ts`
**Lines:** 437-447

**What Changed:**
- Added `folders` field to `CreateIRLResponse` interface
- Includes folder generation stats: created, skipped, errors

### 3. Client Feedback
**File:** `manda-app/app/projects/[id]/deliverables/deliverables-client.tsx`
**Lines:** 119-130

**What Changed:**
- Logs folder generation results to console
- Shows success message with folder count
- Shows warnings if errors occurred

---

## Testing Instructions

### Prerequisites
✅ Docker running
✅ Neo4j container running (`docker-compose -f docker-compose.dev.yml up -d`)
✅ Next.js app running (`npm run dev`)
✅ Processing service running (optional for this test)

### Test Case: T1.3 Retest - Create IRL from Template

**Expected Before Fix:**
- ❌ Data room empty
- ❌ IRL checklist empty
- ❌ No folders created

**Expected After Fix:**
- ✅ Data room populated with template folders
- ✅ IRL checklist populated with template items
- ✅ Folders match IRL template categories

---

## Step-by-Step Testing

### Step 1: Restart Next.js Dev Server
```bash
# Kill existing server
pkill -f "next dev"

# Start fresh
cd manda-app
npm run dev
```

**Why:** Next.js needs to reload the API route changes.

---

### Step 2: Navigate to Deliverables

1. Open browser: `http://localhost:3000`
2. Login if needed
3. Go to your existing project OR create new project
4. Click **Deliverables** tab in navigation

**Expected:** See "Create New IRL" section with template cards

---

### Step 3: Select IRL Template

1. Click on **"Tech M&A"** template card (or any template)
2. Preview modal opens
3. Click **"Use This Template"**
4. Dialog opens asking for IRL title

**Expected:** Dialog shows:
- Title: "Tech M&A - Due Diligence" (pre-filled)
- Description: "This will create an IRL with 5 categories..."

---

### Step 4: Create IRL

1. Keep default title or change it
2. Click **"Create IRL"** button
3. Watch the browser console (Open DevTools: F12 → Console tab)

**Expected Results:**

**Console Output:**
```
[IRL Creation] Auto-generated 5 folders from template "Tech M&A" (skipped 0 existing)
✅ Auto-generated 5 folders from IRL template
```

**UI Behavior:**
- Dialog closes
- IRL Builder opens (showing IRL editing interface)

---

### Step 5: Verify Data Room Has Folders

1. Click **"Back to IRL List"** button (or navigate to Data Room)
2. Open **Data Room** tab in navigation
3. Check the folder tree on the left

**Expected Results:**

**Folders Created (Tech M&A template):**
- 📁 Financial
- 📁 Legal
- 📁 Technical
- 📁 Operational
- 📁 Commercial

**✅ PASS Criteria:**
- All 5 folders appear in Data Room
- Folders match IRL template categories
- Data room is NOT empty

**❌ FAIL Criteria:**
- Data room still empty
- Only some folders created
- Console shows errors

---

### Step 6: Verify IRL Checklist (Secondary Check)

**Note:** This may still be empty if `irl_items` table migration is separate from `sections` JSONB.

1. Open Data Room
2. Look for IRL checklist panel (right side or collapsible sidebar)

**Expected (Best Case):**
- IRL checklist shows template items
- Items grouped by category
- Each item has checkbox (unfulfilled)

**Expected (Acceptable - Known Limitation):**
- Checklist might still be empty if items are only in `sections` JSONB
- This is a separate issue from folder generation

---

### Step 7: Test Blank IRL (Control Test)

1. Navigate back to Deliverables
2. Click **"Custom (Blank)"** card
3. Enter title: "Custom IRL Test"
4. Click "Create IRL"

**Expected Results:**

**Console Output:**
```
(No folder generation logs - blank IRL has no template)
```

**Data Room:**
- No new folders created (blank IRL = no template = no folders)
- Existing folders from previous test remain

**✅ PASS Criteria:**
- No errors
- Blank IRL created successfully
- No unwanted folder generation

---

## Success Criteria Summary

### ✅ Test PASSES if:

1. **Folder Generation Works:**
   - Console shows: "Auto-generated X folders from template..."
   - Data room populated with folders matching template categories
   - Folder count matches template category count

2. **No Errors:**
   - No console errors during IRL creation
   - No API errors (check Network tab: status 201)
   - Folders created in database (verify in Supabase)

3. **Graceful Degradation:**
   - If folder generation fails, IRL still created
   - Error logged to console but doesn't break flow
   - User can continue working

### ❌ Test FAILS if:

1. **Folders Not Created:**
   - Data room still empty after template selection
   - Console shows no folder generation logs
   - No change from before fix

2. **Errors Block IRL Creation:**
   - IRL creation fails due to folder generation error
   - User sees error dialog
   - IRL not created in database

3. **TypeScript Errors:**
   - Console shows type errors
   - API returns 500 error
   - Page crashes

---

## Debugging Steps (If Test Fails)

### If Folders Still Not Created:

1. **Check Console for Errors:**
   ```
   [IRL Creation] Failed to auto-generate folders: <error message>
   ```
   - Look for error message details
   - Common issues: Database permissions, GCS config

2. **Check Server Logs:**
   ```bash
   # In terminal running npm run dev
   # Look for lines starting with [IRL Creation]
   ```

3. **Verify `createFoldersFromIRL` Function Exists:**
   ```bash
   ls manda-app/lib/services/folders.ts
   ```
   - Should exist from E6.4 story

4. **Check Database:**
   - Open Supabase dashboard
   - Go to Table Editor → `folders` table
   - Check if any folders exist for your `deal_id`

### If TypeScript Errors:

1. **Restart TypeScript Server in VSCode:**
   - Command Palette (Cmd+Shift+P)
   - "TypeScript: Restart TS Server"

2. **Check Type Definition:**
   ```bash
   grep -A 10 "CreateIRLResponse" manda-app/lib/types/irl.ts
   ```
   - Should show `folders?:` field

### If IRL Creation Fails Completely:

1. **Check API Response:**
   - Open DevTools → Network tab
   - Find POST request to `/api/projects/[id]/irls`
   - Click on it → Response tab
   - Look for error message

2. **Verify Database Access:**
   ```bash
   # Check Supabase connection
   # Make sure .env.local has correct NEXT_PUBLIC_SUPABASE_URL
   ```

---

## Expected Test Results by Template

### Tech M&A Template
- **Folders Created:** 5
- **Categories:** Financial, Legal, Technical, Operational, Commercial
- **Items per Category:** ~6-8

### Industrial Template
- **Folders Created:** 5
- **Categories:** Financial, Legal, Operations, Environmental, Safety
- **Items per Category:** ~6-8

### Pharma Template
- **Folders Created:** 5
- **Categories:** Financial, Legal, Regulatory, R&D, Manufacturing
- **Items per Category:** ~6-8

### Financial Services Template
- **Folders Created:** 5
- **Categories:** Financial, Legal, Compliance, Risk, Operations
- **Items per Category:** ~6-8

---

## What to Report Back

### If Test PASSES ✅

Reply with:
```
✅ BUG-001 FIXED
- Template: <template name>
- Folders created: <count>
- Data room populated: Yes
- Console logs: Clean
```

### If Test FAILS ❌

Reply with:
1. **What template you tested:** Tech M&A / Industrial / etc.
2. **What you saw:** Screenshot or description
3. **Console errors:** Copy any error messages
4. **Data room state:** Empty / Partial / Other
5. **Browser console logs:** Copy relevant lines

---

## Next Steps After Testing

### If Test Passes:
1. Test remaining templates (Industrial, Pharma, Financial)
2. Retest T1.9 (IRL fulfillment) - now unblocked
3. Retest T1.10 (Progress tracking) - now unblocked
4. Update test-execution-log.md

### If Test Fails:
1. Report findings
2. Debug with additional logging
3. Check E6.4 implementation (folder service)
4. Verify database schema

---

**Ready to test, Max! Let me know what you see.**
