import crypto from "crypto";

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.byteLength === right.byteLength && crypto.timingSafeEqual(left, right);
}

export function getRazorpayKeyId() {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
}

export function isRazorpayConfigured() {
  return Boolean(getRazorpayKeyId() && process.env.RAZORPAY_KEY_SECRET);
}

export function verifyRazorpayPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return safeCompare(expected, signature);
}

export function verifyRazorpayWebhook(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  return safeCompare(expected, signature);
}

export async function createRazorpayOrder({
  amountInr,
  notes,
  receipt,
}: {
  amountInr: number;
  notes: Record<string, string | number>;
  receipt: string;
}) {
  const keyId = getRazorpayKeyId();
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay env is not configured");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInr * 100,
      currency: "INR",
      receipt,
      notes,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.description || "Could not create Razorpay order");
  }

  return data as {
    id: string;
    amount: number;
    currency: "INR";
    receipt: string;
    status: string;
  };
}

export async function getRazorpayOrder(orderId: string) {
  const keyId = getRazorpayKeyId();
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay env is not configured");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.description || "Could not load Razorpay order");
  }

  return data as {
    id: string;
    amount: number;
    currency: "INR";
    notes?: Record<string, string | number>;
    receipt: string;
    status: string;
  };
}
