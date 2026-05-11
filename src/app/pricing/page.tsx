import { Check, CreditCard, Download, IndianRupee } from "lucide-react";
import { CreditPackCheckout } from "@/components/billing/CreditPackCheckout";
import { PageFooter } from "@/components/layout/PageFooter";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  FREE_TRIAL_MINUTES,
  estimatePackEconomics,
  visibleLaunchCreditPacks,
} from "@/lib/billing/pricing";

export default function PricingPage() {
  return (
    <div className="flex h-screen flex-col bg-[#f6f5ef] text-[#111311]">
      <PageHeader />

      <main className="flex-1 overflow-y-auto">
        <section className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
          <div className="mb-5 flex flex-col gap-3 border-b border-[#d9d7ce] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-black/42">Assamese voice credits</p>
              <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Buy generated audio minutes</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/58">
                Smaller UPI-friendly packs for testing real voice quality before committing. Bodo and Manipuri stay included in beta.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-[#9ad9aa] bg-[#edf9ef] px-3 py-2 text-xs font-medium text-[#147a35]">
              <Download className="h-3.5 w-3.5" />
              Re-downloads are free
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {visibleLaunchCreditPacks.map((pack) => {
              const economics = estimatePackEconomics(pack);
              const featured = pack.id === "creator";
              const badge = "badge" in pack ? pack.badge : undefined;

              return (
                <article
                  key={pack.id}
                  className={`flex min-h-[250px] flex-col rounded-lg border p-4 shadow-[0_14px_40px_rgba(16,17,15,0.07)] ${
                    featured
                      ? "border-[#111311] bg-[#111311] text-white"
                      : "border-[#d8d6cc] bg-white text-[#111311]"
                  }`}
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-semibold">{pack.name}</h2>
                        {badge && (
                          <span
                            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                              featured ? "bg-[#30D158] text-black" : "bg-[#edf9ef] text-[#147a35]"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </div>
                      <p className={`mt-2 text-sm leading-6 ${featured ? "text-white/64" : "text-black/56"}`}>
                        {pack.description}
                      </p>
                    </div>
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
                        featured ? "bg-white/[0.08] text-[#30D158]" : "bg-[#f1efe5] text-black/70"
                      }`}
                    >
                      <IndianRupee className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="mt-auto">
                    <p className="flex items-end gap-1">
                      <span className="text-5xl font-semibold tracking-normal">₹{pack.priceInr}</span>
                      <span className={`pb-1 text-xs ${featured ? "text-white/48" : "text-black/45"}`}>one-time</span>
                    </p>
                    <div className={`mt-3 grid gap-2 text-sm ${featured ? "text-white/72" : "text-black/60"}`}>
                      <PackLine label="Minutes" value={`${pack.minutes} min`} />
                      <PackLine label="Unit price" value={`₹${economics.pricePerMinuteInr.toFixed(2)}/min`} />
                    </div>

                    <div className="mt-5">
                      <CreditPackCheckout featured={featured} pack={pack} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg border border-[#d8d6cc] bg-white p-4 shadow-[0_14px_40px_rgba(16,17,15,0.06)]">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-black/64" />
              <h2 className="text-sm font-semibold">Credit rules</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <RuleItem label="Free trial" value={`${FREE_TRIAL_MINUTES} min after signup`} />
              <RuleItem label="Generate" value="Credits are debited per audio render" />
              <RuleItem label="Download" value="Existing files do not burn credits again" />
            </div>
          </div>
        </section>
        <PageFooter />
      </main>
    </div>
  );
}

function PackLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-current/10 py-1 last:border-b-0">
      <span>{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function RuleItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#ece8dc] bg-[#fbfaf6] p-3">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-[#edf9ef] text-[#147a35]">
        <Check className="h-3.5 w-3.5" />
      </div>
      <p className="text-[11px] font-medium uppercase text-black/42">{label}</p>
      <p className="mt-1 text-sm font-medium leading-5 text-[#111311]">{value}</p>
    </div>
  );
}
