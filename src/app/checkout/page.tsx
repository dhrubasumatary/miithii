"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Check } from "lucide-react";

export default function CheckoutPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create payment session
      const response = await fetch("/api/payment/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment session");
      }

      // Redirect to Cashfree payment page
      if (data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        throw new Error("No payment link received");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#30D158] flex items-center justify-center">
              <span className="text-2xl font-bold text-black" style={{ fontFamily: 'system-ui' }}>ম</span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-2xl sm:text-3xl mb-2">Get Beta Access</h1>
            <p className="text-[var(--text-secondary)] text-sm">
              One-time payment • Full access to Miithii
            </p>
          </div>

          {/* Pricing Card */}
          <div className="bg-[var(--bg-secondary)] border border-white/[0.06] rounded-2xl p-6 mb-6">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[var(--text-secondary)] text-sm">Beta Access</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">₹49</span>
                <span className="text-[var(--text-muted)] text-sm">one-time</span>
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-white/[0.04]">
              <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <Check className="w-4 h-4 text-[#30D158] mt-0.5 flex-shrink-0" />
                <span>Unlimited conversations in Axomiya</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <Check className="w-4 h-4 text-[#30D158] mt-0.5 flex-shrink-0" />
                <span>Powered by Gemini 2.5 Pro</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <Check className="w-4 h-4 text-[#30D158] mt-0.5 flex-shrink-0" />
                <span>Image analysis & generation</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <Check className="w-4 h-4 text-[#30D158] mt-0.5 flex-shrink-0" />
                <span>Early access to new features</span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="name" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-white/[0.06] rounded-lg text-[var(--text-primary)] outline-none focus:border-[#30D158]/50 transition-colors"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-white/[0.06] rounded-lg text-[var(--text-primary)] outline-none focus:border-[#30D158]/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm text-[var(--text-secondary)] mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                required
                pattern="[0-9]{10}"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-white/[0.06] rounded-lg text-[var(--text-primary)] outline-none focus:border-[#30D158]/50 transition-colors"
                placeholder="10-digit mobile number"
              />
            </div>

            {error && (
              <div className="p-3 bg-[#ff453a]/10 border border-[#ff453a]/20 rounded-lg">
                <p className="text-[#ff453a] text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#30D158] text-black font-medium rounded-lg hover:bg-[#2ABF4E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Proceed to Payment"}
            </button>
          </form>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
            <Shield className="w-3.5 h-3.5" />
            <span>Secured by Cashfree Payments</span>
          </div>
        </div>
      </main>
    </div>
  );
}

