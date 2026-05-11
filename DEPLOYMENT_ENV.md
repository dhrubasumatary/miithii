# Deployment Environment Variables

Production domain:

```text
https://miithii.com
```

## Required For Production

```bash
# Site URL
NEXT_PUBLIC_SITE_URL=https://miithii.com

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Gemini TTS
GEMINI_API_KEY=...
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview

# Optional language detection provider
SARVAM_API_KEY=...

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_AUDIO_BUCKET=miithii-audio

# Admin API
MIITHII_ADMIN_USER_IDS=user_abc123,user_def456
```

## Optional Local Flags

Production always requires auth and credits for generation. Local development can test those gates explicitly:

```bash
MIITHII_REQUIRE_AUTH_FOR_GENERATION=true
MIITHII_ENABLE_CREDIT_GATE=true
```

## Required Setup

1. Apply `supabase/migrations/20260511010000_miithii_voice_billing.sql`.
2. Confirm the private Supabase storage bucket `miithii-audio` exists.
3. Configure Razorpay webhook:

```text
https://miithii.com/api/payment/webhook
```

4. Subscribe the webhook to `payment.captured`.
5. Set Clerk production keys and allowed redirect domains:

```text
https://miithii.com
https://www.miithii.com
```

6. Add every required variable above in Vercel Project Settings -> Environment Variables for Production.
7. Run `npm run build` before deployment.
8. After deployment, sign in as an admin and open:

```text
https://miithii.com/api/admin/launch-readiness
```

The endpoint only returns setup states, not secret values.

## Deployment Notes

- The old chat routes are intentionally redirected/offline while the product focuses on voice export.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Keep `NEXT_PUBLIC_RAZORPAY_KEY_ID` public; keep `RAZORPAY_KEY_SECRET` private.
- Signed-in users receive one lifetime 3-minute trial grant when their ledger is first loaded.
- In production, generation requires sign-in and credit gating even if local flags are not set.
