'use client';

import Link from 'next/link';
import { UserButton, Show } from '@clerk/nextjs';
import { MessageSquare } from 'lucide-react';
import { CreditBadge } from './credit-badge';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1a1a1a] bg-[#0a0a0a]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold text-white tracking-tight">
            Miithii
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Show when="signed-in">
            <CreditBadge />
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#333] bg-transparent px-3 py-1.5 text-sm text-[#a3a3a3] hover:border-[#e879f9] hover:text-[#e879f9] transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </Link>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            />
          </Show>

          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#e879f9] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#d946ef] transition-colors"
            >
              Sign In
            </Link>
          </Show>
        </div>
      </div>
    </header>
  );
}