"use client";

import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen min-h-dvh flex flex-col relative overflow-hidden bg-black text-[#EDEDED]">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[#1e3a8a] -top-32 -right-32 blur-[80px] opacity-20" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#064e3b] bottom-40 -left-20 blur-[80px] opacity-15" />
        <div className="grid-overlay" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
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
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div className="mb-12">
            <h1 className="text-3xl font-medium mb-4">Hit Us Up</h1>
            <p className="text-white/50 text-lg leading-relaxed">
              We&apos;re Prompt Mafia Inc.—two caffeine-fueled weirdos hacking Assamese AI in a Guwahati flat. 
              Miithii&apos;s our baby: Chat like your best mate, but with zero judgment and infinite patience.
            </p>
          </div>

          {/* Contact Card */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#30D158]/20 flex items-center justify-center">
                <MailIcon className="w-5 h-5 text-[#30D158]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Email Support</p>
                <a 
                  href="mailto:support@miithii.com" 
                  className="text-[#30D158] font-mono hover:underline"
                >
                  support@miithii.com
                </a>
              </div>
            </div>

            <div className="space-y-4 text-sm text-white/60">
              <p>
                We check this hourly (ish). Expect a reply in &lt;24h—faster if it&apos;s 
                <span className="text-[#30D158] font-mono"> &quot;URGENT&quot;</span> or a meme.
              </p>
              <p>
                No tickets, no bots, just Dhru yelling back.
              </p>
            </div>
          </div>

          {/* What to Include */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <span className="text-[#30D158] font-mono">→</span>
              What to Include
            </h2>
            <ul className="space-y-2 text-white/60 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-white/30 mt-1">•</span>
                Your account email (if applicable)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/30 mt-1">•</span>
                Description of the issue or question
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white/30 mt-1">•</span>
                Screenshots or error details for technical problems
              </li>
            </ul>
          </div>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4 mb-12">
            <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-white/30 mb-2">Response Time</p>
              <p className="text-white/80 font-mono">24-48h</p>
            </div>
            <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
              <p className="text-xs uppercase tracking-widest text-white/30 mb-2">Languages</p>
              <p className="text-white/80 font-mono">EN / অসমীয়া</p>
            </div>
          </div>

          {/* Sass Section */}
          <div className="border-t border-white/10 pt-8">
            <p className="text-white/40 text-sm leading-relaxed mb-4">
              Got beef with a buggy response? Wanna roast our beta ₹49 plan? 
              Spill tea on what Assamese slang we&apos;re missing? Or just say &quot;sup&quot;?
            </p>
            <p className="text-white/30 text-xs font-mono">
              P.S. Beta feedback? Gold. We&apos;re eating it for breakfast.
            </p>
          </div>

          {/* Signature */}
          <div className="mt-12 pt-8 border-t border-white/5">
            <p className="text-white/30 text-sm">
              – The Mafia <span className="text-white/20">(not actual criminals, just code ones)</span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-white/5 relative z-10">
        <div className="max-w-2xl mx-auto flex flex-wrap gap-4 justify-between items-center text-xs text-white/30">
          <p>© 2025 Prompt Mafia Inc.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
            <Link href="/refund" className="hover:text-white/50 transition-colors">Refund</Link>
            <Link href="/contact" className="text-[#30D158]">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7L13.03 12.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

