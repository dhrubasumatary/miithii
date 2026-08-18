# Miithii

Miithii is being built as one AI product suite under `miithii.in`.

## Apps

- `apps/hub` -> `miithii.in`
- `apps/subtitles` -> `subtitles.miithii.in`
- `apps/chat` -> `chat.miithii.in`
- `apps/voice` -> `voice.miithii.in`

## Shared packages

- `packages/ui` - Pulse design system, logo, tokens, shared components
- `packages/auth` - Supabase Auth wrapper
- `packages/db` - Supabase client and shared schema types
- `packages/llm-router` - provider routing for OpenRouter, AIMLAPI, and Sarvam
- `packages/memory` - supermemory.ai wrapper
- `packages/uploads` - UploadThing wrapper boundary
- `packages/billing` - Razorpay entitlements boundary

## First build target

Start with `apps/subtitles`. It is the first real app because the subtitle prototype is the most proven. The other apps are thin shells until their product logic is ready.

## Local commands

```bash
pnpm install
pnpm dev:subtitles
pnpm build
pnpm typecheck
```

## Deployment shape

Each app should become its own Vercel project with the root directory set to its app folder:

- `apps/hub`
- `apps/subtitles`
- `apps/chat`
- `apps/voice`

Cloudflare already owns the product subdomains. Until each Vercel project is ready, the new subdomains can stay parked behind the placeholder Worker.

