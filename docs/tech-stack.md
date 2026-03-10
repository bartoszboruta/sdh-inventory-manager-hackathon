# Tech Stack Decision Record (V1)

## Purpose
This document defines the baseline technical stack and architectural conventions for SDH Inventory V1.
It is the source of truth for implementation decisions before task breakdown.

## Core Stack
- Framework/runtime: `create-t3-app` scaffold with Next.js App Router and TypeScript (strict mode)
- Package manager/runtime: Bun
- API layer: tRPC (T3 pattern, internal API only)
- Database: SQLite
- ORM/migrations: Drizzle ORM + Drizzle Kit
- Auth: NextAuth (Auth.js) from T3 template
- Styling/UI: Tailwind CSS + shadcn/ui
- Validation: Zod (input/output contracts)
- Testing baseline: Vitest for unit/integration, tRPC procedure tests; E2E deferred

## Architecture Decisions

### Full type safety (required)
End-to-end type-safe flow:
- Drizzle schema types ->
- tRPC server procedures (input validated by Zod) ->
- typed client hooks/components

No untyped network contracts are introduced in V1.

### API style
- Use tRPC routers and procedures as the only app API interface in V1.
- No REST endpoints unless explicitly required later.
- Routers grouped by domain:
  - `asset`
  - `employee`
  - `location`
  - `verification`
  - `auth`

### Multi-tenancy (V1)
- Single shared SQLite database.
- Every tenant-owned business table includes `companyId`.
- Every tenant-scoped query/mutation must filter by `companyId` from the authenticated session context.
- Cross-tenant reads/writes are prohibited by default.

### Auth and roles
- NextAuth session is extended with:
  - `userId`
  - `companyId`
  - `role`
- Role model:
  - `EMPLOYEE`
  - `OFFICE_MANAGER`

### UI system
- Use shadcn/ui components as local source-owned primitives in `src/components/ui/*`.
- Use Tailwind utilities and design tokens from globals/theme variables.
- Accessibility baseline:
  - semantic HTML
  - keyboard navigation
  - visible focus states
  - sufficient color contrast

## Project Layout Conventions
- Frontend:
  - `src/app/*` route segments, layouts, pages
  - `src/features/*` feature/domain UI and client logic
  - `src/components/ui/*` shared shadcn primitives
  - `src/components/*` shared app-level components (optional)
- Backend:
  - `src/server/api/routers/*` tRPC routers
  - `src/server/api/trpc.ts` middleware/procedure contracts
  - `src/server/db/schema/*` Drizzle schema modules
  - `src/server/db/index.ts` db client

## Public Interfaces and Contracts (initial)

### Role enum
```ts
export enum UserRole {
  EMPLOYEE = "EMPLOYEE",
  OFFICE_MANAGER = "OFFICE_MANAGER",
}
```

### Tenant-scoped convention
```ts
export type TenantScoped = {
  companyId: string;
};
```

### Procedure contracts
- `publicProcedure`: no auth required
- `protectedProcedure`: requires authenticated user context
- `managerProcedure`: requires `protectedProcedure` + role check `OFFICE_MANAGER`

### Shared list response pattern
Use a consistent generic shape for list endpoints:
```ts
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};
```

## Environment and Tooling Standards
- Environment variables live in `.env` / `.env.local`.
- SQLite file path configured via environment variable.
- Required scripts (final names can match T3 defaults):
  - `dev`
  - `build`
  - `start`
  - `lint`
  - `typecheck`
  - `test`
  - `db:generate`
  - `db:migrate`
  - `db:studio` (optional)

## Deferred in V1
- REST API surface
- Per-tenant database split
- Playwright E2E baseline in initial scaffold
