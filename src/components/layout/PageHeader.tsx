"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FileAudio } from "lucide-react";
import type { ReactNode } from "react";
import { AuthControls } from "@/components/auth/AuthControls";
import { cn } from "@/lib/utils";

export function PageHeader() {
  const pathname = usePathname();
  const voiceActive = pathname === "/" || pathname === "/voice";
  
  return (
    <header className="w-full flex-shrink-0 border-b border-[#d9d7ce] bg-[#f6f5ef]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#30D158] text-black shadow-sm">
              <span className="text-sm font-black leading-none" style={{ fontFamily: "system-ui" }}>ম</span>
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-[#111311]">Miithii</span>
              <span className="hidden text-[11px] text-black/45 sm:block">Assamese voice</span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/voice" active={voiceActive}>
              <FileAudio className="h-3.5 w-3.5" />
              <span>Voice</span>
            </NavLink>
            <NavLink href="/pricing" active={pathname === "/pricing"} className="hidden sm:inline-flex">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Pricing</span>
            </NavLink>
            <NavLink href="/terms" active={pathname === "/terms"} className="hidden lg:inline-flex">
              Terms
            </NavLink>
            <NavLink href="/refund" active={pathname === "/refund"} className="hidden lg:inline-flex">
              Refund
            </NavLink>
            <NavLink href="/contact" active={pathname === "/contact"} className="hidden sm:inline-flex">
              Contact
            </NavLink>
          </nav>
          <AuthControls compact />
        </div>
      </div>
    </header>
  );
}

function NavLink({ 
  href, 
  active, 
  className,
  children 
}: { 
  href: string; 
  active: boolean; 
  className?: string;
  children: ReactNode 
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active 
          ? "bg-[#111311] text-white" 
          : "text-black/60 hover:bg-white hover:text-black",
        className
      )}
    >
      {children}
    </Link>
  );
}
