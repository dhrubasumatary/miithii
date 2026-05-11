import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCreditPack } from "@/lib/billing/pricing";
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from "@/lib/billing/razorpay";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in before buying credits.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const pack = getCreditPack(typeof body.packId === "string" ? body.packId : null);

    if (!pack || !pack.active) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    if (!isRazorpayConfigured()) {
      return NextResponse.json(
        {
          error: "Razorpay is not configured on this environment.",
          code: "RAZORPAY_NOT_CONFIGURED",
          pack: {
            id: pack.id,
            name: pack.name,
            priceInr: pack.priceInr,
            minutes: pack.minutes,
          },
        },
        { status: 503 }
      );
    }

    const user = await currentUser();
    const order = await createRazorpayOrder({
      amountInr: pack.priceInr,
      receipt: `miithii_${pack.id}_${Date.now()}`,
      notes: {
        clerkUserId: userId,
        packId: pack.id,
        minutes: pack.minutes,
        product: "miithii_voice_credits",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: getRazorpayKeyId(),
      customer: {
        name: user?.fullName || user?.firstName || "Miithii user",
        email: user?.primaryEmailAddress?.emailAddress || "",
        contact: user?.primaryPhoneNumber?.phoneNumber || "",
      },
      pack: {
        id: pack.id,
        name: pack.name,
        priceInr: pack.priceInr,
        minutes: pack.minutes,
      },
    });
  } catch (error) {
    console.error("create-session error", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
