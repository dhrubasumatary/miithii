import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Globe, Cpu, Shield, Heart } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About — Miithii',
};

const TECH_STACK = [
  { name: 'GLM-5.2', desc: 'State-of-the-art large language model powering every conversation' },
  { name: 'Fireworks AI', desc: 'High-performance inference infrastructure' },
  { name: 'Supermemory', desc: 'Intelligent memory layer for context-aware AI responses' },
  { name: 'Cloudflare', desc: 'Global CDN, security, and edge computing' },
  { name: 'Supabase', desc: 'Open-source database with data residency in India' },
  { name: 'Clerk', desc: 'Modern authentication and user management' },
];

const VALUES = [
  { icon: Globe, title: 'Built in India', desc: 'Designed and operated from Guwahati, Assam — embracing our roots while building for the world.' },
  { icon: Sparkles, title: 'Quality First', desc: 'Every response is powered by cutting-edge AI models. We never compromise on the intelligence behind your conversations.' },
  { icon: Shield, title: 'Privacy by Design', desc: 'Your conversations stay yours. We implement strong data protection practices in compliance with DPDP Act 2023.' },
  { icon: Heart, title: 'Community Driven', desc: 'We build what our users need. Your feedback directly shapes the future of Miithii.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-radial h-72" />
      <div className="max-w-3xl mx-auto px-4 -mt-48 pb-24">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </Link>

        {/* Hero content */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted">Built in Guwahati, for the world</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="text-gradient">About Miithii</span>
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto leading-relaxed">
            Miithii is an AI-powered conversational platform that brings the intelligence of
            GLM-5.2 to everyday conversations. Built in Guwahati, Assam, we believe great
            technology should be accessible, privacy-respecting, and genuinely useful.
          </p>
        </div>

        {/* What is Miithii */}
        <div className="bg-surface border border-border rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">What is Miithii?</h2>
          <div className="space-y-4 text-muted leading-relaxed">
            <p>
              Miithii is an AI chat platform that lets you have rich, context-aware conversations
              powered by GLM-5.2 — one of the most capable open-weight language models available today.
              Whether you&apos;re brainstorming ideas, writing, learning, or just exploring questions,
              Miithii is designed to be your intelligent conversation partner.
            </p>
            <p>
              What sets us apart is our memory layer, powered by Supermemory. Miithii can maintain
              context across your conversations, remember your preferences, and provide responses that
              feel genuinely personalized rather than isolated.
            </p>
            <p>
              We operate on a credit-based model — pay only for what you use, with a generous daily
              free tier so anyone can try Miithii without commitment. No subscriptions, no lock-in.
            </p>
          </div>
        </div>

        {/* Team */}
        <div className="bg-surface border border-border rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">The Team</h2>
          <p className="text-muted leading-relaxed">
            Miithii is built by{' '}
            <span className="text-foreground font-medium">Prompt Mafia Inc.</span>, a technology
            company based in Guwahati, Assam, India. We are a small team of engineers and designers
            passionate about making powerful AI accessible to everyone.
          </p>
          <p className="text-muted leading-relaxed mt-3">
            Our name reflects our philosophy: we&apos;re obsessed with crafting the best possible
            AI experience — not just shipping features, but fermenting them with care and attention.
          </p>
        </div>

        {/* Values */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Our Values</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-surface border border-border rounded-xl p-5">
                <div className="p-2 bg-accent/10 rounded-lg w-fit mb-3">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Powered By</h2>
          <div className="space-y-3">
            {TECH_STACK.map(({ name, desc }) => (
              <div key={name} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{name}</span>
                  <span className="text-muted text-sm"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center gap-2 text-muted text-sm">
              <Cpu className="w-4 h-4 text-accent" />
              <span>
                Built with Next.js 15, TypeScript, and Tailwind CSS. Deployed on Cloudflare.
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-muted mb-4">Ready to experience Miithii?</p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-background font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Start Chatting
          </Link>
        </div>
      </div>
    </div>
  );
}