# Frontend Context (manda-app)

This file provides context for working on the Next.js frontend.

## Architecture

- **Framework**: Next.js 16 with App Router, React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui in `components/ui/`
- **State**: Zustand (client), React Query (server)
- **Auth**: Supabase Auth

## Directory Structure

```
app/                    # App Router pages and API routes
  api/                  # API routes
  (authenticated)/      # Protected pages
components/             # React components
  ui/                   # shadcn/ui components
  cim-builder/          # CIM Builder UI
lib/                    # Shared utilities
  agent/                # Agent system (see lib/agent/CLAUDE.md)
  supabase/             # Supabase client helpers
  hooks/                # React hooks
```

## Key Patterns

### Server Components

Server Components are the default. Add `"use client"` only for interactivity.

```typescript
// Server component (default) - can access DB directly
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('deals').select()
  return <DealList deals={data} />
}
```

### Client Components

```typescript
"use client"
import { useQuery } from '@tanstack/react-query'

export function InteractiveComponent() {
  // Client-side data fetching
}
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

Components are installed to `components/ui/`. Customize after adding.

### Supabase Auth

```typescript
// Server component
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
}

// Client component
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

## Testing

```bash
npm run test:run              # Vitest unit tests
npm run test:integration      # Integration tests (RUN_INTEGRATION_TESTS=true)
npm run test:e2e              # Playwright E2E tests
npm run test:e2e:ui           # Playwright with UI
```

- Unit tests mock external services (Supabase, OpenAI, etc.)
- E2E tests run against dev server

## Multi-Tenant Isolation

All database queries must include `project_id` in WHERE clauses. RLS policies enforce this at the database level.

## Documentation

- **Testing Guide**: `docs/testing/testing-guide.md`
- **Agent Development**: `lib/agent/CLAUDE.md`
- **Feature Docs**: `docs/features/`
