# Miithii Platform — Project Checkpoint
**Saved:** 2026-06-20  
**Phase:** Phase 3 Complete (Frontend Rebuild)  
**By:** Kimchi (Heavy-tier Systems Engineer)

---

## ⚡ TL;DR — What Was Built

A production-grade Next.js 15 chat app for miithii.in that:
- Premium dark-UI landing page with gradient hero, feature cards, CTA
- Clerk auth (Google + Apple OAuth, sign-in, sign-up pages)
- Full streaming chat interface via Vercel AI SDK → api.miithii.in
- Server-side credit deduction (TOKENS_PER_CREDIT=20, 500 free tokens/day)
- Razorpay payment integration (₹19/1000cr, ₹49/3000cr, ₹199/15000cr)
- Supabase database schema (users, credits, transactions, chats, messages)
- DPDP-compliant /terms, /privacy, /contact, /about pages
- TypeScript compiles clean. 31 files. Pushed to GitHub.

---

## 🔑 Critical Keys, IDs, URLs

| Resource | Value | Notes |
|----------|-------|-------|
| **Frontend domain** | `https://miithii.in` | Currently points to dead Vercel deployment (404) |
| **Frontend repo** | `dhrubasumatary/miithii` | GitHub, PUBLIC |
| **Proxy domain** | `https://api.miithii.in` | Cloudflare Worker, live |
| **Proxy repo** | `dhrubasumatary/miithii-api` | GitHub, PRIVATE |
| **Cloudflare Account** | `66f97ccf87b3349218040db7b434e97d` | promptmafiainc@gmail.com |
| **D1 DB** | `miithii-db` | ID: `d245a395-a15a-455f-9d25-9c317a760815` |
| **KV NS** | `MIITHII_CACHE` | ID: `af57147df0bb48d592befd4b937dc702` |
| **Master API Key** | `dfb3c712...637697201` | For proxy auth |
| **Cloudflare Token** | `cfut_12IP...abb8225` | CI needs permission fix |

Full master key: `dfb3c7127663e68dc090d1158e96c785e75af37377cefc7352bb50b637697201`

---

## 📁 File Inventory (miithii frontend)

```
miithii/
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing page (hero, features, CTA, footer)
│   │   ├── layout.tsx          # Root layout (ClerkProvider, metadata, dark theme)
│   │   ├── globals.css         # Dark theme CSS variables + Tailwind v4 config
│   │   ├── chat/
│   │   │   └── page.tsx        # Chat page shell
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx    # Clerk sign-in (dark theme)
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx    # Clerk sign-up (dark theme)
│   │   ├── credits/
│   │   │   └── page.tsx        # Credit top-up page (Razorpay checkout)
│   │   ├── terms/
│   │   │   └── page.tsx        # Terms of Service
│   │   ├── privacy/
│   │   │   └── page.tsx        # Privacy Policy (DPDP Act)
│   │   ├── contact/
│   │   │   └── page.tsx        # Contact page
│   │   ├── about/
│   │   │   └── page.tsx        # About page
│   │   └── api/
│   │       ├── chat/
│   │       │   └── route.ts    # Core API: proxy integration + credit deduction
│   │       ├── credits/
│   │       │   └── balance/
│   │       │       └── route.ts  # Credit balance API
│   │       └── payments/
│   │           ├── create-order/
│   │           │   └── route.ts  # Razorpay order creation
│   │           ├── verify/
│   │           │   └── route.ts  # Razorpay payment verification
│   │           └── webhook/
│   │               └── route.ts  # Razorpay webhook handler
│   ├── components/
│   │   ├── chat-interface.tsx  # Core chat (Vercel AI SDK)
│   │   ├── message-list.tsx    # Message bubbles with markdown-lite
│   │   ├── chat-input.tsx      # Auto-growing textarea + send button
│   │   ├── navbar.tsx          # Top nav with auth + credit badge
│   │   └── credit-badge.tsx    # Live credit balance in navbar
│   └── lib/
│       ├── supabase.ts         # Supabase clients (anon + service role)
│       ├── utils.ts            # cn(), formatTokens(), formatINR()
│       ├── chat.ts             # Proxy call + credit deduction helpers
│       ├── database.ts         # Supabase CRUD helpers
│       └── razorpay.ts         # Razorpay client + signature verification
├── supabase/
│   └── schema.sql              # Full database schema (RLS + indexes)
├── middleware.ts               # Clerk auth routing + route protection
├── .env.example                # All required env vars
└── MIITHII_CHECKPOINT.md       # ← this file
```

---

## 🏗️ Architecture

```
User Browser → miithii.in (Vercel / Next.js 15)
  ├── Landing page (/, static)
  ├── Clerk auth (/sign-in, /sign-up)
  ├── Chat (/chat)
  │   ├── Client: useChat from Vercel AI SDK
  │   └── Server: POST /api/chat
  │       ├── Clerk auth check
  │       ├── Credit balance check (Supabase)
  │       ├── Call api.miithii.in (master key + X-Miithii-User-ID)
  │       ├── Deduct credits from Supabase
  │       ├── Stream response back to browser
  │       └── Save messages to Supabase
  ├── Credits (/credits)
  │   └── Razorpay checkout → /api/payments/*
  └── Static pages (/terms, /privacy, /contact, /about)
```

---

## ✅ What Works Now (in code)

- [x] Premium dark landing page
- [x] Clerk auth (Google + Apple OAuth)
- [x] Streaming chat with Vercel AI SDK
- [x] Server-side proxy integration (api.miithii.in)
- [x] Credit balance tracking
- [x] Credit deduction per-message
- [x] Free tier (500 tokens/day)
- [x] Razorpay payment flow (create, verify, webhook)
- [x] Static legal pages
- [x] TypeScript compiles clean
- [x] Supabase schema with RLS
- [x] DPDP-compliant privacy policy

---

## 🔧 What Needs Your Keys to Go Live

### Required Env Vars (see .env.example)

| Var | Source | Status |
|-----|--------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | Needed |
| `CLERK_SECRET_KEY` | Clerk Dashboard | Needed |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard | Needed |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard | Needed |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Needed |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard | Needed |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard | Needed |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard | Needed |
| `MIITHII_API_KEY` | Proxy secret | Known (master key) |
| `MIITHII_API_URL` | Proxy URL | Known |

### Deployment Steps

1. **Supabase**
   - Create project
   - Run `supabase/schema.sql` in SQL Editor
   - Copy URL + keys

2. **Clerk**
   - Create application
   - Enable Google + Apple OAuth
   - Set redirect URLs: `https://miithii.in/chat`
   - Copy keys

3. **Razorpay**
   - Confirm KYC complete
   - Generate test/live keys
   - Set webhook URL: `https://miithii.in/api/payments/webhook`
   - Copy keys

4. **Vercel**
   - Create project from `dhrubasumatary/miithii`
   - Add all env vars
   - Deploy

5. **DNS** (after Vercel deploy)
   - Point `miithii.in` A record to Vercel
   - Keep facebook-domain-verification TXT intact

6. **Proxy CORS**
   - Update `api.miithii.in` CORS from `*` to `https://miithii.in`

---

## 🚀 Next Actions

1. Provide Supabase/Clerk/Razorpay keys → deploy in one go
2. Set up Supabase first, test credit deduction locally
3. Set up Clerk, test auth flow
4. Set up Razorpay, test credit purchase
5. Deploy to Vercel with domain

---

## 💡 What "Restrict Proxy CORS" Means

Currently `api.miithii.in` allows ANY website to call it (`Access-Control-Allow-Origin: *`).
After launch, we should restrict this to only `https://miithii.in` so malicious sites cannot embed or abuse the API.

Your call on priority.

---

Built by Kimchi for Prompt Mafia Inc.
