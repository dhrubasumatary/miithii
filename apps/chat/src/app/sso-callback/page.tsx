"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";

export default function SsoCallbackPage() {
  return (
    <main className="chat-shell chat-shell--loading" aria-busy="true">
      <AuthenticateWithRedirectCallback />
      <div className="chat-loading-card" aria-hidden="true">
        <span className="chat-brand__dot" />
        <span>Finishing sign in…</span>
      </div>
    </main>
  );
}
