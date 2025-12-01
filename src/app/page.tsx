"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Eye, Languages } from "lucide-react";
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
      <header className="w-full sticky top-0 z-50 bg-[var(--bg-primary)]/90 backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
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
            className="px-4 py-2 rounded-lg bg-[#30D158] text-black text-sm font-medium hover:bg-[#2ABF4E] transition-colors"
          >
            Chat
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center px-4 py-8 md:py-16">
          <div className="max-w-2xl mx-auto w-full">
            <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
                <span className="text-xs text-[var(--text-tertiary)]">Beta • ₹49/month</span>
              </div>

              {/* Title */}
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4">
                The Smartest AI.
                <br />
                <span className="text-[#30D158]">Fluent in Axomiya.</span>
              </h1>

              {/* Description */}
              <p className="text-base text-[var(--text-secondary)] max-w-lg mb-8 leading-relaxed">
                Experience real conversations in Axomiya that spark ideas, solve problems, or just help you pass time. 
                No formal introductions—just start typing.
              </p>

              {/* Chat Input */}
              <div className="mb-6">
                <ChatInput
                  onSend={handleSend}
                  placeholder="Ask me anything in Axomiya or English..."
                  showAttach={false}
                />
              </div>

              {/* Quick Suggestions - horizontal scroll on mobile */}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar mb-12">
                {["Ki khobor?", "Mok roast kor", "Recipe de", "Life advice"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="flex-shrink-0 px-4 py-2 rounded-full bg-white/[0.04] text-sm text-[var(--text-secondary)] hover:bg-white/[0.08] hover:text-[var(--text-primary)] transition-all border border-white/[0.04]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {/* Features - Clean, consistent cards */}
              <div className="grid gap-3">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-[#30D158]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Gemini 2.5 Pro</h3>
                    <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                      Google&apos;s most capable AI—customized to understand tur kotha perfectly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Eye className="w-5 h-5 text-[#30D158]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">See & Create</h3>
                    <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                      Analyze photos, generate art. &quot;Eitu photo&apos;t ki ase?&quot; — just ask.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Languages className="w-5 h-5 text-[#30D158]" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm mb-1">Seamless Code-Mixing</h3>
                    <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
                      Axomiya, English, or mix. Don&apos;t worry about grammar—moi bujhi pau.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Minimal */}
        <footer className="px-4 py-6 border-t border-white/[0.04]">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-4 justify-between items-center text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">Terms</Link>
              <Link href="/refund" className="hover:text-[var(--text-secondary)] transition-colors">Refund</Link>
              <Link href="/contact" className="hover:text-[var(--text-secondary)] transition-colors">Contact</Link>
            </div>
            <p>© 2025 Prompt Mafia Inc.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
