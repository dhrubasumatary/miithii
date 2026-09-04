import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createOrder } from '@/lib/razorpay';
import { createRazorpayOrder } from '@/lib/database';

const CREDIT_PACKS: Record<string, { paise: number; credits: number }> = {
  starter: { paise: 1900, credits: 1000 },
  standard: { paise: 4900, credits: 3000 },
  premium: { paise: 19900, credits: 15000 },
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { packId } = body as { packId: string };

    const pack = CREDIT_PACKS[packId];
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 });
    }

    const receipt = `miithii-${userId}-${Date.now()}`;
    const order = await createOrder(pack.paise, receipt);

    await createRazorpayOrder(userId, order.id, pack.paise, pack.credits);

    return NextResponse.json({
      orderId: order.id,
      amount: pack.paise,
      credits: pack.credits,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('[create-order]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}