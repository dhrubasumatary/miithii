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
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
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
            className="px-3 py-1.5 rounded-lg bg-[#30D158] text-black text-sm font-medium hover:bg-[#2ABF4E] transition-colors"
          >
            Chat
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-x-hidden">
        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center px-5 py-12 sm:py-16">
          <div className="max-w-xl mx-auto w-full">
            <div className={`space-y-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#30D158]" />
                <span className="text-xs text-[var(--text-tertiary)]">Beta • ₹49/month</span>
              </div>

              {/* Title */}
              <div>
                <h1 className="font-serif text-[32px] sm:text-4xl md:text-5xl leading-tight tracking-tight">
                  The Smartest AI.
                  <br />
                  <span className="text-[#30D158]">Fluent in Axomiya.</span>
                </h1>
              </div>

              {/* Description */}
              <p className="text-[15px] sm:text-base text-[var(--text-secondary)] leading-relaxed">
                Real conversations in Axomiya that spark ideas, solve problems, or just help you pass time. 
                No formalities—just start typing.
              </p>

              {/* Chat Input */}
              <div>
                <ChatInput
                  onSend={handleSend}
                  placeholder="Ask me anything..."
                  showAttach={false}
                />
              </div>

              {/* Quick Suggestions */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { text: "Ki khobor?", label: "Greet" },
                  { text: "Roast kor mok", label: "Fun" },
                  { text: "Recipe de", label: "Food" },
                  { text: "Life advice", label: "Deep" }
                ].map((item) => (
                  <button
                    key={item.text}
                    onClick={() => handleSend(item.text)}
                    className="flex-shrink-0 px-3 py-2 rounded-lg bg-white/[0.03] text-[13px] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] transition-all border border-white/[0.04]"
                  >
                    {item.text}
                  </button>
                ))}
              </div>

              {/* Features */}
              <div className="space-y-3 pt-4">
                <div className="flex gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-[#30D158]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-[13px] mb-0.5">Gemini 2.5 Pro</h3>
                    <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                      Google&apos;s most capable AI, tuned for tur kotha.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Eye className="w-4 h-4 text-[#30D158]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-[13px] mb-0.5">See & Create</h3>
                    <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                      Analyze photos, generate art. Just ask.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Languages className="w-4 h-4 text-[#30D158]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-[13px] mb-0.5">Code-Mix Freely</h3>
                    <p className="text-[13px] text-[var(--text-tertiary)] leading-relaxed">
                      Axomiya, English, or mix—moi bujhi pau.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-5 border-t border-white/[0.04]">
          <div className="max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-[11px] text-[var(--text-muted)]">
              <div className="flex items-center gap-4">
                <Link href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">Terms</Link>
                <Link href="/refund" className="hover:text-[var(--text-secondary)] transition-colors">Refund</Link>
                <Link href="/contact" className="hover:text-[var(--text-secondary)] transition-colors">Contact</Link>
              </div>
              <p>© 2025 Prompt Mafia</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
