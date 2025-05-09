"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "@/components/Navigation";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = pathname !== "/chat";
  return (
    <>
      {showNav && <Navigation />}
      <main>{children}</main>
    </>
  );
} 