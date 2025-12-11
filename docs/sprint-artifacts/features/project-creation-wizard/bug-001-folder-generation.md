# BUG-001 Fix Proposal: IRL Template Folder Generation
**Date:** 2025-12-11 18:30 CET
**PM:** John
**Severity:** CRITICAL
**Impact:** Blocks entire IRL workflow (T1.9, T1.10)

---

## Root Cause Analysis

### The Problem

When a user selects an IRL template and creates an IRL:
1. ✅ IRL record is created in `irls` table
2. ✅ IRL items are stored in `sections` JSONB column
3. ❌ **Folders are NEVER created** in `folders` table
4. ❌ **GCS folder prefixes are NEVER created**
5. ❌ **IRL checklist remains empty** (no `irl_items` records)

Result: Empty data room, empty IRL checklist → workflow broken.

### Code Trace

#### 1. User Flow
**File:** [deliverables-client.tsx](../../manda-app/app/projects/[id]/deliverables/deliverables-client.tsx) (lines 80-132)

```typescript
const handleTemplateSelect = useCallback((template: IRLTemplate | null) => {
  setSelectedTemplate(template)
  setIsCreating(true)
  // Pre-fill title
}, [])

const handleCreateIRL = useCallback(async () => {
  // ... validation ...

  const response = await fetch(`/api/projects/${projectId}/irls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: irlTitle,
      templateId: selectedTemplate?.id,
    }),
  })

  // ❌ STOPS HERE - No folder generation call

  const data = await response.json()
  setIrls(prev => [data.irl, ...prev])
  setEditingIrlId(data.irl.id)
}, [projectId, irlTitle, selectedTemplate, router])
```

**Issue:** After IRL creation succeeds, the code does NOT call the folder generation endpoint.

#### 2. IRL Creation API
**File:** [app/api/projects/[id]/irls/route.ts](../../manda-app/app/api/projects/[id]/irls/route.ts) (lines 35-165)

```typescript
export async function POST(request: NextRequest, context: RouteContext) {
  // ... authentication ...
  // ... template validation ...

  // Create IRL record
  const { data: irlData, error: irlError } = await supabase
    .from('irls')
    .insert({
      deal_id: projectId,
      user_id: user.id,
      name: title,
      template_type: templateId || null,
      sections: sectionsData,  // ← IRL items stored here as JSON
      progress_percent: 0,
    })
    .select()
    .single()

  // ❌ MISSING: No call to createFoldersFromIRL()
  // ❌ MISSING: No call to generate-folders endpoint

  return NextResponse.json({ irl, items }, { status: 201 })
}
```

**Issue:** The API creates the IRL but does NOT trigger folder generation.

#### 3. Folder Generation Endpoint EXISTS But Is Never Called
**File:** [app/api/projects/[id]/irls/[irlId]/generate-folders/route.ts](../../manda-app/app/api/projects/[id]/irls/[irlId]/generate-folders/route.ts)

```typescript
export async function POST(request: NextRequest, context: RouteContext) {
  // ... authentication ...

  // ✅ This code WORKS but is NEVER CALLED
  const result = await createFoldersFromIRL(supabase, projectId, irlId)

  return NextResponse.json({
    folders: result.folders,
    tree: enrichedTree,
    created: result.created,
    skipped: result.skipped,
  }, { status: 201 })
}
```

**Issue:** Endpoint exists and is functional, but nothing invokes it.

---

## Why This Happened

### Story E6.4 Implementation Notes

From [e6-4 story](stories/e6-4-implement-data-room-folder-structure-auto-generation-from-irl.md):

> **Task 3.1:** Add "Generate Folders" button to IRL Builder header

This suggests the **original design was MANUAL trigger**, not automatic. The "Generate Folders" button was supposed to be in the IRL Builder UI.

### Design Conflict

- **PRD expectation (Epic 6 AC)**: "System auto-generates folders from IRL"
- **Implementation (E6.4)**: Manual "Generate Folders" button
- **Testing expectation**: Automatic folder generation
- **Actual behavior**: Neither automatic NOR manual button visible

**Hypothesis:** The button was implemented in IRLBuilder component but is not visible or not working.

---

## Proposed Solutions

### Option A: Automatic Folder Generation (Recommended)

**When:** Immediately after IRL creation
**Where:** In the IRL creation API endpoint
**Impact:** Matches user expectations from testing

#### Implementation Steps

1. **Modify IRL Creation API**
   - **File:** `app/api/projects/[id]/irls/route.ts`
   - **Line:** After line 116 (after IRL is created)

   ```typescript
   // Create the IRL record
   const { data: irlData, error: irlError } = await supabase
     .from('irls')
     .insert({ ... })
     .select()
     .single()

   if (irlError) {
     return NextResponse.json({ error: 'Failed to create IRL' }, { status: 500 })
   }

   // ✅ NEW: Auto-generate folders from template
   let folderGenerationResult = null
   if (templateId) {
     try {
       const { createFoldersFromIRL } = await import('@/lib/services/folders')
       folderGenerationResult = await createFoldersFromIRL(
         supabase,
         projectId,
         irlData.id
       )
       console.log(`Generated ${folderGenerationResult.created} folders from IRL template`)
     } catch (error) {
       console.error('Failed to auto-generate folders:', error)
       // Don't fail IRL creation if folder generation fails
     }
   }

   // Return IRL with folder generation stats
   return NextResponse.json({
     irl,
     items,
     folders: folderGenerationResult, // Optional: include folder stats in response
   }, { status: 201 })
   ```

2. **Update Client to Handle Folder Stats**
   - **File:** `app/projects/[id]/deliverables/deliverables-client.tsx`
   - **Line:** After line 117 (after IRL creation response)

   ```typescript
   const data = await response.json()

   // ✅ NEW: Show folder generation result
   if (data.folders && data.folders.created > 0) {
     console.log(`Created ${data.folders.created} folders from IRL template`)
     // Optional: Show toast notification
   }

   setIrls(prev => [data.irl, ...prev])
   setEditingIrlId(data.irl.id)
   ```

**Pros:**
- Matches user expectations
- Zero friction - "just works"
- Consistent with PRD Epic 6 AC: "System auto-generates folders"
- Simple implementation (10-15 lines of code)

**Cons:**
- Users can't preview folders before creation
- Slight performance impact on IRL creation (adds ~500ms)

---

### Option B: Manual "Generate Folders" Button

**When:** User clicks button in IRL Builder
**Where:** IRL Builder component
**Impact:** Requires user action, but gives more control

#### Implementation Steps

1. **Check if Button Exists in IRLBuilder**
   - **File:** `components/irl/IRLBuilder.tsx`
   - **Action:** Search for "Generate Folders" button
   - **If exists:** Debug why it's not visible/working
   - **If missing:** Add button to toolbar

2. **Add Button to IRLBuilder Toolbar** (if missing)
   ```typescript
   <div className="flex gap-2">
     {/* Existing buttons: Save, Export, etc. */}

     {/* ✅ NEW: Generate Folders button */}
     <Button
       variant="outline"
       onClick={handleGenerateFolders}
       disabled={isGeneratingFolders}
     >
       {isGeneratingFolders ? (
         <>
           <Loader2 className="h-4 w-4 mr-2 animate-spin" />
           Generating...
         </>
       ) : (
         <>
           <FolderPlus className="h-4 w-4 mr-2" />
           Generate Folders
         </>
       )}
     </Button>
   </div>
   ```

3. **Implement Handler**
   ```typescript
   const handleGenerateFolders = async () => {
     setIsGeneratingFolders(true)
     try {
       const response = await fetch(
         `/api/projects/${projectId}/irls/${irlId}/generate-folders`,
         { method: 'POST' }
       )
       const data = await response.json()

       // Show success notification
       toast.success(`Created ${data.created} folders from IRL`)

       // Refresh data room (if needed)
     } catch (error) {
       toast.error('Failed to generate folders')
     } finally {
       setIsGeneratingFolders(false)
     }
   }
   ```

**Pros:**
- User has explicit control
- Can review IRL before generating folders
- Matches E6.4 original design

**Cons:**
- Extra step for users (friction)
- Button might be missed
- Doesn't match automatic expectation from testing

---

### Option C: Hybrid Approach (Best of Both)

**Automatic + Manual Option**

1. **Auto-generate on creation** (Option A)
2. **Add "Regenerate Folders" button** in IRL Builder for:
   - Regenerating if user edited IRL categories
   - Recovering from errors
   - Syncing folders with IRL changes

**Pros:**
- Zero friction for initial setup
- Flexibility for power users
- Recoverable from errors

**Cons:**
- Most complex implementation
- Need to handle duplicate prevention

---

## Recommended Fix: Option A (Automatic)

**Rationale:**
1. Matches PRD Epic 6 AC: "System auto-generates folders"
2. Matches user testing expectations
3. Simplest user experience
4. Quick to implement (1-2 hours)
5. Low risk - folder generation is idempotent (skips existing folders)

---

## Implementation Checklist

- [ ] Modify `app/api/projects/[id]/irls/route.ts` POST handler
  - [ ] Import `createFoldersFromIRL` after IRL creation
  - [ ] Call folder generation if `templateId` is provided
  - [ ] Handle errors gracefully (don't fail IRL creation)
  - [ ] Return folder stats in response

- [ ] Update `app/projects/[id]/deliverables/deliverables-client.tsx`
  - [ ] Log folder generation results
  - [ ] Optional: Add toast notification

- [ ] Test end-to-end
  - [ ] Create IRL from Tech M&A template
  - [ ] Verify folders appear in data room
  - [ ] Verify IRL checklist populated (if irl_items migration is separate)
  - [ ] Test with blank IRL (should skip folder generation)

- [ ] Update test execution log
  - [ ] Mark T1.3 as PASS (retest)
  - [ ] Unblock T1.9 and T1.10

---

## Secondary Issue: IRL Items in Checklist

**Note:** The IRL creation API stores items in `sections` JSONB column (line 107), NOT in `irl_items` table.

**Check:** Does the `irl_items` table exist? If yes, the API needs to also insert records there for the checklist to work.

**File to Check:** Database migration for `irl_items` table
**Story Reference:** E6.2, E6.5

**If `irl_items` table exists:**
- IRL creation API needs to insert into `irl_items` table
- Currently only stores in `sections` JSONB

**Action:** After fixing folder generation, verify IRL checklist works. If not, add `irl_items` insert logic.

---

## Timeline Estimate

**Option A Implementation:**
- Code changes: 30 minutes
- Testing: 30 minutes
- Documentation: 15 minutes
- **Total: 1-1.5 hours**

**Option B Implementation:**
- Find/create button: 45 minutes
- Wire up handler: 30 minutes
- Testing: 30 minutes
- **Total: 2 hours**

**Option C Implementation:**
- Automatic + manual: 2-3 hours

---

## Risk Assessment

**Low Risk:**
- `createFoldersFromIRL()` is already implemented and tested (E6.4)
- Folder generation is idempotent (skips duplicates)
- Failure doesn't break IRL creation (wrapped in try-catch)

**Medium Risk:**
- Performance: Folder generation adds ~500ms to IRL creation
  - Mitigation: Run in background (optional)
  - Acceptable: 500ms is reasonable for one-time setup

**No Risk:**
- Changes are isolated to IRL creation flow
- No impact on existing IRLs
- No database schema changes required

---

## Questions for Max

1. **Preferred solution?**
   - Option A (Automatic) ← Recommended
   - Option B (Manual button)
   - Option C (Hybrid)

2. **Should folder generation be synchronous or async?**
   - Synchronous: User waits ~500ms, sees result immediately
   - Async: Returns immediately, folders appear in background

3. **Do you want a toast notification when folders are created?**
   - "Created 5 folders from Tech M&A template"

4. **Should we also fix the IRL checklist issue?**
   - Check if `irl_items` table exists
   - If yes, add insert logic to populate checklist

---

*Ready to implement Option A unless you prefer a different approach.*
