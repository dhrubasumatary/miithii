"use client";

import { useState, useEffect, useCallback, type FC } from "react";
import {
  AssistantRuntimeProvider,
  AssistantCloud,
  useAui,
  useAuiState,
  unstable_useComposerInput,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/ai-sdk";
import { Thread } from "@/components/thread.aui";
import { ThreadList } from "@/components/thread-list.aui";
import {
  AudioLines,
  MessageCirclePlus,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings2,
  Sparkles,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@miithii/ui/lib/utils";

const assistantCloud = new AssistantCloud({
  baseUrl:
    process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL ??
    "https://proj-00s8iick8y6c.assistant-api.com",
  anonymous: true,
});

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const transport = new AssistantChatTransport({
  api: `${apiBaseUrl}/api/chat/v2`,
  credentials: "include",
});

export function Chat() {
  const runtime = useChatRuntime({
    transport,
    cloud: assistantCloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadUrlSync />
      <ChatShell />
    </AssistantRuntimeProvider>
  );
}

/**
 * Synchronizes the active Assistant Cloud thread with the ?thread= URL query param.
 * - Restores thread on initial page load if ?thread=<id> is present.
 * - Updates the query param when the user switches or creates a thread.
 * - Listens for browser Back/Forward navigation (popstate) to switch threads.
 */
function ThreadUrlSync() {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);

  // Restore thread from URL query param on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const threadParam = params.get("thread");
    if (threadParam && threadParam !== "main" && threadParam !== mainThreadId) {
      aui.threads?.switchToThread?.(threadParam);
    }
  }, [aui]);

  // Update URL query param when mainThreadId changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const currentParam = url.searchParams.get("thread");

    if (mainThreadId && mainThreadId !== "main") {
      if (currentParam !== mainThreadId) {
        url.searchParams.set("thread", mainThreadId);
        window.history.pushState({}, "", url.toString());
      }
    } else if (currentParam) {
      url.searchParams.delete("thread");
      window.history.replaceState({}, "", url.toString());
    }
  }, [mainThreadId]);

  // Listen to browser Back/Forward popstate
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const threadParam = params.get("thread");
      if (threadParam && threadParam !== "main") {
        aui.threads?.switchToThread?.(threadParam);
      } else {
        aui.threads?.switchToNewThread?.();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [aui]);

  return null;
}

function ChatShell() {
  const aui = useAui();
  const mainThreadId = useAuiState((s) => s.threads.mainThreadId);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Close mobile drawer automatically when a thread is selected
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [mainThreadId]);

  const handleNewChat = useCallback(() => {
    aui.threads?.switchToNewThread?.();
    setMobileDrawerOpen(false);
  }, [aui]);

  return (
    <main className="chat-shell">
      {/* Desktop Left Rail (68px) */}
      <aside className="chat-rail" aria-label="Navigation rail">
        <a
          className="chat-rail__mark"
          href="https://miithii.in"
          aria-label="Miithii home"
          title="Miithii home"
        >
          <span className="chat-brand__dot" aria-hidden="true" />
        </a>

        <div className="chat-rail__tools">
          <button
            className="chat-rail__button"
            type="button"
            aria-label="New chat"
            title="New chat"
            onClick={handleNewChat}
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            className={cn(
              "chat-rail__button",
              desktopDrawerOpen && "chat-rail__button--active"
            )}
            type="button"
            aria-label={desktopDrawerOpen ? "Close conversations" : "Open conversations"}
            title="Conversations history"
            onClick={() => setDesktopDrawerOpen((v) => !v)}
          >
            {desktopDrawerOpen ? (
              <PanelLeftClose aria-hidden="true" />
            ) : (
              <PanelLeft aria-hidden="true" />
            )}
          </button>
          <a
            className="chat-rail__button"
            href="https://voice.miithii.in"
            aria-label="Open voice companion"
            title="Voice companion"
          >
            <AudioLines aria-hidden="true" />
          </a>
        </div>

        <button
          className="chat-rail__button chat-rail__settings"
          type="button"
          aria-label="Settings"
          title="Settings & info"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 aria-hidden="true" />
        </button>
      </aside>

      {/* Desktop Expandable Thread Drawer (280px) */}
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
      </aside>

      {/* Main Conversation Area */}
      <div className="chat-main-canvas">
        {/* Mobile Top Header */}
        <header className="chat-mobile-header">
          <button
            type="button"
            className="chat-mobile-header__btn"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open conversations list"
          >
            <Menu className="size-5" />
          </button>

          <a
            className="chat-brand"
            href="https://miithii.in"
            aria-label="Miithii home"
          >
            <span className="chat-brand__dot" aria-hidden="true" />
            <span>miithii</span>
          </a>

          <div className="chat-mobile-header__actions">
            <a
              className="chat-mobile-header__btn"
              href="https://voice.miithii.in"
              aria-label="Open voice companion"
            >
              <AudioLines className="size-5" />
            </a>
            <button
              type="button"
              className="chat-mobile-header__btn"
              onClick={handleNewChat}
              aria-label="New chat"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </header>

        {/* Runtime-Connected Assistant-UI Thread */}
        <div className="chat-thread-container">
          <Thread components={{ Welcome: MiithiiWelcome }} autoFocus />
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
          </aside>
        </div>
      )}

      {/* Settings & Info Modal */}
      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
    </main>
  );
}

/**
 * Calm, centered Welcome view matching Miithii's brand.
 * Includes fast starter chips that populate the composer.
 */
const MiithiiWelcome: FC = () => {
  return (
    <section className="chat-welcome" aria-label="Welcome to Miithii">
      <span className="chat-welcome__mark" aria-hidden="true">
        <Sparkles className="size-5" />
      </span>
      <p className="chat-eyebrow">YOUR ASSAMESE COMPANION</p>
      <h1>What&apos;s on your mind?</h1>
      <p>
        Write naturally in English, Assamese, or a mix. Miithii replies in
        casual romanized Assamese.
      </p>
      <div className="chat-starters" aria-label="Conversation starters">
        <Starter prompt="Help me think through something" />
        <Starter prompt="I need a quick idea" />
        <Starter prompt="Let’s just talk" />
        <Starter prompt="kun tumi?" />
      </div>
    </section>
  );
};

function Starter({ prompt }: { prompt: string }) {
  const { setText } = unstable_useComposerInput();

  return (
    <button
      type="button"
      className="chat-starter"
      onClick={() => setText(prompt)}
    >
      <MessageCirclePlus className="size-3.5" aria-hidden="true" />
      <span>{prompt}</span>
    </button>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
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
          <span className="chat-drawer__title">Miithii Companion</span>
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
            <strong>Architecture</strong>
            <p>Assistant Cloud history persistence with Cloudflare API generation runtime (v2).</p>
          </div>
          <div className="chat-settings-item">
            <strong>Usage Limit</strong>
            <p>50 messages per day for anonymous guest sessions. Resets at midnight IST.</p>
          </div>
          <div className="chat-settings-item">
            <strong>Voice Mode</strong>
            <p>
              Experience voice-first conversation at{" "}
              <a
                href="https://voice.miithii.in"
                className="chat-settings-link inline-flex items-center gap-1 text-[#5a861d] underline"
                target="_blank"
                rel="noreferrer"
              >
                voice.miithii.in <ExternalLink className="size-3" />
              </a>
            </p>
          </div>
          <div className="chat-settings-item">
            <strong>Session Privacy</strong>
            <p>Conversations are stored anonymously in your browser profile.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
