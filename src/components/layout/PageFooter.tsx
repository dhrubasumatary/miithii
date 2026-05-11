"use client";

import Link from "next/link";

export function PageFooter() {
  return (
    <footer className="flex-shrink-0 border-t border-[#d9d7ce] bg-[#f6f5ef] px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-2 text-black/48">
          <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#30D158]">
            <span className="text-[8px] font-bold text-black" style={{ fontFamily: "system-ui" }}>ম</span>
          </div>
          <span className="text-xs">
            © 2026 Prompt Mafia Inc. · Made in Guwahati
          </span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-black/48">
          <Link href="/pricing" className="transition-colors hover:text-black/70">Pricing</Link>
          <Link href="/terms" className="transition-colors hover:text-black/70">Terms</Link>
          <Link href="/refund" className="transition-colors hover:text-black/70">Refund</Link>
          <Link href="/contact" className="transition-colors hover:text-black/70">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
