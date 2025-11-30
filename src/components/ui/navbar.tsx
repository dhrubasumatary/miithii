"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#30D158]">
              <span className="font-mono text-sm font-bold text-black">M</span>
            </div>
            <span className="font-medium text-[#EDEDED]">Miithii</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <NavLink href="/chat" active={pathname === "/chat"}>
              Chat
            </NavLink>
            <NavLink href="/contact" active={pathname === "/contact"}>
              Contact
            </NavLink>
            <NavLink href="/terms" active={pathname === "/terms"}>
              Terms
            </NavLink>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/chat"
            className="rounded-lg bg-[#30D158] px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#2ABF4E]"
          >
            Start Chatting
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "text-sm transition-colors hover:text-white",
        active ? "text-white font-medium" : "text-white/50"
      )}
    >
      {children}
    </Link>
  );
}

