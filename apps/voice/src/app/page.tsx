"use client";

import { LogoMark, ProductDock } from "@miithii/ui";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_LANGUAGE, VOICE_LANGUAGES, type VoiceLanguageCode } from "@/lib/languages";
import { MicRecorder } from "@/lib/mic-recorder";
import { ClerkSignIn, VoiceAccountMenu, useVoiceAuth } from "@/lib/clerk";

const MAX_RECORD_SECONDS = 25; // transcription API caps clips at 30s
const MIN_RECORD_SECONDS = 0.6;
const VAD_WARMUP_MS = 350;
const VAD_SPEECH_CONFIRM_MS = 180;
const VAD_SILENCE_MS = 1800;
const VAD_START_FLOOR = 0.012;
const VAD_CONTINUE_FLOOR = 0.008;

type Turn = { role: "user" | "assistant"; text: string };
type Phase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";
type VadState = {
  startedAt: number;
  noiseFloor: number;
  smoothedLevel: number;
  candidateStartedAt: number | null;
  heardSpeech: boolean;
  lastVoiceAt: number | null;
  autoStop: boolean;
};

const statusText: Record<Phase, string> = {
  idle: "Tap to talk",
  listening: "Listening",
  transcribing: "Got it",
  thinking: "Thinking…",
  speaking: "Replying…"
};

export default function Page() {
  const { status: authStatus, getApiToken } = useVoiceAuth();
  const [language, setLanguage] = useState<VoiceLanguageCode>(DEFAULT_LANGUAGE);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [languageSwitchCue, setLanguageSwitchCue] = useState(0);

  const recorderRef = useRef<MicRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const stopPlaybackRef = useRef<() => void>(() => {});
  const mutedRef = useRef(false);
  const vadRef = useRef<VadState | null>(null);
  const keyboardHoldRef = useRef(false);

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
            const token = await getApiToken();
            const res = await fetch("/api/tts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ text, language })
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
    [getApiToken, language]
  );

  const runTurn = useCallback(async (audio: Blob) => {
    setError(null);
    setPhase("transcribing");
    try {
      const token = await getApiToken();
      const sttForm = new FormData();
      sttForm.append("file", audio, "recording.wav");
      const sttRes = await fetch("/api/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: sttForm
      });
      const sttData = await sttRes.json();
      if (!sttRes.ok) throw new Error(sttData.error ?? "Transcription failed");
      const heard = String(sttData.text ?? "");
      if (!heard) throw new Error("Didn't catch that — try speaking a little closer");

      const history = [...historyRef.current, { role: "user" as const, text: heard }];
      setTurns(history);
      setPhase("thinking");

      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language, turnId: crypto.randomUUID(), messages: history.map(({ role, text }) => ({ role, content: text })) })
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
  }, [getApiToken, speak, language]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    keyboardHoldRef.current = false;
    recorderRef.current = null;
    vadRef.current = null;
    if (recorder.durationSeconds < MIN_RECORD_SECONDS) {
      recorder.abort().catch(() => {});
      setPhase("idle");
      setError("That was too short — try again");
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

  const startRecording = useCallback(async (autoStop = true) => {
    stopPlayback();
    setError(null);
    setLevel(0);
    setRecordSeconds(0);
    const recorder = new MicRecorder();
    vadRef.current = {
      startedAt: performance.now(),
      noiseFloor: 0.004,
      smoothedLevel: 0,
      candidateStartedAt: null,
      heardSpeech: false,
      lastVoiceAt: null,
      autoStop
    };

    const onLevel = (nextLevel: number) => {
      setLevel(nextLevel);
      const vad = vadRef.current;
      if (!vad || !vad.autoStop || recorderRef.current !== recorder) return;

      const now = performance.now();
      const elapsed = now - vad.startedAt;
      vad.smoothedLevel = vad.smoothedLevel * 0.72 + nextLevel * 0.28;
      const observedLevel = vad.smoothedLevel;

      // Track the room floor only while we have not committed to speech. It
      // rises very slowly so an immediate first word is not learned as noise,
      // but drops quickly enough to adapt to a quiet microphone.
      if (!vad.heardSpeech) {
        const bounded = Math.min(observedLevel, 0.025);
        vad.noiseFloor = bounded < vad.noiseFloor
          ? vad.noiseFloor * 0.8 + bounded * 0.2
          : vad.noiseFloor * 0.98 + bounded * 0.02;
      }

      if (elapsed < VAD_WARMUP_MS) return;

      const speechThreshold = Math.max(VAD_START_FLOOR, vad.noiseFloor * 2.8);
      const continuationThreshold = Math.max(VAD_CONTINUE_FLOOR, vad.noiseFloor * 1.7);

      if (!vad.heardSpeech) {
        if (observedLevel >= speechThreshold) {
          vad.candidateStartedAt ??= now;
          if (now - vad.candidateStartedAt >= VAD_SPEECH_CONFIRM_MS) {
            vad.heardSpeech = true;
            vad.lastVoiceAt = now;
          }
        } else {
          vad.candidateStartedAt = null;
        }
        return;
      }

      if (observedLevel >= continuationThreshold) {
        vad.lastVoiceAt = now;
        return;
      }

      // A long continuous pause after confirmed speech is treated as the end
      // of the utterance. 1.8s is deliberately conservative so sentence-level
      // pauses and slower speech do not get clipped.
      if (vad.lastVoiceAt && now - vad.lastVoiceAt >= VAD_SILENCE_MS) {
        stopRecording();
      }
    };

    try {
      recorderRef.current = recorder;
      await recorder.start(onLevel);
      if (recorderRef.current !== recorder) {
        await recorder.abort().catch(() => {});
        return;
      }
    } catch {
      recorderRef.current = null;
      vadRef.current = null;
      setError("Microphone access is required to talk");
      return;
    }
    setPhase("listening");
  }, [stopPlayback, stopRecording]);

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
      if (authStatus !== "signed-in") return;
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      if (phase !== "idle") return;
      event.preventDefault();
      // Space remains true push-to-talk: releasing the key is the stop signal.
      // Tap/click recording uses VAD auto-stop instead.
      keyboardHoldRef.current = true;
      startRecording(false);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (!keyboardHoldRef.current) return;
      event.preventDefault();
      keyboardHoldRef.current = false;
      if (recorderRef.current) stopRecording();
    };
    const onBlur = () => {
      if (!keyboardHoldRef.current) return;
      keyboardHoldRef.current = false;
      if (recorderRef.current) stopRecording();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [authStatus, phase, startRecording, stopRecording]);

  const busy = phase === "transcribing" || phase === "thinking";
  const authReady = authStatus === "signed-in";

  if (authStatus === "loading") {
    return (
      <div className="voice-app voice-app--auth">
        <ProductDock active="voice" />
        <main className="voice-auth-state" aria-busy="true">
          <LogoMark className="voice-auth-state__mark" />
          <p>Loading Miithii Voice…</p>
        </main>
      </div>
    );
  }

  if (authStatus === "missing" || authStatus === "error") {
    return (
      <div className="voice-app voice-app--auth">
        <ProductDock active="voice" />
        <main className="voice-auth-state">
          <LogoMark className="voice-auth-state__mark" />
          <h1>Voice sign-in is not configured</h1>
          <p>Add the Clerk publishable key to the voice app environment before testing authenticated voice.</p>
        </main>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="voice-app voice-app--auth">
        <ProductDock active="voice" />
        <main className="voice-auth-state voice-auth-state--signin">
          <span className="voice-auth-state__eyebrow">Voice</span>
          <h1>Talk with Miithii.</h1>
          <p>Speak any language. Choose Assamese or Bodo for the reply. Chat + Voice share 50 messages a day.</p>
          <ClerkSignIn />
        </main>
      </div>
    );
  }

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

  const changeLanguage = (nextLanguage: VoiceLanguageCode) => {
    if (nextLanguage === language || phase !== "idle") return;
    stopPlayback();
    setLanguage(nextLanguage);
    setError(null);
    setLanguageSwitchCue(value => value + 1);
  };

  const lastUser = [...turns].reverse().find(turn => turn.role === "user");
  const lastReply = [...turns].reverse().find(turn => turn.role === "assistant");
  const previewText = phase === "speaking" && lastReply ? lastReply.text : phase === "listening" || busy ? lastUser?.text : undefined;

  return (
    <div className="voice-app">
      <ProductDock active="voice" account={<VoiceAccountMenu />} />

      <main className="voice-stage">
        <div className="voice-language" aria-label="Choose Miithii's reply language">
          <span className="voice-pronunciation">
            Miithii <span>/ˈmiː.θiː/</span>
          </span>
          <span className="voice-language__caption">Reply language</span>
          <div className="voice-language__options" role="group" aria-label="Reply language">
            {Object.entries(VOICE_LANGUAGES).map(([code, value]) => (
              <button
                type="button"
                key={code}
                className="voice-language__option"
                data-active={language === code ? "true" : "false"}
                aria-pressed={language === code}
                aria-label={`Reply in ${value.english}`}
                disabled={phase !== "idle"}
                onClick={() => changeLanguage(code as VoiceLanguageCode)}
              >
                <span className="voice-language__native">{value.label}</span>
                <small>{value.english}</small>
              </button>
            ))}
          </div>
          {languageSwitchCue > 0 ? (
            <span className="sr-only" role="status" aria-live="polite">
              Miithii will reply in {VOICE_LANGUAGES[language].english}.
            </span>
          ) : null}
        </div>
        <div
          className="voice-orb"
          data-phase={phase}
          data-language={language}
          style={{ "--level": Math.min(1, level * 14) } as CSSProperties}
          aria-hidden="true"
        >
          <span className="voice-orb__halo" />
          <span className="voice-orb__halo voice-orb__halo--late" />
          <span className="voice-orb__body" />
          {languageSwitchCue > 0 ? (
            <span
              className="voice-language-change"
              key={`${language}-${languageSwitchCue}`}
              aria-hidden="true"
            >
              <span className="voice-language-change__bars">
                <i />
                <i />
                <i />
              </span>
              <strong>{VOICE_LANGUAGES[language].label}</strong>
              <small>{VOICE_LANGUAGES[language].english}</small>
            </span>
          ) : null}
        </div>

        <p className="voice-status" role="status">
          {statusText[phase]}
          {phase === "listening" ? (
            <span className="voice-status__timer">
              {recordSeconds.toFixed(0)}s / {MAX_RECORD_SECONDS}s
            </span>
          ) : null}
        </p>

        {turns.length === 0 && phase === "idle" ? (
          <p className="voice-first-use">Speak any language · pause to send</p>
        ) : null}

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
