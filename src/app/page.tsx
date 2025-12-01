"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Languages, Eye, Sparkles } from "lucide-react";
import { ChatInput } from "@/components/chat/chat-input";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return;
    const conversationId = crypto.randomUUID();
    const encodedMessage = encodeURIComponent(text);
    router.push(`/chat/${conversationId}?m=${encodedMessage}`);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="w-full sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#30D158] flex items-center justify-center">
              <span className="text-sm font-bold text-black" style={{ fontFamily: 'system-ui' }}>ম</span>
            </div>
            <span className="font-medium text-sm hidden sm:block">Miithii</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/chat" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Chat
            </Link>
            <Link href="/contact" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Contact
            </Link>
            <Link href="/terms" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Terms
            </Link>
          </nav>

          <Link 
            href="/chat"
            className="px-3 sm:px-4 py-2 rounded-lg bg-[#30D158] text-black text-sm font-medium hover:bg-[#2ABF4E] transition-colors"
          >
            <span className="hidden sm:inline">Start Chatting</span>
            <span className="sm:hidden">Chat</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-8 sm:py-12">
          <div className="max-w-5xl mx-auto w-full">
            <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] mb-6 sm:mb-10">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
                <span className="text-xs text-[var(--text-tertiary)] font-mono">Beta • ₹49/month</span>
              </div>

              {/* Title */}
              <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight mb-4 sm:mb-6">
                The Smartest AI.
                <br />
                <span className="text-[#30D158]">Fluent in Axomiya.</span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg md:text-xl text-[var(--text-secondary)] max-w-xl mb-8 sm:mb-12 leading-relaxed">
                Miithii speaks your language. Experience real conversations in Axomiya that spark ideas, 
                solve problems, or just help you pass time. No formal introductions needed—just start typing.
              </p>

              {/* Chat Input */}
              <div className="max-w-2xl mb-8 sm:mb-12">
                <ChatInput
                  onSend={handleSend}
                  placeholder="Ask me anything in Axomiya or English..."
                  showAttach={false}
                />
                <p className="text-center text-[10px] sm:text-[11px] text-[var(--text-muted)] mt-3">
                  Press Enter to start chatting
                </p>
              </div>

              {/* Quick Suggestions */}
              <div className="flex flex-wrap gap-2 mb-10 sm:mb-16">
                {["Ki khobor tur?", "Mok roast kor", "Khorisa r recipe de", "Life advice de"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/[0.03] text-xs sm:text-sm text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {/* Card 1: Gemini 2.5 Pro */}
              <div className="bg-gradient-to-br from-[#4285F4]/10 via-[#EA4335]/5 to-[#FBBC05]/10 rounded-xl p-5 sm:p-6 border border-white/[0.04] hover:border-white/[0.08] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4285F4] via-[#9B72CB] to-[#D96570] flex items-center justify-center mb-4">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  Powered by Gemini 2.5
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--text-muted)]">Latest</span>
                </h3>
                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                  Google&apos;s most powerful AI—now customized to understand tur kotha and context perfectly.
                </p>
              </div>

              {/* Card 2: Vision + Create */}
              <div className="bg-white/[0.02] rounded-xl p-5 sm:p-6 border border-white/[0.04] hover:border-white/[0.08] transition-all group">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-4 group-hover:bg-white/[0.06] transition-colors">
                  <Eye className="w-5 h-5 text-[#30D158]" />
                </div>
                <h3 className="font-medium mb-2">See & Create</h3>
                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                  Analyze photos or generate art. Just ask, &quot;Eitu photo&apos;t ki ase?&quot; or &quot;Eta dhunia scene bana.&quot;
                </p>
              </div>

              {/* Card 3: Code-Mixing */}
              <div className="bg-white/[0.02] rounded-xl p-5 sm:p-6 border border-white/[0.04] hover:border-white/[0.08] transition-all group sm:col-span-2 lg:col-span-1">
                <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mb-4 group-hover:bg-white/[0.06] transition-colors">
                  <Languages className="w-5 h-5 text-[#30D158]" />
                </div>
                <h3 className="font-medium mb-2">Seamless Code-Mixing</h3>
                <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                  Axomiya, English, or a mix of both. Don&apos;t worry about grammar—moi bujhi pau.
                </p>
              </div>
            </div>
          </div>

          {/* About */}
          <div className={`max-w-5xl mx-auto w-full mt-16 sm:mt-24 lg:mt-32 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg sm:text-xl flex-shrink-0">
                🏴‍☠️
              </div>
              <div>
                <h2 className="font-serif text-lg sm:text-xl mb-1">Prompt Mafia Inc.</h2>
                <p className="text-[var(--text-tertiary)] text-xs sm:text-sm">Two caffeine-fueled weirdos in Guwahati</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 sm:gap-8 text-sm text-[var(--text-secondary)] leading-relaxed">
              <div>
                <p className="mb-4">
                  We&apos;re building Miithii as a stepping stone. This wrapper around Gemini is just 
                  the start—we want to attract young talent to help us train a foundational model 
                  that truly understands and speaks our native language.
                </p>
                <p>Bodo mode dropping soon. Promise.</p>
              </div>
              <div>
                <p className="mb-4">
                  The mission: Fund and build a core AI model from the ground up for low-resource 
                  languages. Starting with Axomiya, expanding from there.
                </p>
                <p className="text-[var(--text-muted)] font-mono text-xs">
                  We&apos;re in beta, iterating fast.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-4 sm:px-6 py-6 sm:py-8 border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 justify-between mb-6 sm:mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded bg-[#30D158] flex items-center justify-center">
                    <span className="text-black font-bold text-[10px] sm:text-xs" style={{ fontFamily: 'system-ui' }}>ম</span>
                  </div>
                  <span className="font-medium text-sm">Miithii</span>
                </div>
                <p className="text-[var(--text-muted)] text-xs max-w-xs">
                  Chat with AI in Axomiya. Built by Prompt Mafia Inc.
                </p>
              </div>

              <div className="flex gap-8 sm:gap-12 text-sm">
                <div>
                  <p className="text-[var(--text-muted)] text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3">Product</p>
                  <Link href="/chat" className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs sm:text-sm">
                    Chat
                  </Link>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3">Legal</p>
                  <div className="space-y-1 sm:space-y-2">
                    <Link href="/terms" className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs sm:text-sm">
                      Terms
                    </Link>
                    <Link href="/refund" className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs sm:text-sm">
                      Refund
                    </Link>
                  </div>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-[10px] sm:text-xs uppercase tracking-widest mb-2 sm:mb-3">Support</p>
                  <div className="space-y-1 sm:space-y-2">
                    <Link href="/contact" className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs sm:text-sm">
                      Contact
                    </Link>
                    <a href="mailto:support@miithii.com" className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-xs sm:text-sm">
                      Email
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-between items-center pt-4 sm:pt-6 border-t border-white/[0.04] text-[10px] sm:text-xs text-[var(--text-muted)]">
              <p>© 2025 Prompt Mafia Inc.</p>
              <p className="font-mono">Made with ☕ in Guwahati</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
