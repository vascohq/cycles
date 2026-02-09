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

- **Boards** → Liveblocks rooms (ID pattern: `{orgId}:{slug}`)
- **Pitches** → Top-level initiatives within a board
- **Scopes** → Work items under a pitch (with color, progress, effort, impact)
- **Tasks** → Individual items under a scope (status: todo/in_progress/done; type: task/optional/bug/question)

Types and hooks are defined in `src/liveblocks.config.ts`. Use `useStorage()`, `useMutation()`, etc. from there.

### Auth

Clerk v6 handles authentication. Middleware is in `src/middleware.ts`. Routes are scoped by `[slug]` which is either an org slug or `me` for personal workspaces. Server-side auth: `const { userId, orgId, orgSlug } = await auth()`.

### Routing

- `/` → redirects to `/{slug}/boards`
- `/[slug]/boards` → board listing
- `/[slug]/boards/[roomId]` → board room (real-time collaboration)
- `/api/liveblocks-auth` → Liveblocks auth endpoint

### Key Directories

- `src/app/[slug]/boards/` — Board pages, server actions, and board creation
- `src/app/[slug]/boards/[roomId]/` — Room UI: pitch views, hill charts, task views, drag-and-drop
- `src/components/ui/` — shadcn/ui components (Radix + Tailwind)
- `src/lib/` — Utilities (`cn()` in utils.ts, Liveblocks server client, user helpers)
- `src/liveblocks.config.ts` — Liveblocks client setup, storage types, all real-time hooks

### State Management

Real-time state lives in Liveblocks (accessed via hooks from `src/liveblocks.config.ts`). Org user data is provided via `OrganizationUsersProvider` React context. Themes via `next-themes`.

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
- Room IDs: `{orgPrefix}:{slug}` where orgPrefix is orgId or userId
- CSS theming via HSL CSS variables; dark mode via class strategy
