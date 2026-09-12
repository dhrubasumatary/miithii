# Miithii

Miithii is one product suite under `miithii.in`. The web apps share identity, quota, API behavior, and a common product dock, while Cloudflare Workers own the production edge.

## Product surfaces

- `apps/hub` → `miithii.in`
- `apps/chat` → `chat.miithii.in`
- `apps/voice` → `voice.miithii.in`
- `apps/subtitles` → `subtitles.miithii.in`
- `packages/ui` → shared visual system and cross-product navigation

Chat and Voice require sign-in because conversation history, daily quota, and memory are account-scoped. Subtitles is currently a public waitlist and does not require an account.

## Runtime services

- `workers/api` — authenticated API, model routing, quota, memory, and private R2 uploads
- `workers/chat` — Chat static assets plus same-origin API forwarding
- `apps/voice/worker.js` — Voice static assets, STT/TTS endpoints, and API forwarding
- `apps/subtitles/worker.js` — Subtitles static assets and the waitlist endpoint
- `workers/apex` — `miithii.in` and `www.miithii.in`

## Fresh-machine setup

Use Node 24 and pnpm 11.19.0. The repository declares the pnpm version in `package.json`; enable Corepack if pnpm is not already installed.

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
git clone https://github.com/dhrubasumatary/miithii.git
cd miithii
pnpm bootstrap
pnpm check
```

`pnpm bootstrap` installs both dependency graphs: the Turborepo workspace with pnpm and the standalone API Worker with its committed npm lockfile. `pnpm check` runs workspace typechecks/builds plus the API Worker protocol tests and Wrangler dry-run build.

## Local environment files

Never commit secrets. Start from `.env.example`, but place values in the files consumed by each runtime:

```text
workers/api/.dev.vars
  UPSTREAM_API_KEY
  SUPERMEMORY_API_KEY
  CLERK_ISSUER
  CLERK_AUDIENCE

apps/chat/.env.local
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  NEXT_PUBLIC_ASSISTANT_BASE_URL
  MIITHII_API_ORIGIN=http://127.0.0.1:8787

apps/voice/.env.local
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  BODHAN_API_KEY
  BODHAN_TTS_API_KEY
  MIITHII_API_ORIGIN=http://127.0.0.1:8787
  MIITHII_VOICE_API_ORIGIN=http://127.0.0.1:8788

apps/subtitles/.env.local
  WAITLIST_KEY
```

For localhost auth, Clerk must allow the local origins you use and the `miithii-api` JWT template must match the API Worker expectations. Production uses the live Clerk frontend at `clerk.miithii.in`.

## Local development

After the environment files are in place, one command starts the web apps, shared API Worker, and Voice API proxy together:

```bash
pnpm dev
```

For debugging one layer at a time, `pnpm dev:web`, `pnpm dev:api`, and `pnpm dev:voice-api` remain available.

Default app ports are:

```text
Hub        http://localhost:3000
Subtitles  http://localhost:3001
Chat       http://localhost:3002
Voice      http://localhost:3003
API        http://127.0.0.1:8787
Voice API  http://127.0.0.1:8788
```

If you only need one app, use `pnpm dev:hub`, `pnpm dev:chat`, `pnpm dev:voice`, or `pnpm dev:subtitles` while keeping the required Worker processes running.

## Production deployment

`main` is production. `.github/workflows/deploy-production.yml` is the canonical release path. It verifies the exact commit, enforces the private R2 attachment lifecycle, deploys API → Chat → Voice → Subtitles → Apex, and then smoke-tests the public surfaces.

Repository configuration required by GitHub Actions:

```text
Secret:   CLOUDFLARE_API_TOKEN
Secret:   WAITLIST_KEY
Variable: CLOUDFLARE_ACCOUNT_ID
Variable: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
```

The existing API and Voice runtime secrets stay in Cloudflare and are preserved by Wrangler during normal releases. For a disaster-recovery rebuild into a blank Cloudflare account, restore those Worker secrets separately before deploying.

More detail: `docs/ci-cd.md` and `docs/miithii-architecture.md`.
