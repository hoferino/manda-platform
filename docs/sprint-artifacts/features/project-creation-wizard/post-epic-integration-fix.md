# IRL Workflow Fix Proposal - Complete Integration
**Date:** 2025-12-11 19:15 CET
**PM:** John
**Severity:** CRITICAL - Complete workflow broken
**Issues:** BUG-001 (partial), UX issues in wizard

---

## Current Broken Flow

### What User Sees
1. Create New Project → Step 1: Enter name/company
2. Step 2: Select IRL template (shows "Tech M&A Standard IRL" with sections preview)
3. Click "Change Template" button (THIS SHOULD NOT EXIST - dropdown should always show)
4. Click "Create Project"
5. **❌ RESULT**: Deal created, `irl_template` stored, but:
   - No IRL record created
   - No folders created
   - No checklist items created
   - Data room empty
   - IRL checklist empty

### What Code Does
```typescript
// Step2IRLTemplate component (wizard)
onTemplateChange(template) // Sets selectedTemplate to "Tech M&A Standard IRL"

// NewProjectPage
await createDeal({
  name: "My Deal",
  irl_template: "Tech M&A Standard IRL", // ← Saves to database
})

// lib/api/deals-client.ts
await supabase.from('deals').insert({
  irl_template: input.irl_template, // ← Stored but NEVER USED
})

// ❌ NOTHING HAPPENS WITH THE TEMPLATE
// No IRL creation
// No folder generation
// Just a string in the database
```

---

## Root Cause Analysis

### Problem 1: Template Name vs Template ID Mismatch

**Wizard sends:** `"Tech M&A Standard IRL"` (display name)
**IRL templates expect:** `"tech-ma"` (template ID)

The wizard has TWO different template systems:
1. **Step3IRLTemplate.tsx** → Hardcoded sections (lines 32-77)
2. **IRL Templates** (`packages/shared/templates/irls/*.json`) → Full templates with items

**They don't match!**

### Problem 2: No Integration Layer

`createDeal()` just inserts to database. There's NO code that:
- Reads the `irl_template` value
- Creates an IRL record
- Calls folder generation
- Populates checklist

### Problem 3: UX Issues

1. **"Change Template" button** (line 256-262) → Should be permanent dropdown
2. **Template names mismatch** → Wizard uses "Tech M&A Standard IRL", templates use "Tech M&A"
3. **Sections vs Items** → Wizard shows generic sections, templates have detailed items

---

## Proposed Fix - Complete Integration

### Option A: Server-Side Trigger (RECOMMENDED)

**Create a server action or API endpoint** that handles the full deal creation workflow.

#### Implementation

**1. Create Server Action: `app/actions/create-deal-with-irl.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/services/irl-templates'
import { createFoldersFromIRL } from '@/lib/services/folders'

// Map wizard template names to template IDs
const TEMPLATE_NAME_TO_ID: Record<string, string> = {
  'Tech M&A Standard IRL': 'tech-ma',
  'Industrial M&A IRL': 'industrial',
  'Pharma M&A IRL': 'pharma',
  'General M&A IRL': 'custom',
}

export async function createDealWithIRL(input: {
  name: string
  company_name?: string | null
  industry?: string | null
  irl_template?: string | null
}) {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Authentication required' }
  }

  // 1. Create deal record
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      name: input.name,
      company_name: input.company_name,
      industry: input.industry,
      irl_template: input.irl_template,
      status: 'active',
    })
    .select()
    .single()

  if (dealError) {
    return { error: dealError.message }
  }

  // 2. If IRL template selected, create IRL + folders
  if (input.irl_template && input.irl_template !== 'none' && input.irl_template !== 'upload') {
    try {
      // Map wizard name to template ID
      const templateId = TEMPLATE_NAME_TO_ID[input.irl_template]

      if (!templateId) {
        console.warn(`Unknown IRL template: ${input.irl_template}`)
        return { data: deal, error: null }
      }

      // Load template
      const template = await getTemplate(templateId)
      if (!template) {
        console.warn(`Template not found: ${templateId}`)
        return { data: deal, error: null }
      }

      // Create IRL record
      const sectionsData = template.categories.map((cat) => ({
        name: cat.name,
        items: cat.items.map((item) => ({
          name: item.name,
          description: item.description || '',
          priority: item.priority,
          status: 'not_started',
        })),
      }))

      const { data: irl, error: irlError } = await supabase
        .from('irls')
        .insert({
          deal_id: deal.id,
          user_id: user.id,
          name: `${input.name} - IRL`,
          template_type: templateId,
          sections: sectionsData,
          progress_percent: 0,
        })
        .select()
        .single()

      if (irlError) {
        console.error('Failed to create IRL:', irlError)
        return { data: deal, error: null } // Don't fail deal creation
      }

      // 3. Generate folders from IRL
      const folderResult = await createFoldersFromIRL(supabase, deal.id, irl.id)
      console.log(`Created ${folderResult.created} folders for deal ${deal.id}`)

    } catch (error) {
      console.error('Error creating IRL/folders:', error)
      // Don't fail the deal creation
    }
  }

  return { data: deal, error: null }
}
```

**2. Update Wizard to Use Server Action**

```typescript
// app/projects/new/page.tsx

import { createDealWithIRL } from '@/app/actions/create-deal-with-irl'

// In handleSubmit:
const result = await createDealWithIRL({
  name: formData.projectName.trim(),
  company_name: formData.companyName.trim() || null,
  industry: formData.industry || null,
  irl_template: irlTemplate,
})
```

**3. Fix Template Name Mapping in Wizard**

```typescript
// components/wizard/Step3IRLTemplate.tsx (lines 32-77)

// UPDATE template names to match the backend template names
export const IRL_TEMPLATES = {
  'tech-ma': {
    name: 'Tech M&A', // ← Changed from "Tech M&A Standard IRL"
    sections: [...],
  },
  industrial: {
    name: 'Industrial', // ← Changed from "Industrial M&A IRL"
    sections: [...],
  },
  pharma: {
    name: 'Pharma', // ← Changed from "Pharma M&A IRL"
    sections: [...],
  },
  custom: {
    name: 'General M&A', // ← Changed from "General M&A IRL"
    sections: [...],
  },
}
```

**4. Remove "Change Template" Button, Show Dropdown Always**

```typescript
// components/wizard/Step3IRLTemplate.tsx (lines 253-289)

// REMOVE the conditional showTemplateSelect state
// ALWAYS show the dropdown

<CardHeader className="pb-4">
  <CardTitle className="text-lg">Select Template</CardTitle>
</CardHeader>

<CardContent className="space-y-4">
  {/* Template Selector - ALWAYS VISIBLE */}
  <div className="space-y-2">
    <Select
      value={selectedTemplate}
      onValueChange={(value) => onTemplateChange(value)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a template" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(IRL_TEMPLATES).map(([key, tmpl]) => (
          <SelectItem key={key} value={tmpl.name}>
            {tmpl.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Preview Section - BELOW dropdown */}
  <div>
    <Button
      variant="ghost"
      className="w-full justify-between px-0 hover:bg-transparent"
      onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
    >
      <span className="text-sm font-medium">Preview Template Sections</span>
      {isPreviewExpanded ? <ChevronUp /> : <ChevronDown />}
    </Button>

    {isPreviewExpanded && (
      <ul className="space-y-2 border-l-2 border-muted pl-4 mt-3">
        {template.sections.map((section, index) => (
          <li key={index} className="text-sm text-muted-foreground">
            {section}
          </li>
        ))}
      </ul>
    )}
  </div>
</CardContent>
```

---

## Files to Modify

| File | Operation | Lines | Changes |
|------|-----------|-------|---------|
| `app/actions/create-deal-with-irl.ts` | CREATE | N/A | New server action for integrated deal creation |
| `app/projects/new/page.tsx` | MODIFY | 112-130 | Replace `createDeal()` with `createDealWithIRL()` |
| `components/wizard/Step3IRLTemplate.tsx` | MODIFY | 32-77 | Update template names to match backend |
| `components/wizard/Step3IRLTemplate.tsx` | MODIFY | 253-289 | Remove "Change Template" button, show dropdown always |
| `components/wizard/Step3IRLTemplate.tsx` | MODIFY | 29 | Change DEFAULT_TEMPLATE to match new naming |

---

## Testing Checklist

- [x] Create new project with "Tech M&A" template
  - [x] Deal created in database
  - [x] IRL record created with sections
  - [x] Folders created in data room (5 folders)
  - [x] IRL checklist populated
  - [x] Can mark items as fulfilled

- [x] Create new project with "Empty Project"
  - [x] Deal created in database
  - [x] No IRL record created
  - [x] No folders created
  - [x] Data room empty (as expected)

- [x] Template dropdown always visible (no "Change Template" button)
  - [x] Dropdown shows 5 templates
  - [x] Preview always visible (no expand/collapse)
  - [x] Changing template updates preview

- [x] All 5 templates work
  - [x] Tech M&A → 5 categories
  - [x] Industrial → 6 categories
  - [x] Pharma → 6 categories
  - [x] Financial Services → 6 categories
  - [x] General M&A → 6 categories

- [x] Auto-select default template when clicking "Use Template"
- [x] Create Project button disabled when no template selected

---

## Implementation Status

**COMPLETED:** 2025-12-11 21:40 CET

### Changes Implemented

1. ✅ **Server Action Created** - `app/actions/create-deal-with-irl.ts`
   - Integrated workflow: Deal → IRL → IRL Items → Folders
   - Template name to ID mapping
   - Graceful degradation (continues on errors)
   - Creates `irl_items` table records for interactivity

2. ✅ **Wizard Updated** - `app/projects/new/page.tsx`
   - Changed from `createDeal()` to `createDealWithIRL()`
   - Added validation: Create button disabled when no template selected
   - Added folder count feedback in success message

3. ✅ **Template Component Fixed** - `components/wizard/Step3IRLTemplate.tsx`
   - Standardized template names (removed "IRL" suffix)
   - Removed "Change Template" button
   - Always show dropdown
   - Always show preview content (no toggle)
   - Auto-select "General M&A" as default template
   - Improved "What Happens Next" descriptions

4. ✅ **Folder Service Fixed** - `lib/services/folders.ts`
   - Updated `getIRLCategoryStructure()` to read from JSONB `irls.sections`
   - Falls back to `irl_items` table for manual IRLs

5. ✅ **IRL API Fixed** - `lib/api/irl.ts`
   - Updated `getProjectIRL()` to support JSONB `irls.sections`
   - Falls back to `irl_items` table for manual IRLs
   - Generates temporary IDs for JSONB-based items

### Dual Data Storage Pattern

Template-based IRLs now store data in TWO places:
1. **JSONB (`irls.sections`)** - Bulk storage, fast reference
2. **Individual records (`irl_items`)** - User interactions (mark fulfilled, link documents)

This allows:
- Fast bulk operations from JSONB
- Interactive features from table records
- Backward compatibility with manual IRLs

---

## Open Questions (RESOLVED)

1. **Template sections vs items:** ✅ Keeping generic sections in wizard preview
2. **Upload Custom IRL:** ✅ Create empty deal, user uploads later in Deliverables
3. **IRL naming:** ✅ Keeping "{Project Name} - IRL" format
