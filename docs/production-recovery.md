# Production Recovery Notes

Date: 2026-08-18

## Current State

- `miithii.in` and `www.miithii.in` still resolve to Vercel DNS.
- Vercel project `miithii` exists under team `miithii-server`, but production deploy is blocked by an overdue team balance.
- A Cloudflare fallback Worker is deployed and healthy:
  - Worker: `miithii-apex-fresh`
  - URL: `https://miithii-apex-fresh.promptmafiainc.workers.dev`
  - Version: `c7eada45-69d1-4f77-bdf7-cb828ba7f9cb`
- Cloudflare Worker routes are registered:
  - `miithii.in/*`
  - `www.miithii.in/*`
- The routes will only receive apex traffic after the apex/www DNS records are proxied through Cloudflare.

## What Blocked The Vercel Fix

The Vercel CLI authenticated successfully, but production deployment failed because the team has an overdue balance. Vercel returned:

```text
Your team has an overdue balance. Please add a valid payment method to reactivate your account.
```

## Remaining Switch

Do one of these:

1. Fix Vercel billing, then deploy `apps/hub` to the Vercel project and attach `miithii.in` / `www.miithii.in`.
2. Grant Cloudflare DNS edit permission, then change apex/www away from Vercel and proxy them through Cloudflare so `miithii-apex-fresh` serves production.

Do not change MX, DKIM, SPF, or email-routing records.
