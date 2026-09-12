"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProductUrl } from "@miithii/ui/product-links";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

type ClerkSession = {
  getToken(options?: { template?: string; skipCache?: boolean }): Promise<string | null>;
};

type ClerkSignInResource = {
  authenticateWithRedirect(options: {
    strategy: "oauth_google";
    redirectUrl: string;
    redirectUrlComplete: string;
  }): Promise<void>;
};

type ClerkUser = {
  fullName?: string | null;
  firstName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{ emailAddress: string }>;
};

type ClerkGlobal = {
  isSignedIn: boolean;
  user?: ClerkUser | null;
  session?: ClerkSession | null;
  client?: { signIn?: ClerkSignInResource | null } | null;
  load(options?: Record<string, unknown>): Promise<void>;
  addListener(callback: () => void): () => void;
  signOut(options?: { redirectUrl?: string }): Promise<void>;
  handleRedirectCallback(options?: Record<string, unknown>): Promise<void>;
};

declare global {
  interface Window {
    Clerk?: ClerkGlobal;
  }
}

export type AuthStatus = "loading" | "signed-in" | "signed-out" | "missing" | "error";

function frontendDomain(key: string) {
  const encoded = key.match(/^pk_(?:test|live)_(.+)$/)?.[1];
  if (!encoded) throw new Error("Invalid Clerk publishable key");
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
  const domain = atob(base64).replace(/\$$/, "");
  if (!domain || /[^a-zA-Z0-9.-]/.test(domain)) throw new Error("Invalid Clerk frontend domain");
  return domain;
}

function loadScript(id: string, src: string, attributes: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${id}`)), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    Object.entries(attributes).forEach(([name, value]) => script.setAttribute(name, value));
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed to load ${id}`)), { once: true });
    document.head.appendChild(script);
  });
}

export async function loadClerk() {
  if (!publishableKey) throw new Error("Missing Clerk publishable key");
  const domain = frontendDomain(publishableKey);

  await loadScript("miithii-clerk-js", `https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
    "data-clerk-publishable-key": publishableKey
  });

  if (!window.Clerk) throw new Error("Clerk did not initialize");
  await window.Clerk.load();
  return window.Clerk;
}

export function useVoiceAuth() {
  const [status, setStatus] = useState<AuthStatus>(publishableKey ? "loading" : "missing");

  useEffect(() => {
    if (!publishableKey) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    loadClerk()
      .then(clerk => {
        if (cancelled) return;
        const sync = () => setStatus(clerk.isSignedIn ? "signed-in" : "signed-out");
        sync();
        unsubscribe = clerk.addListener(sync);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const getApiToken = useCallback(async () => {
    const session = window.Clerk?.session;
    if (!session) throw new Error("Sign in required");
    const token = await session.getToken({ template: "miithii-api" });
    if (!token) throw new Error("Sign in required");
    return token;
  }, []);

  return { status, getApiToken };
}

export function ClerkSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGoogle = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const clerk = await loadClerk();
      const signIn = clerk.client?.signIn;
      if (!signIn) throw new Error("Sign in is not ready");
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/"
      });
    } catch {
      setPending(false);
      setError("Google sign in could not start. Please try again.");
    }
  }, [pending]);

  return (
    <div className="voice-google-signin">
      <button type="button" onClick={startGoogle} disabled={pending} aria-busy={pending}>
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.91c1.703-1.568 2.683-3.879 2.683-6.614Z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.957-2.181l-2.91-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A8.999 8.999 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.168.282-1.706V4.962H.956A8.997 8.997 0 0 0 0 9c0 1.45.347 2.822.956 4.038l3.007-2.332Z" />
          <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.442 1.346l2.581-2.581C13.463.892 11.426 0 9 0A8.999 8.999 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
        </svg>
        <span>{pending ? "Opening Google…" : "Continue with Google"}</span>
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function VoiceAccountMenu() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<ClerkUser | null>(() =>
    typeof window === "undefined" ? null : window.Clerk?.user ?? null
  );

  useEffect(() => {
    const clerk = window.Clerk;
    if (!clerk) return;
    const sync = () => setUser(clerk.user ?? null);
    sync();
    return clerk.addListener(sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const name = user?.fullName?.trim() || user?.firstName?.trim() || user?.username?.trim() || "Miithii account";
  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";
  const initial = name.charAt(0).toUpperCase() || "M";

  return (
    <div className="voice-account" ref={wrapperRef}>
      <button
        type="button"
        className="voice-account__trigger"
        onClick={() => setOpen(value => !value)}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.imageUrl ? (
          <img className="voice-account__avatar" src={user.imageUrl} alt="" />
        ) : (
          <span className="voice-account__avatar voice-account__avatar--initial" aria-hidden="true">{initial}</span>
        )}
      </button>
      {open ? (
        <div className="voice-account__menu" role="menu" aria-label="Account">
          <div className="voice-account__identity">
            <strong>{name}</strong>
            {email ? <span>{email}</span> : null}
          </div>
          <div className="voice-account__rule" />
          <a className="voice-account__action" href={getProductUrl("chat")} role="menuitem">
            Chat & settings
          </a>
          <button
            type="button"
            className="voice-account__action voice-account__action--danger"
            role="menuitem"
            onClick={() => void window.Clerk?.signOut({ redirectUrl: "/" })}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
