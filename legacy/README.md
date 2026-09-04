# Legacy — pre-monorepo Miithii app

This is the complete pre-monorepo Miithii app (Next.js landing, chat, Clerk auth,
Razorpay credits/payments, Supabase schema) that was deleted by the monorepo
baseline reset commit `29f8b0f`.

Recovered verbatim from git commit `be63f5e` via `git archive be63f5e`.
Only `package-lock.json` was dropped here to keep the tree lean — it remains
available on the `legacy/pre-monorepo` branch / `pre-monorepo-app` tag:

```bash
git show be63f5e:package-lock.json   # or: git checkout legacy/pre-monorepo
```

This folder is a **reference snapshot** — it is not part of the pnpm/turbo
workspace and does not build as-is from the repo root. To port code from it
into the monorepo apps (chat streaming, credit accounting, Razorpay flows,
Supabase schema), copy and adapt the relevant files.

Key files:

| File | What it has |
| --- | --- |
| `MIITHII_CHECKPOINT.md` | Full architecture + deployment runbook of the old app |
| `src/app/api/chat/route.ts` | Streaming chat route with credit pre-auth/deduction |
| `src/lib/database.ts` | 13 Supabase helpers (credits, chats, messages, Razorpay orders) |
| `supabase/schema.sql` | Tables: credit_balances, credit_transactions, razorpay_orders, chats, messages + RPCs |
| `src/app/api/payments/*` | Razorpay create-order / verify / webhook flows |
| `src/components/chat-*.tsx`, `message-list.tsx` | Old chat UI (pre-assistant-ui) |
