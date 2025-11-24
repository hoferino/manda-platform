# Story 1.6: Build Project Workspace Shell with Navigation

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **a project workspace with top navigation and sidebar showing all 5 main sections**,
so that **I can navigate between Dashboard, Data Room, Knowledge Explorer, Chat, and Deliverables within a project**.

## Context

This story creates the project workspace shell that users enter after clicking a project from the Projects Overview (E1.4) or after creating a new project (E1.5). The workspace provides the navigation structure for all project-specific features. It includes a top navigation bar showing the project name and a sidebar with 5 sections: Dashboard, Data Room, Knowledge Explorer, Chat, and Deliverables. In Epic 1, these sections are empty placeholders (actual functionality comes in later epics).

**User Experience:** The workspace should feel like entering a dedicated project environment with clear navigation and visual hierarchy. Users should always know which project they're in and which section they're viewing.

## Acceptance Criteria

### AC1: Project Workspace Route and Layout
**Given** I am an authenticated user with access to a project
**When** I navigate to `/projects/[id]/dashboard`
**Then** I see the project workspace layout
**And** The top navigation bar shows the project name
**And** The sidebar shows 5 navigation sections
**And** The main content area loads the Dashboard section (default)

### AC2: Top Navigation Bar
**Given** I am in the project workspace
**When** I view the top navigation
**Then** I see:
  - A "back" button or breadcrumb to return to Projects Overview
  - The project name (large, prominent)
  - The company name (if available, smaller text)
  - A project actions menu (kebab icon) with Archive/Settings options
**And** The top bar is sticky (remains visible when scrolling)
**And** The top bar has a subtle shadow or border to separate from content

### AC3: Sidebar Navigation
**Given** I am in the project workspace
**When** I view the sidebar
**Then** I see 5 navigation items in order:
  1. Dashboard (Home icon)
  2. Data Room (Folder icon)
  3. Knowledge Explorer (Brain icon)
  4. Chat (MessageSquare icon)
  5. Deliverables (FileText icon)
**And** Each item shows an icon and label
**And** The current section is highlighted (active state)
**And** Items are clickable and navigate to their respective routes

### AC4: Section Routing
**Given** I am in the project workspace
**When** I click "Data Room" in the sidebar
**Then** the URL changes to `/projects/[id]/data-room`
**And** the sidebar highlights "Data Room" as active
**And** the main content area loads the Data Room section (placeholder)
**When** I click "Knowledge Explorer"
**Then** the URL changes to `/projects/[id]/knowledge-explorer`
**And** the sidebar highlights "Knowledge Explorer" as active

### AC5: Placeholder Content for Sections
**Given** I navigate to any of the 5 sections
**When** the section loads
**Then** I see a placeholder message indicating the section is under development
**And** The placeholder includes:
  - Section name (heading)
  - Description of what the section will contain
  - "Coming soon" badge or message
  - Illustration or icon (optional)
**Examples:**
  - Dashboard: "Project overview and metrics (Coming in Epic 2)"
  - Data Room: "Document management and organization (Coming in Epic 2)"
  - Knowledge Explorer: "Semantic search and knowledge graph (Coming in Epic 3)"
  - Chat: "Conversational AI assistant (Coming in Epic 5)"
  - Deliverables: "CIM, Q&A, and IRL outputs (Coming in Epic 9)"

### AC6: Sidebar Active State
**Given** I am viewing a specific section
**When** I check the sidebar
**Then** the current section has an active state (background color, border, or icon color)
**And** Other sections have an inactive state
**When** I navigate to a different section
**Then** the active state updates immediately

### AC7: Responsive Sidebar
**Given** I am in the project workspace on different screen sizes
**When** I view the workspace on desktop (1920x1080)
**Then** the sidebar is always visible on the left (fixed width: 240px)
**When** I view on tablet (1024x768)
**Then** the sidebar is collapsible (hamburger menu icon)
**And** clicking the hamburger toggles the sidebar open/closed
**When** I view on mobile (375x667)
**Then** the sidebar is collapsed by default
**And** navigation is accessible via hamburger menu
**And** clicking a sidebar item closes the sidebar automatically (mobile only)

### AC8: Project Data Fetching and Validation
**Given** I navigate to `/projects/[id]/dashboard`
**When** the page loads
**Then** the project data is fetched from the database
**And** the project name and company name are displayed in the top nav
**When** the project ID is invalid or does not exist
**Then** I see a 404 error page: "Project not found"
**When** the project belongs to another user (RLS enforcement)
**Then** I see a 403 error page: "You don't have access to this project"

### AC9: Breadcrumb Navigation
**Given** I am in the project workspace
**When** I view the top navigation
**Then** I see a breadcrumb or back button: "← Projects" (link to `/projects`)
**When** I click the breadcrumb/back button
**Then** I am navigated to the Projects Overview
**And** I see all my projects

### AC10: Loading and Error States
**Given** I navigate to a project workspace
**When** the project data is loading
**Then** I see skeleton loaders for top nav and sidebar
**And** Loading completes within 1 second (NFR-PERF-001)
**When** there is a network error fetching project data
**Then** I see an error message: "Failed to load project. Please try again."
**And** I see a "Retry" button

## Tasks / Subtasks

- [ ] **Task 1: Create Project Workspace Layout** (AC: #1, #7)
  - [ ] Create `app/projects/[id]/layout.tsx` for project workspace layout
  - [ ] Implement layout structure: top nav + sidebar + main content area
  - [ ] Make layout responsive (desktop: fixed sidebar, mobile: collapsible)
  - [ ] Use Next.js dynamic routes: `[id]` parameter

- [ ] **Task 2: Build Top Navigation Bar** (AC: #2, #9)
  - [ ] Create `components/workspace/TopNav.tsx`
  - [ ] Display project name and company name
  - [ ] Add breadcrumb: "← Projects" (link to `/projects`)
  - [ ] Add project actions menu (shadcn/ui DropdownMenu)
  - [ ] Make top nav sticky (CSS: `position: sticky; top: 0;`)
  - [ ] Add shadow or border for visual separation

- [ ] **Task 3: Build Sidebar Navigation** (AC: #3, #6)
  - [ ] Create `components/workspace/Sidebar.tsx`
  - [ ] Define navigation items:
    ```typescript
    const NAV_ITEMS = [
      { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
      { id: 'data-room', label: 'Data Room', icon: Folder, path: '/data-room' },
      { id: 'knowledge-explorer', label: 'Knowledge Explorer', icon: Brain, path: '/knowledge-explorer' },
      { id: 'chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
      { id: 'deliverables', label: 'Deliverables', icon: FileText, path: '/deliverables' }
    ]
    ```
  - [ ] Use Lucide icons for navigation items
  - [ ] Implement active state highlighting (check current path)
  - [ ] Use Next.js `<Link>` for navigation

- [ ] **Task 4: Implement Section Routes** (AC: #4)
  - [ ] Create `app/projects/[id]/dashboard/page.tsx`
  - [ ] Create `app/projects/[id]/data-room/page.tsx`
  - [ ] Create `app/projects/[id]/knowledge-explorer/page.tsx`
  - [ ] Create `app/projects/[id]/chat/page.tsx`
  - [ ] Create `app/projects/[id]/deliverables/page.tsx`
  - [ ] Each route uses the shared layout from `app/projects/[id]/layout.tsx`

- [ ] **Task 5: Create Placeholder Content** (AC: #5)
  - [ ] Create `components/workspace/PlaceholderSection.tsx` reusable component
  - [ ] Accept props: section name, description, epic number
  - [ ] Display "Coming soon" badge
  - [ ] Add optional illustration (use Undraw or similar)
  - [ ] Use placeholder in all 5 section pages

- [ ] **Task 6: Fetch Project Data** (AC: #8, #10)
  - [ ] Create `lib/api/deals.ts` with `getDealById(id)` function:
    ```typescript
    async function getDealById(id: string) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    }
    ```
  - [ ] Call `getDealById()` in layout Server Component
  - [ ] Pass project data to client components via props or context
  - [ ] Handle errors: 404 if not found, 403 if RLS blocks access

- [ ] **Task 7: Implement Error Pages** (AC: #8)
  - [ ] Create `app/projects/[id]/not-found.tsx` for 404 errors
  - [ ] Create custom error boundary for 403 errors
  - [ ] Show user-friendly error messages
  - [ ] Add "Back to Projects" button on error pages

- [ ] **Task 8: Implement Responsive Sidebar** (AC: #7)
  - [ ] Desktop (≥1024px): Sidebar always visible, fixed width 240px
  - [ ] Tablet/Mobile (<1024px): Sidebar collapsible with hamburger icon
  - [ ] Create `components/workspace/MobileSidebarToggle.tsx`
  - [ ] Use Zustand or React Context for sidebar open/closed state
  - [ ] Auto-close sidebar on mobile when clicking a nav item
  - [ ] Add smooth open/close animation (CSS transition)

- [ ] **Task 9: Add Loading Skeletons** (AC: #10)
  - [ ] Create `components/workspace/TopNavSkeleton.tsx`
  - [ ] Create `components/workspace/SidebarSkeleton.tsx`
  - [ ] Show skeletons while project data is loading
  - [ ] Use shadcn/ui Skeleton component

- [ ] **Task 10: Active State Highlighting** (AC: #6)
  - [ ] Use Next.js `usePathname()` hook to get current path
  - [ ] Compare current path with nav item paths
  - [ ] Apply active styles (background color, border, icon color)
  - [ ] Ensure active state updates immediately on navigation

- [ ] **Task 11: Add Project Actions Menu** (AC: #2)
  - [ ] Create project actions dropdown (shadcn/ui DropdownMenu)
  - [ ] Add menu items:
    - Archive Project (placeholder action)
    - Project Settings (placeholder action)
    - Delete Project (placeholder action, with confirmation)
  - [ ] Implement placeholder handlers (show toast: "Feature coming soon")
  - [ ] Full implementation in Phase 2

- [ ] **Task 12: Implement Breadcrumb Navigation** (AC: #9)
  - [ ] Add breadcrumb to top nav: "← Projects" (link to `/projects`)
  - [ ] Use Next.js `<Link>` component
  - [ ] Style breadcrumb as subtle link (secondary color)
  - [ ] Test navigation back to Projects Overview

- [ ] **Task 13: Testing** (AC: All)
  - [ ] Unit test: `getDealById()` function
  - [ ] Component test: Sidebar renders with correct nav items
  - [ ] Component test: Active state highlights correctly
  - [ ] E2E test: Navigate from Projects Overview → Project Workspace
  - [ ] E2E test: Click sidebar items → URL and active state update
  - [ ] E2E test: Responsive sidebar toggles on mobile
  - [ ] E2E test: Breadcrumb navigates back to Projects Overview
  - [ ] Security test: User A cannot access User B's project (403 error)
  - [ ] Error test: Invalid project ID shows 404 page

- [ ] **Task 14: Styling and Polish** (AC: #2, #3)
  - [ ] Apply consistent spacing and typography
  - [ ] Ensure hover states on all interactive elements
  - [ ] Add subtle transitions for sidebar and active state changes
  - [ ] Test accessibility (keyboard navigation, focus indicators)
  - [ ] Run Lighthouse audit (target: >90 performance, >95 accessibility)

- [ ] **Task 15: Documentation** (AC: All)
  - [ ] Document workspace layout structure
  - [ ] Add screenshots of workspace and navigation
  - [ ] Document navigation items and routes
  - [ ] Document responsive behavior

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Frontend Components:**
- **shadcn/ui**: DropdownMenu, Skeleton
- **Lucide Icons**: Home, Folder, Brain, MessageSquare, FileText, Menu (hamburger)
- **Next.js Layouts**: Shared layout for all project routes
- **Zustand or React Context**: Sidebar state management (open/closed)

**Routing:**
- Next.js App Router with dynamic routes: `[id]`
- Nested routes under `/projects/[id]/`
- Shared layout for all project routes

### Workspace Layout Structure

```
app/projects/[id]/
├── layout.tsx                 # Shared layout (top nav + sidebar)
├── dashboard/page.tsx         # Dashboard section
├── data-room/page.tsx         # Data Room section
├── knowledge-explorer/page.tsx # Knowledge Explorer section
├── chat/page.tsx              # Chat section
├── deliverables/page.tsx      # Deliverables section
└── not-found.tsx              # 404 error page
```

**Layout Component Structure:**
```typescript
// app/projects/[id]/layout.tsx
export default async function ProjectLayout({ params, children }) {
  const project = await getDealById(params.id)

  if (!project) {
    notFound()  // Show 404 page
  }

  return (
    <div className="flex flex-col h-screen">
      <TopNav project={project} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentPath={pathname} projectId={params.id} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Navigation Items Configuration

```typescript
// lib/navigation.ts
import { Home, Folder, Brain, MessageSquare, FileText } from 'lucide-react'

export const WORKSPACE_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: 'dashboard',
    description: 'Project overview and metrics',
    epic: 2
  },
  {
    id: 'data-room',
    label: 'Data Room',
    icon: Folder,
    path: 'data-room',
    description: 'Document management and organization',
    epic: 2
  },
  {
    id: 'knowledge-explorer',
    label: 'Knowledge Explorer',
    icon: Brain,
    path: 'knowledge-explorer',
    description: 'Semantic search and knowledge graph',
    epic: 3
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    path: 'chat',
    description: 'Conversational AI assistant',
    epic: 5
  },
  {
    id: 'deliverables',
    label: 'Deliverables',
    icon: FileText,
    path: 'deliverables',
    description: 'CIM, Q&A, and IRL outputs',
    epic: 9
  }
]
```

### Responsive Behavior

**Breakpoints:**
- Desktop (≥1024px): Fixed sidebar (240px width)
- Tablet (<1024px): Collapsible sidebar (overlay)
- Mobile (<768px): Collapsible sidebar (full-width overlay)

**Sidebar State Management:**
```typescript
// Using Zustand for global sidebar state
import { create } from 'zustand'

interface SidebarStore {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false })
}))
```

### Active State Detection

```typescript
// components/workspace/Sidebar.tsx
'use client'

import { usePathname } from 'next/navigation'

export function Sidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname()

  const isActive = (itemPath: string) => {
    return pathname === `/projects/${projectId}/${itemPath}`
  }

  return (
    <nav>
      {WORKSPACE_NAV_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={`/projects/${projectId}/${item.path}`}
          className={cn(
            'flex items-center gap-2 p-3 rounded',
            isActive(item.path)
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

### Error Handling

**404 Not Found:**
```typescript
// app/projects/[id]/not-found.tsx
export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold">Project Not Found</h1>
      <p className="text-muted-foreground">
        The project you're looking for doesn't exist or has been deleted.
      </p>
      <Link href="/projects">
        <Button>← Back to Projects</Button>
      </Link>
    </div>
  )
}
```

**403 Forbidden (RLS):**
- Supabase returns 0 rows if RLS blocks access
- Treat as 404 (don't leak information about other users' projects)

### Non-Functional Requirements

**Performance (NFR-PERF-001):**
- Project workspace loads within 1 second
- Client-side navigation under 200ms (React Router)
- Sidebar toggle animations smooth (60 FPS)

**Accessibility:**
- Keyboard navigation (Tab through sidebar items, Enter to select)
- Screen reader support (ARIA labels, landmarks)
- Focus indicators on all interactive elements
- Skip navigation link (optional, for accessibility)

**Responsive Design:**
- Desktop: Fixed sidebar, full content width
- Tablet: Collapsible sidebar, adjusted content width
- Mobile: Full-width sidebar overlay, stacked layout

### Testing Strategy

**Unit Tests:**
- Test `getDealById()` function
- Test sidebar state management (Zustand store)

**Component Tests:**
- Render Sidebar → verify nav items render
- Render TopNav → verify project name displays
- Test active state highlighting logic

**E2E Tests (Playwright):**
- Navigate from Projects Overview → Project Workspace
- Click sidebar items → verify URL and active state update
- Test responsive sidebar toggle on mobile
- Test breadcrumb navigation
- Test error states (404, 403)

**Security Tests:**
- Verify RLS: User A cannot access User B's project
- Verify 403 error shown appropriately

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Project-Structure]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Project-Workspace-Navigation]

**Epic Specification:**
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-4-Project-Workspace-Navigation]
- [Source: docs/epics.md#Epic-1-Story-E1.6]

**Official Documentation:**
- [Next.js Layouts and Templates](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts)
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
- [Lucide Icons](https://lucide.dev/)

### Security Considerations

**Row-Level Security:**
- RLS policies (E1.3) ensure users only access their own projects
- `getDealById()` returns null if project doesn't exist or belongs to another user
- Handle as 404 (don't leak information about other users' projects)

**Authentication:**
- Middleware (E1.2) ensures user is authenticated before accessing workspace
- Project workspace is a protected route

### Prerequisites

- **E1.1** (Next.js 15 Setup) must be completed
- **E1.2** (Supabase Auth) must be completed
- **E1.3** (PostgreSQL Schema) must be completed
- **E1.4** (Projects Overview) provides navigation source
- **E1.5** (Project Creation) creates projects

### Dependencies

- **Epic 2** (Data Room) will implement Data Room section
- **Epic 3** (Knowledge Explorer) will implement Knowledge Explorer section
- **Epic 5** (Chat) will implement Chat section
- **Epic 9** (Deliverables) will implement Deliverables section

## Dev Agent Record

### Context Reference

[Story Context XML](./e1-6-build-project-workspace-shell-with-navigation.context.xml)

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
