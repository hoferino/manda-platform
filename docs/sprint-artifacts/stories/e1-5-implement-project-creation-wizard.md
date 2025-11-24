# Story 1.5: Implement Project Creation Wizard

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **a guided 3-step wizard to create new projects with project type and IRL template selection**,
so that **I can quickly set up new deals with appropriate templates and organization**.

## Context

This story implements the project creation wizard that users access by clicking "+ New Project" from the Projects Overview (E1.4). The wizard guides users through a 3-step process: (1) Basic Information (project name, company, industry), (2) Project Type Selection (Tech M&A, Industrial, Pharma, Custom), and (3) IRL Template (auto-suggested based on type). Upon completion, a new deal record is created in the database and the user is redirected to the project workspace.

**User Experience:** The wizard should feel simple and guided, with clear progress indication and validation at each step. The IRL template suggestion demonstrates the platform's intelligence without overwhelming new users.

## Acceptance Criteria

### AC1: Wizard Route and Layout
**Given** I am an authenticated user
**When** I navigate to `/projects/new`
**Then** I see the project creation wizard
**And** I see a progress indicator showing "Step 1 of 3"
**And** I see a "Cancel" button to return to Projects Overview
**And** I see a "Next" button (disabled until form is valid)

### AC2: Step 1 - Basic Information
**Given** I am on Step 1 of the wizard
**When** I enter project details
**Then** I see input fields for:
  - Project Name (required, max 100 characters)
  - Company Name (optional, max 100 characters)
  - Industry (optional dropdown: Technology, Healthcare, Financial Services, Industrial, Retail, Energy, Real Estate, Other)
**And** Required fields are marked with an asterisk (*)
**When** I fill in the Project Name field
**Then** the "Next" button becomes enabled
**When** I click "Next"
**Then** I proceed to Step 2
**And** Progress indicator shows "Step 2 of 3"

### AC3: Step 2 - Project Type Selection
**Given** I am on Step 2 of the wizard
**When** the step loads
**Then** I see 4 project type cards:
  - Tech M&A (with icon and description)
  - Industrial (with icon and description)
  - Pharma (with icon and description)
  - Custom (with icon and description)
**When** I click a project type card
**Then** the card is highlighted as selected
**And** the "Next" button becomes enabled
**When** I click "Back"
**Then** I return to Step 1 with my previous inputs preserved
**When** I click "Next"
**Then** I proceed to Step 3

### AC4: Step 3 - IRL Template Selection
**Given** I am on Step 3 of the wizard
**When** the step loads
**Then** I see an IRL template auto-suggested based on my selected project type
**And** I see the template name (e.g., "Tech M&A Standard IRL")
**And** I see a preview of template sections (collapsed list)
**When** I click "Preview Template"
**Then** I see an expanded view of all IRL sections
**When** I click "Change Template" (optional)
**Then** I see a dropdown to select a different template
**When** I click "Create Project"
**Then** a new deal record is created in the database
**And** I am redirected to `/projects/[id]/dashboard`
**And** A success toast notification appears: "Project created successfully!"

### AC5: Form Validation
**Given** I am on Step 1
**When** I leave Project Name blank and click "Next"
**Then** the "Next" button remains disabled
**And** I see a validation message: "Project name is required"
**When** I enter a name longer than 100 characters
**Then** I see a validation message: "Project name must be 100 characters or less"
**And** Input is truncated or prevented from exceeding limit

### AC6: Navigation and State Preservation
**Given** I am on Step 2
**When** I click "Back"
**Then** I return to Step 1
**And** my previously entered data is preserved
**When** I navigate through all 3 steps and click "Back" multiple times
**Then** all my selections are preserved
**When** I close the browser and return (before submitting)
**Then** my progress is lost (no persistence across sessions in MVP)

### AC7: Database Record Creation
**Given** I complete the wizard and click "Create Project"
**When** the deal record is created
**Then** the record includes:
  - `id`: auto-generated UUID
  - `user_id`: current authenticated user's ID
  - `name`: entered project name
  - `company_name`: entered company name (or null)
  - `industry`: selected industry (or null)
  - `deal_type`: selected project type
  - `status`: 'active' (default)
  - `irl_template`: selected IRL template name
  - `created_at`: current timestamp
  - `updated_at`: current timestamp
**And** RLS policies ensure the record is created with correct user_id

### AC8: Error Handling
**Given** I complete the wizard
**When** the database operation fails (network error, server down)
**Then** I see an error toast: "Failed to create project. Please try again."
**And** I remain on Step 3 with my data preserved
**And** I can retry by clicking "Create Project" again
**When** there is a validation error from the database
**Then** I see a specific error message (e.g., "Project name already exists")

### AC9: Responsive Design
**Given** I am on the wizard
**When** I view it on different screen sizes
**Then** on desktop (1920x1080): Wizard is centered with max-width 800px
**And** on tablet (1024x768): Wizard is full-width with padding
**And** on mobile (375x667): Wizard is full-width, stacked layout
**And** All buttons and inputs remain accessible and usable

### AC10: Cancel and Redirect
**Given** I am on any step of the wizard
**When** I click "Cancel"
**Then** I am redirected to `/projects` (Projects Overview)
**And** No deal record is created
**When** I successfully create a project
**Then** I am redirected to `/projects/[id]/dashboard`
**And** The project workspace loads (E1.6)

## Tasks / Subtasks

- [ ] **Task 1: Create Wizard Route and Layout** (AC: #1, #9)
  - [ ] Create `app/projects/new/page.tsx` route
  - [ ] Create wizard layout component: `components/wizard/WizardLayout.tsx`
  - [ ] Implement progress indicator (Step X of 3)
  - [ ] Add Cancel button (links back to `/projects`)
  - [ ] Add Next/Back/Submit buttons (conditionally rendered)
  - [ ] Implement responsive layout (max-width 800px on desktop, full-width on mobile)

- [ ] **Task 2: Implement Step 1 - Basic Information** (AC: #2, #5)
  - [ ] Create `components/wizard/Step1BasicInfo.tsx`
  - [ ] Add form fields using shadcn/ui Input and Label components:
    - Project Name (required)
    - Company Name (optional)
    - Industry (Select dropdown)
  - [ ] Implement form validation (required fields, max length)
  - [ ] Show validation errors inline
  - [ ] Enable/disable "Next" button based on validation
  - [ ] Test field validation edge cases

- [ ] **Task 3: Implement Step 2 - Project Type Selection** (AC: #3)
  - [ ] Create `components/wizard/Step2ProjectType.tsx`
  - [ ] Create project type card component: `components/wizard/ProjectTypeCard.tsx`
  - [ ] Define project types:
    ```typescript
    const PROJECT_TYPES = [
      { id: 'tech-ma', name: 'Tech M&A', icon: Laptop, description: '...' },
      { id: 'industrial', name: 'Industrial', icon: Factory, description: '...' },
      { id: 'pharma', name: 'Pharma', icon: Pill, description: '...' },
      { id: 'custom', name: 'Custom', icon: Settings, description: '...' }
    ]
    ```
  - [ ] Implement card selection (highlight selected card)
  - [ ] Use Lucide icons for project types
  - [ ] Enable "Next" button when a type is selected

- [ ] **Task 4: Implement Step 3 - IRL Template Selection** (AC: #4)
  - [ ] Create `components/wizard/Step3IRLTemplate.tsx`
  - [ ] Implement IRL template auto-suggestion logic:
    ```typescript
    const getDefaultTemplate = (dealType: string) => {
      const templates = {
        'tech-ma': 'Tech M&A Standard IRL',
        'industrial': 'Industrial M&A IRL',
        'pharma': 'Pharma M&A IRL',
        'custom': 'General M&A IRL'
      }
      return templates[dealType] || 'General M&A IRL'
    }
    ```
  - [ ] Display suggested template with preview
  - [ ] Add "Preview Template" collapsible section
  - [ ] Add "Change Template" dropdown (optional)
  - [ ] Change "Next" button to "Create Project" on Step 3

- [ ] **Task 5: Implement Wizard State Management** (AC: #6)
  - [ ] Use React `useState` to manage wizard state:
    ```typescript
    const [currentStep, setCurrentStep] = useState(1)
    const [formData, setFormData] = useState({
      projectName: '',
      companyName: '',
      industry: '',
      dealType: '',
      irlTemplate: ''
    })
    ```
  - [ ] Implement step navigation (next, back)
  - [ ] Preserve data when navigating between steps
  - [ ] Reset state on cancel or successful submission

- [ ] **Task 6: Implement Form Submission** (AC: #7, #8)
  - [ ] Create `lib/api/deals.ts` with `createDeal()` function:
    ```typescript
    async function createDeal(data: CreateDealInput) {
      const supabase = createClient()
      const { data: deal, error } = await supabase
        .from('deals')
        .insert({
          name: data.projectName,
          company_name: data.companyName,
          industry: data.industry,
          deal_type: data.dealType,
          irl_template: data.irlTemplate,
          status: 'active'
        })
        .select()
        .single()

      if (error) throw error
      return deal
    }
    ```
  - [ ] Call `createDeal()` on wizard submission
  - [ ] Verify RLS policy sets `user_id` automatically (via Supabase Auth)
  - [ ] Handle success: redirect to project workspace
  - [ ] Handle errors: show error toast, preserve form data

- [ ] **Task 7: Add Loading and Error States** (AC: #8)
  - [ ] Show loading spinner on "Create Project" button during submission
  - [ ] Disable all form inputs during submission
  - [ ] Display error toast on failure (use shadcn/ui Toast)
  - [ ] Allow retry on error (keep form data, re-enable submission)

- [ ] **Task 8: Implement Toast Notifications** (AC: #4, #8)
  - [ ] Install shadcn/ui Toast: `npx shadcn@latest add toast`
  - [ ] Create toast provider in root layout
  - [ ] Show success toast: "Project created successfully!"
  - [ ] Show error toast: "Failed to create project. Please try again."
  - [ ] Auto-dismiss success toast after 3 seconds

- [ ] **Task 9: Add Validation** (AC: #5)
  - [ ] Implement field-level validation:
    - Project Name: required, max 100 chars
    - Company Name: optional, max 100 chars
    - Industry: optional
    - Deal Type: required (Step 2)
  - [ ] Show validation errors inline (red text below field)
  - [ ] Disable "Next" button until step is valid
  - [ ] Test edge cases (empty strings, whitespace-only, special characters)

- [ ] **Task 10: Implement Responsive Design** (AC: #9)
  - [ ] Test wizard on desktop (1920x1080)
  - [ ] Test wizard on tablet (1024x768)
  - [ ] Test wizard on mobile (375x667)
  - [ ] Ensure project type cards stack vertically on mobile
  - [ ] Ensure form inputs are full-width on mobile
  - [ ] Test touch interactions (tap to select cards)

- [ ] **Task 11: Add Icons and Styling** (AC: #3)
  - [ ] Import icons from Lucide: `Laptop`, `Factory`, `Pill`, `Settings`
  - [ ] Style project type cards with hover effects
  - [ ] Add selected state styling (border, background color)
  - [ ] Ensure accessibility (focus indicators, ARIA labels)

- [ ] **Task 12: Testing** (AC: All)
  - [ ] Unit test: `createDeal()` function
  - [ ] Component test: Wizard navigation (next, back)
  - [ ] Component test: Form validation
  - [ ] E2E test: Complete wizard → project created
  - [ ] E2E test: Cancel wizard → no project created
  - [ ] E2E test: Validation errors prevent submission
  - [ ] E2E test: Navigate back → data preserved
  - [ ] Security test: Verify RLS sets correct user_id

- [ ] **Task 13: Documentation** (AC: All)
  - [ ] Document wizard steps and flow
  - [ ] Add screenshots to documentation
  - [ ] Document IRL template mapping logic
  - [ ] Document validation rules

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Frontend Components:**
- **shadcn/ui**: Input, Label, Select, Button, Card, Toast
- **Lucide Icons**: Project type icons (Laptop, Factory, Pill, Settings)
- **React Hook Form**: Optional for complex validation (or use plain React state)
- **Zod**: Optional for schema validation (or use manual validation)

**State Management:**
- Use React `useState` for wizard state (simple, no need for complex state management)
- Preserve state during navigation between steps
- Reset state on cancel or successful submission

### Wizard Flow

**Step 1: Basic Information**
```
Input: Project Name, Company Name, Industry
Validation: Project Name required, max 100 chars
Output: formData { projectName, companyName, industry }
```

**Step 2: Project Type**
```
Input: Select project type (Tech M&A, Industrial, Pharma, Custom)
Validation: One type must be selected
Output: formData { ...prev, dealType }
```

**Step 3: IRL Template**
```
Input: Confirm suggested IRL template (or change)
Validation: Template must be selected
Output: formData { ...prev, irlTemplate }
Action: Submit → Create deal record → Redirect to workspace
```

### IRL Template Mapping

**Template Suggestions:**
```typescript
const IRL_TEMPLATES = {
  'tech-ma': {
    name: 'Tech M&A Standard IRL',
    sections: [
      'Company Information',
      'Financial Statements (3 years)',
      'Technology Stack & IP',
      'Customer Contracts',
      'Employee Information',
      'Legal & Compliance'
    ]
  },
  'industrial': {
    name: 'Industrial M&A IRL',
    sections: [
      'Company Information',
      'Financial Statements',
      'Manufacturing Facilities',
      'Supply Chain Agreements',
      'Environmental Compliance',
      'Safety Records'
    ]
  },
  'pharma': {
    name: 'Pharma M&A IRL',
    sections: [
      'Company Information',
      'Financial Statements',
      'Clinical Trial Data',
      'Regulatory Approvals (FDA, EMA)',
      'Patents & IP',
      'R&D Pipeline'
    ]
  },
  'custom': {
    name: 'General M&A IRL',
    sections: [
      'Company Information',
      'Financial Statements',
      'Contracts & Agreements',
      'Legal & Compliance',
      'Operations',
      'Strategic Documents'
    ]
  }
}
```

### Form Validation

**Client-Side Validation:**
- Project Name: Required, 1-100 characters
- Company Name: Optional, max 100 characters
- Industry: Optional
- Deal Type: Required (selected in Step 2)
- IRL Template: Required (auto-suggested, can be changed)

**Server-Side Validation:**
- Supabase schema enforces NOT NULL constraints
- Database rejects invalid data (fallback safety)

### Database Schema (from E1.3)

**Deals Table:**
```sql
CREATE TABLE deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL,
    company_name text,
    industry text,
    deal_type text,
    status text DEFAULT 'active',
    irl_template text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

**RLS Policy:**
- `user_id` is automatically set to `auth.uid()` by RLS policy
- Application code does NOT need to manually set `user_id`
- Supabase Auth context handles this automatically

### Non-Functional Requirements

**Performance (NFR-PERF-001):**
- Wizard should feel instant (no lag between steps)
- Project creation should complete within 2 seconds
- Database insert typically <200ms (NFR-PERF-003)

**User Experience:**
- Clear progress indication (Step X of 3)
- Validation errors shown inline (not blocking popups)
- Success feedback (toast notification)
- Easy navigation (Back button preserves data)

**Accessibility:**
- Keyboard navigation (Tab through fields, Enter to submit)
- Screen reader support (ARIA labels, live regions for validation errors)
- Focus management (focus first field on each step)

### Testing Strategy

**Unit Tests:**
- Test `createDeal()` function with valid data
- Test validation logic for each field

**Component Tests:**
- Render Step 1 → enter data → click Next → verify Step 2 loads
- Render Step 2 → select type → click Back → verify data preserved
- Test validation errors display correctly

**E2E Tests (Playwright):**
- Complete wizard → verify project appears in Projects Overview
- Cancel wizard → verify no project created
- Invalid data → verify validation errors prevent submission
- Navigate back → verify data preserved
- Submit → verify redirect to project workspace

**Security Tests:**
- Verify RLS sets correct `user_id`
- Verify User A cannot create deals as User B

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Workflows-and-Sequencing]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Project-Creation-Flow]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-1-Project-Creation-and-Management]
- [Source: docs/epics.md#Epic-1-Story-E1.5]

**Official Documentation:**
- [Next.js Forms](https://nextjs.org/docs/app/building-your-application/data-fetching/forms-and-mutations)
- [shadcn/ui Form](https://ui.shadcn.com/docs/components/form)
- [Supabase Insert](https://supabase.com/docs/reference/javascript/insert)

### Security Considerations

**Row-Level Security:**
- RLS policy automatically sets `user_id` on INSERT
- No risk of user creating deals for other users
- Database enforces isolation

**Input Sanitization:**
- Supabase parameterized queries prevent SQL injection
- Validate input lengths client-side
- Trust RLS for authorization enforcement

### Prerequisites

- **E1.1** (Next.js 15 Setup) must be completed
- **E1.2** (Supabase Auth) must be completed
- **E1.3** (PostgreSQL Schema) must be completed
- **E1.4** (Projects Overview) must be completed (navigation source)

### Dependencies

- **E1.6** (Project Workspace) is the navigation target after creation
- **Epic 2** (Data Room) will use the IRL template for folder generation

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-5-implement-project-creation-wizard.context.xml)

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent during implementation_

### Completion Notes List

_To be filled by dev agent after completion_

### File List

_To be filled by dev agent with created/modified/deleted files_

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-24 | Max (SM Agent) | Initial story draft created from Epic 1 tech spec |
