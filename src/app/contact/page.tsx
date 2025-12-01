"use client";

import { Mail, Clock, Globe, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageFooter } from "@/components/layout/PageFooter";

export default function ContactPage() {
  return (
    <div className="h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <PageHeader />

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Hero */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] mb-6">
              <Send className="w-3 h-3 text-[#30D158]" />
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider">Support</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-4">
              Hit Us Up
            </h1>
            <p className="text-[var(--text-secondary)] text-base leading-relaxed">
              We&apos;re Prompt Mafia Inc.—two caffeine-fueled weirdos hacking Assamese AI in a Guwahati flat.
            </p>
          </div>

          {/* Contact Card */}
          <div className="bg-white/[0.03] rounded-2xl p-6 mb-10">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-11 h-11 rounded-xl bg-[#30D158]/15 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#30D158]" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Email Support</p>
                <a 
                  href="mailto:support@miithii.com" 
                  className="text-[#30D158] font-mono text-sm hover:underline"
                >
                  support@miithii.com
                </a>
              </div>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              We check this hourly (ish). Expect a reply in &lt;24h—faster if it&apos;s 
              <span className="text-[#30D158] font-mono"> &quot;URGENT&quot;</span> or a meme.
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-3 mb-10">
            <div className="bg-white/[0.03] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Response</p>
              </div>
              <p className="font-mono text-sm">24-48h</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-[var(--text-muted)]" />
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Languages</p>
              </div>
              <p className="font-mono text-sm">EN / অসমীয়া</p>
            </div>
          </div>

          {/* What to Include */}
          <div className="mb-10">
            <h2 className="font-medium text-sm mb-4 text-[var(--text-primary)]">What to Include</h2>
            <ul className="space-y-2.5 text-[var(--text-secondary)] text-sm">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] mt-1.5 flex-shrink-0" />
                Your account email (if applicable)
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] mt-1.5 flex-shrink-0" />
                Description of the issue or question
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] mt-1.5 flex-shrink-0" />
                Screenshots for technical problems
              </li>
            </ul>
          </div>

          {/* Sass Section */}
          <div className="border-t border-white/[0.04] pt-8">
            <p className="text-[var(--text-tertiary)] text-sm leading-relaxed mb-3">
              Got beef with a buggy response? Wanna roast our beta ₹49 plan? 
              Spill tea on what Assamese slang we&apos;re missing?
            </p>
            <p className="text-[var(--text-muted)] text-xs font-mono">
              P.S. Beta feedback = Gold. We eat it for breakfast.
            </p>
          </div>

          <div className="mt-10 pt-8 border-t border-white/[0.04]">
            <p className="text-[var(--text-muted)] text-sm">
              – The Mafia <span className="opacity-50">(code criminals only)</span>
            </p>
          </div>
        </div>
      </main>

      <PageFooter />
    </div>
  );
}
