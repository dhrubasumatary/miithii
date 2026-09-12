"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";

const clerkPublishableKey =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkPublishableKey) {
    return (
      <main className="chat-shell chat-shell--signed-out" aria-label="Configuration error">
        <section className="chat-signin-panel" style={{ maxWidth: 460 }}>
          <span className="chat-brand__dot" aria-hidden="true" />
          <h1 style={{ fontSize: "28px" }}>Setup Required</h1>
          <p>
            Miithii Chat requires a Clerk publishable key. Please configure{" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> in your environment.
          </p>
        </section>
      </main>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "var(--mi-primary)",
          colorBackground: "var(--mi-surface)",
          colorInputBackground: "var(--mi-surface-raised)",
          colorText: "var(--mi-text)",
          colorTextSecondary: "var(--mi-text-muted)",
          colorNeutral: "var(--mi-text)",
          borderRadius: "12px",
          fontFamily: "var(--font-miithii-body), Manrope, system-ui, sans-serif",
        },
        elements: {
          modalBackdrop: "backdrop-blur-md bg-black/35",
          cardBox: "shadow-[var(--mi-shadow-lg)]",
          card: "border border-[var(--mi-border)] bg-[var(--mi-surface)]",
          headerTitle: "font-[var(--font-miithii-display)] tracking-[-0.035em]",
          headerSubtitle: "text-[var(--mi-text-muted)]",
          socialButtonsBlockButton: "border-[var(--mi-border)] bg-[var(--mi-surface-subtle)] hover:bg-[var(--mi-hover)]",
          formFieldInput: "border-[var(--mi-border)] bg-[var(--mi-surface-raised)] focus:border-[var(--mi-primary)]",
          formButtonPrimary: "bg-[var(--mi-primary)] text-[var(--mi-on-primary)] hover:bg-[var(--mi-primary-hover)] shadow-none",
          footerActionLink: "text-[var(--mi-primary-strong)] hover:text-[var(--mi-primary)]",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
