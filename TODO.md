# Miithii TODO

Last updated: May 11, 2026

## Priority 0: Make The App Able To Earn

- [ ] Fix Clerk auth keys in `.env.local`.
- [ ] Confirm sign-in and sign-out work without redirect loops.
- [ ] Turn on local production-like gates:
  - [ ] `MIITHII_REQUIRE_AUTH_FOR_GENERATION=true`
  - [ ] `MIITHII_ENABLE_CREDIT_GATE=true`
- [ ] Test signed-in free trial grant.
- [ ] Generate one short voice file while signed in.
- [ ] Confirm credits debit after generation.
- [ ] Confirm generation appears in history.
- [ ] Confirm re-download works without burning credits.

## Priority 1: Payment Flow

- [ ] Configure Razorpay sandbox keys.
- [ ] Test `/pricing` checkout for the smallest pack.
- [ ] Confirm Razorpay order metadata contains correct `userId`, `packId`, amount, and currency.
- [ ] Test `/api/payment/verify`.
- [ ] Test Razorpay webhook locally or through a tunnel.
- [ ] Confirm duplicate webhook/verify calls do not double-credit the user.
- [ ] Confirm credits appear immediately after payment.
- [ ] Add a clean payment failure message.

## Priority 2: Launch UX Cleanup

- [ ] Make signed-out history state explicit: “Sign in to keep export history.”
- [ ] Make signed-out generation behavior explicit in production: ask user to sign in before rendering.
- [ ] Change copy from generic TTS to regional voice export positioning.
- [ ] Add clean fallback for unsupported share: “Download instead.”
- [ ] Add visible support link for failed generations.
- [ ] Keep credit pill explicit: `Credits / 3 min left`.
- [ ] Recheck mobile states:
  - [ ] empty
  - [ ] typing
  - [ ] detecting
  - [ ] detected
  - [ ] unclear language
  - [ ] generating
  - [ ] generated
  - [ ] error
  - [ ] voice picker
- [ ] Recheck desktop states for the same list.

## Priority 3: Revenue CTA

- [ ] Add “Need bulk voices?” CTA on pricing page.
- [ ] Add manual Studio offer:
  - [ ] `5 Reel Voices - INR 199`
  - [ ] `15 Reel Voices - INR 499`
  - [ ] `Local Business Promo - INR 699`
  - [ ] `Monthly Page Voice - INR 999`
- [ ] Add WhatsApp or support email link for Studio orders.
- [ ] Add CTA after generation: “Need more voices? Buy minutes.”
- [ ] Add CTA after low credit: “Add minutes.”

## Priority 4: Product Quality

- [ ] Create 10 real demo audio files:
  - [ ] Assamese reel
  - [ ] Assamese tuition lesson
  - [ ] Assamese shop ad
  - [ ] Assamese announcement
  - [ ] Bodo beta sample
  - [ ] Manipuri beta sample
  - [ ] Bengali sample
  - [ ] Hindi sample
  - [ ] local business promo
  - [ ] creator intro/outro
- [ ] Test detection with:
  - [ ] Assamese native script
  - [ ] Assamese Latin
  - [ ] Bodo Devanagari
  - [ ] Bodo Latin
  - [ ] Manipuri Meitei Mayek
  - [ ] Bengali
  - [ ] Hindi
  - [ ] English
  - [ ] unclear/gibberish
- [ ] Review generated pronunciation for each demo.
- [ ] Mark Bodo and Manipuri clearly as beta until quality is proven.

## Priority 5: Cost And Ops

- [ ] Decide whether launch export remains WAV only.
- [ ] Add MP3/AAC export if storage/bandwidth becomes a concern.
- [ ] Add basic rate limits for:
  - [ ] detection
  - [ ] generation
  - [ ] payment creation
  - [ ] download URL creation
- [ ] Add admin page for:
  - [ ] payments
  - [ ] credits
  - [ ] generated minutes
  - [ ] failed generations
  - [ ] manual credit grants/refunds
- [ ] Persist voice feedback into useful admin review workflow.

## Priority 6: Sales Execution

- [ ] Make a lead spreadsheet with:
  - [ ] name
  - [ ] page/business
  - [ ] language
  - [ ] contact
  - [ ] sample sent
  - [ ] paid
  - [ ] amount
  - [ ] feedback
  - [ ] repeat
- [ ] DM 100 local creators/pages/businesses.
- [ ] Offer first custom sample.
- [ ] Pitch `5 reel voices for INR 199`.
- [ ] Collect 5 testimonials or permissioned examples.
- [ ] Track the exact objections people give.

## Priority 7: Analytics

- [ ] Add events:
  - [ ] `voice_text_started`
  - [ ] `language_detected`
  - [ ] `generation_started`
  - [ ] `generation_succeeded`
  - [ ] `generation_failed`
  - [ ] `audio_downloaded`
  - [ ] `share_clicked`
  - [ ] `pricing_clicked`
  - [ ] `checkout_started`
  - [ ] `payment_succeeded`
  - [ ] `credits_debited`
  - [ ] `feedback_submitted`
- [ ] Build a simple weekly dashboard or export.

## Definition Of Launch Ready

- [ ] `npm run build` passes.
- [ ] `/voice` loads on mobile and desktop.
- [ ] Sign-in works.
- [ ] Free trial works.
- [ ] Paid checkout works.
- [ ] Credits debit correctly.
- [ ] Downloads work.
- [ ] History works.
- [ ] No horizontal overflow on 400px mobile.
- [ ] Generation result is visible after render on mobile.
- [ ] Support contact is visible when something fails.
- [ ] At least 10 demo audios are ready.
- [ ] At least 10 people have been asked to pay.

