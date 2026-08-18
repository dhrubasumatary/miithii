# Miithii UI Stack Decision

Date: 2026-08-18

## Decision

Use `@miithii/ui` as the shared source-owned design package, with Pulse tokens and shadcn-compatible primitive patterns. Use shadcn/ui as the primary component workflow when we need richer components, and keep beUI / `starc007/ui-components` as an optional registry to borrow selected animated pieces from source, not as the foundation for the whole product suite.

Implemented baseline:

- Tailwind v4 processing is enabled through `@tailwindcss/postcss`.
- `components.json` exists at the repo root, every app, and `packages/ui`.
- `@miithii/ui` exports source-owned primitives from `packages/ui/src/components/*`.
- `@miithii/ui/lib/utils` exposes the standard shadcn-style `cn()` helper.
- The beUI registry is configured as `beui` with `https://beui.dev/r/{name}`.

## Why

Miithii needs a product UI system that can survive across `hub`, `subtitles`, `chat`, and `voice`. shadcn fits that shape because components are copied into the codebase and become ours to maintain. It also has a monorepo path, registry support, and a large ecosystem for product primitives.

beUI is useful for polished animated blocks, but it is a narrower layer built on React, Tailwind CSS, Motion, and shadcn/ui. That makes it better as a selective source import after review than as a base dependency for all Miithii apps.

## Operating Rules

- Keep Pulse tokens, logo assets, and shared primitives in `packages/ui`.
- Leave `apps/subtitles` clean while the subtitles product is being built.
- Add shadcn components only when the screen needs the interaction pattern, for example `Dialog`, `Sheet`, `Tabs`, `Tooltip`, `Table`, `Command`, `DropdownMenu`, or `AlertDialog`.
- Prefer Radix-backed shadcn components if the app will use Vercel AI Elements or other Radix-shaped AI UI primitives.
- Review any external registry component for license, accessibility, keyboard behavior, bundle cost, and mobile fit before promoting it into `packages/ui`.
- Keep placeholder subdomains `noindex` until the real product pages are live, so unfinished app shells do not compete with the apex domain in search.

## Adding Components

Add reusable product-wide primitives from inside `packages/ui`, then export them from `packages/ui/src/components.ts` and `packages/ui/src/index.ts`.

For shadcn components, prefer Radix-backed `new-york` components. For beUI, fetch one named registry component at a time, review its files and dependencies, and only keep it if it improves an actual Miithii screen.
