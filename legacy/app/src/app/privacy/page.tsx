import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — Miithii',
};

export default function PrivacyPage() {
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
          <span className="text-gradient">Privacy Policy</span>
        </h1>
        <p className="text-muted mb-10">Last updated: 20 June 2026 — DPDP Act 2023 Compliant</p>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">1. Overview</h2>
            <p className="text-muted">
              Prompt Mafia Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;Miithii&quot;) operates the website{' '}
              <a href="https://miithii.in" className="text-accent hover:underline">
                https://miithii.in
              </a>{' '}
              and related services. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your personal information in compliance with the Digital Personal Data
              Protection Act, 2023 (DPDP Act) of India and applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">2. Data We Collect</h2>
            <p className="text-muted mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc list-inside text-muted space-y-1">
              <li>
                <strong className="text-foreground">Account data:</strong> Your name, email address,
                and authentication information provided by Clerk (our authentication partner).
              </li>
              <li>
                <strong className="text-foreground">Chat data:</strong> Messages, prompts, and
                conversations you submit through Miithii, including AI-generated responses.
              </li>
              <li>
                <strong className="text-foreground">Usage data:</strong> Token consumption, feature
                usage patterns, session metadata, and interaction logs.
              </li>
              <li>
                <strong className="text-foreground">Payment data:</strong> Razorpay processes all
                payments. We receive only transaction identifiers and amount — not card details.
              </li>
              <li>
                <strong className="text-foreground">Device &amp; access data:</strong> IP address,
                browser type, and pages accessed, collected via Cloudflare (our CDN and security provider).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">3. How We Use Your Data</h2>
            <p className="text-muted mb-3">We use your personal data for the following purposes:</p>
            <ul className="list-disc list-inside text-muted space-y-1">
              <li>Providing and maintaining the Miithii AI conversational service</li>
              <li>Processing credit purchases and managing your account balance</li>
              <li>Improving, personalising, and optimising our service quality</li>
              <li>Detecting, investigating, and preventing fraudulent or unauthorised activity</li>
              <li>Complying with our legal obligations under Indian law, including the DPDP Act</li>
              <li>Communicating with you regarding your account, service updates, or support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">4. Legal Basis for Processing</h2>
            <p className="text-muted">
              Under the DPDP Act 2023, we process your personal data on the basis of your consent,
              which you provide by registering for and using Miithii. You may withdraw consent at
              any time by deleting your account — however, this may result in loss of access to the
              service and any remaining credit balance.
            </p>
            <p className="text-muted mt-3">
              We also process data without consent where necessary to comply with judicial orders,
              legal obligations, or for matters relating to the safety of any individual.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">5. Third-Party Data Processors</h2>
            <p className="text-muted mb-4">
              We share your data with the following third-party service providers, who process it
              on our behalf for service delivery purposes:
            </p>
            <div className="space-y-3">
              {[
                { name: 'Clerk', purpose: 'User authentication and account management', url: 'https://clerk.com' },
                { name: 'Supabase', purpose: 'Database hosting — servers located in India (IN)', url: 'https://supabase.com' },
                { name: 'Supermemory', purpose: 'Memory and context management for AI conversations', url: 'https://supermemory.dev' },
                { name: 'Fireworks AI', purpose: 'AI model inference infrastructure', url: 'https://fireworks.ai' },
                { name: 'Cloudflare', purpose: 'CDN distribution, security, and DDoS protection', url: 'https://cloudflare.com' },
                { name: 'Razorpay', purpose: 'Payment processing for credit purchases', url: 'https://razorpay.com' },
              ].map((party) => (
                <div key={party.name} className="flex gap-3 text-sm">
                  <span className="text-foreground font-medium min-w-[120px]">{party.name}</span>
                  <div>
                    <span className="text-muted">{party.purpose}</span>
                    <span className="text-muted"> — </span>
                    <a href={party.url} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
                      {party.url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted mt-4">
              These providers are contractually bound to use your data only for the purposes
              specified above and to implement appropriate security measures.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">6. Data Storage &amp; Security</h2>
            <p className="text-muted">
              Your personal data is stored in Supabase, whose infrastructure is hosted on servers
              located in India. We implement industry-standard technical and organisational measures
              to protect your data against unauthorised access, alteration, disclosure, or destruction.
              These include encryption in transit (TLS/SSL), access controls, and regular security reviews.
            </p>
            <p className="text-muted mt-3">
              Cloudflare provides additional protection at the network layer. However, no internet
              transmission or electronic storage system is completely secure. If you believe your
              account has been compromised, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">7. Data Retention</h2>
            <p className="text-muted">
              We retain your personal data for as long as your account is active and for a period
              of up to 3 years after account deletion or last activity, or as required to comply
              with legal obligations. Chat history and messages are retained until you delete your
              account or specific conversations.
            </p>
            <p className="text-muted mt-3">
              Credit transaction records are retained for a minimum period as required under
              applicable Indian tax and financial regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">8. Your Rights (DPDP Act 2023)</h2>
            <p className="text-muted mb-3">
              Under the DPDP Act, you have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-muted space-y-1">
              <li>
                <strong className="text-foreground">Right to access:</strong> Request a summary of
                the personal data we hold about you.
              </li>
              <li>
                <strong className="text-foreground">Right to correction:</strong> Request correction
                of inaccurate or incomplete personal data.
              </li>
              <li>
                <strong className="text-foreground">Right to erasure:</strong> Request deletion of
                your personal data, subject to legal retention requirements.
              </li>
              <li>
                <strong className="text-foreground">Right to withdrawal of consent:</strong> Withdraw
                consent at any time, with the understanding that this may terminate your access to Miithii.
              </li>
              <li>
                <strong className="text-foreground">Right to grievance redressal:</strong> Raise a
                complaint if you believe your data rights have been violated.
              </li>
            </ul>
            <p className="text-muted mt-3">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:promptmafiainc@gmail.com" className="text-accent hover:underline">
                promptmafiainc@gmail.com
              </a>{' '}
              with the subject line &quot;Data Subject Request.&quot; We will respond within the timeframe
              prescribed under applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">9. Children&apos;s Data</h2>
            <p className="text-muted">
              Miithii is not intended for use by individuals under 18 years of age. We do not
              knowingly collect personal data from minors. If we become aware that we have collected
              data from a minor, we will take steps to delete such information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">10. Data Breach Notification</h2>
            <p className="text-muted">
              In the event of a personal data breach that is likely to cause harm to any data principal,
              we will notify the affected individuals and the Data Protection Board of India within
              the timeframe prescribed under the DPDP Act 2023.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">11. Changes to This Policy</h2>
            <p className="text-muted">
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, or legal requirements. Any material changes will be communicated by posting
              the revised policy on this page with an updated &quot;Last updated&quot; date. Your continued
              use of Miithii after any change constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">12. Contact Us</h2>
            <p className="text-muted">For privacy-related queries or to exercise your data rights:</p>
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