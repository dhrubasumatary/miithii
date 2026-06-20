import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact — Miithii',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Chat
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Get in Touch</span>
          </h1>
          <p className="text-muted text-lg">
            Have a question, feedback, or just want to say hello?
            We&apos;d love to hear from you.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-8 space-y-8">
          {/* Email */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/10 rounded-xl shrink-0">
              <Mail className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold mb-0.5">Email</h3>
              <a
                href="mailto:promptmafiainc@gmail.com"
                className="text-accent hover:underline text-sm"
              >
                promptmafiainc@gmail.com
              </a>
              <p className="text-muted text-sm mt-1">
                We typically respond within 24–48 hours on business days.
              </p>
            </div>
          </div>

          {/* Company */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/10 rounded-xl shrink-0">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold mb-0.5">Company</h3>
              <p className="text-sm">Prompt Mafia Inc.</p>
              <p className="text-muted text-sm mt-1">
                Building AI products in Assam, for the world.
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-4">
            <div className="p-3 bg-accent/10 rounded-xl shrink-0">
              <MapPin className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold mb-0.5">Location</h3>
              <p className="text-sm">Guwahati, Assam, India</p>
              <p className="text-muted text-sm mt-1">
                Proudly built in Northeast India.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted text-sm">
            For business inquiries, partnership proposals, or media requests,
            please include &quot;Business Inquiry&quot; in your email subject line.
          </p>
        </div>
      </div>
    </div>
  );
}