import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminUserId } from "@/lib/admin";
import { isRazorpayConfigured } from "@/lib/billing/razorpay";
import { siteConfig } from "@/lib/site";
import { getAudioBucket, isSupabaseConfigured } from "@/lib/supabase/server";

function envState(name: string) {
  const value = process.env[name];
  if (!value) return "missing";
  if (/your_|placeholder|changeme/i.test(value)) return "placeholder";
  return "set";
}

function keyMode(name: string) {
  const value = process.env[name] || "";
  if (!value) return "missing";
  if (value.includes("_live_") || value.startsWith("pk_live") || value.startsWith("sk_live") || value.startsWith("rzp_live")) return "live";
  if (value.includes("_test_") || value.startsWith("pk_test") || value.startsWith("sk_test") || value.startsWith("rzp_test")) return "test";
  return "unknown";
}

export async function GET() {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const env = {
    siteUrl: envState("NEXT_PUBLIC_SITE_URL"),
    clerkPublishableKey: envState("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    clerkSecretKey: envState("CLERK_SECRET_KEY"),
    geminiApiKey: envState("GEMINI_API_KEY"),
    razorpayKeyId: envState("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
    razorpayKeySecret: envState("RAZORPAY_KEY_SECRET"),
    razorpayWebhookSecret: envState("RAZORPAY_WEBHOOK_SECRET"),
    supabaseUrl: envState("SUPABASE_URL"),
    supabaseServiceRoleKey: envState("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseAudioBucket: envState("SUPABASE_AUDIO_BUCKET"),
    adminUserIds: envState("MIITHII_ADMIN_USER_IDS"),
  };

  const services = {
    siteUrl: siteConfig.url,
    nodeEnv: process.env.NODE_ENV || "unknown",
    clerkMode: {
      publishable: keyMode("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      secret: keyMode("CLERK_SECRET_KEY"),
    },
    razorpayMode: keyMode("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
    razorpayConfigured: isRazorpayConfigured(),
    supabaseConfigured: isSupabaseConfigured(),
    supabaseAudioBucket: getAudioBucket(),
    productionGenerationRequiresAuth: process.env.NODE_ENV === "production" || process.env.MIITHII_REQUIRE_AUTH_FOR_GENERATION === "true",
    productionCreditGateEnabled: process.env.NODE_ENV === "production" || process.env.MIITHII_ENABLE_CREDIT_GATE === "true",
  };

  const missing = Object.entries(env)
    .filter(([, state]) => state !== "set")
    .map(([name, state]) => ({ name, state }));

  return NextResponse.json({
    ready: missing.length === 0 && services.razorpayConfigured && services.supabaseConfigured,
    missing,
    env,
    services,
  });
}
