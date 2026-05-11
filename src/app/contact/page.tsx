import { Clock, FileAudio, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { PageFooter } from "@/components/layout/PageFooter";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ContactPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f6f5ef] text-[#111311]">
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10">
          <header className="border-b border-[#d9d7ce] pb-5">
            <p className="mb-2 text-xs font-semibold uppercase text-black/42">Support</p>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Contact Miithii</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
              Send voice generation bugs, pronunciation feedback, account questions, or billing issues. For audio quality reports, include the source text and detected language.
            </p>
          </header>

          <section className="mt-5 rounded-lg border border-[#d8d6cc] bg-white p-4 shadow-[0_14px_40px_rgba(16,17,15,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-[#111311] text-white">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-black/42">Email support</p>
                <a href="mailto:support@miithii.com" className="mt-1 block truncate text-base font-semibold text-[#111311] underline-offset-4 hover:underline">
                  support@miithii.com
                </a>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoItem
              icon={<Clock className="h-4 w-4" />}
              title="Response time"
              text="Usually within 24-48 hours while the product is in active build."
            />
            <InfoItem
              icon={<FileAudio className="h-4 w-4" />}
              title="Audio reports"
              text="Send the source text, language, selected voice, and what sounded wrong."
            />
          </div>

          <section className="mt-8 border-t border-[#d9d7ce] pt-5">
            <h2 className="text-sm font-semibold">Helpful details</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-black/62">
              <li>Account email if the issue is tied to sign-in or credits.</li>
              <li>Screenshot or screen recording for UI bugs.</li>
              <li>The downloaded audio filename for export or playback problems.</li>
            </ul>
          </section>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}

function InfoItem({ icon, text, title }: { icon: ReactNode; text: string; title: string }) {
  return (
    <section className="rounded-lg border border-[#d8d6cc] bg-white p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-[#f1efe5] text-black/68">
        {icon}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-black/58">{text}</p>
    </section>
  );
}
