"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader() {
  const pathname = usePathname();
  
  return (
    <header className="flex-shrink-0 w-full bg-[var(--bg-primary)] border-b border-white/[0.04]">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className="p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-6 h-6 rounded-md bg-[#30D158] flex items-center justify-center">
              <span className="text-xs font-bold text-black" style={{ fontFamily: 'system-ui' }}>ম</span>
            </div>
            <span className="font-medium text-sm hidden sm:block">Miithii</span>
          </Link>
        </div>
        
        <nav className="flex items-center gap-0.5">
          <NavLink href="/chat" active={pathname?.startsWith("/chat") ?? false}>
            Chat
          </NavLink>
          <NavLink href="/terms" active={pathname === "/terms"}>
            Terms
          </NavLink>
          <NavLink href="/refund" active={pathname === "/refund"}>
            Refund
          </NavLink>
          <NavLink href="/contact" active={pathname === "/contact"}>
            Contact
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ 
  href, 
  active, 
  children 
}: { 
  href: string; 
  active: boolean; 
  children: React.ReactNode 
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-2.5 py-1.5 rounded-md text-xs transition-colors",
        active 
          ? "text-[#30D158] bg-[#30D158]/10" 
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]"
      )}
    >
      {children}
    </Link>
  );
}
