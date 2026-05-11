import Link from "next/link";
import type { ReactNode } from "react";
import { ReceiptText } from "lucide-react";
import { PageFooter } from "@/components/layout/PageFooter";
import { PageHeader } from "@/components/layout/PageHeader";

export default function RefundPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f6f5ef] text-[#111311]">
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
          <header className="border-b border-[#d9d7ce] pb-5">
            <p className="mb-2 text-xs font-semibold uppercase text-black/42">Billing</p>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Refund & Cancellation</h1>
            <p className="mt-2 text-sm text-black/48">Last updated: May 11, 2026</p>
          </header>

          <section className="mt-5 rounded-lg border border-[#d8d6cc] bg-white p-4 shadow-[0_14px_40px_rgba(16,17,15,0.06)]">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#f1efe5] text-black/70">
              <ReceiptText className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">Credit packs are one-time purchases.</h2>
            <p className="mt-3 text-sm leading-7 text-black/62">
              Miithii sells generated-minute packs for voice exports. Each checkout should show the price, minutes, and payment details before purchase.
            </p>
          </section>

          <div className="mt-8 space-y-7">
            <Section title="1. Cancellations">
              One-time credit packs do not renew, so there is no subscription to cancel. Future recurring plans, if added, should include cancellation rules at checkout.
            </Section>

            <Section title="2. Refund review">
              Refunds can be reviewed for duplicate charges, failed credit activation after payment, or other billing mistakes. Send the payment receipt and account email.
            </Section>

            <Section title="3. Used credits">
              Voice generation has model cost. Credits used for completed generations are generally not reversible unless a billing or system error caused the issue.
            </Section>

            <Section title="4. Re-downloads">
              Downloading an already generated file does not spend credits again. Regenerating the same or edited text creates a new charge.
            </Section>

            <Section title="5. Contact">
              Email{" "}
              <a href="mailto:support@miithii.com" className="font-semibold text-[#147a35] underline-offset-4 hover:underline">
                support@miithii.com
              </a>{" "}
              for billing support.
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
