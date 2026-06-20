import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { markRazorpayOrderPaid, addCredits } from '@/lib/database';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body as {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    };

    const secret = process.env.RAZORPAY_KEY_SECRET!;
    const valid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret
    );

    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const orderResult = await markRazorpayOrderPaid(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!orderResult.success || !orderResult.creditsToAdd) {
      return NextResponse.json(
        { error: orderResult.error ?? 'Failed to update order' },
        { status: 500 }
      );
    }

    const creditResult = await addCredits(userId, orderResult.creditsToAdd, 'purchase', {
      razorpay_order_id,
      razorpay_payment_id,
    });

    if (!creditResult.success) {
      return NextResponse.json(
        { error: creditResult.error ?? 'Failed to add credits' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      creditsAdded: orderResult.creditsToAdd,
      balance: creditResult.balanceAfter,
    });
  } catch (err) {
    console.error('[payments/verify]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}