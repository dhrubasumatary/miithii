import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID!;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY!;
const CASHFREE_MODE = process.env.CASHFREE_MODE || "sandbox";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Cashfree API endpoint based on mode
const CASHFREE_API_URL = CASHFREE_MODE === "production" 
  ? "https://api.cashfree.com/pg/orders"
  : "https://sandbox.cashfree.com/pg/orders";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerEmail, customerPhone } = body;

    console.log("=== Payment Session Request ===");
    console.log("Customer data:", { customerName, customerEmail, customerPhone });
    console.log("App ID:", CASHFREE_APP_ID);
    console.log("Mode:", CASHFREE_MODE);
    console.log("API URL:", CASHFREE_API_URL);

    // Validate input
    if (!customerName || !customerEmail || !customerPhone) {
      return NextResponse.json(
        { error: "Missing required fields: customerName, customerEmail, customerPhone" },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Create order payload
    const orderPayload = {
      order_id: orderId,
      order_amount: 49, // ₹49 for beta access
      order_currency: "INR",
      customer_details: {
        customer_id: `customer_${Date.now()}`,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `${APP_URL}/payment/callback?order_id={order_id}`,
        notify_url: `${APP_URL}/api/payment/webhook`,
      },
      order_note: "Miithii Beta Access - One-time payment",
    };

    // Make request to Cashfree
    const response = await fetch(CASHFREE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    console.log("=== Cashfree Response ===");
    console.log("Status:", response.status);
    console.log("Data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("Cashfree API error:", data);
      return NextResponse.json(
        { error: "Failed to create payment session", details: data },
        { status: response.status }
      );
    }

    // Return payment session URL
    // Note: payment_link might not be in response, we need to construct it
    const paymentLink = data.payment_link || `https://payments.cashfree.com/order/#${data.payment_session_id}`;
    
    console.log("Payment link:", paymentLink);

    return NextResponse.json({
      success: true,
      order_id: data.order_id,
      payment_session_id: data.payment_session_id,
      payment_link: paymentLink,
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

