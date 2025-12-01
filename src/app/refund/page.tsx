"use client";

import { AlertTriangle, Check, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageFooter } from "@/components/layout/PageFooter";

export default function RefundPage() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <PageHeader />

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] mb-6">
              <CreditCard className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">Legal</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-3">
              Refund & Cancellation
            </h1>
            <p className="text-[var(--text-muted)] text-xs font-mono">Last updated: November 26, 2025</p>
          </div>

          {/* Warning */}
          <div className="bg-[#ff453a]/[0.08] rounded-xl p-5 mb-10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#ff453a] flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[#ff453a] font-medium text-sm mb-1.5">
                  Straight up: No refunds. Ever.
                </h2>
                <p className="text-[var(--text-secondary)] text-sm">
                  You pay ₹49 → you get access till the billing month ends → done.
                </p>
              </div>
            </div>
          </div>

          {/* Why */}
          <div className="mb-10">
            <h2 className="font-medium text-sm mb-4 text-[var(--text-primary)]">Why so cruel?</h2>
            <ul className="space-y-2.5 text-[var(--text-secondary)] text-sm">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
                We&apos;re two people and a prayer.
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
                Servers cost money the second you hit &quot;send&quot;.
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
                We&apos;d rather build Assamese AI than process refunds.
              </li>
            </ul>
          </div>

          {/* Exceptions */}
          <div className="bg-white/[0.03] rounded-xl p-5 mb-10">
            <h2 className="font-medium text-sm mb-4">Exceptions (only these)</h2>
            <ul className="space-y-2.5 text-[var(--text-secondary)] text-sm">
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#30D158] flex-shrink-0 mt-0.5" />
                We charged you twice by mistake
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#30D158] flex-shrink-0 mt-0.5" />
                We charged you after you cancelled
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#30D158] flex-shrink-0 mt-0.5" />
                Site was dead for 7+ days straight
              </li>
            </ul>
            <p className="text-[var(--text-muted)] text-xs mt-4">
              Email <a href="mailto:support@miithii.com" className="text-[#30D158] hover:underline">support@miithii.com</a> with proof.
            </p>
          </div>

          {/* Policy Details */}
          <div className="space-y-6">
            <Section title="1. Policy Overview">
              This applies to all plans. Purchases grant immediate digital access, which cannot be returned.
            </Section>

            <Section title="2. Cancellation">
              Cancel anytime via account settings. Access continues until billing period ends. No prorated refunds.
            </Section>

            <Section title="3. Billing Disputes">
              Contact support with details. We investigate in 5-7 business days. Only legitimate errors qualify.
            </Section>

            <Section title="4. Unused Services">
              No refunds for unused limits or features. Limits expire at end of period.
            </Section>

            <Section title="5. Contact">
              <a href="mailto:support@miithii.com" className="text-[#30D158] hover:underline font-mono">
                support@miithii.com
              </a>
              <span className="text-[var(--text-tertiary)]"> — 24-48h response.</span>
            </Section>
          </div>

          <div className="mt-10 pt-8 border-t border-white/[0.04]">
            <p className="text-[var(--text-secondary)] text-sm mb-2">
              By subscribing, you agree: all sales final.
            </p>
            <p className="text-[var(--text-muted)] text-xs font-mono">
              – Prompt Mafia (still broke, still building)
            </p>
          </div>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-medium text-sm mb-2 text-[var(--text-primary)]">{title}</h2>
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
        {children}
      </p>
    </div>
  );
}
