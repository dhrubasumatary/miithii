import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY!;

/**
 * Verify Cashfree webhook signature
 */
function verifyCashfreeSignature(
  timestamp: string,
  rawBody: string,
  signature: string
): boolean {
  const signatureData = `${timestamp}${rawBody}`;
  const computedSignature = crypto
    .createHmac("sha256", CASHFREE_SECRET_KEY)
    .update(signatureData)
    .digest("base64");
  
  return computedSignature === signature;
}

/**
 * Webhook handler for Cashfree payment notifications
 * This endpoint will be called by Cashfree when payment status changes
 */
export async function POST(req: NextRequest) {
  try {
    // Get headers
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const signature = req.headers.get("x-webhook-signature") || "";
    
    // Get raw body for signature verification
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);

    // Verify webhook signature
    if (!verifyCashfreeSignature(timestamp, rawBody, signature)) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Process webhook event
    const { type, data } = body;

    console.log("Webhook received:", { type, data });

    // Handle different event types
    switch (type) {
      case "PAYMENT_SUCCESS_WEBHOOK":
        // Payment successful
        const { order, payment } = data;
        
        console.log("Payment successful:", {
          orderId: order.order_id,
          orderAmount: order.order_amount,
          paymentStatus: payment.payment_status,
          customerEmail: order.customer_details?.customer_email,
        });

        // TODO: Store payment info in Convex
        // - Mark user as having beta access
        // - Store order_id, payment_time, customer_email, etc.
        
        break;

      case "PAYMENT_FAILED_WEBHOOK":
        // Payment failed
        console.log("Payment failed:", data);
        break;

      case "PAYMENT_USER_DROPPED_WEBHOOK":
        // User dropped from payment page
        console.log("User dropped payment:", data);
        break;

      default:
        console.log("Unknown webhook type:", type);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

