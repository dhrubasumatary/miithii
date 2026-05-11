"use client";

import { useClerk } from "@clerk/nextjs";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

type CheckoutPack = {
  id: string;
  name: string;
  priceInr: number;
  minutes: number;
};

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CreditPackCheckout({
  featured,
  pack,
}: {
  featured?: boolean;
  pack: CheckoutPack;
}) {
  const clerk = useClerk();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout() {
    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/payment/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();

      if (res.status === 401 || data.code === "AUTH_REQUIRED") {
        setStatus("idle");
        clerk.openSignIn();
        return;
      }

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Checkout is not ready yet.");
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setStatus("error");
        setMessage("Could not load Razorpay checkout.");
        return;
      }

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Miithii",
        description: `${pack.name} - ${pack.minutes} generated minutes`,
        order_id: data.orderId,
        prefill: data.customer,
        theme: { color: "#30D158" },
        handler: async (response: RazorpayResponse) => {
          const verify = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...response, packId: pack.id }),
          });
          const verifyData = await verify.json();

          if (!verify.ok) {
            setStatus("error");
            setMessage(verifyData.error || "Payment captured but credits were not verified.");
            return;
          }

          setStatus("success");
          setMessage(`${verifyData.minutesAdded || pack.minutes} minutes added.`);
        },
      });

      checkout.open();
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Checkout failed to start.");
    }
  }

  return (
    <div>
      <button
        disabled={status === "loading"}
        onClick={startCheckout}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          featured
            ? "bg-[#30D158] text-black hover:bg-[#42df68]"
            : "bg-[#111311] text-white hover:bg-black"
        }`}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Buy credits
          </>
        )}
      </button>
      {message && (
        <p
          className={`mt-3 text-center text-xs ${
            status === "success" ? "text-[#147a35]" : featured ? "text-white/52" : "text-black/45"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
