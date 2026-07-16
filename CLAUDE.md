# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev          # Start dev server (localhost:3000)
yarn build        # Production build
yarn lint         # ESLint (src/)
yarn typecheck    # TypeScript check (tsc --noEmit)
yarn test         # Run all tests (Vitest)
npx vitest run src/path/to/file.test.ts  # Run a single test file
```

## Architecture

**Cycles** is a Shape Up project management tool built on Next.js 16 (App Router), React 19, and TypeScript.

### Data Model

There is no traditional database — **Liveblocks** is the primary data layer, providing real-time collaborative storage per room.

- **Cycles** → Liveblocks rooms (ID pattern: `{orgId}:cycle:{slug}`)
- **Pitches** → Top-level initiatives within a cycle
- **Scopes** → Work items under a pitch (with tier, hill progress, color)
- **Tasks** → Individual items under a scope (done: boolean)
- **Updates** → Point-in-time needle snapshots with narrative

Types are defined in `src/cycle-liveblocks.config.ts`. Hooks are in `src/cycle-room-context.ts` — use `useCycleStorage()`, `useCycleMutation()`, etc.

### Auth

Clerk v6 handles authentication. Middleware is in `src/middleware.ts`. Routes are scoped by `[slug]` which is either an org slug or `me` for personal workspaces. Server-side auth: `const { userId, orgId, orgSlug } = await auth()`.

### Routing

- `/` → redirects to `/{slug}/cycles`
- `/[slug]/cycles` → cycle listing
- `/[slug]/cycles/[cycleSlug]` → Mission Control (all pitches in a cycle)
- `/[slug]/cycles/[cycleSlug]/[pitchSlug]` → Scope Map (single pitch detail)
- `/api/liveblocks-auth` → Liveblocks auth endpoint

### Key Directories

- `src/app/[slug]/cycles/` — Cycle pages, server actions, Mission Control & Scope Map
- `src/components/` — Shared components (needle, hill-chart, scope-card, move-needle, etc.)
- `src/components/ui/` — shadcn/ui components (Radix + Tailwind)
- `src/lib/` — Pure-function engines (needle, hill, timebox, update, slack-message) and utilities
- `src/cycle-liveblocks.config.ts` — Cycle storage types
- `src/cycle-room-context.ts` — Liveblocks client setup, room hooks

### State Management

Real-time state lives in Liveblocks (accessed via hooks from `src/cycle-room-context.ts`). Org user data is provided via `OrganizationUsersProvider` React context. Themes via `next-themes`.

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Auth:** Clerk v6 (`@clerk/nextjs`)
- **Real-time:** Liveblocks (`@liveblocks/client`, `@liveblocks/react`, `@liveblocks/node`)
- **UI:** shadcn/ui, Radix UI, Tailwind CSS, lucide-react icons
- **Drag & Drop:** @dnd-kit
- **Testing:** Vitest, @testing-library/react, jsdom
- **Package Manager:** Yarn (not npm/pnpm/bun)

## Conventions

- Path alias: `@/*` maps to `./src/*`
- IDs generated with `nanoid`
- Slug validation: `/^[a-zA-Z0-9_-]+$/` (no slashes, dots, or encoded characters — prevents open redirects)
- Room IDs: `{orgPrefix}:cycle:{slug}` where orgPrefix is orgId or userId
- CSS theming via HSL CSS variables; dark mode via class strategy
- **No prop drilling for cross-cutting concerns.** Use React Context providers or hooks (e.g. Clerk's `useAuth()`, `useSlackEnabled()`) instead of threading props through intermediate components. Server-only values (env vars) go in a context provider at the page boundary; auth data comes from Clerk hooks.
- **MCP upsert tools are partial updates.** Non-identity fields must be `z.optional()` (never `z.…().default(…)`) and guarded in the writer (`if (params.x !== undefined) existing.set(...)`), so omitting a field leaves it unchanged instead of wiping it. See ADR 0011.

## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues on `vascohq/cycles`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Slack announcements

Format for announcing shipped fixes/features (default channel #product-dev), branded for Cycles. See `docs/agents/slack-announcement.md`.
