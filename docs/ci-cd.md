# Miithii CI/CD

This repo uses GitHub Actions as the reproducible handoff between development and production.

## What Runs

- `CI` runs on every pull request, every push to `main`, and manual dispatch.
- `CI` installs with `pnpm --frozen-lockfile`, then runs `pnpm typecheck` and `pnpm build` across the Turborepo workspace.
- `Deploy Production` runs when production app/Worker code reaches `main`, or when started manually.
- It rebuilds the web apps, tests the API Worker, dry-runs every Worker bundle, ensures the private Chat attachment bucket exists with a 24-hour lifecycle, then deploys API -> Chat -> Voice -> Subtitles -> Apex and smoke-tests every public surface.

## Required GitHub Settings

Set these in the GitHub repo before relying on deployment:

- Repository secret: `CLOUDFLARE_API_TOKEN`
- Repository variable: `CLOUDFLARE_ACCOUNT_ID`
- Repository variable: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (production `pk_live` key)
- Repository secret: `UPSTREAM_API_KEY`
- Repository secret: `SUPERMEMORY_API_KEY`
- Repository secrets: `BODHAN_API_KEY`, `BODHAN_TTS_API_KEY`
- Repository secret: `WAITLIST_KEY`

The Cloudflare token must be able to deploy Workers/routes, read the `miithii.in` zone, and create/read/configure R2 buckets because the release workflow enforces attachment retention policy.

The release writes runtime secrets to temporary runner files and passes them to Wrangler. `SUPERMEMORY_API_KEY` is optional only for an already-configured API Worker; set it in GitHub before rebuilding production from a blank Cloudflare account.

Optional later, for faster Turborepo builds:

- Repository secret: `TURBO_TOKEN`
- Repository variable: `TURBO_TEAM`

## Current Production Model

`miithii.in` and `www.miithii.in` are served by `workers/apex`. Chat and Voice are static Next exports served by their Workers. Subtitles is a static export served by `apps/subtitles/worker.js`, which owns the waitlist API at the same origin. `workers/api` remains the shared authenticated backend.

Chat attachments are private R2 objects in `miithii-chat-uploads`. The Worker returns references only to the authenticated owner and application logic treats objects as expired after 24 hours; the release workflow also applies an R2 lifecycle rule to `images/` so storage expiration matches that contract.

## Branch Rule

Treat `main` as production. Production deployment starts only after the release verification job passes for the exact commit being deployed.
