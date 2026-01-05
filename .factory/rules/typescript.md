# TypeScript & React Conventions

## General

- Use `interface` for object shapes and `type` for unions/intersections/primitives
- Avoid `any` - use `unknown` with type guards when type is unknown
- Avoid `as` assertions - prefer proper type guards or `zod` validation
- Export types alongside their implementations
- Use `const` assertions for readonly arrays/objects

## React Components

- Use functional components with TypeScript
- Props interfaces should be named `{ComponentName}Props`
- Use `React.ReactNode` for children, not `React.ReactChild`
- Default to Server Components, use `"use client"` only when needed
- Use `React.Suspense` for async component boundaries
- Avoid `useEffect` for initialization - use Server Components

## React Hooks

- Custom hooks start with `use` prefix
- Dependencies in `useEffect`, `useMemo`, `useCallback` must be exhaustive
- Return stable references from custom hooks
- Use `useCallback` for props passed to memoized child components

## Imports

- Group imports:
  1. React/Next.js built-ins
  2. External libraries
  3. Internal modules (from `@/` prefix)
  4. Types (if needed)
- Use absolute imports from `@/` prefix for internal modules
- Avoid barrel files (index.ts re-exports) for performance
- Order: React imports first, then external libraries, then internal modules

## Next.js Specific

- Use `app/` directory for new features (App Router)
- Use Server Actions for mutations
- Use `revalidatePath` and `revalidateTag` for cache invalidation
- Use `notFound()` for 404s, not `redirect('/404')`

## Type Safety

- Enable `strict: true` in tsconfig.json
- Use `noUncheckedIndexedAccess: true` if practical
- Prefer discriminated unions for exhaustive logic
- Use `zod` or analogous libraries for runtime validation
- Type API responses with proper interfaces

## Error Handling

- Use `error.tsx` for error boundaries
- Use Error instances, not strings for errors
- Log errors with structured logging
- Provide user-friendly error messages
