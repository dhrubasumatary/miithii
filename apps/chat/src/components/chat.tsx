"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type FC } from "react";
import {
  AssistantRuntimeProvider,
  AssistantCloud,
  type AttachmentAdapter,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/ai-sdk";
import type { UIMessage } from "ai";
import { Thread } from "@/components/thread.aui";
import { ThreadList } from "@/components/thread-list.aui";
import {
  LogOut,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  Sun,
  X,
} from "lucide-react";
import {
  useAuth,
  useClerk,
  useSignIn,
  useUser,
} from "@clerk/clerk-react";
import {
  ProductDock,
  type MiithiiTheme,
  useMiithiiTheme,
} from "@miithii/ui";
import { cn } from "@miithii/ui/lib/utils";
import { getProductUrl } from "@miithii/ui/product-links";
import { useAccount } from "@/hooks/use-account";
import { createChatImageAttachmentAdapter } from "@/lib/attachment-adapter";

type Account = ReturnType<typeof useAccount>;
type ThemeMode = MiithiiTheme;

const assistantBaseUrl =
  process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL ??
  "https://proj-00s8iick8y6c.assistant-api.com";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const GoogleMark: FC = () => (
  <svg viewBox="0 0 18 18" aria-hidden="true" className="chat-google-mark">
    <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.91c1.703-1.568 2.683-3.879 2.683-6.614Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.957-2.181l-2.91-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A8.999 8.999 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.168.282-1.706V4.962H.956A8.997 8.997 0 0 0 0 9c0 1.45.347 2.822.956 4.038l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.442 1.346l2.581-2.581C13.463.892 11.426 0 9 0A8.999 8.999 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
  </svg>
);

// A local composer draft gets a temporary id ("main" for the first thread,
// or an SDK-generated "__LOCALID_*" placeholder) until Cloud assigns a real
// thread id. Only persisted ids are safe to put in the URL or title.
const isPersistedThreadId = (id: string | null | undefined): id is string =>
  Boolean(id && id !== "main" && !id.startsWith("__LOCALID_"));

// Confirmed product decision: thread titles are a deterministic excerpt of
// the first user message, never a language/topic guess.
function excerptTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";
  const MAX = 60;
  if (normalized.length <= MAX) return normalized;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let result = "";
    for (const { segment } of segmenter.segment(normalized)) {
      if ((result + segment).length > MAX) break;
      result += segment;
    }
    return `${result.trimEnd()}\u2026`;
  }
  return `${normalized.slice(0, MAX).trimEnd()}\u2026`;
}

export function Chat() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { theme, changeTheme } = useMiithiiTheme();
  const runtimeConfig = useMemo(() => {
    if (!isLoaded || !isSignedIn) return null;

    const authToken = async () => getToken({ template: "assistant-ui" });
    const getApiToken = async () => getToken({ template: "miithii-api" });
    const assistantCloud = new AssistantCloud({
      baseUrl: assistantBaseUrl,
      authToken,
    });
    const attachmentAdapter = createChatImageAttachmentAdapter(getApiToken, apiBaseUrl);
    const transport = new AssistantChatTransport<UIMessage>({
      api: `${apiBaseUrl}/api/chat/v2`,
      headers: async () => {
        const token = await getApiToken();
        const authHeaders: Record<string, string> = {};
        if (token) authHeaders.Authorization = `Bearer ${token}`;
        return authHeaders;
      },
    });

    return { assistantCloud, attachmentAdapter, transport };
  }, [getToken, isLoaded, isSignedIn]);

  if (!isLoaded) return <ChatLoadingShell />;
  if (!isSignedIn || !runtimeConfig) {
    return <SignedOutChat />;
  }

  return (
    <AuthenticatedChat
      {...runtimeConfig}
      theme={theme}
      onThemeChange={changeTheme}
    />
  );
}

function AuthenticatedChat({
  assistantCloud,
  attachmentAdapter,
  transport,
  theme,
  onThemeChange,
}: {
  assistantCloud: AssistantCloud;
  attachmentAdapter: AttachmentAdapter;
  transport: AssistantChatTransport<UIMessage>;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const runtime = useChatRuntime({
    transport,
    cloud: assistantCloud,
    adapters: { attachments: attachmentAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadUrlSync />
      <ThreadTitleSync />
      <ChatShell theme={theme} onThemeChange={onThemeChange} />
    </AssistantRuntimeProvider>
  );
}

function ChatLoadingShell() {
  return (
    <main className="chat-shell chat-shell--loading" aria-busy="true">
      <div className="chat-loading-card">
        <span className="chat-brand__dot" aria-hidden="true" />
        <span>Loading Miithii...</span>
      </div>
    </main>
  );
}

function SignedOutChat() {
  const { isLoaded: isSignInLoaded, signIn } = useSignIn();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const continueWithGoogle = async () => {
    if (!isSignInLoaded || !signIn || isRedirecting) return;
    setAuthError(null);
    setIsRedirecting(true);

    try {
      const completeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: completeUrl || "/",
      });
    } catch (error) {
      console.error("Unable to start Google sign in", error);
      setAuthError("Google sign in could not start. Please try again.");
      setIsRedirecting(false);
    }
  };

  return (
    <main className="chat-shell chat-shell--signed-out">
      <ProductDock active="chat" />
      <section className="chat-signin-panel" aria-label="Sign in required">
        <div className="chat-signin-copy">
          <span className="chat-signin-kicker">Miithii Chat</span>
          <h1>Think in your language.</h1>
          <p>
            Ask, write, plan, or just talk. Use English, Assamese, or both. Miithii keeps useful context so you can keep going instead of starting over.
          </p>
        </div>

        <p className="chat-signin-languages">English <span>·</span> অসমীয়া <span>·</span> mix both</p>

        <div className="chat-signin-actions">
          <button
            type="button"
            className="chat-auth-btn chat-auth-btn--primary"
            onClick={continueWithGoogle}
            disabled={!isSignInLoaded || isRedirecting}
            aria-busy={isRedirecting}
          >
            <GoogleMark />
            <span>{isRedirecting ? "Opening Google…" : "Continue with Google"}</span>
          </button>
        </div>
        {authError && <p className="chat-signin-error" role="alert">{authError}</p>}
        <p className="chat-signin-helper">Sign in once · 50 messages/day · your conversations stay with you</p>
      </section>
    </main>
  );
}

function AccountMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const name = user?.fullName?.trim()
    || user?.firstName?.trim()
    || user?.username?.trim()
    || "Miithii account";
  const email = user?.primaryEmailAddress?.emailAddress
    || user?.emailAddresses?.[0]?.emailAddress
    || "";
  const initial = name.charAt(0).toUpperCase() || "M";

  return (
    <div className="chat-account-menu" ref={menuRef}>
      <button
        type="button"
        className="chat-account-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt="" className="chat-account-avatar" />
        ) : (
          <span className="chat-account-avatar chat-account-avatar--initial" aria-hidden="true">{initial}</span>
        )}
      </button>

      {open && (
        <div className="chat-account-popover" role="dialog" aria-label="Account">
          <div className="chat-account-summary">
            <span className="chat-account-name">{name}</span>
            {email ? <span className="chat-account-email">{email}</span> : null}
          </div>
          <div className="chat-account-divider" />
          <button
            type="button"
            className="chat-account-action"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <Settings aria-hidden="true" />
            <span>Settings & appearance</span>
          </button>
          <button
            type="button"
            className="chat-account-action chat-account-action--danger"
            onClick={() => void signOut({ redirectUrl: "/" })}
          >
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Keep Assistant Cloud navigation and the URL in one direction at a time. */
function ThreadUrlSync() {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadsLoading = useAuiState((s) => s.threads.isLoading);
  const restoredRef = useRef(false);
  const previousThreadIdRef = useRef<string | null>(null);
  const suppressNextWriteRef = useRef(false);

  const clearThreadParam = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("thread")) return;
    url.searchParams.delete("thread");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Restore only after Cloud's thread list is ready. Until then the writer is
  // disabled, so a temporary local thread cannot erase a cold deep link.
  useEffect(() => {
    if (typeof window === "undefined" || threadsLoading || restoredRef.current) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const threadParam = params.get("thread");
    const restore = async () => {
      if (threadParam && !isPersistedThreadId(threadParam)) clearThreadParam();
      if (isPersistedThreadId(threadParam) && threadParam !== mainThreadId) {
        suppressNextWriteRef.current = true;
        try {
          await Promise.resolve(aui.threads?.switchToThread?.(threadParam));
        } catch (error) {
          console.warn("Unable to restore requested conversation", error);
          suppressNextWriteRef.current = false;
          clearThreadParam();
          try {
            suppressNextWriteRef.current = true;
            await Promise.resolve(aui.threads?.switchToNewThread?.());
          } catch {
            suppressNextWriteRef.current = false;
          }
        }
      }
      if (!cancelled) {
        previousThreadIdRef.current = mainThreadId ?? null;
        restoredRef.current = true;
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [aui, clearThreadParam, mainThreadId, threadsLoading]);

  // A newly-created local thread becoming a persisted Cloud id replaces the
  // temporary URL. Deliberate persisted-thread selections push history.
  useEffect(() => {
    if (typeof window === "undefined" || !restoredRef.current) return;
    const previousThreadId = previousThreadIdRef.current;
    previousThreadIdRef.current = mainThreadId ?? null;
    if (suppressNextWriteRef.current) {
      suppressNextWriteRef.current = false;
      return;
    }
    const url = new URL(window.location.href);
    const currentParam = url.searchParams.get("thread");

    if (isPersistedThreadId(mainThreadId)) {
      if (currentParam !== mainThreadId) {
        url.searchParams.set("thread", mainThreadId);
        const method = isPersistedThreadId(previousThreadId) ? "pushState" : "replaceState";
        window.history[method]({}, "", url.toString());
      }
    } else if (currentParam) {
      url.searchParams.delete("thread");
      window.history.replaceState({}, "", url.toString());
    }
  }, [mainThreadId]);

  // Browser Back/Forward drives Cloud, never another history write.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const threadParam = params.get("thread");
      if (isPersistedThreadId(threadParam)) {
        if (threadParam === mainThreadId) return;
        suppressNextWriteRef.current = true;
        Promise.resolve(aui.threads?.switchToThread?.(threadParam)).catch((error) => {
          suppressNextWriteRef.current = false;
          console.warn("Unable to open conversation from browser history", error);
          clearThreadParam();
        });
      } else if (isPersistedThreadId(mainThreadId)) {
        suppressNextWriteRef.current = true;
        Promise.resolve(aui.threads?.switchToNewThread?.()).catch(() => {
          suppressNextWriteRef.current = false;
        });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [aui, clearThreadParam, mainThreadId]);

  return null;
}

/**
 * Sets a thread's title from a deterministic excerpt of its first user
 * message the moment that message lands, so Cloud's own auto-titling (if
 * any) finds a non-empty title already in place. Respects manual renames:
 * once a thread has any title, this never touches it again.
 */
function ThreadTitleSync() {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const threadItems = useAuiState((s) => s.threads.threadItems);
  const messages = useAuiState((s) => s.thread.messages);
  const titledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isPersistedThreadId(mainThreadId)) return;
    if (titledRef.current.has(mainThreadId)) return;

    const currentItem = threadItems.find((item) => item.id === mainThreadId);
    if (currentItem?.title) {
      titledRef.current.add(mainThreadId);
      return;
    }

    const firstUserMessage = messages.find((m) => m.role === "user");
    const textPart = firstUserMessage?.content.find(
      (part): part is { type: "text"; text: string } => part.type === "text",
    );
    if (!textPart?.text) return;

    titledRef.current.add(mainThreadId);
    aui.threads.item("main").rename(excerptTitle(textPart.text));
  }, [aui, mainThreadId, threadItems, messages]);

  return null;
}

function ChatShell({
  theme,
  onThemeChange,
}: {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const account = useAccount();

  // Close mobile drawer automatically when a thread is selected
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [mainThreadId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileDrawerOpen(false);
      setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Refresh the daily usage readout once a run finishes, so Settings reflects
  // what the server actually charged rather than an optimistic guess.
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) account.refreshUsage();
    wasRunningRef.current = isRunning;
  }, [isRunning, account.refreshUsage]);

  const handleNewChat = useCallback(() => {
    aui.threads?.switchToNewThread?.();
    setMobileDrawerOpen(false);
  }, [aui]);

  const handleConversations = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      setMobileDrawerOpen(true);
      return;
    }
    setDesktopDrawerOpen((value) => !value);
  }, []);

  return (
    <main className="chat-shell">
      <ProductDock
        active="chat"
        actions={
          <>
          <button
            type="button"
            className={cn(
              "chat-product-action chat-product-action--labelled",
              (desktopDrawerOpen || mobileDrawerOpen) && "is-active",
            )}
            onClick={handleConversations}
            aria-label={desktopDrawerOpen ? "Close conversations" : "Open conversations"}
          >
            {desktopDrawerOpen ? <PanelLeftClose aria-hidden="true" /> : <PanelLeft aria-hidden="true" />}
            <span>History</span>
          </button>
          <button
            type="button"
            className="chat-product-action chat-product-action--labelled chat-product-action--primary chat-product-action--new"
            onClick={handleNewChat}
            aria-label="New chat"
          >
            <Plus aria-hidden="true" />
            <span>New</span>
          </button>
          </>
        }
        account={
          <AccountMenu onOpenSettings={() => setSettingsOpen(true)} />
        }
      />

      {/* Desktop conversation drawer */}
      <aside
        className={cn(
          "chat-drawer-desktop",
          desktopDrawerOpen ? "chat-drawer-desktop--open" : "chat-drawer-desktop--closed"
        )}
        aria-label="Conversations drawer"
      >
        <div className="chat-drawer__header">
          <span className="chat-drawer__title">Conversations</span>
          <button
            type="button"
            className="chat-drawer__toggle-btn"
            onClick={() => setDesktopDrawerOpen(false)}
            aria-label="Collapse conversations panel"
            title="Collapse panel"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
        <div className="chat-drawer__content">
          <ThreadList />
        </div>
        <div className="chat-drawer__footer">
          <button
            type="button"
            className="chat-drawer__settings-row"
            onClick={() => setSettingsOpen(true)}
          >
            <span>Settings & appearance</span>
          </button>
        </div>
      </aside>

      {/* Main Conversation Area */}
      <div className="chat-main-canvas">
        {/* Runtime-Connected Assistant-UI Thread */}
        <div className="chat-thread-container">
          <Thread
            components={{ Welcome: MiithiiWelcome }}
            autoFocus={false}
            composerMeta={<UsageMeter account={account} />}
          />
        </div>
      </div>

      {/* Mobile Slide-Out Drawer / Sheet */}
      {mobileDrawerOpen && (
        <div
          className="chat-mobile-drawer-overlay"
          onClick={() => setMobileDrawerOpen(false)}
          role="presentation"
        >
          <aside
            className="chat-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Mobile conversation history"
            role="dialog"
            aria-modal="true"
          >
            <div className="chat-drawer__header">
              <span className="chat-drawer__title">Conversations</span>
              <button
                type="button"
                className="chat-drawer__toggle-btn"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close drawer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="chat-drawer__content">
              <ThreadList />
            </div>
            <div className="chat-drawer__footer">
              <button
                type="button"
                className="chat-drawer__settings-row"
                onClick={() => {
                setMobileDrawerOpen(false);
                setSettingsOpen(true);
              }}
            >
                <span>Settings & appearance</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Settings & Info Modal */}
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          account={account}
          theme={theme}
          onThemeChange={onThemeChange}
        />
      )}
    </main>
  );
}

const MiithiiWelcome: FC = () => {
  const aui = useAui();
  const { user } = useUser();
  const [dayGreeting, setDayGreeting] = useState("Hello");
  const starters = [
    "Help me phrase this naturally in Assamese",
    "Think through a decision with me",
    "Explain this without jargon",
  ];

  const startWith = (text: string) => {
    aui.composer.setText(text);
    void aui.composer.send();
  };

  useEffect(() => {
    const hour = new Date().getHours();
    setDayGreeting(
      hour < 5
        ? "Hello"
        : hour < 12
          ? "Good morning"
          : hour < 17
            ? "Good afternoon"
            : hour < 22
              ? "Good evening"
              : "Hello",
    );
  }, []);

  const displayName = user?.firstName?.trim() || user?.username?.trim() || "";

  return (
    <section className="chat-welcome" aria-label="Welcome to Miithii">
      <span className="chat-welcome__eyebrow">Write naturally · context follows</span>
      <h1>{dayGreeting}{displayName ? `, ${displayName}` : ""}.</h1>
      <p>Use English, Assamese, or both. Miithii can carry useful context forward, so you can keep going instead of starting from zero.</p>
      <div className="chat-welcome__starters" aria-label="Conversation starters">
        {starters.map((starter) => (
          <button key={starter} type="button" onClick={() => startWith(starter)}>
            <span>{starter}</span>
            <span aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <a className="chat-welcome__voice" href={getProductUrl("voice")}>
        Prefer speaking? Open Voice <span aria-hidden="true">→</span>
      </a>
    </section>
  );
};

function UsageMeter({ account }: { account: Account }) {
  const { usage, usagePending, usageError } = account;
  if (usagePending && !usage) {
    return <div className="chat-usage-meter chat-usage-meter--loading" aria-hidden="true" />;
  }
  if (!usage || usageError && !usage) return null;

  const remainingRatio = usage.limit > 0
    ? Math.min(1, Math.max(0, usage.remaining / usage.limit))
    : 0;
  return (
    <div
      className="chat-usage-meter"
      data-level={usage.remaining <= 5 ? "low" : usage.remaining <= 15 ? "medium" : "normal"}
      aria-label={`${usage.remaining} of ${usage.limit} messages left today`}
    >
      <span className="chat-usage-meter__label">
        <strong>{usage.remaining}</strong> left today
      </span>
      <span className="chat-usage-meter__track" aria-hidden="true">
        <span
          className="chat-usage-meter__fill"
          style={{ width: `${Math.round(remainingRatio * 100)}%` }}
        />
      </span>
    </div>
  );
}

function SettingsDialog({
  onClose,
  account,
  theme,
  onThemeChange,
}: {
  onClose: () => void;
  account: Account;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const {
    usage,
    usagePending,
    usageError,
    prefs,
    prefsLoading,
    prefsLoadError,
    prefsPending,
    prefsSaveError,
    refreshUsage,
    refreshPrefs,
    setMemoryEnabled,
    forgetMemory,
  } = account;
  const [forgetState, setForgetState] = useState<"idle" | "confirm" | "working" | "done" | "error">("idle");

  const usageText = usagePending && !usage
      ? "Loading usage..."
      : usageError && !usage
        ? "Usage is unavailable right now."
        : !usage
          ? "Usage is unavailable right now."
      : usage.remaining <= 0
        ? `Daily limit reached. Resets ${new Date(usage.resetAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST.`
        : `${usage.remaining} of ${usage.limit} messages left today. Resets at midnight IST.`;

  const handleMemoryToggle = () => {
    if (!prefs || prefsPending) return;
    setMemoryEnabled(!prefs.memoryEnabled).catch(() => {});
  };

  const handleForget = () => {
    if (forgetState === "confirm" || forgetState === "error") {
      setForgetState("working");
      forgetMemory()
        .then(() => setForgetState("done"))
        .catch(() => setForgetState("error"));
      return;
    }
    setForgetState("confirm");
  };

  return (
    <div
      className="chat-mobile-drawer-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="chat-settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings and Information"
      >
        <div className="chat-drawer__header">
          <span className="chat-drawer__title">Settings</span>
          <button
            type="button"
            className="chat-drawer__toggle-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="chat-settings-content">
          <div className="chat-settings-item">
            <div className="chat-settings-item--row">
              <strong>Chat appearance</strong>
              <div className="chat-theme-switch" role="group" aria-label="Chat appearance">
                <button
                  type="button"
                  className={theme === "light" ? "is-active" : undefined}
                  onClick={() => onThemeChange("light")}
                  aria-pressed={theme === "light"}
                >
                  <Sun aria-hidden="true" />
                  Light
                </button>
                <button
                  type="button"
                  className={theme === "dark" ? "is-active" : undefined}
                  onClick={() => onThemeChange("dark")}
                  aria-pressed={theme === "dark"}
                >
                  <Moon aria-hidden="true" />
                  Dark
                </button>
              </div>
            </div>
            <p>Your theme follows you across Miithii on this browser.</p>
          </div>
          <div className="chat-settings-item">
            <div className="chat-settings-item--row chat-settings-item--top">
              <strong>Daily messages</strong>
              {usageError && (
                <button
                  type="button"
                  className="chat-settings-retry"
                  onClick={() => void refreshUsage()}
                  disabled={usagePending}
                >
                  {usagePending ? "Checking…" : "Retry"}
                </button>
              )}
            </div>
            <p aria-live="polite">{usageText}</p>
            {usageError && usage && (
              <p className="chat-settings-status chat-settings-status--error">
                Couldn&apos;t refresh usage. Showing the last known count.
              </p>
            )}
          </div>
          <div className="chat-settings-item">
            <div className="chat-settings-item--row">
              <strong>Remember useful details</strong>
              <button
                type="button"
                className="chat-settings-toggle"
                data-state={prefs?.memoryEnabled ? "on" : "off"}
                role="switch"
                aria-checked={Boolean(prefs?.memoryEnabled)}
                aria-label="Remember useful details across conversations"
                aria-busy={prefsLoading || prefsPending}
                disabled={!prefs || prefsLoading || prefsLoadError || prefsPending}
                onClick={handleMemoryToggle}
              >
                <span className="chat-settings-toggle-thumb" aria-hidden="true" />
              </button>
            </div>
            <p>
              When on, Miithii automatically keeps useful personal details across conversations. Turning this
              off stops future remembering and lookups, but does not erase what was already stored.
            </p>
            {prefsLoading && <p className="chat-settings-status">Loading memory setting…</p>}
            {prefsLoadError && (
              <div className="chat-settings-status-row">
                <p className="chat-settings-status chat-settings-status--error">
                  Memory settings are unavailable right now.
                </p>
                <button
                  type="button"
                  className="chat-settings-retry"
                  onClick={() => void refreshPrefs()}
                  disabled={prefsLoading}
                >
                  {prefsLoading ? "Checking…" : "Retry"}
                </button>
              </div>
            )}
            {prefsSaveError && (
              <p className="chat-settings-status chat-settings-status--error">
                Couldn&apos;t confirm that change. Please try again.
              </p>
            )}
            {prefsPending && <p className="chat-settings-status">Saving…</p>}
            <button
              type="button"
              className="chat-settings-danger-btn"
              disabled={forgetState === "working" || forgetState === "done" || prefsPending}
              onClick={handleForget}
            >
              {forgetState === "idle" && "Forget everything"}
              {forgetState === "confirm" && "Click again to confirm"}
              {forgetState === "working" && "Deleting…"}
              {forgetState === "done" && "Memories deleted"}
              {forgetState === "error" && "Try deleting again"}
            </button>
            {forgetState === "error" && (
              <p className="chat-settings-status chat-settings-status--error">
                Memories could not be deleted. Nothing is being reported as deleted.
              </p>
            )}
          </div>
          <div className="chat-settings-item">
            <strong>Voice</strong>
            <p>
              Talk out loud at{" "}
              <a
                href={getProductUrl("voice")}
                className="chat-settings-link"
                target="_blank"
                rel="noreferrer"
              >
                voice.miithii.in
              </a>
            </p>
          </div>
          <div className="chat-settings-item">
            <strong>History</strong>
            <p>Your conversations are synced to your signed-in account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
