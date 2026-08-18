# @miithii/ui

Miithii UI is the shared Pulse design layer for the product suite. It keeps the brand tokens, base CSS, and source-owned React primitives in one workspace package so `hub`, `subtitles`, `chat`, and `voice` stay visually consistent.

## Direction

- Keep this package as the source of truth for Miithii tokens, logo assets, and common primitives.
- Use shadcn/ui as the add-by-source component workflow for richer primitives like dialogs, sheets, tabs, command palettes, tables, and tooltips.
- Treat third-party shadcn registries, including beUI, as optional source imports for specific effects or blocks after checking license, accessibility, and fit.
- Do not add a third-party UI kit as a runtime dependency for the whole suite unless it owns a clear problem that shadcn plus Miithii tokens cannot solve.
- Keep components in `src/components/*` so shadcn-generated files and hand-written primitives share the same layout.

## Current Exports

- Brand: `LogoMark`, `LogoWordmark`
- Navigation and shell: `ProductShell`, `ProductHeader`, `ProductMain`, `ProductNav`
- Actions and status: `Button`, `StatusBadge`
- Surfaces: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- Forms: `Field`, `Input`, `Textarea`, `Select`
- Utilities: `cn`

## Usage

Import the stylesheet once from each app's global CSS:

```css
@import "tailwindcss";
@source "../../../../packages/ui/src";
@import "@miithii/ui/styles.css";
```

Import primitives from the package:

```tsx
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@miithii/ui";
```

When shadcn components are added later, prefer copying them into the shared UI package for product-wide primitives and into an app only when the component is truly app-specific.
