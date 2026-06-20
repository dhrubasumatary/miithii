import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export { razorpay };

export async function createOrder(amountPaise: number, receipt: string) {
  return razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes: {
      app: 'miithii',
    },
  });
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto');
  const body = orderId + '|' + paymentId;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expected === signature;
}