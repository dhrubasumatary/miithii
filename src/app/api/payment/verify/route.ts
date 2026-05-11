import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCreditPack } from "@/lib/billing/pricing";
import { recordPaymentCreditGrant } from "@/lib/billing/ledger";
import { getRazorpayOrder, verifyRazorpayPaymentSignature } from "@/lib/billing/razorpay";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to verify payment" }, { status: 401 });
    }

    const body = await req.json();
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    const pack = getCreditPack(String(body.packId || ""));

    if (!orderId || !paymentId || !signature || !pack || !pack.active) {
      return NextResponse.json({ error: "Invalid payment verification payload" }, { status: 400 });
    }

    if (!verifyRazorpayPaymentSignature({ orderId, paymentId, signature })) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 401 });
    }

    const order = await getRazorpayOrder(orderId);
    const orderPackId = String(order.notes?.packId || "");
    const orderUserId = String(order.notes?.clerkUserId || "");
    const expectedAmount = pack.priceInr * 100;

    if (
      order.id !== orderId ||
      orderPackId !== pack.id ||
      orderUserId !== userId ||
      order.amount !== expectedAmount ||
      order.currency !== "INR"
    ) {
      return NextResponse.json({ error: "Payment does not match this credit pack" }, { status: 400 });
    }

    const ledger = await recordPaymentCreditGrant({
      amountInr: pack.priceInr,
      pack,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      userId,
    });

    return NextResponse.json({
      ok: true,
      minutesAdded: pack.minutes,
      balanceAfter: ledger?.balanceAfter ?? null,
    });
  } catch (error) {
    console.error("payment verify error", error);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 500 });
  }
}
