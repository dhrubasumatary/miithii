import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { addCredits, getRazorpayOrderByOrderId, getRazorpayOrderByPaymentId } from '@/lib/database';
import crypto from 'crypto';

export const runtime = 'nodejs';

interface RazorpayPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
      };
    };
  };
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const body = JSON.parse(rawBody) as RazorpayPayload;

    if (body.event !== 'payment.captured') {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.payload.payment.entity.id;
    const razorpayOrderId = body.payload.payment.entity.order_id;

    // Idempotency: check if already processed by payment_id
    const existing = await getRazorpayOrderByPaymentId(paymentId);
    if (existing) {
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    const order = await getRazorpayOrderByOrderId(razorpayOrderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'paid') {
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('razorpay_orders')
      .update({
        status: 'paid',
        razorpay_payment_id: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpayOrderId);

    if (updateError) throw updateError;

    await addCredits(order.user_id, order.credits_to_add, 'purchase', {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}