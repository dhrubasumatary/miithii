"use client";

import { LogoMark } from "@miithii/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_LANGUAGE, VOICE_LANGUAGES } from "@/lib/languages";
import { MicRecorder } from "@/lib/mic-recorder";

const MAX_RECORD_SECONDS = 25; // transcription API caps clips at 30s
const MIN_RECORD_SECONDS = 0.6;

type Turn = { role: "user" | "assistant"; text: string };
type Phase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

const statusText: Record<Phase, string> = {
  idle: "Tap the mic to talk",
  listening: "Listening…",
  transcribing: "Writing it down…",
  thinking: "Thinking…",
  speaking: "Speaking…"
};

const navItems = [
  { href: "https://miithii.in", label: "Hub" },
  { href: "https://subtitles.miithii.in", label: "Subtitles" },
  { href: "https://chat.miithii.in", label: "Chat" }
];

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const recorderRef = useRef<MicRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const stopPlaybackRef = useRef<() => void>(() => {});
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const stopPlayback = useCallback(() => {
    stopPlaybackRef.current();
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

  /** Speak assistant text through /api/tts and resolve when playback ends. */
  const speak = useCallback(
    (text: string) =>
      new Promise<void>(resolve => {
        let cancelled = false;
        const finish = () => {
          if (!cancelled) resolve();
          stopPlaybackRef.current = () => {};
        };
        stopPlaybackRef.current = () => {
          cancelled = true;
          resolve();
          stopPlaybackRef.current = () => {};
        };
        (async () => {
          try {
            const res = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, language: DEFAULT_LANGUAGE })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Speech failed");
            for (const base64 of data.audio as string[]) {
              if (cancelled) break;
              const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
              const context = audioContextRef.current ?? new AudioContext();
              audioContextRef.current = context;
              const buffer = await context.decodeAudioData(bytes.buffer);
              await new Promise<void>(done => {
                const source = context.createBufferSource();
                source.buffer = buffer;
                source.connect(context.destination);
                source.onended = () => done();
                stopPlaybackRef.current = () => {
                  cancelled = true;
                  try {
                    source.stop();
                  } catch {
                    /* already stopped */
                  }
                  resolve();
                  stopPlaybackRef.current = () => {};
                  done();
                };
                source.start();
              });
            }
          } catch (err) {
            if (!cancelled) setError(err instanceof Error ? err.message : "Speech failed");
          } finally {
            finish();
          }
        })();
      }),
    []
  );

  const runTurn = useCallback(async (audio: Blob) => {
    setError(null);
    setPhase("transcribing");
    try {
      const sttForm = new FormData();
      sttForm.append("file", audio, "recording.wav");
      sttForm.append("language", DEFAULT_LANGUAGE);
      const sttRes = await fetch("/api/stt", { method: "POST", body: sttForm });
      const sttData = await sttRes.json();
      if (!sttRes.ok) throw new Error(sttData.error ?? "Transcription failed");
      const heard = String(sttData.text ?? "");
      if (!heard) throw new Error("Didn't catch that — try speaking a little closer");

      const history = [...historyRef.current, { role: "user" as const, text: heard }];
      setTurns(history);
      setPhase("thinking");

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, text }) => ({ role, content: text })) })
      });
      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error(chatData.error ?? "The assistant is unavailable right now");
      const reply = String(chatData.reply);

      historyRef.current = [...history, { role: "assistant" as const, text: reply }];
      setTurns(historyRef.current);

      if (!mutedRef.current) {
        setPhase("speaking");
        await speak(reply);
      }
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }, [speak]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    if (recorder.durationSeconds < MIN_RECORD_SECONDS) {
      recorder.abort().catch(() => {});
      setPhase("idle");
      setError("Tap and hold while you speak");
      return;
    }
    recorder
      .stop()
      .then(audio => runTurn(audio))
      .catch(() => {
        setPhase("idle");
        setError("Could not read the microphone recording");
      });
  }, [runTurn]);

  const startRecording = useCallback(async () => {
    stopPlayback();
    setError(null);
    setLevel(0);
    setRecordSeconds(0);
    const recorder = new MicRecorder();
    try {
      await recorder.start(setLevel);
    } catch {
      setError("Microphone access is required to talk");
      return;
    }
    recorderRef.current = recorder;
    setPhase("listening");
  }, [stopPlayback]);

  // Auto-stop before the 30s API cap.
  useEffect(() => {
    if (phase !== "listening") return;
    const tick = setInterval(() => {
      const recorder = recorderRef.current;
      if (!recorder) return;
      setRecordSeconds(recorder.durationSeconds);
      if (recorder.durationSeconds >= MAX_RECORD_SECONDS) stopRecording();
    }, 200);
    return () => clearInterval(tick);
  }, [phase, stopRecording]);

  // Desktop push-to-talk.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      event.preventDefault();
      if (phase === "idle") startRecording();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (phase === "listening") stopRecording();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, startRecording, stopRecording]);

  const busy = phase === "transcribing" || phase === "thinking";

  const toggleMic = () => {
    if (phase === "listening") stopRecording();
    else if (phase === "idle") startRecording();
    else if (phase === "speaking") stopPlayback();
  };

  const clearConversation = () => {
    stopPlayback();
    historyRef.current = [];
    setTurns([]);
    setError(null);
    setPhase("idle");
    setSheetOpen(false);
  };

  const lastUser = [...turns].reverse().find(turn => turn.role === "user");
  const lastReply = [...turns].reverse().find(turn => turn.role === "assistant");
  const previewText = phase === "speaking" && lastReply ? lastReply.text : phase === "listening" || busy ? lastUser?.text : undefined;

  return (
    <div className="voice-app">
      <header className="voice-bar">
        <a className="voice-brand" href="https://miithii.in" aria-label="Miithii">
          <LogoMark className="voice-brand__mark" />
          <span className="voice-brand__text">miithii</span>
        </a>
        <nav className="voice-nav" aria-label="Products">
          {navItems.map(item => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="voice-stage">
        <div className="voice-orb" data-phase={phase} aria-hidden="true">
          <span className="voice-orb__halo" />
          <span className="voice-orb__halo voice-orb__halo--late" />
          <span className="voice-orb__body" />
        </div>

        <p className="voice-status" role="status">
          {statusText[phase]}
          {phase === "listening" ? (
            <span className="voice-status__timer">
              {recordSeconds.toFixed(0)}s / {MAX_RECORD_SECONDS}s
            </span>
          ) : null}
        </p>

        {previewText && <p className="voice-preview">{previewText}</p>}
      </main>

      <footer className="voice-dock">
        {error && (
          <p className="voice-error" role="alert">
            {error}
          </p>
        )}
        <div className="voice-dock__row">
          <button
            type="button"
            className={`voice-side${muted ? " voice-side--on" : ""}`}
            onClick={() => setMuted(value => !value)}
            aria-pressed={muted}
            aria-label={muted ? "Unmute replies" : "Mute replies"}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M3 10v4h4l5 5V5L7 10H3z" />
                <path d="m15 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M3 10v4h4l5 5V5L7 10H3z" />
                <path d="M16 8c1.3 1 2 2.4 2 4s-.7 3-2 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="voice-mic"
            data-phase={phase}
            onClick={toggleMic}
            aria-label={phase === "listening" ? "Stop and send" : phase === "speaking" ? "Stop speaking" : busy ? "Working…" : "Start talking"}
            disabled={busy}
          >
            {phase === "listening" ? (
              <span className="voice-mic__square" />
            ) : phase === "speaking" ? (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
                <path d="M3 10v4h4l5 5V5L7 10H3z" />
                <path d="M16 8c1.3 1 2 2.4 2 4s-.7 3-2 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
                <path d="M18 11a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V21h2v-2.07A8 8 0 0 0 20 11h-2z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="voice-side"
            onClick={() => setSheetOpen(true)}
            disabled={turns.length === 0}
            aria-label="View transcript"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h10M4 18h7" />
            </svg>
          </button>
        </div>
        <p className="voice-hint">
          You can also hold the <kbd>space bar</kbd> to talk
        </p>
      </footer>

      {sheetOpen && (
        <div className="voice-sheet" role="dialog" aria-label="Transcript">
          <div className="voice-sheet__head">
            <h2>Transcript</h2>
            <div className="voice-sheet__actions">
              <button type="button" onClick={clearConversation}>
                Clear
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
          </div>
          <ol className="voice-sheet__list">
            {turns.map((turn, index) => (
              <li key={index} className={`voice-turn voice-turn--${turn.role}`}>
                <span className="voice-turn__who">{turn.role === "user" ? "You" : "Miithii"}</span>
                <p>{turn.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
