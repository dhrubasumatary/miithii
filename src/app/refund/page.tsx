"use client";

import Link from "next/link";

export default function RefundPage() {
  return (
    <div className="min-h-screen min-h-dvh flex flex-col relative overflow-hidden bg-black text-[#EDEDED]">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[#1e3a8a] -top-32 -right-32 blur-[80px] opacity-15" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#064e3b] bottom-20 -left-20 blur-[80px] opacity-10" />
        <div className="grid-overlay" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-4 bg-black/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-[#30D158] flex items-center justify-center">
              <span className="text-black font-mono font-bold text-sm">M</span>
            </div>
            <span className="font-medium">Miithii</span>
          </Link>
          <Link 
            href="/miithii"
            className="text-sm text-[#30D158] hover:underline font-mono"
          >
            → Chat
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-8 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-2">Legal</p>
            <h1 className="text-3xl font-medium mb-2">Refund & Cancellation</h1>
            <p className="text-white/40 text-sm font-mono">Last updated: November 26, 2025</p>
          </div>

          {/* The Hard Truth Box */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 mb-10">
            <h2 className="text-red-400 font-medium mb-4 flex items-center gap-2">
              <span className="font-mono">!</span> Straight up: No refunds. Ever.
            </h2>
            <p className="text-white/60 text-sm">
              You pay ₹49 (or whatever the beta price is) → you get access till the end of the billing month → done.
            </p>
          </div>

          {/* Why Section */}
          <div className="mb-10">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <span className="text-[#30D158] font-mono">→</span>
              Why so cruel?
            </h2>
            <ul className="space-y-3 text-white/60 text-sm pl-5">
              <li className="flex items-start gap-3">
                <span className="text-white/30">•</span>
                We&apos;re two people and a prayer.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-white/30">•</span>
                Servers cost money the second you hit &quot;send&quot;.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-white/30">•</span>
                We&apos;d rather spend time making Assamese AI better than processing refunds.
              </li>
            </ul>
          </div>

          {/* Exceptions */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 mb-10">
            <h2 className="text-white/80 font-medium mb-4 flex items-center gap-2">
              <span className="text-[#30D158] font-mono">→</span>
              Exceptions (only these, don&apos;t beg)
            </h2>
            <ul className="space-y-3 text-white/60 text-sm">
              <li className="flex items-start gap-3">
                <span className="text-[#30D158]">✓</span>
                We charged you twice by mistake
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#30D158]">✓</span>
                We charged you after you cancelled
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#30D158]">✓</span>
                The site was completely dead for 7+ days straight
              </li>
            </ul>
            <p className="text-white/40 text-xs mt-4">
              In those cases, mail <a href="mailto:support@miithii.com" className="text-[#30D158] hover:underline">support@miithii.com</a> with proof and we&apos;ll fix it like gentlemen.
            </p>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-8">
            <Section title="1. Policy Overview">
              <p>
                This applies to all beta plans (e.g., ₹49 experimental) and future tiers. 
                Purchases grant immediate digital access, which cannot be returned.
              </p>
            </Section>

            <Section title="2. What Fees Cover">
              <p>
                Access, usage limits, infrastructure, AI processing, storage, and support.
              </p>
            </Section>

            <Section title="3. Cancellation">
              <SubSection title="How It Works">
                Cancel anytime via account settings. Access continues until billing period end; 
                no prorated refunds. Account reverts to free/beta access post-period.
              </SubSection>
              <SubSection title="How to Cancel">
                Log in → Account Settings → Cancel Subscription → Confirm. Confirmation email sent.
              </SubSection>
            </Section>

            <Section title="4. Billing Disputes">
              <SubSection title="Unauthorized Charges">
                Contact support@miithii.com with details. We investigate in 5-7 business days. 
                Legitimate errors (e.g., duplicates) may be corrected/refunded. Normal charges do not qualify.
              </SubSection>
              <SubSection title="Technical Issues">
                Report to support. We resolve promptly; extended outages (&gt;24 hours) may yield credits 
                at our discretion (not refunds).
              </SubSection>
            </Section>

            <Section title="5. Unused Services">
              <p>
                No refunds/credits for unused limits, non-use periods, or unutilized features. 
                Limits expire end-of-period; no rollover.
              </p>
            </Section>

            <Section title="6. Service Changes">
              <p>
                We may modify/discontinue services with notice. Existing periods honored; no refunds for changes.
              </p>
            </Section>

            <Section title="7. Account Termination">
              <SubSection title="Voluntary">
                Immediate access end; no refunds. Data deletion in 30 days.
              </SubSection>
              <SubSection title="Involuntary">
                For violations: no refunds; forfeiture of period.
              </SubSection>
            </Section>

            <Section title="8. Third-Party Payments">
              <p>
                Subject to processor terms. Direct disputes to us before chargebacks, which may suspend accounts.
              </p>
            </Section>

            <Section title="9. Contact">
              <p>
                <a href="mailto:support@miithii.com" className="text-[#30D158] hover:underline font-mono">
                  support@miithii.com
                </a>
                <br />
                <span className="text-white/40">We respond in 24-48 hours.</span>
              </p>
            </Section>
          </div>

          {/* Closing */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-white/50 text-sm mb-4">
              By subscribing, you agree to this policy: all sales final except errors or law-required.
            </p>
            <p className="text-white/30 text-xs">
              That&apos;s it. Harsh but fair.
            </p>
            <p className="text-white/30 text-xs mt-4 font-mono">
              – Prompt Mafia (still broke, still building)
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-white/5 relative z-10">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-4 justify-between items-center text-xs text-white/30">
          <p>© 2025 Prompt Mafia Inc.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
            <Link href="/refund" className="text-[#30D158]">Refund</Link>
            <Link href="/contact" className="hover:text-white/50 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-medium text-[#EDEDED] mb-3 flex items-center gap-2">
        <span className="text-[#30D158] font-mono text-sm">→</span>
        {title}
      </h2>
      <div className="text-white/60 text-sm leading-relaxed space-y-3 pl-5">
        {children}
      </div>
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-white/80 font-medium text-sm mb-1">{title}</h3>
      <p className="text-white/50">{children}</p>
    </div>
  );
}

