# Miithii Voice

Miithii Voice is a Next.js product for generating downloadable regional Indian language voice files. The current product focus is voice export, not chat.

## Current Product

- Paste text and auto-detect Assamese, Bodo, Manipuri, Hindi, Bengali, English, or unknown text.
- Generate male or female Gemini TTS audio with language-specific prompt profiles.
- Charge generated minute credits, with free re-downloads from history.
- Sell one-time credit packs through Razorpay.
- Store generation metadata, credit ledger rows, cost events, and private audio files in Supabase.
- Use Clerk for sign-in and account controls.

## Stack

- Next.js 15 App Router
- React 19
- Tailwind CSS v4
- Clerk auth
- Razorpay checkout
- Supabase REST and Storage
- Gemini TTS
- Sarvam language detection when configured, local detection rules as fallback

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm start
```

## Key Routes

- `/voice` - main voice generation console
- `/pricing` - credit packs
- `/api/detect-language` - language detection
- `/api/generate-voice` - TTS generation, billing gate, storage
- `/api/generations` - balance and recent generation history
- `/api/generations/[id]/download` - signed private audio download URL
- `/api/payment/create-session` - Razorpay order creation
- `/api/payment/verify` - Razorpay client callback verification and credit grant
- `/api/payment/webhook` - Razorpay webhook credit grant
- `/api/admin/profitability` - admin-only revenue/cost summary

## Required Environment

See `.env.example` for the full list.

Minimum production setup:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AUDIO_BUCKET`
- `MIITHII_ADMIN_USER_IDS`

Production automatically requires signed-in generation and credit gating. Local development can opt into those gates with:

```bash
MIITHII_REQUIRE_AUTH_FOR_GENERATION=true
MIITHII_ENABLE_CREDIT_GATE=true
```

## Database

Apply the Supabase migration in `supabase/migrations/20260511010000_miithii_voice_billing.sql`.

It creates:

- `payments`
- `generations`
- `audio_files`
- `credit_ledger`
- `cost_events`
- `user_credit_balances`
- `daily_profitability`
- private `miithii-audio` storage bucket

## Product Notes

The launch pricing model is documented in `docs/miithii-economics.md`. The revenue and distribution plan is in `docs/revenue-plan.md`. The operational product status and launch checklist are in `docs/product-status.md`. The execution checklist is in `TODO.md`. The next-agent implementation handoff is in `AGENT_HANDOFF.md`.
