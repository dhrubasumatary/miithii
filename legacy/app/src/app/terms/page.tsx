import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service — Miithii',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </Link>

        <h1 className="text-4xl font-bold mb-2">
          <span className="text-gradient">Terms of Service</span>
        </h1>
        <p className="text-muted mb-10">Last updated: 20 June 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted">
              By accessing or using Miithii (operated by Prompt Mafia Inc.), you agree to be bound
              by these Terms of Service and all applicable laws and regulations. If you do not agree
              with any part of these terms, you must not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">2. Description of Service</h2>
            <p className="text-muted">
              Miithii provides an AI-powered conversational interface powered by GLM-5.2 and related
              technologies. The service is provided &quot;as is&quot; and we reserve the right to modify,
              suspend, or discontinue any part of the service at any time without prior notice.
            </p>
            <p className="text-muted mt-3">
              Credits purchased on Miithii represent a finite amount of AI usage tokens. Each credit
              approximates 20 tokens of AI model consumption. Actual token usage may vary based on
              response length and complexity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">3. Account &amp; Payments</h2>
            <p className="text-muted">
              You must register for an account using your email through our authentication provider
              (Clerk). You are responsible for maintaining the confidentiality of your account
              credentials and for all activities under your account.
            </p>
            <p className="text-muted mt-3">
              All payments are processed via Razorpay. Miithii does not store your payment card
              details. Refunds for purchased credit packs are governed by Section 5 below.
            </p>
            <p className="text-muted mt-3">
              Prices for credit packs are listed in Indian Rupees (INR) and are subject to change
              without notice. Changes to pricing apply only to future purchases, not existing balances.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">4. Acceptable Use</h2>
            <p className="text-muted">You agree not to use Miithii to:</p>
            <ul className="list-disc list-inside text-muted mt-2 space-y-1">
              <li>Generate content that is illegal, harmful, or offensive under Indian law or applicable international law</li>
              <li>Violate the intellectual property rights of any third party</li>
              <li>Attempt to reverse-engineer, extract, or replicate the underlying AI models</li>
              <li>Use automated tools to interact with the service without prior written consent</li>
              <li>Resell or redistribute access to Miithii</li>
              <li>Engage in any activity that interferes with or disrupts the service infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">5. Refund Policy</h2>
            <p className="text-muted">
              All credit purchases are final and non-refundable unless required by applicable law.
              Credits have no monetary value and cannot be exchanged for cash. Unused credits do not
              expire but may be forfeited if your account is terminated for violation of these terms.
            </p>
            <p className="text-muted mt-3">
              If you believe a charge was made in error, please contact us at{' '}
              <a href="mailto:promptmafiainc@gmail.com" className="text-accent hover:underline">
                promptmafiainc@gmail.com
              </a>{' '}
              within 7 days of the transaction. We will review legitimate errors on a case-by-case basis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">6. Free Tier</h2>
            <p className="text-muted">
              Miithii offers a free tier providing up to 500 free tokens per day per account. This
              allocation resets daily at midnight IST. Unused free tokens do not carry over. We
              reserve the right to modify or discontinue the free tier at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">7. Termination</h2>
            <p className="text-muted">
              We may suspend or terminate your account at our sole discretion if you violate these
              Terms of Service, engage in prohibited activities, or for any other reason we deem
              necessary to protect the integrity of the platform. Upon termination, any unused
              credit balance may be forfeited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">8. Disclaimer of Warranties</h2>
            <p className="text-muted">
              MIITHII IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that the
              service will be uninterrupted, error-free, or completely secure.
            </p>
            <p className="text-muted mt-3">
              AI-generated content reflects the capabilities and limitations of large language models.
              Miithii does not guarantee the accuracy, completeness, or reliability of any AI output.
              Users are responsible for verifying critical information independently.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">9. Limitation of Liability</h2>
            <p className="text-muted">
              To the maximum extent permitted by applicable Indian law, Prompt Mafia Inc. and its
              affiliates shall not be liable for any indirect, incidental, special, consequential,
              or punitive damages arising from your use of Miithii, including but not limited to loss
              of profits, data, or business opportunities.
            </p>
            <p className="text-muted mt-3">
              Our total liability for any claim arising from your use of the service shall not exceed
              the amount you paid for credits in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">10. Intellectual Property</h2>
            <p className="text-muted">
              The Miithii platform, including its design, branding, and proprietary technology, is
              owned by Prompt Mafia Inc. and protected by applicable intellectual property laws.
              You retain ownership of content you input into the service. By using Miithii, you grant
              us a limited license to process your inputs solely for the purpose of providing the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">11. Privacy &amp; Data</h2>
            <p className="text-muted">
              Your privacy is important to us. Please review our Privacy Policy for details on how
              we collect, use, and protect your personal data. By using Miithii, you consent to our
              data practices as described in the Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">12. Modifications to Terms</h2>
            <p className="text-muted">
              We may update these Terms of Service from time to time. We will notify you of material
              changes by posting the updated terms on this page with a revised &quot;Last updated&quot; date.
              Your continued use of Miithii after any modification constitutes your acceptance of the
              revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">13. Governing Law &amp; Jurisdiction</h2>
            <p className="text-muted">
              These Terms of Service shall be governed by and construed in accordance with the laws
              of India. Any disputes arising from these terms or your use of Miithii shall be subject
              to the exclusive jurisdiction of the courts in Guwahati, Assam, India.
            </p>
            <p className="text-muted mt-3">
              If any provision of these terms is found unenforceable, the remaining provisions shall
              continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">14. Contact</h2>
            <p className="text-muted">
              For questions regarding these Terms of Service, please contact us at:
            </p>
            <div className="mt-3 text-muted space-y-1">
              <p>Email: <a href="mailto:promptmafiainc@gmail.com" className="text-accent hover:underline">promptmafiainc@gmail.com</a></p>
              <p>Company: Prompt Mafia Inc.</p>
              <p>Location: Guwahati, Assam, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}