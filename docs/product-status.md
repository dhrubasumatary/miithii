# Miithii Voice Product Status

Last updated: May 11, 2026

## Current Shape

Miithii has moved from an Assamese chat app to a focused voice-export product. The main route is `/voice`; `/` renders the same console. The old chat API now returns `410` and the middleware redirects `/chat`, `/checkout`, and `/payment` flows back to the active voice/pricing product.

## What Works In Code

- Voice console with paste area, language detection, male/female voice selection, credit estimate, generated audio playback, and downloads.
- Gemini TTS generation with text chunking and PCM-to-WAV conversion.
- Sarvam language detection when configured, with local Northeast India language rules as fallback.
- Clerk sign-in controls.
- Razorpay credit-pack checkout.
- Server-side Razorpay payment signature verification.
- Server-side Razorpay order validation against user id, pack id, INR currency, and amount.
- Idempotent credit grant handling for verify/webhook duplicate payment callbacks.
- Supabase schema for payments, generations, private audio files, credit ledger, cost events, and profitability views.
- One-time 3-minute free trial credit grant for signed-in users.
- Recent generation list with free re-downloads through signed Supabase storage URLs.
- Admin-only profitability API at `/api/admin/profitability`.

## Product Decisions Already Encoded

- Sell generated minutes, not message counts.
- Start with one-time UPI-friendly packs before subscriptions.
- Visible packs:
  - Try: INR 19 for 2 minutes
  - Mini: INR 49 for 6 minutes
  - Creator: INR 99 for 14 minutes
- Keep re-downloads free.
- Production generation requires sign-in and credit balance.
- Local development can run without provider keys using mock detection and mock audio.

## Important Files

- `src/app/voice/page.tsx` - primary product UI
- `src/app/pricing/page.tsx` - credit-pack page
- `src/app/api/generate-voice/route.ts` - TTS generation and billing gate
- `src/app/api/generations/route.ts` - balance and history
- `src/app/api/generations/[id]/download/route.ts` - signed download URL
- `src/app/api/payment/create-session/route.ts` - Razorpay order creation
- `src/app/api/payment/verify/route.ts` - browser callback verification
- `src/app/api/payment/webhook/route.ts` - Razorpay webhook handling
- `src/lib/billing/ledger.ts` - free trial, credits, payments, generation cost records
- `src/lib/billing/pricing.ts` - packs and cost model
- `src/lib/billing/razorpay.ts` - Razorpay helpers
- `src/lib/supabase/server.ts` - Supabase REST/storage helper
- `supabase/migrations/20260511010000_miithii_voice_billing.sql` - database and storage setup
- `docs/miithii-economics.md` - pricing economics draft
- `docs/revenue-plan.md` - product positioning, launch offers, distribution plan, and revenue targets

## Remaining Launch Work

1. Apply the Supabase migration in the real project and verify storage upload/download.
2. Configure production Clerk, Razorpay, Gemini, optional Sarvam, and Supabase env vars.
3. Test Razorpay sandbox end-to-end with webhook enabled.
4. Test one signed-in generation with `MIITHII_ENABLE_CREDIT_GATE=true`.
5. Decide whether generated audio should remain WAV for launch or be converted to MP3/AAC to reduce storage and bandwidth.
6. Persist voice feedback instead of only logging it.
7. Add user-visible refund/failure rules for bad generations.
8. Add rate limits for generation and payment APIs before public traffic.
9. Add a small admin page for profitability, payments, and manual credit adjustments.
10. Update legal pages with the final business entity, refund rules, and support email before production.

## Known Risks

- Audio is stored as WAV, which is larger than the economics doc recommends.
- Supabase access uses the service-role key from server code; keep every helper server-only.
- Payment verify calls Razorpay to validate order metadata, so checkout success depends on Razorpay API availability.
- The free-trial grant is guarded by a partial unique index in the migration; production should use the updated migration before enabling credit gates.
- No automated test suite exists yet; `npm run build` is currently the main verification.

## Recovery Command Set

```bash
npm install
npm run build
npm run dev
```

Local product URL:

```text
http://localhost:3000/voice
```
