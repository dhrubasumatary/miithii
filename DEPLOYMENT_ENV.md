# Deployment Environment Variables

## Required Environment Variables for Production

### Cashfree Payment Gateway
```bash
CASHFREE_APP_ID=your_production_app_id
CASHFREE_SECRET_KEY=your_production_secret_key
CASHFREE_MODE=production
```

### App Configuration
```bash
# CRITICAL: Must match your deployed domain
NEXT_PUBLIC_APP_URL=https://miithii.com
```

### Gemini AI (Already configured)
```bash
GEMINI_API_KEY=your_gemini_api_key
```

## Local Development (.env.local)
```bash
CASHFREE_APP_ID=your_production_app_id
CASHFREE_SECRET_KEY=your_production_secret_key
CASHFREE_MODE=production
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
```

## Important Notes

1. **NEXT_PUBLIC_APP_URL** is used for:
   - Payment return URL (callback after payment)
   - Webhook notification URL
   - MUST match your actual deployed domain

2. **Never use ngrok URLs in production** - they expire and cause payment failures

3. **Cashfree Webhook Configuration**:
   - Login to Cashfree Dashboard
   - Go to Developers > Webhooks
   - Set webhook URL to: `https://miithii.com/api/payment/webhook`
   - Enable events: `PAYMENT_SUCCESS_WEBHOOK`, `PAYMENT_FAILED_WEBHOOK`

## Vercel Deployment

```bash
vercel env add NEXT_PUBLIC_APP_URL
# Enter: https://miithii.com

vercel env add CASHFREE_APP_ID
# Enter: your_production_app_id

vercel env add CASHFREE_SECRET_KEY
# Enter: your_production_secret_key

vercel env add CASHFREE_MODE
# Enter: production
```

Then redeploy:
```bash
vercel --prod
```

