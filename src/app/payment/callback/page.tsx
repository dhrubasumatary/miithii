"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");

  useEffect(() => {
    const orderId = searchParams.get("order_id");
    
    if (!orderId) {
      setStatus("failed");
      return;
    }

    // Simulate payment verification
    // In production, you would verify payment status with Cashfree API
    const timer = setTimeout(() => {
      // For now, assume success
      // Later, you'll verify with Cashfree and check Convex for payment record
      setStatus("success");
      
      // Redirect to chat after 3 seconds
      setTimeout(() => {
        router.push("/chat");
      }, 3000);
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center px-5">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#30D158] flex items-center justify-center">
            <span className="text-2xl font-bold text-black" style={{ fontFamily: 'system-ui' }}>ম</span>
          </div>
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-[#30D158] animate-spin" />
            <h1 className="font-serif text-2xl">Verifying Payment...</h1>
            <p className="text-[var(--text-secondary)] text-sm">
              Please wait while we confirm your payment
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 animate-fade-in">
            <CheckCircle2 className="w-16 h-16 mx-auto text-[#30D158]" />
            <h1 className="font-serif text-2xl sm:text-3xl">Payment Successful!</h1>
            <p className="text-[var(--text-secondary)]">
              Welcome to Miithii Beta! You now have full access.
            </p>
            <div className="pt-4">
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Redirecting to chat in 3 seconds...
              </p>
              <Link
                href="/chat"
                className="inline-block px-6 py-2.5 bg-[#30D158] text-black font-medium rounded-lg hover:bg-[#2ABF4E] transition-colors"
              >
                Go to Chat Now
              </Link>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-4 animate-fade-in">
            <XCircle className="w-16 h-16 mx-auto text-[#ff453a]" />
            <h1 className="font-serif text-2xl sm:text-3xl">Payment Failed</h1>
            <p className="text-[var(--text-secondary)]">
              We couldn&apos;t process your payment. Please try again.
            </p>
            <div className="pt-4 space-y-3">
              <Link
                href="/checkout"
                className="block w-full py-2.5 bg-[#30D158] text-black font-medium rounded-lg hover:bg-[#2ABF4E] transition-colors"
              >
                Try Again
              </Link>
              <Link
                href="/contact"
                className="block w-full py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium rounded-lg border border-white/[0.06] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#30D158] animate-spin" />
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}

