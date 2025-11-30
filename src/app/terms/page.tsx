"use client";

import Link from "next/link";

export default function TermsPage() {
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
            <h1 className="text-3xl font-medium mb-2">Terms & Conditions</h1>
            <p className="text-white/40 text-sm font-mono">Last updated: November 26, 2025</p>
          </div>

          {/* TL;DR Box */}
          <div className="bg-[#30D158]/10 border border-[#30D158]/30 rounded-2xl p-6 mb-10">
            <h2 className="text-[#30D158] font-medium mb-4 flex items-center gap-2">
              <span className="font-mono">$</span> TL;DR (the one humans actually read)
            </h2>
            <ul className="space-y-2 text-sm text-white/70">
              <li>• Don&apos;t be an asshole.</li>
              <li>• Don&apos;t use Miithii for illegal shit.</li>
              <li>• Don&apos;t try to hack us (we&apos;re broke enough already).</li>
              <li>• AI can hallucinate — don&apos;t blame us if it tells you the capital of Assam is Mumbai.</li>
              <li>• We can change or kill the service whenever. Sorry, startup life.</li>
            </ul>
          </div>

          {/* Full Terms */}
          <div className="prose prose-invert prose-sm max-w-none">
            <Section title="1. Acceptance of Terms">
              <p>
                These Terms form a binding agreement between you and Prompt Mafia Inc. (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) 
                for your use of Miithii, an AI-powered chat platform supporting Assamese (with Bodo support forthcoming). 
                By creating an account or using the service, you confirm you have read and agree to these Terms.
              </p>
            </Section>

            <Section title="2. Service Description">
              <p>
                Miithii enables AI conversations in Assamese, including chat, document/text processing, and history management. 
                We may modify, suspend, or discontinue services at any time.
              </p>
            </Section>

            <Section title="3. User Accounts">
              <SubSection title="3.1 Creation">
                Provide accurate information to create an account. You are responsible for maintaining confidentiality, 
                all account activity, and updating details. Notify us of unauthorized use immediately.
              </SubSection>
              <SubSection title="3.2 Eligibility">
                You must be at least 13 years old and have legal capacity to agree.
              </SubSection>
              <SubSection title="3.3 Termination">
                Terminate via account settings; data deletion occurs within 30 days. 
                We may suspend or terminate for violations.
              </SubSection>
            </Section>

            <Section title="4. Subscription Plans and Billing">
              <SubSection title="4.1 Beta Access">
                Currently in beta with an experimental plan at ₹49/month (details subject to change). 
                No other tiers are live.
              </SubSection>
              <SubSection title="4.2 Payment">
                Billed monthly in INR via third-party processor. You authorize charges. 
                Prices may change with 30 days&apos; notice.
              </SubSection>
              <SubSection title="4.3 Usage Limits">
                Limits apply per plan. Exceeding limits requires upgrade; unused usage does not roll over.
              </SubSection>
            </Section>

            <Section title="5. Refund Policy">
              <p>
                See our <Link href="/refund" className="text-[#30D158] hover:underline">Refund Policy</Link>: 
                No refunds for any fees or services.
              </p>
            </Section>

            <Section title="6. User Content and Data">
              <SubSection title="6.1 Your Content">
                You own uploaded content (e.g., text, documents). You grant us a limited license to 
                process and store it for service delivery and anonymized improvements.
              </SubSection>
              <SubSection title="6.2 Storage and Deletion">
                Content is stored minimally via third-party providers for service continuity. 
                Upon termination, we delete within 30 days. Users can request deletion via support. 
                We do not access or review chat histories.
              </SubSection>
              <SubSection title="6.3 Prohibited Content">
                Do not upload illegal, harmful, infringing, or discriminatory content, 
                including malware, harassment, explicit material, or promotions of violence.
              </SubSection>
            </Section>

            <Section title="7. Privacy">
              <p>
                Governed by our Privacy Policy. We use standard security but cannot guarantee absolute protection.
              </p>
            </Section>

            <Section title="8. Intellectual Property">
              <p>
                Miithii (excluding User Content) is owned by Prompt Mafia Inc. and protected by law. 
                You receive a limited, non-exclusive license for personal/business use. 
                Do not copy, modify, reverse-engineer, or resell.
              </p>
            </Section>

            <Section title="9. AI-Generated Content">
              <p>
                Responses may contain inaccuracies. Verify independently; not professional advice.
              </p>
            </Section>

            <Section title="10. Acceptable Use">
              <p>
                Do not use for illegal purposes, unauthorized access, disruption, bots, 
                circumvention of limits, impersonation, or data harvesting.
              </p>
            </Section>

            <Section title="11. Third-Party Services">
              <p>
                We integrate third-party tools; their terms apply. We are not liable for their performance.
              </p>
            </Section>

            <Section title="12. Disclaimers and Limitations of Liability">
              <SubSection title="12.1 As Is">
                Miithii is provided &quot;as is&quot; without warranties of merchantability, fitness, or non-infringement. 
                No guarantees of uninterrupted, error-free, or accurate service.
              </SubSection>
              <SubSection title="12.2 Liability">
                To the extent permitted by law, we are not liable for indirect, incidental, or consequential damages. 
                Total liability limited to amounts paid by you in the prior 12 months or ₹1,000, whichever is greater.
              </SubSection>
            </Section>

            <Section title="13. Indemnification">
              <p>
                You indemnify us against claims from your use, violations, or User Content.
              </p>
            </Section>

            <Section title="14. Modifications">
              <p>
                We may update Terms with notice via email or platform. Continued use constitutes acceptance.
              </p>
            </Section>

            <Section title="15. Termination">
              <p>
                We may terminate access for violations without notice. Surviving provisions apply post-termination.
              </p>
            </Section>

            <Section title="16. Governing Law">
              <p>
                Governed by Indian law. Disputes in courts of Guwahati, Assam, India.
              </p>
            </Section>

            <Section title="17. Contact">
              <p>
                <a href="mailto:support@miithii.com" className="text-[#30D158] hover:underline font-mono">
                  support@miithii.com
                </a>
                <br />
                <span className="text-white/40">Prompt Mafia Inc.</span>
              </p>
            </Section>
          </div>

          {/* Acknowledgment */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-white/50 text-sm">
              By using Miithii, you agree to these Terms. If not, close the tab and touch grass.
            </p>
            <p className="text-white/30 text-xs mt-4 font-mono">
              Love, The Prompt Mafia
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-white/5 relative z-10">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-4 justify-between items-center text-xs text-white/30">
          <p>© 2025 Prompt Mafia Inc.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="text-[#30D158]">Terms</Link>
            <Link href="/refund" className="hover:text-white/50 transition-colors">Refund</Link>
            <Link href="/contact" className="hover:text-white/50 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium text-[#EDEDED] mb-3 flex items-center gap-2">
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

