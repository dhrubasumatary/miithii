"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen min-h-dvh flex flex-col relative overflow-hidden bg-black text-[#EDEDED]">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[#1e3a8a] top-1/4 -right-48 blur-[100px] opacity-20 animate-float" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[#064e3b] bottom-1/4 -left-32 blur-[100px] opacity-15 animate-float-slow" />
        <div className="grid-overlay" />
      </div>

      {/* Header */}
      <header className="hidden" />

      {/* Hero */}
      <main className="flex-1 flex flex-col justify-center px-4 py-16 relative z-10">
        <div className="max-w-4xl mx-auto w-full">
          <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
              <span className="text-xs text-white/50 font-mono">Beta • ₹49/month</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium leading-tight mb-6">
              Chat with AI
              <br />
              <span className="text-[#30D158]">in Assamese</span>
            </h1>

            {/* Description */}
            <p className="text-lg text-white/50 max-w-xl mb-8 leading-relaxed">
              Miithii speaks your language. Real conversations in Axomiya that spark ideas, 
              solve problems, and maybe even roast your bad puns.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-4 mb-16">
              <Link 
                href="/chat"
                className="px-6 py-3 rounded-xl bg-[#30D158] text-black font-medium hover:bg-[#2ABF4E] transition-all hover:scale-105"
              >
                Start Chatting →
              </Link>
              <Link 
                href="/contact"
                className="px-6 py-3 rounded-xl border border-white/20 text-white/70 hover:bg-white/5 hover:border-white/30 transition-all"
              >
                Contact Us
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className={`grid sm:grid-cols-3 gap-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <FeatureCard
              icon="🗣️"
              title="Native Assamese"
              description="Street-level Guwahati dialect, not textbook Sahitya Sabha"
            />
            <FeatureCard
              icon="⚡"
              title="Gemini Powered"
              description="Wrapped around Google's most capable AI model"
            />
            <FeatureCard
              icon="🛠️"
              title="Built-in Tools"
              description="Calculator, time zones, code runner, and more"
            />
          </div>
        </div>

        {/* About Section */}
        <div className={`max-w-4xl mx-auto w-full mt-24 pt-16 border-t border-white/5 transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl">
              🏴‍☠️
            </div>
            <div>
              <h2 className="text-xl font-medium mb-1">Prompt Mafia Inc.</h2>
              <p className="text-white/40 text-sm">Two caffeine-fueled weirdos in Guwahati</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-8 text-sm text-white/50 leading-relaxed">
            <div>
              <p className="mb-4">
                We&apos;re building Miithii as a stepping stone. This wrapper around Gemini is just 
                the start—we want to attract young talent to help us train a foundational model 
                that truly understands and speaks our native language.
              </p>
              <p>
                Bodo mode dropping soon. Promise.
              </p>
            </div>
            <div>
              <p className="mb-4">
                The mission: Fund and build a core AI model from the ground up for low-resource 
                languages. Starting with Assamese, expanding from there.
              </p>
              <p className="text-white/30 font-mono text-xs">
                We&apos;re in beta, iterating fast.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-white/5 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-8 justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-[#30D158] flex items-center justify-center">
                  <span className="text-black font-mono font-bold text-xs">M</span>
                </div>
                <span className="font-medium text-sm">Miithii</span>
              </div>
              <p className="text-white/30 text-xs max-w-xs">
                Chat with machines in Assamese. Built by Prompt Mafia Inc.
              </p>
            </div>

            <div className="flex gap-12 text-sm">
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Product</p>
                <div className="space-y-2">
                  <Link href="/chat" className="block text-white/50 hover:text-white transition-colors">
                    Chat
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Legal</p>
                <div className="space-y-2">
                  <Link href="/terms" className="block text-white/50 hover:text-white transition-colors">
                    Terms
                  </Link>
                  <Link href="/refund" className="block text-white/50 hover:text-white transition-colors">
                    Refund
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Support</p>
                <div className="space-y-2">
                  <Link href="/contact" className="block text-white/50 hover:text-white transition-colors">
                    Contact
                  </Link>
                  <a href="mailto:support@miithii.com" className="block text-white/50 hover:text-white transition-colors">
                    Email
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-between items-center pt-6 border-t border-white/5 text-xs text-white/30">
            <p>© 2025 Prompt Mafia Inc. All rights reserved.</p>
            <p className="font-mono">Made with ☕ in Guwahati</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-white/40">{description}</p>
    </div>
  );
}
