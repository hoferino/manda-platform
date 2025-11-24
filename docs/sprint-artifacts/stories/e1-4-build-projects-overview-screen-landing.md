# Story 1.4: Build Projects Overview Screen (Landing)

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **a Projects Overview screen showing all my projects in card and table views**,
so that **I can quickly see my active projects, their status, and navigate to specific projects**.

## Context

This story creates the landing screen that authenticated users see after logging in. It displays all projects (deals) owned by the user in two view modes: card grid (default) and table view. Each project shows key metadata (name, company, status, progress, last activity). The screen includes filtering, sorting, and a prominent "+ New Project" button that will open the project creation wizard (E1.5).

**User Experience:** This is the primary navigation hub for the platform. Users should immediately see their project portfolio and quickly identify which projects need attention.

## Acceptance Criteria

### AC1: Projects Overview Page Route
**Given** I am an authenticated user
**When** I navigate to `/projects`
**Then** I see the Projects Overview screen
**And** The page title shows "Projects"
**And** I see a "+ New Project" button in the top-right corner
**And** I see view toggle buttons (Card/Table)

### AC2: Card Grid View (Default)
**Given** I am on the Projects Overview screen
**When** the page loads
**Then** I see my projects displayed as cards in a responsive grid
**And** Each card shows:
  - Project name
  - Company name
  - Deal type (Tech M&A, Industrial, Pharma, Custom)
  - Status badge (Active, On-Hold, Archived)
  - Progress indicator (0-100%)
  - Last activity timestamp (e.g., "2 hours ago")
**And** Cards are sorted by last activity (most recent first)
**And** Cards have hover effects indicating clickability

### AC3: Table View
**Given** I am on the Projects Overview screen
**When** I click the "Table" view toggle
**Then** I see my projects displayed in a table format
**And** Table columns show:
  - Project Name
  - Company
  - Industry
  - Deal Type
  - Status
  - Progress
  - Last Activity
  - Actions (kebab menu with View/Archive options)
**And** Table is sortable by clicking column headers
**And** Table rows highlight on hover

### AC4: Empty State
**Given** I am a new user with no projects
**When** I navigate to `/projects`
**Then** I see an empty state illustration
**And** I see text: "No projects yet. Create your first project to get started."
**And** I see a prominent "+ Create Project" button
**And** The empty state is centered and visually appealing

### AC5: Project Filtering
**Given** I have multiple projects with different statuses
**When** I select a filter (All, Active, On-Hold, Archived)
**Then** the project list updates to show only matching projects
**And** The active filter is highlighted
**And** The filter count shows number of projects (e.g., "Active (3)")

### AC6: Project Search
**Given** I have multiple projects
**When** I type in the search box
**Then** projects are filtered by name or company name (case-insensitive)
**And** Search results update in real-time as I type
**And** I see "No results found" if no matches

### AC7: Project Navigation
**Given** I am viewing a project card or table row
**When** I click on the project
**Then** I am navigated to `/projects/[id]/dashboard`
**And** The project workspace loads (E1.6)

### AC8: Responsive Design
**Given** I am on the Projects Overview screen
**When** I view the page on different screen sizes
**Then** on desktop (1920x1080): 3-4 cards per row
**And** on tablet (1024x768): 2 cards per row
**And** on mobile (375x667): 1 card per row, stacked
**And** Table view switches to mobile-friendly cards on small screens
**And** All elements remain accessible and readable

### AC9: Loading and Error States
**Given** I navigate to `/projects`
**When** projects are loading from the database
**Then** I see skeleton loaders (card or table skeletons)
**And** Loading completes within 1 second (NFR-PERF-001)
**When** there is a database error
**Then** I see an error message: "Failed to load projects. Please try again."
**And** I see a "Retry" button

### AC10: Real-Time Updates (Future Enhancement)
**Given** I have the Projects Overview open
**When** another user updates a shared project (Phase 2 feature)
**Then** the project list updates automatically (via Supabase Realtime)
**Note:** This AC is preparatory for Phase 2; not implemented in MVP

## Tasks / Subtasks

- [ ] **Task 1: Create Projects Overview Page** (AC: #1)
  - [ ] Create `app/projects/page.tsx` route
  - [ ] Set up Server Component for data fetching
  - [ ] Add page metadata (title: "Projects - Manda")
  - [ ] Implement authentication check (redirect to /login if unauthenticated)
  - [ ] Create page layout with header and view toggle

- [ ] **Task 2: Implement Data Fetching** (AC: #1, #9)
  - [ ] Create `lib/api/deals.ts` with `getDeals()` function
  - [ ] Implement Supabase query:
    ```typescript
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('updated_at', { ascending: false })
    ```
  - [ ] Add TypeScript types for Deal model
  - [ ] Implement error handling and loading states
  - [ ] Test RLS enforcement (user only sees their own deals)

- [ ] **Task 3: Create Card Grid View Component** (AC: #2, #8)
  - [ ] Create `components/projects/ProjectCard.tsx`
  - [ ] Implement card layout with shadcn/ui Card component
  - [ ] Display project metadata (name, company, status, etc.)
  - [ ] Add status badge using shadcn/ui Badge component
  - [ ] Implement progress indicator (0-100%)
  - [ ] Format last activity timestamp (use `date-fns` library)
  - [ ] Add hover effects (scale, shadow)
  - [ ] Make card clickable (navigate to project workspace)
  - [ ] Implement responsive grid layout (CSS Grid or Tailwind grid classes)

- [ ] **Task 4: Create Table View Component** (AC: #3, #8)
  - [ ] Create `components/projects/ProjectTable.tsx`
  - [ ] Use shadcn/ui Table component
  - [ ] Implement sortable columns (click header to sort)
  - [ ] Add actions kebab menu (shadcn/ui DropdownMenu)
  - [ ] Implement row hover highlighting
  - [ ] Make rows clickable (navigate to project workspace)
  - [ ] Add responsive behavior (switch to card view on mobile)

- [ ] **Task 5: Implement View Toggle** (AC: #1, #2, #3)
  - [ ] Create `components/projects/ViewToggle.tsx`
  - [ ] Use shadcn/ui Tabs or ToggleGroup component
  - [ ] Store view preference in localStorage
  - [ ] Restore view preference on page load
  - [ ] Toggle between ProjectCard grid and ProjectTable

- [ ] **Task 6: Create Empty State** (AC: #4)
  - [ ] Create `components/projects/EmptyState.tsx`
  - [ ] Add illustration (use Undraw or similar)
  - [ ] Add descriptive text and "+ Create Project" button
  - [ ] Center empty state vertically and horizontally
  - [ ] Test with new user account (0 projects)

- [ ] **Task 7: Implement Filtering** (AC: #5)
  - [ ] Create `components/projects/ProjectFilters.tsx`
  - [ ] Add filter buttons: All, Active, On-Hold, Archived
  - [ ] Implement client-side filtering logic
  - [ ] Highlight active filter
  - [ ] Display count per filter (e.g., "Active (3)")
  - [ ] Update URL query params for shareable filtered views

- [ ] **Task 8: Implement Search** (AC: #6)
  - [ ] Create search input using shadcn/ui Input component
  - [ ] Implement debounced search (300ms delay)
  - [ ] Filter projects by name or company name (case-insensitive)
  - [ ] Show "No results found" message if no matches
  - [ ] Add clear search button (X icon)

- [ ] **Task 9: Add Loading Skeletons** (AC: #9)
  - [ ] Create `components/projects/ProjectCardSkeleton.tsx`
  - [ ] Create `components/projects/ProjectTableSkeleton.tsx`
  - [ ] Use shadcn/ui Skeleton component
  - [ ] Show skeletons while data is loading
  - [ ] Match skeleton layout to actual card/table layout

- [ ] **Task 10: Implement Error Handling** (AC: #9)
  - [ ] Create error state component
  - [ ] Display user-friendly error message
  - [ ] Add "Retry" button to refetch data
  - [ ] Log errors to console (production: use error tracking service)
  - [ ] Test error scenarios (disconnect internet, simulate query failure)

- [ ] **Task 11: Add "+ New Project" Button** (AC: #1)
  - [ ] Add button to page header using shadcn/ui Button
  - [ ] Link to project creation wizard (E1.5, route: `/projects/new`)
  - [ ] Add icon (Plus icon from lucide-react)
  - [ ] Make button prominent (primary color)

- [ ] **Task 12: Implement Responsive Design** (AC: #8)
  - [ ] Test on desktop (1920x1080): 3-4 cards per row
  - [ ] Test on tablet (1024x768): 2 cards per row
  - [ ] Test on mobile (375x667): 1 card per row
  - [ ] Ensure table switches to cards on mobile (<768px)
  - [ ] Test all interactive elements (buttons, filters, search)
  - [ ] Run Lighthouse mobile audit (target: >90 performance)

- [ ] **Task 13: Add Timestamp Formatting** (AC: #2)
  - [ ] Install `date-fns`: `npm install date-fns`
  - [ ] Format last activity: "2 hours ago", "Yesterday", "3 days ago", etc.
  - [ ] Use `formatDistanceToNow()` from date-fns
  - [ ] Add tooltip showing exact timestamp on hover

- [ ] **Task 14: Testing** (AC: All)
  - [ ] Unit test: `getDeals()` function
  - [ ] Component test: ProjectCard renders correctly
  - [ ] Component test: ProjectTable renders correctly
  - [ ] E2E test: User creates project → sees it in overview
  - [ ] E2E test: Filter projects by status
  - [ ] E2E test: Search projects by name
  - [ ] E2E test: Toggle between card and table views
  - [ ] E2E test: Click project → navigate to workspace
  - [ ] Security test: User A cannot see User B's projects

- [ ] **Task 15: Documentation** (AC: All)
  - [ ] Document component props and types
  - [ ] Add README section for Projects Overview page
  - [ ] Document view preference localStorage key
  - [ ] Add screenshots to documentation

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Frontend Components:**
- **shadcn/ui**: Card, Badge, Button, Input, Table, Skeleton, DropdownMenu
  - Docs: [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- **Tailwind CSS 4**: Grid layout, responsive utilities
- **date-fns**: Timestamp formatting
  - Docs: [date-fns](https://date-fns.org/)
- **lucide-react**: Icons (Plus, Search, Grid, Table, etc.)
  - Docs: [lucide-react Icons](https://lucide.dev/)

**Data Fetching:**
- **Supabase Client**: Server-side data fetching in Server Components
- **TanStack Query (React Query)**: Client-side caching (optional, for real-time updates)

### Component Structure

```
app/projects/
└── page.tsx                    # Server Component (data fetching)
    ├── ProjectsHeader.tsx      # Title, "+ New Project" button, view toggle
    ├── ProjectFilters.tsx      # Filter buttons (All, Active, etc.)
    ├── ProjectSearch.tsx       # Search input
    ├── ProjectCard.tsx         # Card view item
    ├── ProjectTable.tsx        # Table view
    ├── EmptyState.tsx          # No projects state
    ├── ProjectCardSkeleton.tsx # Loading skeleton
    └── ProjectTableSkeleton.tsx
```

### Data Fetching Pattern

**Server Component (Recommended for Initial Load):**
```typescript
// app/projects/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function ProjectsPage() {
  const supabase = createClient()

  const { data: deals, error } = await supabase
    .from('deals')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return <ErrorState error={error} />
  if (!deals || deals.length === 0) return <EmptyState />

  return <ProjectsView deals={deals} />
}
```

**Client-Side Filtering/Search:**
- Use `useState` to manage filtered/searched projects
- Filter runs on client-side (no additional database queries)
- Fast, real-time updates as user types

### UI/UX Design

**Card View:**
- Clean, visual cards with subtle shadows
- Status badge color-coded (Active: green, On-Hold: yellow, Archived: gray)
- Progress bar or circular progress indicator
- Hover effect: slight elevation, pointer cursor

**Table View:**
- Compact, data-dense layout
- Sortable columns (click header to toggle ascending/descending)
- Row hover highlighting
- Actions menu (kebab icon) for additional options

**Empty State:**
- Friendly illustration (e.g., empty folder, rocket)
- Clear call-to-action: "+ Create Your First Project"
- Centered layout with padding

### Performance Optimizations

**Initial Load (NFR-PERF-001):**
- Server-side data fetching for fast initial render
- Target: Page loads within 1 second
- Optimize image sizes (if using illustrations)

**Skeleton Loaders:**
- Show skeletons immediately while data loads
- Prevents layout shift
- Matches actual card/table layout

**Lazy Loading (Future):**
- Implement pagination if user has 50+ projects
- Virtual scrolling for large datasets

### Responsive Breakpoints

**Tailwind Breakpoints:**
- `sm`: 640px (mobile landscape)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (large desktop)
- `2xl`: 1536px (extra large)

**Grid Layout:**
```css
/* Responsive grid */
grid-cols-1        /* Mobile: 1 column */
md:grid-cols-2     /* Tablet: 2 columns */
lg:grid-cols-3     /* Desktop: 3 columns */
xl:grid-cols-4     /* Large: 4 columns */
```

### Filtering Logic

**Filter States:**
- All: Show all projects
- Active: `status === 'active'`
- On-Hold: `status === 'on-hold'`
- Archived: `status === 'archived'`

**Implementation:**
```typescript
const [filter, setFilter] = useState<'all' | 'active' | 'on-hold' | 'archived'>('all')

const filteredDeals = deals.filter(deal =>
  filter === 'all' ? true : deal.status === filter
)
```

### Search Implementation

**Debounced Search:**
```typescript
import { useDebouncedValue } from '@/hooks/use-debounced-value'

const [searchQuery, setSearchQuery] = useState('')
const debouncedQuery = useDebouncedValue(searchQuery, 300)

const searchedDeals = filteredDeals.filter(deal =>
  deal.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
  deal.company_name?.toLowerCase().includes(debouncedQuery.toLowerCase())
)
```

### Non-Functional Requirements

**Performance (NFR-PERF-001):**
- Deal list view loads within 1 second (typical: 10-50 deals per user)
- Client-side navigation under 200ms
- Supabase REST API responses under 500ms

**Accessibility:**
- Keyboard navigation (Tab through cards/rows)
- Screen reader support (ARIA labels)
- Color contrast meets WCAG AA standards
- Focus indicators on interactive elements

**Responsive (NFR-PERF-001):**
- Tested on desktop (1920x1080) and tablet (1024x768)
- Mobile-friendly (375x667 minimum)
- Touch-friendly tap targets (min 44x44px)

### Testing Strategy

**Unit Tests:**
- Test `getDeals()` function
- Test filtering logic
- Test search logic

**Component Tests:**
- Render ProjectCard with mock data
- Render ProjectTable with mock data
- Test empty state renders
- Test skeleton loaders render

**E2E Tests (Playwright):**
- User logs in → sees Projects Overview
- User creates project → project appears in list
- User filters by status → list updates
- User searches by name → list updates
- User clicks project → navigates to workspace
- User toggles view → switches between card and table

**Security Tests:**
- Verify RLS: User A cannot see User B's projects
- Verify unauthenticated users redirected to /login

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Frontend-Components]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Projects-Overview-UI]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-1-Project-Creation-and-Management]
- [Source: docs/epics.md#Epic-1-Story-E1.4]

**Official Documentation:**
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Supabase Client](https://supabase.com/docs/reference/javascript/select)
- [shadcn/ui Card](https://ui.shadcn.com/docs/components/card)
- [date-fns formatDistanceToNow](https://date-fns.org/docs/formatDistanceToNow)

### Security Considerations

**Row-Level Security:**
- RLS policies (E1.3) enforce that users only see their own deals
- No additional security logic needed in application code
- Database-level enforcement

**Authentication:**
- Middleware (E1.2) redirects unauthenticated users to /login
- Server Component verifies auth before fetching data

### Prerequisites

- **E1.1** (Next.js 15 Setup) must be completed
- **E1.2** (Supabase Auth) must be completed
- **E1.3** (PostgreSQL Schema) must be completed

### Dependencies

- **E1.5** (Project Creation) creates deals that appear in this overview
- **E1.6** (Project Workspace) is the navigation target when clicking a project

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-4-build-projects-overview-screen-landing.context.xml)

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
