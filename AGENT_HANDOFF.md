# Miithii Agent Handoff

Last updated: May 11, 2026

## Read This First

Miithii is now a regional voice export product, not a chat app.

The next agent should optimize for one business loop:

> Paste script -> detect language -> generate regional voice -> download/share -> pay for minutes -> repeat.

Do not turn this into a general chatbot, app builder, agent platform, or broad AI playground. The launch product should be narrow and monetizable.

## Key Docs To Read

1. `README.md` - current app summary and routes.
2. `TODO.md` - execution checklist.
3. `docs/revenue-plan.md` - money plan, target users, launch motion.
4. `docs/miithii-economics.md` - pricing and cost assumptions.
5. `docs/product-status.md` - operational status and launch blockers.

## Important Code

- `src/app/voice/page.tsx` - main product UI.
- `src/app/page.tsx` - renders the voice app as homepage.
- `src/app/pricing/page.tsx` - credit pack purchase page.
- `src/app/api/detect-language/route.ts` - language detection.
- `src/app/api/generate-voice/route.ts` - TTS generation and billing gate.
- `src/app/api/generations/route.ts` - balance and generation history.
- `src/app/api/generations/[id]/download/route.ts` - signed download URL.
- `src/app/api/payment/create-session/route.ts` - Razorpay order creation.
- `src/app/api/payment/verify/route.ts` - Razorpay client callback verification.
- `src/app/api/payment/webhook/route.ts` - Razorpay webhook handling.
- `src/lib/billing/pricing.ts` - credit packs and cost model.
- `src/lib/billing/ledger.ts` - credit ledger, trial grant, payment crediting, generation debit.
- `src/lib/supabase/server.ts` - Supabase REST/storage helpers.
- `supabase/migrations/20260511010000_miithii_voice_billing.sql` - DB/storage schema.

## Current Product Positioning

Use this positioning:

> Assamese and Northeast voiceovers in seconds.

Expanded:

> Paste Assamese, Bodo, Manipuri, Bengali, Hindi, English, or mixed regional text. Miithii detects the language, renders a natural Gemini TTS voice, and gives a downloadable audio file for reels, lessons, explainers, ads, and local content.

Avoid generic copy like:

- AI assistant
- chatbot
- all-in-one AI
- unlimited voice studio
- agent platform
- Turing-complete tool

## User Logic

### Guest

Guest users should be able to:

- paste text
- auto-detect language
- see estimated credits
- inspect pricing

Guest users should not generate audio in production.

Production CTA:

> Sign in to generate and keep export history.

### Signed-In Free Trial

Signed-in users get:

- 3 lifetime free minutes
- max 1 minute per trial generation
- generation
- download
- history
- free re-download

After a successful trial generation, push:

> Buy minutes

### Paid User

Paid users have a minute balance.

Rules:

- debit only after successful audio generation
- round generation usage up to 0.25 minute
- re-downloads are free
- regeneration costs again
- manual refund only for verified failures
- show remaining credits clearly

### Studio / Bulk User

This is the highest early-value user.

They may come through WhatsApp/manual sales and need:

- bigger packs
- priority support
- manual credit grants
- batch support later
- cleaner admin tooling

## Economics Logic

Current internal cost model:

- `INTERNAL_COST_INR_PER_MINUTE = 4`
- `FREE_TRIAL_MINUTES = 3`
- `TRIAL_MAX_GENERATION_MINUTES = 1`
- credits round to 0.25 minute

Current visible packs:

| Pack | Price | Minutes | Purpose |
| --- | ---: | ---: | --- |
| Test | INR 9 | 1 | first trust-building export |
| Reels | INR 29 | 4 | impulse creator pack |
| Creator | INR 79 | 12 | main early self-serve pack |

These packs are not enough to sustain the business alone. They are a conversion wedge.

Add or support manual Studio offers:

| Offer | Price | Included |
| --- | ---: | --- |
| 5 Reel Voices | INR 199 | 5 short scripts, up to 30 sec each |
| 15 Reel Voices | INR 499 | 15 short scripts, up to 30 sec each |
| Local Business Promo | INR 699 | 3 ad voice variants + usage suggestions |
| Monthly Page Voice | INR 999 | 40 short exports/month |

Do not launch subscriptions yet.

Subscriptions can come later only after:

- payment works reliably
- credit ledger works
- at least 20-30 users have paid once
- some users buy a second time
- generation failure rate is controlled

Possible later subscription ladder:

| Plan | Price | Minutes |
| --- | ---: | ---: |
| Light | INR 99/mo | 16 |
| Creator | INR 249/mo | 45 |
| Pro | INR 499/mo | 95 |

No unlimited plan.

## Data Logic

Store enough for billing, support, and product improvement. Do not be careless with user scripts.

Must store:

- user id
- text length
- detected language
- script
- estimated duration
- credits debited
- provider/model
- voice name
- prompt version
- generation status
- audio storage path
- payment id/order id
- ledger rows
- feedback rating

Be careful with full text:

- full scripts may be private business/school/personal material
- store only if needed for support/debugging
- allow deletion later
- do not use scripts publicly without permission

Analytics events to add:

- `voice_text_started`
- `language_detected`
- `generation_started`
- `generation_succeeded`
- `generation_failed`
- `audio_downloaded`
- `share_clicked`
- `pricing_clicked`
- `checkout_started`
- `payment_succeeded`
- `credits_debited`
- `feedback_submitted`

## Current UI Decisions

The `/voice` UI has already been moved toward a production app surface.

Keep these:

- mobile-first composer
- explicit credit pill: `Credits / 3 min left`
- primary action like `Generate Assamese voice`
- post-generation action like `Regenerate Assamese voice`
- language panel
- audio card with play/share/download
- feedback buttons
- auto-scroll to generated audio on mobile
- no fake sample chip parade
- no useless beta/labs label pile

Any UI change should improve the core conversion loop. Do not add decorative landing sections before the actual app.

## Immediate Next Work

Work in this order.

1. Fix Clerk key mismatch in `.env.local` / auth config.
2. Verify sign-in and sign-out.
3. Make signed-out history/generation states explicit.
4. Turn on local gates:
   - `MIITHII_REQUIRE_AUTH_FOR_GENERATION=true`
   - `MIITHII_ENABLE_CREDIT_GATE=true`
5. Test signed-in 3-minute free trial grant.
6. Test successful generation debit.
7. Test generation history and signed download.
8. Configure/test Razorpay sandbox.
9. Test payment verify and webhook idempotency.
10. Add Studio/WhatsApp CTA to pricing.
11. Add analytics events.
12. Run `npm run build`.
13. Restart dev server on `localhost:3000`.
14. Capture and inspect mobile and desktop screenshots for every state.

## QA Checklist

Language detection must be tested with:

- Assamese native script
- Assamese Latin
- Bodo Devanagari
- Bodo Latin
- Manipuri Meitei Mayek
- Bengali
- Hindi
- English
- unclear/gibberish

UI states must be tested on mobile and desktop:

- empty
- typing
- detecting
- detected
- unclear language
- generating
- generated
- error
- voice picker
- pricing
- signed out
- signed in free trial
- paid credits

Build check:

```bash
npm run build
```

Local run:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/voice
```

## Engineering Rules For Next Agent

- Do not revert unrelated dirty repo changes.
- Use existing app patterns and files.
- Keep product scope narrow.
- Do not make a landing page the first screen.
- Do not add broad chat/agent features.
- If adding copy, make it sound like a real product, not an AI demo.
- If touching billing, test ledger and idempotency.
- If touching UI, verify mobile screenshots.
- If touching generation, verify detection + generation + download.
- Always run `npm run build` before final.

## Final Outcome Expected

Miithii should be ready to take real users through:

1. Sign in.
2. Get free trial minutes.
3. Paste a regional script.
4. Detect language.
5. Generate voice.
6. Download/share audio.
7. Buy more minutes.
8. See history.
9. Re-download for free.

The product is launch-ready only when that loop works without confusion.

