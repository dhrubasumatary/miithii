"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageFooter } from "@/components/layout/PageFooter";

export default function TermsPage() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <PageHeader />

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] mb-6">
              <FileText className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">Legal</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-3">
              Terms & Conditions
            </h1>
            <p className="text-[var(--text-muted)] text-xs font-mono">Last updated: November 26, 2025</p>
          </div>

          {/* TL;DR */}
          <div className="bg-[#30D158]/[0.08] rounded-xl p-5 mb-10">
            <h2 className="text-[#30D158] font-medium text-sm mb-3 flex items-center gap-2">
              <span className="font-mono">$</span> 
              TL;DR
            </h2>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="text-[#30D158]">•</span>
                Don&apos;t be an asshole.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#30D158]">•</span>
                Don&apos;t use Miithii for illegal shit.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#30D158]">•</span>
                Don&apos;t try to hack us (we&apos;re broke enough).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#30D158]">•</span>
                AI can hallucinate — verify important info.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#30D158]">•</span>
                We can change or kill the service whenever.
              </li>
            </ul>
          </div>

          {/* Terms */}
          <div className="space-y-8">
            <Section title="1. Acceptance of Terms">
              These Terms form a binding agreement between you and Prompt Mafia Inc. for your use of Miithii, 
              an AI-powered chat platform supporting Assamese. By using the service, you agree to these Terms.
            </Section>

            <Section title="2. Service Description">
              Miithii enables AI conversations in Assamese, including chat, document processing, and history management. 
              We may modify, suspend, or discontinue services at any time.
            </Section>

            <Section title="3. User Accounts">
              Provide accurate information to create an account. You&apos;re responsible for maintaining confidentiality 
              and all account activity. Must be 13+ years old with legal capacity to agree.
            </Section>

            <Section title="4. Billing">
              Currently in beta at ₹49/month (subject to change). Billed monthly in INR. Prices may change with 30 days&apos; notice.
            </Section>

            <Section title="5. Refund Policy">
              See our <Link href="/refund" className="text-[#30D158] hover:underline">Refund Policy</Link>: No refunds for any fees or services.
            </Section>

            <Section title="6. User Content">
              You own uploaded content. You grant us a limited license to process and store it. 
              Content deleted within 30 days of termination.
            </Section>

            <Section title="7-11. Privacy, IP, AI, Usage">
              We use standard security. Miithii is our IP. AI responses may contain inaccuracies. 
              Don&apos;t use for illegal purposes. Third-party integrations have their own terms.
            </Section>

            <Section title="12. Liability">
              Miithii is provided &quot;as is&quot;. We&apos;re not liable for indirect damages. 
              Total liability limited to amounts paid in prior 12 months or ₹1,000.
            </Section>

            <Section title="13-17. Legal">
              You indemnify us against claims. We may update terms with notice. Governed by Indian law (Guwahati, Assam). 
              Contact: <a href="mailto:support@miithii.com" className="text-[#30D158] hover:underline font-mono">support@miithii.com</a>
            </Section>
          </div>

          <div className="mt-10 pt-8 border-t border-white/[0.04]">
            <p className="text-[var(--text-secondary)] text-sm mb-3">
              By using Miithii, you agree to these Terms. If not, close the tab and touch grass.
            </p>
            <p className="text-[var(--text-muted)] text-xs font-mono">
              Love, The Prompt Mafia
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
