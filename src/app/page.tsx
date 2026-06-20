'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Sparkles,
  MessageSquare,
  Brain,
  CreditCard,
  Globe,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Chat in Assamese',
    description:
      'Miithii understands Assamese script, Roman Assamese, and natural code-mixing. She mirrors your language.',
  },
  {
    icon: Brain,
    title: 'Real Memory',
    description:
      'She remembers your conversations. Ask her about something you told her last week.',
  },
  {
    icon: Sparkles,
    title: 'Premium AI Quality',
    description:
      'Powered by Fireworks GLM-5.2 — top-tier reasoning, coding, and creative writing.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Edge-deployed on Cloudflare. Responses stream in milliseconds, not seconds.',
  },
  {
    icon: CreditCard,
    title: 'Pay Per Use',
    description:
      'Buy credit packs. No subscriptions. Top up via UPI, card, or wallet through Razorpay.',
  },
  {
    icon: Globe,
    title: 'Privacy First',
    description:
      'Your data stays in India. No training on your chats. Delete your history anytime.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
        <div className="mx-auto max-w-7xl px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#333] bg-[#111] px-4 py-1.5 text-sm text-[#a3a3a3] mb-8">
              <Sparkles className="w-4 h-4 text-[#e879f9]" />
              Built in Guwahati for Assam
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-white mb-6">
              Meet <span className="text-gradient">Miithii</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg sm:text-xl text-[#a3a3a3] mb-10 leading-relaxed">
              Your personal AI who actually understands Assamese, remembers
              everything, and isn&apos;t afraid to tell you the truth.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-8 py-3.5 font-semibold text-base hover:bg-gray-100 transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Start Chatting
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-xl border border-[#333] bg-transparent px-8 py-3.5 font-medium text-base hover:bg-[#111] transition-colors"
              >
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-y border-[#1a1a1a]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Miithii?
            </h2>
            <p className="text-[#a3a3a3] max-w-xl mx-auto">
              Not another generic chatbot. Built specifically for how Assam
              actually communicates.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-6 hover:border-[#333] transition-colors group"
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-[#1a1a1a] w-10 h-10 group-hover:bg-[#222] transition-colors">
                  <feature.icon className="w-5 h-5 text-[#e879f9]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[#a3a3a3] leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo prompt */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
            Try it yourself
          </h2>
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-6 text-left">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xs font-bold text-[#e879f9]">
                M
              </div>
              <div>
                <p className="text-sm text-[#a3a3a3] mb-1">Miithii</p>
                <p className="text-white text-base">
                  আপোনাৰ অভিবাদন! মই মিঠি। মই আপোনাৰ AI সহায়ক। কি খবৰ?
                </p>
              </div>
            </div>
            <p className="text-sm text-[#525252] text-center">
              Sign in to start a real conversation.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-[#1a1a1a]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to chat?
          </h2>
          <p className="text-[#a3a3a3] mb-8 max-w-lg mx-auto">
            Sign up with Google or Apple in seconds. No phone number needed.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-xl bg-[#e879f9] text-black px-8 py-3.5 font-semibold text-base hover:bg-[#d946ef] transition-colors"
          >
            <Sparkles className="w-5 h-5" />
            Get Started Free
          </Link>
          <p className="text-xs text-[#525252] mt-4">
            500 free tokens daily. Top up anytime via Razorpay.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#525252]">
            Built by Prompt Mafia Inc. in Guwahati, Assam.
          </p>
          <div className="flex items-center gap-6 text-sm text-[#525252]">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
