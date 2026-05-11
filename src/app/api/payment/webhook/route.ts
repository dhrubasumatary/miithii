import { NextRequest, NextResponse } from "next/server";
import { getCreditPack } from "@/lib/billing/pricing";
import { recordPaymentCreditGrant } from "@/lib/billing/ledger";
import { verifyRazorpayWebhook } from "@/lib/billing/razorpay";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-razorpay-signature") || "";
    const rawBody = await req.text();

    if (!verifyRazorpayWebhook(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const payload = event?.payload?.payment?.entity;

    if (event?.event !== "payment.captured" || !payload) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const packId = String(payload.notes?.packId || "");
    const userId = String(payload.notes?.clerkUserId || "");
    const pack = getCreditPack(packId);

    if (!userId || !pack) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_pack_or_user" });
    }

    await recordPaymentCreditGrant({
      amountInr: Number(payload.amount || 0) / 100,
      pack,
      razorpayOrderId: String(payload.order_id || ""),
      razorpayPaymentId: String(payload.id || ""),
      userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("razorpay webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
