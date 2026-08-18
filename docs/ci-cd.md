# Miithii CI/CD

This repo uses GitHub Actions as the handoff point between development and production.

## What Runs

- `CI` runs on every pull request, every push to `main`, and manual dispatch.
- `CI` installs with `pnpm --frozen-lockfile`, then runs `pnpm typecheck` and `pnpm build` across the Turborepo workspace.
- `Deploy Apex` runs only when `workers/apex/**` changes on `main`, or when started manually from the GitHub Actions tab.
- `Deploy Apex` validates the Cloudflare Worker bundle, deploys `workers/apex`, then checks that `miithii.in` is live and `www.miithii.in` redirects to the apex.

## Required GitHub Settings

Set these in the GitHub repo before relying on deployment:

- Repository secret: `CLOUDFLARE_API_TOKEN`
- Repository variable: `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare token should be scoped narrowly to deploy the existing Worker and routes for `miithii.in`. At minimum, use permissions for Workers script edit, Workers routes edit, and zone read on the `miithii.in` zone.

Optional later, for faster Turborepo builds:

- Repository secret: `TURBO_TOKEN`
- Repository variable: `TURBO_TEAM`

## Current Production Model

`miithii.in` and `www.miithii.in` are served by the Cloudflare Worker in `workers/apex`. Keep the apex and `www` DNS records orange-clouded in Cloudflare, otherwise the Worker route will be bypassed.

The Next.js apps in `apps/*` are checked by CI, but they are not deployed automatically yet. When each product becomes real, add a separate deployment workflow per app so subtitles, chat, voice, and hub can move independently.

## Branch Rule

Treat `main` as production. Work on feature branches, open pull requests, wait for `CI`, then merge. Production apex deploys only after code reaches `main`.
