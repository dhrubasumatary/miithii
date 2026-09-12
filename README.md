# Miithii

Miithii is one product suite under `miithii.in`, with separate web surfaces and Cloudflare Workers sharing identity and API behavior.

## Apps

- `apps/hub` -> `miithii.in`
- `apps/subtitles` -> `subtitles.miithii.in`
- `apps/chat` -> `chat.miithii.in`
- `apps/voice` -> `voice.miithii.in`

## Shared package

- `packages/ui` - Pulse design system, logo, tokens, shared components

Auth, quota, model routing, uploads, and memory behavior are owned by the active apps and Workers.

## Workers

- `workers/api` - shared authenticated API, quota, model routing, uploads, and memory policy
- `workers/chat` - `chat.miithii.in` static assets plus same-origin API forwarding
- `workers/apex` - current `miithii.in` / `www.miithii.in` production Worker
- `apps/voice/worker.js` - `voice.miithii.in` static assets, voice STT/TTS, and API forwarding

## Local commands

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

## Deployment shape

Cloudflare is the active production edge. `workers/apex` serves the apex domain, `workers/chat` serves the chat static export and proxies its API paths, `apps/voice/worker.js` serves the voice static export and voice endpoints, and `workers/api` is the shared API service. `apps/hub`, `apps/subtitles`, `apps/chat`, and `apps/voice` remain the Turborepo web applications checked by CI.

