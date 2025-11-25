# Manda M&A Intelligence Platform

A modern web application for M&A due diligence and intelligence gathering.

## Technology Stack

- **Next.js 16** - React framework with App Router and Turbopack
- **React 19.2** - UI library with Server and Client Components
- **Tailwind CSS 4** - Utility-first CSS with OKLCH color space
- **shadcn/ui** - Accessible component library
- **TypeScript** - Type-safe JavaScript with strict mode
- **Supabase** - Authentication, PostgreSQL database, and storage

## Prerequisites

- **Node.js 20 LTS** or higher
- **npm 10+** (comes with Node.js)
- **Supabase Account** - For authentication and database

Verify your Node.js version:
```bash
node --version  # Should be v20.x.x or higher
```

## Getting Started

### Installation

```bash
# Navigate to the app directory
cd manda-app

# Install dependencies
npm install
```

### Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Fill in your Supabase credentials (from Supabase Dashboard > Settings > API):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-only
```

### Development

```bash
# Start development server with Turbopack (fast HMR)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with Turbopack on port 3000 |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

## Project Structure

```
manda-app/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with AuthProvider
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles + Tailwind + theme
│   ├── login/              # Login page with email/password & OAuth
│   ├── signup/             # Signup page with email/password & OAuth
│   ├── auth/callback/      # OAuth callback handler
│   ├── projects/           # Protected projects page
│   ├── api/health/         # Health check endpoint
│   └── test-components/    # Component integration test page
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── providers/          # React context providers
│       └── auth-provider.tsx
├── lib/
│   ├── utils.ts            # Utility functions (cn helper)
│   └── supabase/           # Supabase client utilities
│       ├── client.ts       # Browser client
│       ├── server.ts       # Server client
│       ├── middleware.ts   # Middleware client
│       └── types.ts        # Database types
├── hooks/                  # Custom React hooks
├── middleware.ts           # Auth route protection
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## Authentication

### Supported Methods

1. **Email/Password** - Traditional signup with email confirmation
2. **Magic Link** - Passwordless authentication via email
3. **Google OAuth** - Sign in with Google (requires setup)

### Authentication Flow

1. User visits `/login` or `/signup`
2. User authenticates via chosen method
3. For OAuth/Magic Link, redirected to `/auth/callback`
4. Session established, user redirected to `/projects`
5. Middleware protects routes requiring authentication

### Route Protection

Protected routes (require authentication):
- `/projects/*`
- `/dashboard/*`
- `/api/protected/*`

Public routes:
- `/` (landing page)
- `/login`
- `/signup`
- `/auth/callback`

### Using Authentication in Components

**Server Components:**
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}
```

**Client Components:**
```tsx
'use client'
import { useAuth } from '@/components/providers/auth-provider'

export function MyComponent() {
  const { user, loading, signOut } = useAuth()
  // ...
}
```

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and keys from Settings > API
3. Configure environment variables in `.env.local`
4. (Optional) Enable Google OAuth in Authentication > Providers

#### Google OAuth Setup

1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
2. Add authorized redirect URI: `https://<project-id>.supabase.co/auth/v1/callback`
3. Add Client ID and Secret in Supabase Dashboard > Authentication > Providers > Google

## API Endpoints

### Health Check

```
GET /api/health
```

Returns system health status including database connectivity and auth service status.

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-25T00:00:00.000Z",
  "checks": {
    "database": { "status": "ok", "latency": 45 },
    "auth": { "status": "ok" }
  }
}
```

## Component Usage

### Server Components (Default)

Components in the `app/` directory are Server Components by default:

```tsx
// app/page.tsx - Server Component
export default function Page() {
  return <h1>Hello from server</h1>;
}
```

### Client Components

Add `"use client"` directive for interactivity:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </Button>
  );
}
```

### shadcn/ui Components

Import from `@/components/ui/`:

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
```

### Adding More shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

Example:
```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add toast
```

## Theme Customization

The theme is configured in `app/globals.css` using CSS variables with OKLCH colors:

```css
:root {
  --primary: oklch(55% 0.15 250);
  --secondary: oklch(95% 0.02 250);
  /* ... more colors */
}

@theme inline {
  --color-primary: var(--primary);
  /* ... mapped to Tailwind */
}
```

### Available Color Variables

- `primary` / `primary-foreground`
- `secondary` / `secondary-foreground`
- `muted` / `muted-foreground`
- `accent` / `accent-foreground`
- `destructive` / `destructive-foreground`
- `card` / `card-foreground`
- `popover` / `popover-foreground`
- `border`, `input`, `ring`

### Dark Mode

Dark mode is supported via `prefers-color-scheme` media query and `.dark` class.

## TypeScript Configuration

Strict mode is enabled with additional safety options:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

## Testing the Setup

Visit [http://localhost:3000/test-components](http://localhost:3000/test-components) to verify:

- All shadcn/ui components render correctly
- Server and Client Components work together
- Tailwind CSS utilities apply styles
- OKLCH theme colors display properly
- Interactive features respond to user input

## Performance Targets

- **Dev compile**: <5 seconds initial, <100ms HMR
- **Bundle size**: <300KB gzipped initial JS
- **Lighthouse**: >90 performance score
- **Auth operations**: Login <2s, session validation <100ms

## Security

- Service role key is NEVER exposed to the client
- Environment variables prefixed with `NEXT_PUBLIC_` are client-safe
- Row-Level Security (RLS) enforced on all database tables
- JWT tokens expire after 1 hour with automatic refresh
- Protected routes enforced via middleware

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Next.js Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)

## License

Proprietary - Manda M&A Intelligence Platform
