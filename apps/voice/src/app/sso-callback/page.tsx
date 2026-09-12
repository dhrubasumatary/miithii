"use client";

import { LogoMark } from "@miithii/ui";
import { useEffect, useState } from "react";
import { loadClerk } from "@/lib/clerk";

export default function SsoCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadClerk()
      .then(clerk => clerk.handleRedirectCallback())
      .catch(() => {
        if (!cancelled) setError("Sign in could not be completed. Return to Voice and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="voice-auth-state" aria-busy={!error}>
      <LogoMark className="voice-auth-state__mark" />
      <p>{error ?? "Finishing sign in…"}</p>
    </main>
  );
}
