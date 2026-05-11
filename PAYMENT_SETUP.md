# Razorpay Payment Setup

Miithii sells one-time generated-minute credit packs through Razorpay Checkout.

## Environment Variables

```bash
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_or_live_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

Also configure Clerk and Supabase, because successful payments grant credits to the signed-in Clerk user in the Supabase credit ledger.

## Flow

1. User signs in.
2. User opens `/pricing` and selects a credit pack.
3. `/api/payment/create-session` creates a Razorpay order with server-side notes:
   - `clerkUserId`
   - `packId`
   - `minutes`
   - `product=miithii_voice_credits`
4. Razorpay Checkout opens in the browser.
5. Browser callback posts payment ids/signature to `/api/payment/verify`.
6. Server verifies the signature, loads the Razorpay order, checks the order amount, pack id, currency, and Clerk user id, then grants credits.
7. Razorpay webhook posts `payment.captured` to `/api/payment/webhook`; duplicate credit grants are ignored by the ledger.

## Webhook

In Razorpay Dashboard, add:

```text
https://miithii.com/api/payment/webhook
```

Subscribe to:

```text
payment.captured
```

Set `RAZORPAY_WEBHOOK_SECRET` to the same secret configured in the dashboard.

For local webhook testing, use a tunnel URL that forwards to `/api/payment/webhook`, then replace it with `https://miithii.com/api/payment/webhook` before production.

## Credit Packs

Visible launch packs are defined in `src/lib/billing/pricing.ts`. Confirm the code and this document match before going live.

- Test: INR 9, 1 minute
- Reels: INR 29, 4 minutes
- Creator: INR 79, 12 minutes

## Local Test Checklist

```bash
npm run build
npm run dev
```

Then:

1. Sign in with Clerk.
2. Visit `/pricing`.
3. Start checkout.
4. Complete Razorpay test payment.
5. Confirm `/api/generations` shows the updated `balanceMinutes`.
6. Generate audio on `/voice`.
7. Confirm the generation appears under Recent files and can be downloaded again without burning credits.
