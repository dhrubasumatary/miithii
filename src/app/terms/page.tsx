import Link from "next/link";
import type { ReactNode } from "react";
import { PageFooter } from "@/components/layout/PageFooter";
import { PageHeader } from "@/components/layout/PageHeader";

export default function TermsPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f6f5ef] text-[#111311]">
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
          <header className="border-b border-[#d9d7ce] pb-5">
            <p className="mb-2 text-xs font-semibold uppercase text-black/42">Legal</p>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Terms & Conditions</h1>
            <p className="mt-2 text-sm text-black/48">Last updated: May 11, 2026</p>
          </header>

          <section className="mt-5 rounded-lg border border-[#d8d6cc] bg-white p-4 shadow-[0_14px_40px_rgba(16,17,15,0.06)]">
            <p className="text-sm leading-7 text-black/66">
              Miithii converts text into downloadable voice files. By using the service, you agree to use it responsibly and to review generated audio before publishing it anywhere important.
            </p>
          </section>

          <div className="mt-8 space-y-7">
            <Section title="1. Service">
              Miithii Voice converts text into generated audio files. The product may change as voice quality, storage, authentication, and billing systems improve.
            </Section>

            <Section title="2. Accounts">
              If accounts are enabled, keep your login details secure and use accurate information. You are responsible for activity under your account.
            </Section>

            <Section title="3. Generated Audio">
              You are responsible for the text you submit and how you use generated audio. Do not use Miithii to impersonate people, mislead listeners, violate rights, or create illegal content.
            </Section>

            <Section title="4. Billing">
              Credit packs and usage limits are shown before purchase. Regenerating audio costs credits again. Re-downloading an existing file does not debit credits.
            </Section>

            <Section title="5. Reliability">
              Generated output can contain pronunciation mistakes, language detection errors, or audio artifacts. Miithii is provided as-is while it is under active development.
            </Section>

            <Section title="6. Contact">
              For support, legal, or account questions, email{" "}
              <a href="mailto:support@miithii.com" className="font-semibold text-[#147a35] underline-offset-4 hover:underline">
                support@miithii.com
              </a>
              .
            </Section>
          </div>

          <div className="mt-8 border-t border-[#d9d7ce] pt-5">
            <Link href="/voice" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#111311] px-5 text-sm font-semibold text-white transition-colors hover:bg-black">
              Open Voice
            </Link>
          </div>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[#111311]">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-black/62">{children}</p>
    </section>
  );
}
