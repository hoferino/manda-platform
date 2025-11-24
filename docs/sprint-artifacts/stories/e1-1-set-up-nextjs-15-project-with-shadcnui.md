# Story 1.1: Set up Next.js 15 Project with shadcn/ui and Tailwind CSS 4

Status: ready-for-dev

## Story

As a **developer**,
I want **a properly configured Next.js 15 project with shadcn/ui, React 19.2, and Tailwind CSS 4**,
so that **I have a solid foundation for building the Manda M&A Intelligence Platform frontend**.

## Context

This is the foundational story for Epic 1: Project Foundation. It establishes the entire frontend stack including Next.js 15 (with Turbopack in dev mode), React 19.2, Tailwind CSS 4 (with OKLCH colors and @theme directive), and shadcn/ui component library. This story creates the project structure, configures the build system, and verifies that all technologies work together correctly.

**Note:** While the epic file references "Next.js 14", the technical specification has been updated to **Next.js 15.5** with **React 19.2** and **Tailwind CSS 4** based on the latest architecture decisions (Architecture Section - Technology Stack).

## Acceptance Criteria

### AC1: Next.js 15 Project Initialization
**Given** I have Node.js 20 LTS installed
**When** I run `npm run dev`
**Then** the Next.js dev server starts on `localhost:3000`
**And** Turbopack builds complete within 5 seconds (initial compile)
**And** I see a basic landing page rendered
**And** Hot module replacement (HMR) works when I edit files

### AC2: React 19.2 Integration
**Given** React 19.2 is installed
**When** I create a Server Component in `app/page.tsx`
**Then** the component renders without errors
**And** React DevTools shows React 19.2
**And** Server Components and Client Components interoperate correctly

### AC3: Tailwind CSS 4 Configuration
**Given** Tailwind CSS 4 is configured with @theme directive
**When** I apply Tailwind utility classes to elements
**Then** styles are applied correctly
**And** OKLCH color space is available for theming
**And** Production build purges unused CSS (<50KB gzipped)
**And** Tailwind IntelliSense works in VS Code

### AC4: shadcn/ui Component Library
**Given** shadcn/ui is installed with Tailwind 4 compatibility
**When** I import and use Button, Input, Card, Badge, and Label components
**Then** all components render with proper styling
**And** Components use data-slot attributes for customization
**And** Components follow shadcn/ui design patterns
**And** Theme customization via @theme directive works

### AC5: TypeScript Strict Mode
**Given** TypeScript is configured with strict mode enabled
**When** I introduce a type error in code
**Then** the build fails with a clear error message
**And** VS Code highlights the error inline
**And** All config files use TypeScript (next.config.ts, tailwind.config.ts)

### AC6: Project Structure
**Given** the project is initialized
**When** I inspect the folder structure
**Then** I see the following directories:
- `app/` - Next.js 15 App Router pages and layouts
- `components/` - Reusable React components
- `components/ui/` - shadcn/ui components
- `lib/` - Utility functions and helpers
- `hooks/` - Custom React hooks
- `styles/` - Global CSS and Tailwind imports
- `public/` - Static assets

**And** the structure matches the documented architecture (Architecture Section - Project Structure)

### AC7: Development Experience
**Given** the project is set up
**When** I run `npm run dev`
**Then** Turbopack compiles changes in <100ms
**And** Console shows no errors or warnings
**And** Browser devtools show no console errors
**And** TypeScript errors are displayed clearly in terminal

### AC8: Build and Type Checking
**Given** the project has no errors
**When** I run `npm run build`
**Then** the production build completes successfully
**And** Static pages are pre-rendered
**And** Bundle size is reasonable (<300KB initial JS gzipped)
**When** I run `npm run type-check`
**Then** TypeScript compilation succeeds with no errors

## Tasks / Subtasks

- [ ] **Task 1: Initialize Next.js 15 Project** (AC: #1, #2, #5)
  - [ ] Run `npx create-next-app@latest manda-platform --typescript --tailwind --app --turbopack --use-npm`
  - [ ] Verify Next.js 15.5+ and React 19.2+ are installed
  - [ ] Configure `next.config.ts` for Turbopack and optimization settings
  - [ ] Test dev server starts and renders default page
  - [ ] Verify HMR works by editing `app/page.tsx`

- [ ] **Task 2: Configure TypeScript Strict Mode** (AC: #5)
  - [ ] Update `tsconfig.json` with strict mode settings:
    ```json
    {
      "compilerOptions": {
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitOverride": true
      }
    }
    ```
  - [ ] Add `tsc --noEmit` as `npm run type-check` script
  - [ ] Verify type errors are caught

- [ ] **Task 3: Upgrade to Tailwind CSS 4 and Configure Theme** (AC: #3)
  - [ ] Install Tailwind CSS 4: `npm install tailwindcss@next @tailwindcss/postcss@next`
  - [ ] Update `tailwind.config.ts` to use @theme directive with OKLCH colors
  - [ ] Configure content paths: `./app/**/*.{js,ts,jsx,tsx}`, `./components/**/*.{js,ts,jsx,tsx}`
  - [ ] Import Tailwind in `app/globals.css`: `@import "tailwindcss";`
  - [ ] Test utility classes render correctly
  - [ ] Verify production build purges unused CSS

- [ ] **Task 4: Install and Configure shadcn/ui for Tailwind 4** (AC: #4)
  - [ ] Run `npx shadcn@latest init` and select Tailwind 4 compatibility mode
  - [ ] Configure `components.json` with:
    - Style: "new-york"
    - Base color: "neutral"
    - CSS variables: true
  - [ ] Install base components: `npx shadcn@latest add button input card badge label`
  - [ ] Verify components use data-slot attributes
  - [ ] Test components render with Tailwind 4 styling
  - [ ] Update theme in `app/globals.css` using @theme directive

- [ ] **Task 5: Create Project Structure** (AC: #6)
  - [ ] Create `components/` directory for custom components
  - [ ] Verify `components/ui/` exists (created by shadcn/ui)
  - [ ] Create `lib/` directory with `utils.ts` (cn helper for shadcn/ui)
  - [ ] Create `hooks/` directory for custom React hooks
  - [ ] Create `styles/` directory (optional, if additional global styles needed)
  - [ ] Verify `public/` directory exists for static assets
  - [ ] Document folder structure in project README

- [ ] **Task 6: Create Test Page to Verify Integration** (AC: #1-4, #7)
  - [ ] Create `app/test-components/page.tsx` with:
    - Server Component wrapper
    - Client Component section demonstrating React 19.2 features
    - All 5 shadcn/ui components (Button, Input, Card, Badge, Label)
    - Tailwind utility classes (flex, grid, colors, spacing)
    - OKLCH theme colors demonstration
  - [ ] Verify page renders without errors
  - [ ] Test interactive components (Button onClick, Input onChange)
  - [ ] Verify styling matches shadcn/ui design system

- [ ] **Task 7: Production Build and Optimization** (AC: #8)
  - [ ] Run `npm run build` and verify no errors
  - [ ] Check bundle sizes: `npm run build | grep "Route (app)"`
  - [ ] Verify initial bundle <300KB gzipped
  - [ ] Test production server: `npm run start`
  - [ ] Verify static generation works for test page
  - [ ] Run Lighthouse audit (target: >90 performance score)

- [ ] **Task 8: Documentation** (AC: All)
  - [ ] Create `README.md` with setup instructions
  - [ ] Document required Node.js version (20 LTS)
  - [ ] Add scripts documentation (dev, build, start, type-check, lint)
  - [ ] Document folder structure and conventions
  - [ ] Add `.env.example` file (placeholder for future environment variables)
  - [ ] Document shadcn/ui usage and theme customization

## Dev Notes

### Technology Stack (Epic 1 Tech Spec)

**Frontend Framework:**
- **Next.js 15.5**: Server-side rendering, App Router, Turbopack dev builds
  - Docs: [Next.js 15 Documentation](https://nextjs.org/docs)
  - New Features: React 19 support, Turbopack stable in dev, Server Actions
- **React 19.2**: Component-based UI, Server Components, improved hooks
  - Docs: [React 19 Changelog](https://react.dev/blog/2024/12/05/react-19)
- **Tailwind CSS 4**: Utility-first CSS with OKLCH colors and @theme directive
  - Docs: [Tailwind v4 Documentation](https://tailwindcss.com/docs)
  - Migration: [Tailwind 4 Upgrade Guide](https://tailwindcss.com/docs/v4-beta)
- **shadcn/ui**: Accessible, customizable UI components
  - Docs: [shadcn/ui Tailwind v4 Guide](https://ui.shadchn.com/docs/tailwind-v4)
  - Integration: On-demand imports, theme directive for customization

### Project Structure Alignment

```
manda-platform/
├── app/                      # Next.js 15 App Router
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page
│   ├── globals.css          # Tailwind imports + @theme
│   ├── test-components/     # Component testing page
│   └── (future routes)      # /login, /projects, etc.
├── components/
│   ├── ui/                  # shadcn/ui components (auto-generated)
│   └── (custom components)  # Project-specific components
├── lib/
│   ├── utils.ts             # cn() helper for shadcn/ui
│   └── (future utilities)   # Supabase client, etc.
├── hooks/                   # Custom React hooks
├── public/                  # Static assets
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind 4 configuration
├── tsconfig.json            # TypeScript configuration
├── components.json          # shadcn/ui configuration
└── package.json             # Dependencies and scripts
```

### Architectural Patterns

**App Router Best Practices:**
- Use Server Components by default (performance optimization)
- Add `'use client'` directive only when needed (interactivity, hooks, browser APIs)
- Leverage Server Actions for form submissions (future stories)
- Use route-level code splitting for lazy loading

**Component Organization:**
- `components/ui/` - shadcn/ui components (don't modify directly)
- `components/` - Custom, reusable components
- Colocate components with routes when specific to a page

**Styling Strategy:**
- Tailwind utility classes for layout and spacing
- shadcn/ui components for consistent UI patterns
- Theme customization via `@theme` directive in `globals.css`
- OKLCH color space for accessible, perceptually uniform colors

### Performance Targets (NFR-PERF-004)

- **Initial Bundle**: <300KB gzipped (tree-shaking enabled)
- **Dev Compile**: <5 seconds initial, <100ms hot reload (Turbopack)
- **Production Build**: <2 minutes for full build
- **Lighthouse Score**: >90 performance, >95 accessibility

### Known Compatibility Issues

**None identified.** Next.js 15, React 19.2, and Tailwind CSS 4 are stable versions released in Q4 2024/Q1 2025. shadcn/ui has been updated for Tailwind 4 compatibility.

**Version Compatibility Matrix** (Tech Spec - Dependencies):
- Node.js 20+ LTS (required for Next.js 15)
- npm 10+
- React 19.2 (required by Next.js 15)
- Next.js 15.5+
- Tailwind CSS 4.x
- shadcn/ui latest (Tailwind 4 compatible)

### Testing Strategy

**Unit Tests:**
- Test utility functions in `lib/utils.ts`
- Test custom hooks (when created)

**Component Tests:**
- Verify shadcn/ui components render correctly
- Test interactive components (Button onClick, Input onChange)
- Snapshot tests for UI consistency

**Build Tests:**
- Verify production build succeeds
- Check bundle sizes meet targets
- Test type checking passes

**Manual QA:**
- Dev server starts without errors
- Hot reload works
- Tailwind utilities apply correctly
- shadcn/ui theme customization works
- No console errors in browser

### References

**Architecture:**
- [Source: docs/manda-architecture.md#Technology-Stack]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#Frontend-Framework]

**Epic Specification:**
- [Source: docs/epics.md#Epic-1-Story-E1.1]
- [Source: docs/sprint-artifacts/tech-spec-epic-1.md#AC-8-Docker-Compose-Dev-Environment]

**Official Documentation:**
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [React 19 Changelog](https://react.dev/blog/2024/12/05/react-19)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)

### Security Considerations

**None for this story.** This is frontend infrastructure setup only. Security considerations will be addressed in Story E1.2 (Supabase Auth) and E1.3 (RLS Policies).

### Prerequisites

**None.** This is the first story in Epic 1, establishing the foundation for all subsequent work.

### Dependencies (for future stories)

- **E1.2** (Configure Supabase Auth) depends on this story completing
- **E1.4** (Projects Overview UI) depends on this story for component library
- **All Epic 1 stories** depend on this foundation

## Dev Agent Record

### Context Reference

- [e1-1-set-up-nextjs-15-project-with-shadcnui.context.xml](e1-1-set-up-nextjs-15-project-with-shadcnui.context.xml)

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
| 2025-11-24 | Max (SM Agent) | Initial story draft created from Epic 1 and tech spec |
