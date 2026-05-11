"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/auth/AuthControls";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#d9d7ce] bg-[#f6f5ef]/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#30D158]">
              <span className="font-mono text-sm font-bold text-black">ম</span>
            </div>
            <span className="font-medium text-[#111311]">Miithii</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <NavLink href="/voice" active={pathname === "/voice"}>
              Voice
            </NavLink>
            <NavLink href="/contact" active={pathname === "/contact"}>
              Contact
            </NavLink>
            <NavLink href="/terms" active={pathname === "/terms"}>
              Terms
            </NavLink>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AuthControls compact />
          <Link
            href="/voice"
            className="hidden rounded-md bg-[#111311] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black sm:inline-flex"
          >
            Generate audio
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
        "text-sm transition-colors hover:text-black",
        active ? "font-medium text-black" : "text-black/50"
      )}
    >
      {children}
    </Link>
  );
}
