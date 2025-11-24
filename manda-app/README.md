# Manda M&A Intelligence Platform

A modern web application for M&A due diligence and intelligence gathering.

## Technology Stack

- **Next.js 16** - React framework with App Router and Turbopack
- **React 19.2** - UI library with Server and Client Components
- **Tailwind CSS 4** - Utility-first CSS with OKLCH color space
- **shadcn/ui** - Accessible component library
- **TypeScript** - Type-safe JavaScript with strict mode

## Prerequisites

- **Node.js 20 LTS** or higher
- **npm 10+** (comes with Node.js)

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
│   ├── layout.tsx          # Root layout (Server Component)
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles + Tailwind + theme
│   └── test-components/    # Component integration test page
├── components/
│   └── ui/                 # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       └── label.tsx
├── lib/
│   └── utils.ts            # Utility functions (cn helper)
├── hooks/                  # Custom React hooks
├── styles/                 # Additional styles (optional)
├── public/                 # Static assets
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── components.json         # shadcn/ui configuration
└── package.json            # Dependencies and scripts
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

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)

## License

Proprietary - Manda M&A Intelligence Platform
