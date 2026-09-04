# Miithii Build Plan — Parallel Agent Delegation
**Date:** 2026-06-20

## Project
- **Path:** `/home/z/Desktop/miithii`
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 (already configured in globals.css)
- **Auth:** @clerk/nextjs v7 (already in middleware.ts + layout.tsx)
- **Database:** @supabase/supabase-js + @supabase/ssr
- **AI SDK:** ai v6 (useChat, streamText)
- **Payments:** razorpay v2.9.6
- **UI:** lucide-react (icons), framer-motion (animations)

## Env Vars (read from .env.example)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MIITHII_API_KEY=dfb3c7127663e
MIITHII_API_URL=https://api.miithii.in/v1/chat/completions
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://miithii.in
TOKENS_PER_CREDIT=20
FREE_TOKENS_DAILY=500
```

## API Proxy Contract
- **URL:** `https://api.miithii.in/v1/chat/completions`
- **Auth:** `Authorization: Bearer <MIITHII_API_KEY>`
- **User header:** `X-Miithii-User-ID: <clerk-user-id>`
- **Request body:** OpenAI-compatible `{ model, messages, stream: true/false }`
- **Response headers:** `X-Miithii-Total-Tokens`, `X-Miithii-Memories-Injected`, `X-Miithii-Request-ID`
- **Response body:** OpenAI streaming SSE (`data: {...}`) or JSON
- **Model:** `glm-5.2`

## Database Schema (Supabase)

```sql
-- Credit balances (one row per user)
CREATE TABLE credit_balances (
  user_id TEXT PRIMARY KEY,
  credits INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  free_tokens_used_today INTEGER NOT NULL DEFAULT 0,
  free_tokens_reset_at DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit transactions (audit trail)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'bonus')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  request_id TEXT,
  tokens_used INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Razorpay orders
CREATE TABLE razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  amount_paise INTEGER NOT NULL,
  credits_to_add INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Chats
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  model TEXT DEFAULT 'glm-5.2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their balances" ON credit_balances FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own their transactions" ON credit_transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own their chats" ON chats FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own their messages" ON messages FOR ALL USING (
  chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
);
```

## Chunk Assignments

### Chunk 1: Chat Backend (API Route + Helpers)
**Agent:** Builder — API + Streaming Logic
**Files to create/edit:**
- `src/app/api/chat/route.ts` — Critical. Server-side route that:
  1. Authenticates via Clerk `auth()`
  2. Reads request body `{ messages, model?, stream? }`
  3. Checks credits in Supabase (RPC or direct query)
  4. If free tier: checks `free_tokens_used_today` against `FREE_TOKENS_DAILY`
  5. Calls `api.miithii.in` with `Authorization: Bearer <master key>` + `X-Miithii-User-ID: <clerk user id>`
  6. If streaming: pipes the SSE stream directly back
  7. If non-streaming: returns JSON response
  8. After response completes: reads `X-Miithii-Total-Tokens` header
  9. Calculates credit cost = ceil(tokens / TOKENS_PER_CREDIT)
  10. Deducts credits from Supabase
  11. Inserts `credit_transactions` (type: 'usage')
  12. Saves user + assistant messages to Supabase `messages` table
  13. Returns response to client
- `src/lib/chat.ts` — Helper functions for calling proxy, parsing headers

**Acceptance criteria:**
- `/api/chat` works with `useChat` from Vercel AI SDK
- Returns proper SSE stream
- Credits are deducted correctly
- Messages are saved to Supabase
- Unauthorized requests return 401
- Insufficient credits return 402 with message

### Chunk 2: Chat UI + Auth Pages + Navigation
**Agent:** Builder — Frontend + Auth
**Files to create:**
- `src/app/chat/page.tsx` — Main chat page layout
- `src/components/chat-interface.tsx` — Core chat component using `useChat` from `ai`
- `src/components/message-list.tsx` — Renders messages with markdown support
- `src/components/chat-input.tsx` — Textarea with send button
- `src/components/navbar.tsx` — Top navigation with Clerk `UserButton`, credits display, links
- `src/app/sign-in/[[...sign-in]]/page.tsx` — Clerk sign-in page (dark theme)
- `src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk sign-up page (dark theme)
- `src/components/credit-badge.tsx` — Shows current credit balance from /api/credits/balance

**Acceptance criteria:**
- Use `useChat({ api: '/api/chat' })` from `ai` package
- Streaming messages appear word-by-word
- Token counter shows tokens used per message
- Navbar shows auth state + credit balance
- Sign-in/sign-up pages have dark theme matching globals.css
- Chat UI looks premium (dark, rounded, proper spacing, scrollable history)

### Chunk 3: Payments + Credits + Static Pages + Schema
**Agent:** Builder — Payments + Content
**Files to create:**
- `src/lib/razorpay.ts` — Razorpay client init + helpers
- `src/lib/database.ts` — Supabase helpers (getBalance, deductCredits, addCredits, createTransaction, saveMessage, getChats, getMessages)
- `src/app/api/payments/create-order/route.ts` — Creates Razorpay order, stores in Supabase
- `src/app/api/payments/verify/route.ts` — Verifies Razorpay signature, adds credits
- `src/app/api/payments/webhook/route.ts` — Idempotent webhook handler
- `src/app/api/credits/balance/route.ts` — Returns user's current credit balance
- `src/app/credits/page.tsx` — Credit top-up page with Razorpay checkout
- `src/app/terms/page.tsx` — Terms of service (Indian legal compliance)
- `src/app/privacy/page.tsx` — Privacy policy (DPDP Act compliant)
- `src/app/contact/page.tsx` — Contact page
- `src/app/about/page.tsx` — About / team page
- `supabase/schema.sql` — Full SQL schema for Supabase setup

**Acceptance criteria:**
- `/api/payments/create-order` returns orderId + Razorpay key
- `/api/payments/verify` verifies HMAC and adds credits atomically
- Webhook is idempotent (checks razorpay_payment_id)
- `/credits` page has credit packs with Razorpay checkout integration
- Legal pages are comprehensive and DPDP-aware
- Schema.sql is complete and ready to execute in Supabase SQL editor

## Shared Conventions

1. **Dark theme only.** Background `#0a0a0a`, subtle borders `#1a1a1a`, accent `#e879f9`.
2. **Lucide icons only.** No external icon libraries.
3. **No shadcn/ui install needed.** Use plain Tailwind with our custom CSS variables.
4. **TypeScript strict.** No `any` types. Define interfaces.
5. **Error handling:** Always return JSON `{ error: string }` with appropriate HTTP status.
6. **Auth:** Server routes use `auth()` from `@clerk/nextjs/server`. Client components use `useAuth()`.
7. **Database:** Use `supabaseAdmin` for server-side writes (RLS bypass). Use `supabase` for client reads.
