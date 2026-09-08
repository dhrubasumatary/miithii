"use client";

import {
  AssistantRuntimeProvider,
  AssistantCloud,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState
} from "@assistant-ui/react";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { ArrowUp, AudioLines, MessageCirclePlus, Plus, Search, Settings2, Sparkles, Square, Trash2 } from "lucide-react";

const assistantCloud = new AssistantCloud({
  // The project id is encoded in this Frontend API URL. This public endpoint
  // is safe to ship in the static client; anonymous mode issues its own
  // browser-scoped Cloud identity.
  baseUrl:
    process.env.NEXT_PUBLIC_ASSISTANT_BASE_URL ??
    "https://proj-00s8iick8y6c.assistant-api.com",
  anonymous: true,
});

// The chat Worker proxies this same-origin path to the API Worker through a
// private service binding. Keeping the browser request same-origin avoids
// extension and cross-origin restrictions without exposing any credentials.
export function Chat() {
  const runtime = useDataStreamRuntime({
    api: "/api/chat",
    credentials: "include",
    protocol: "data-stream",
    cloud: assistantCloud,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="chat-shell">
        <aside className="chat-rail" aria-label="Chat navigation">
          <a className="chat-rail__mark" href="https://miithii.in" aria-label="Miithii home">
            <span className="chat-brand__dot" aria-hidden="true" />
          </a>
          <div className="chat-rail__tools">
            <button className="chat-rail__button chat-rail__button--active" type="button" aria-label="New chat" onClick={() => runtime.thread.reset()}><Plus aria-hidden="true" /></button>
            <button className="chat-rail__button" type="button" aria-label="Search chats"><Search aria-hidden="true" /></button>
            <a className="chat-rail__button" href="https://voice.miithii.in" aria-label="Open voice chat"><AudioLines aria-hidden="true" /></a>
          </div>
          <button className="chat-rail__button chat-rail__settings" type="button" aria-label="Settings"><Settings2 aria-hidden="true" /></button>
        </aside>
        <ChatHeader onClear={() => runtime.thread.reset()} />

        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="chat-viewport" turnAnchor="top">
            <div className="chat-content">
              <AuiIf condition={state => state.thread.isEmpty}>
                <Welcome onStart={prompt => runtime.thread.append(prompt)} />
              </AuiIf>
              <section className="chat-messages" aria-live="polite">
                <ThreadPrimitive.Messages>{() => <ChatMessage />}</ThreadPrimitive.Messages>
              </section>
              <ThreadPrimitive.ViewportFooter className="chat-composer-wrap">
                <Composer />
                <p className="chat-disclaimer">Miithii can make mistakes. Avoid sharing sensitive information.</p>
              </ThreadPrimitive.ViewportFooter>
            </div>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </main>
    </AssistantRuntimeProvider>
  );
}

function ChatHeader({ onClear }: { onClear: () => void }) {
  const isEmpty = useAuiState(state => state.thread.isEmpty);
  return (
    <header className="chat-header">
      <a className="chat-brand" href="https://miithii.in" aria-label="Miithii home">
        <span className="chat-brand__dot" aria-hidden="true" />
        <span>miithii</span>
      </a>
      <div className="chat-header__actions">
        <a className="chat-voice-link" href="https://voice.miithii.in"><AudioLines aria-hidden="true" /><span>Voice</span></a>
        <button className="chat-clear" type="button" onClick={onClear} disabled={isEmpty}>
          <Trash2 aria-hidden="true" />
          <span>Clear</span>
        </button>
      </div>
    </header>
  );
}

function Welcome({ onStart }: { onStart: (prompt: string) => void }) {
  return (
    <section className="chat-welcome">
      <span className="chat-welcome__mark" aria-hidden="true"><Sparkles /></span>
      <p className="chat-eyebrow">YOUR ASSAMESE COMPANION</p>
      <h1>What&apos;s on your mind?</h1>
      <p>Write naturally in English, Assamese, or a mix. Miithii replies in casual romanized Assamese.</p>
      <div className="chat-starters" aria-label="Conversation starters">
        <Starter prompt="Help me think through something" onStart={onStart} />
        <Starter prompt="I need a quick idea" onStart={onStart} />
        <Starter prompt="Let’s just talk" onStart={onStart} />
      </div>
    </section>
  );
}

function Starter({ prompt, onStart }: { prompt: string; onStart: (prompt: string) => void }) {
  return (
    <button type="button" className="chat-starter" onClick={() => onStart(prompt)}>
      <MessageCirclePlus aria-hidden="true" />
      {prompt}
    </button>
  );
}

function ChatMessage() {
  const role = useAuiState(state => state.message.role);
  return (
    <MessagePrimitive.Root className={`chat-message chat-message--${role}`}>
      {role === "assistant" ? <span className="chat-message__name">MIITHII</span> : null}
      <div className="chat-message__bubble">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function Composer() {
  const running = useAuiState(state => state.thread.isRunning);
  return (
    <ComposerPrimitive.Root className="chat-composer">
      <ComposerPrimitive.Input
        aria-label="Message Miithii"
        className="chat-composer__input"
        placeholder="Message Miithii…"
        rows={1}
        autoFocus
      />
      {running ? (
        <ComposerPrimitive.Cancel asChild>
          <button className="chat-send chat-send--stop" type="button" aria-label="Stop generating">
            <Square aria-hidden="true" />
          </button>
        </ComposerPrimitive.Cancel>
      ) : (
        <ComposerPrimitive.Send asChild>
          <button className="chat-send" type="submit" aria-label="Send message">
            <ArrowUp aria-hidden="true" />
          </button>
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  );
}
