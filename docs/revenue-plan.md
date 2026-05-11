# Miithii Revenue Plan

Last updated: May 11, 2026

## What Miithii Actually Is

Miithii is not a chat app anymore. It is a regional Indian voice export product.

The current product promise should be:

> Paste Assamese, Bodo, Manipuri, Bengali, Hindi, English, or mixed regional text. Miithii detects the language, renders a natural Gemini TTS voice, and gives you a downloadable audio file for reels, lessons, explainers, ads, and local content.

The product should not pretend to be a general AI assistant, a voice chatbot, a dubbing studio, or an unlimited creator suite yet. The money wedge is narrower:

> Fast downloadable Northeast Indian language voiceovers.

That wedge is strong because generic TTS products do not speak to Assamese/Bodo/Manipuri creators directly, and local creators do not want to fight prompt settings, voices, exports, or payment friction.

## Who Pays First

### 1. Local Reels And Page Admins

They need short voiceovers for Instagram, Facebook, YouTube Shorts, local news explainers, memes, offers, and festival posts.

Why they pay:

- They already pay designers/editors or spend time recording.
- They need speed more than perfect studio quality.
- They care about local accent and shareable audio.

Offer:

- Self-serve credits.
- WhatsApp delivery for the first 20-50 paying users.
- "Send script, get voice file" concierge package.

### 2. Coaching/Tuition Teachers

They need Assamese/Hindi/Bengali lesson explainers, announcements, and revision clips.

Why they pay:

- They repeat the same workflow weekly.
- They are less trend-sensitive than creators.
- They care about clarity and download reliability.

Offer:

- Monthly creator pack.
- History and re-downloads.
- Longer script support.

### 3. Local Businesses

They need quick audio for ads, offers, shop announcements, event promos, and WhatsApp forwards.

Why they pay:

- A single good promo can be worth more than the pack price.
- They do not want to learn AI tools.

Offer:

- Done-for-you packs.
- Priority delivery.
- Commercial usage clarity.

### 4. Small Agencies And Editors

They need many short exports for clients.

Why they pay:

- They can resell the audio inside their own edit packages.
- They value batch speed and predictable cost.

Offer later:

- Bulk minutes.
- Saved voices.
- Batch upload.
- Team history.

## The Business Model

Use two monetization tracks at launch.

### Track A: Self-Serve Credits

Keep this simple and transparent.

Current packs in code:

| Pack | Price | Minutes | User Price/Min | Variable Cost @ INR 4/min | Gateway Estimate | Variable Profit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Test | INR 9 | 1 | INR 9.00 | INR 4 | INR 1 | INR 4 |
| Reels | INR 29 | 4 | INR 7.25 | INR 16 | INR 1 | INR 12 |
| Creator | INR 79 | 12 | INR 6.58 | INR 48 | INR 2 | INR 29 |

These packs are fine for trust-building, but they will not feed us alone. They are low-ticket conversion products. The real goal is to identify repeat users and push them into higher-value packs or concierge.

Recommended next visible ladder:

| Offer | Price | What User Gets | Why |
| --- | ---: | --- | --- |
| First Export | INR 9 | 1 minute | Removes payment fear |
| Reels Pack | INR 29 | 4 minutes | Main impulse buy |
| Creator Pack | INR 79 | 12 minutes | Current best self-serve pack |
| Studio Pack | INR 299 | 45 minutes + priority support | First meaningful revenue pack |

Do not show subscriptions on day one. Subscriptions only make sense once repeat weekly usage is proven.

### Track B: Done-For-You Studio

This is how Miithii can earn real money before self-serve volume is huge.

Launch the offer manually:

| Package | Price | Included | Delivery |
| --- | ---: | --- | --- |
| 5 Reel Voices | INR 199 | 5 short scripts, up to 30 sec each | Same day |
| 15 Reel Voices | INR 499 | 15 short scripts, up to 30 sec each | 48 hours |
| Local Business Promo | INR 699 | 3 ad voice variants + usage suggestions | 24-48 hours |
| Monthly Page Voice | INR 999 | 40 short exports/month | Ongoing |

Why this matters:

- Higher margin than credit packs.
- Lets us learn user scripts, pain points, and language failures.
- Produces testimonials and before/after examples.
- Avoids needing a perfect product before revenue.

The app should still exist as the product, but the first serious revenue can come through a human-assisted layer.

## Positioning

Avoid generic lines like "AI text to speech".

Use:

- "Assamese and Northeast voiceovers in seconds."
- "Paste script. Get a downloadable regional voice file."
- "Built for reels, lessons, local ads, and announcements."
- "Assamese-first, with Bodo and Manipuri in beta."

Do not overpromise perfect Bodo/Manipuri yet. Say beta clearly where needed.

## Launch Page / App Copy

The first screen should remain the product, not a marketing landing page.

Inside the product, every line should support conversion:

- Credit pill: "Credits / 3 min left"
- Primary button: "Generate Assamese voice", "Generate Bodo voice"
- Empty history: "Your generated files will stay here for replay and re-download."
- Pricing CTA: "Buy minutes"
- Pricing proof: "Re-downloads are free"
- Trial rule: "3 free minutes after sign-in. Max 1 minute per trial export."

Remove anything that looks like a generated demo section, language chip parade, or fake beta badge without purpose.

## Product Gaps Blocking Money

These must be fixed before public launch.

1. Clerk key mismatch must be fixed. Auth cannot feel broken.
2. Signed-out history must be intentional. Either hide it or say "Sign in to keep export history."
3. Credit ledger must be tested with real signed-in generation.
4. Razorpay sandbox flow must be tested end-to-end with webhook.
5. Failed generation rules must be visible. Regeneration costs credits unless failure is verified.
6. Store compressed MP3/AAC in addition to WAV or provide MP3 download. WAV is useful but heavy.
7. Share failure must degrade cleanly to "Download instead."
8. Add basic rate limits before public traffic.
9. Add admin view for payments, credits, generated minutes, and support actions.
10. Add real examples generated by Miithii, but only after quality is good enough.

## What To Build Next

### Must-Have Before Launch

- Signed-in flow: login, free trial grant, generate, debit, history, download.
- Payment flow: Razorpay order, verify, webhook idempotency, credit balance update.
- Guest flow: allow detection and preview UI, but require sign-in before generation in production.
- Support path: WhatsApp/email link after payment and generation errors.
- Audio result screen: download, share, regenerate, feedback.
- Admin profitability route connected to a simple internal page.

### Revenue Features

1. "Buy minutes" from the app header and post-generation result.
2. "Need bulk voices?" WhatsApp CTA on pricing page.
3. "Studio Pack" hidden/manual link for early customers.
4. Referral coupon codes for local pages.
5. Failure feedback that can mark a generation for manual review.
6. Export format selector: WAV now, MP3 next.

### Later

- Batch scripts.
- Saved brand voices/prompts.
- Multi-speaker local dialogues.
- Subtitle/SRT export.
- API for agencies.
- Team workspaces.

## Distribution Plan

### Week 1: Concierge Revenue

Goal: get first 10 paid users manually.

Actions:

- Make 10 high-quality sample clips: Assamese reels, Bodo beta, Manipuri beta, local business ad, tuition lesson.
- DM 100 local creators/page admins with one personalized sample.
- Offer "5 reel voices for INR 199".
- Collect script types and objections.
- Track every lead in a spreadsheet: niche, language, price sensitivity, output quality, paid/not paid.

Success:

- 10 paid users.
- 30 generated exports.
- 5 testimonials or public examples.
- 3 repeat users.

### Week 2: Self-Serve Payment

Goal: prove users can pay and generate without hand-holding.

Actions:

- Turn on production auth and credit gate.
- Test Razorpay live with small payment.
- Add post-payment success path back to `/voice`.
- Add "Sign in to keep history" empty state.
- Add "Download MP3" if possible.
- Push Test/Reels/Creator packs.

Success:

- 25 paid self-serve purchases.
- Payment failure rate under 5%.
- Generation failure rate under 10%.
- At least 40% of payers download audio.

### Week 3: Creator Loop

Goal: repeat usage.

Actions:

- Add recent exports and re-download polish.
- Add "duplicate script / regenerate with another voice".
- Send WhatsApp/email to paid users with unused credits.
- Ship examples from real creator use cases.
- Add one-click "buy more minutes" after generation.

Success:

- 20% of paid users buy a second pack or request studio work.
- 100+ total generated minutes.
- At least 10 repeat generation sessions.

### Week 4: Raise Average Order Value

Goal: stop depending on INR 9/29 packs.

Actions:

- Introduce Studio Pack INR 299/499.
- Offer manual bulk support to creators/agencies.
- Add simple admin page for manual credit grants/refunds.
- Create 3 niche pages/posts: reels, tuition, local ads.

Success:

- INR 10,000 monthly run-rate.
- At least 5 users paying INR 199+.
- Clear top language/use case.

## Metrics To Track

Track these from day one:

| Metric | Why It Matters |
| --- | --- |
| Visitor -> text pasted | Does the app invite action? |
| Text pasted -> detected language | Is detection good enough? |
| Detected -> generate clicked | Does user trust the UI? |
| Generate clicked -> audio ready | Core reliability |
| Audio ready -> download clicked | Actual product value |
| Free trial -> paid pack | Monetization |
| Paid pack -> second generation | Activation quality |
| Paid user -> repeat purchase | Business quality |
| Cost per generated minute | Margin |
| Refund/manual-fix requests | Quality debt |

Minimum analytics events:

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

## Financial Targets

### Survival Math

At current pricing, self-serve profit is thin. Approximate variable profit:

- Test: INR 4/order
- Reels: INR 12/order
- Creator: INR 29/order

To make INR 10,000 variable profit only from Creator packs, Miithii needs roughly 345 Creator pack purchases. That is too much for early launch.

So the practical plan is:

1. Use cheap packs to build trust and usage.
2. Convert serious users to INR 199-999 studio offers.
3. Add subscriptions only after repeat behavior is proven.

### First Revenue Targets

| Stage | Target |
| --- | ---: |
| First 7 days | INR 2,000 collected |
| First 30 days | INR 10,000 collected |
| Month 2 | INR 30,000 collected |
| Month 3 | INR 75,000 collected |

The fastest path to these numbers is not only app traffic. It is app + direct sales + WhatsApp + creator outreach.

## Pricing Guardrails

- Do not sell unlimited.
- Do not make free anonymous generation public.
- Keep trial to 3 minutes lifetime, 1 minute max per export.
- Charge every regeneration unless it is a verified failure.
- Keep Bodo/Manipuri marked beta until quality is proven.
- Increase price if Gemini cost, failure rate, or support load rises.
- Push heavy users to manual Studio/Bulk pricing.

## Technical Cost Notes

Current planning assumptions:

- Gemini 3.1 Flash TTS Preview is modeled at USD 1/M input tokens and USD 20/M output tokens.
- Gemini audio output is commonly modeled at 25 audio tokens/second.
- That means standard-rate Gemini audio output is about USD 0.03/minute before input/retry overhead.
- At INR 85/USD, that is about INR 2.55/minute before overhead.
- The app currently uses INR 4/minute as the conservative internal cost floor.
- Razorpay domestic payments are modeled at roughly 2% plus 18% GST on the fee, approximately 2.36% effective.
- Supabase Pro is USD 25/month; free tier can work for launch tests if limits are acceptable.

Refresh these before public pricing changes.

## Concrete Next Session Work

1. Fix Clerk key mismatch and signed-in state.
2. Make signed-out history state explicit.
3. Test real credit ledger with `MIITHII_ENABLE_CREDIT_GATE=true`.
4. Test Razorpay sandbox and webhook idempotency.
5. Add Studio Pack CTA to pricing.
6. Add support/WhatsApp CTA for bulk or failed generations.
7. Add analytics events listed above.
8. Add MP3/AAC export path or document why WAV is launch-only.
9. Add admin page for revenue, cost, payments, users, manual credits.
10. Capture final mobile/desktop screenshots for empty, detected, generated, pricing, checkout, and signed-out states.

## Sources Checked

- Google/Gemini TTS pricing references should be checked against the official Gemini API pricing page before launch: https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter listed Gemini 3.1 Flash TTS Preview at USD 1/M input and USD 20/M output, released April 24, 2026: https://openrouter.ai/google/gemini-3.1-flash-tts-preview
- Razorpay standard payment gateway pricing has no setup/AMC and domestic payments are typically 2% plus GST: https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/
- Supabase pricing lists Free and Pro tiers, with Pro from USD 25/month and storage/egress quotas: https://supabase.com/pricing

