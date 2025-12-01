# Cashfree Payment Integration Setup

## 1. Environment Variables

Add these to your `.env.local` file:

```bash
# Cashfree Payment Gateway
CASHFREE_APP_ID=your_app_id_here
CASHFREE_SECRET_KEY=your_secret_key_here
CASHFREE_MODE=sandbox
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For Production:**
- Change `CASHFREE_MODE` to `production`
- Update `NEXT_PUBLIC_APP_URL` to your live domain
- Use production Cashfree credentials

## 2. Test Payment Flow

### Sandbox Testing
1. Visit `http://localhost:3000/checkout`
2. Fill in the form with test details
3. Use Cashfree test cards:
   - Card: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date

### Test UPI
- UPI ID: `success@paytm` (for successful payment)
- UPI ID: `failure@paytm` (for failed payment)

## 3. Webhook Configuration

In your Cashfree dashboard:
1. Go to **Settings** → **Webhooks**
2. Add webhook URL: `https://yourdomain.com/api/payment/webhook`
3. Subscribe to events:
   - `PAYMENT_SUCCESS_WEBHOOK`
   - `PAYMENT_FAILED_WEBHOOK`
   - `PAYMENT_USER_DROPPED_WEBHOOK`

## 4. Payment Flow

```
User clicks "Get Access" 
  → /checkout page
  → Fill details & submit
  → Backend creates Cashfree order (/api/payment/create-session)
  → User redirected to Cashfree hosted page
  → User completes payment
  → Cashfree redirects to /payment/callback
  → Webhook confirms payment (/api/payment/webhook)
  → User redirected to /chat
```

## 5. Convex Integration (Later)

When you set up Convex, update the webhook handler:

```typescript
// In /api/payment/webhook/route.ts
case "PAYMENT_SUCCESS_WEBHOOK":
  // Store in Convex:
  await convex.mutation(api.payments.recordPayment, {
    orderId: order.order_id,
    customerEmail: order.customer_details.customer_email,
    amount: order.order_amount,
    status: "success",
    paidAt: new Date().toISOString(),
  });
  break;
```

## 6. Files Created

- `/src/app/api/payment/create-session/route.ts` - Creates payment order
- `/src/app/api/payment/webhook/route.ts` - Handles payment notifications
- `/src/app/checkout/page.tsx` - Payment initiation page
- `/src/app/payment/callback/page.tsx` - Payment result page

## 7. Next Steps

- [ ] Add Cashfree credentials to `.env.local`
- [ ] Test payment flow in sandbox mode
- [ ] Set up webhooks in Cashfree dashboard
- [ ] Test webhook delivery
- [ ] Integrate Convex for storing payment records
- [ ] Add Clerk authentication
- [ ] Restrict `/chat` to paid users only

