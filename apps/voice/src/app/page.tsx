"use client";

import { LogoMark, ProductDock } from "@miithii/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceSignal } from "@/components/voice-signal";
import { DEFAULT_LANGUAGE, VOICE_LANGUAGES, type VoiceLanguageCode } from "@/lib/languages";
import { MicRecorder } from "@/lib/mic-recorder";
import { acceptsPushToTalkTarget, ownsVoiceTurn, selectVoiceHistory } from "@/lib/voice-lifecycle";
import { ClerkSignIn, VoiceAccountMenu, useVoiceAuth } from "@/lib/clerk";

const MAX_RECORD_SECONDS = 25; // transcription API caps clips at 30s
const MIN_RECORD_SECONDS = 0.6;
const VAD_WARMUP_MS = 350;
const VAD_SPEECH_CONFIRM_MS = 180;
const VAD_SILENCE_MS = 1500;
const VAD_START_FLOOR = 0.012;
const VAD_CONTINUE_FLOOR = 0.008;
// Browser deadlines must exceed the Voice worker's account-check + provider
// envelopes. Shorter client timers used to abort otherwise healthy server work.
const STT_DEADLINE_MS = 50_000;
const CHAT_DEADLINE_MS = 55_000;
const TTS_DEADLINE_MS = 50_000;
const DISPLAY_DEADLINE_MS = 35_000;

type Turn = { role: "user" | "assistant"; text: string; displayText?: string; language?: VoiceLanguageCode };
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

function measureLatency(name: string, startedAt: number) {
  try {
    performance.clearMeasures(name);
    performance.measure(name, { start: startedAt, end: performance.now() });
  } catch {
    /* performance measures are diagnostic only */
  }
}

async function fetchWithDeadline(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
}

async function readVoiceStreamWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
) {
  let timeout = 0;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error("Voice connection stalled. Tap to try again.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export default function Page() {
  const { status: authStatus, getApiToken } = useVoiceAuth();
  const [language, setLanguage] = useState<VoiceLanguageCode>(DEFAULT_LANGUAGE);
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [languageSwitchCue, setLanguageSwitchCue] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);

  const recorderRef = useRef<MicRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const stopPlaybackRef = useRef<() => void>(() => {});
  const mutedRef = useRef(false);
  const vadRef = useRef<VadState | null>(null);
  const keyboardHoldRef = useRef(false);
  const recordingStartRef = useRef<MicRecorder | null>(null);
  const recordingGenerationRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const turnGenerationRef = useRef(0);
  const turnAbortRef = useRef<AbortController | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);
  const wasSignedInRef = useRef(false);
  const transcriptTriggerRef = useRef<HTMLButtonElement | null>(null);
  const transcriptCloseRef = useRef<HTMLButtonElement | null>(null);

  const commitTurns = useCallback((next: Turn[]) => {
    historyRef.current = next;
    setTurns(next);
    return next;
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!sheetOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => transcriptCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSheetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        if (transcriptTriggerRef.current) transcriptTriggerRef.current.focus();
        else previouslyFocused?.focus();
      });
    };
  }, [sheetOpen]);

  const stopPlayback = useCallback(() => {
    playbackAbortRef.current?.abort();
    playbackAbortRef.current = null;
    outputLevelRef.current = 0;
    stopPlaybackRef.current();
  }, []);

  const primePlayback = useCallback(() => {
    try {
      const existing = audioContextRef.current;
      const context = existing && existing.state !== "closed" ? existing : new AudioContext();
      audioContextRef.current = context;
      if (context.state === "suspended") void context.resume().catch(() => {});
    } catch {
      // Playback will retry when the TTS response arrives. Mic capture should
      // still be allowed even if this browser refuses to prewarm Web Audio.
      audioContextRef.current = null;
    }
  }, []);

  const cancelActiveTurn = useCallback(() => {
    turnGenerationRef.current += 1;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    stopPlayback();
  }, [stopPlayback]);

  const invalidateSession = useCallback(() => {
    sessionGenerationRef.current += 1;
    cancelActiveTurn();
    const playbackContext = audioContextRef.current;
    audioContextRef.current = null;
    if (playbackContext) void playbackContext.close().catch(() => {});
    keyboardHoldRef.current = false;
    vadRef.current = null;
    inputLevelRef.current = 0;
    outputLevelRef.current = 0;
    setAudioStarted(false);
    recordingGenerationRef.current += 1;
    const recorder = recorderRef.current;
    const startingRecorder = recordingStartRef.current;
    recordingStartRef.current = null;
    recorderRef.current = null;
    if (recorder) void recorder.abort().catch(() => {});
    if (startingRecorder && startingRecorder !== recorder) void startingRecorder.abort().catch(() => {});
  }, [cancelActiveTurn]);

  useEffect(() => {
    if (authStatus === "signed-in") {
      wasSignedInRef.current = true;
      return;
    }
    if (!wasSignedInRef.current) return;
    wasSignedInRef.current = false;
    invalidateSession();
    commitTurns([]);
    setError(null);
    setPhase("idle");
    setSheetOpen(false);
  }, [authStatus, commitTurns, invalidateSession]);

  /** Fetch one complete spoken turn through /api/tts and resolve when playback ends. */
  const speak = useCallback(
    (text: string, speechLanguage: VoiceLanguageCode, turnSignal: AbortSignal, turnStartedAt: number, ownsTurn: () => boolean) =>
      new Promise<void>(resolve => {
        let cancelled = false;
        const playbackController = new AbortController();
        playbackAbortRef.current?.abort();
        playbackAbortRef.current = playbackController;
        const abortFromTurn = () => playbackController.abort();
        if (turnSignal.aborted) playbackController.abort();
        else turnSignal.addEventListener("abort", abortFromTurn, { once: true });
        let ownedStop: () => void = () => {};
        const installStop = (next: () => void) => {
          ownedStop = next;
          stopPlaybackRef.current = next;
        };
        const finish = () => {
          turnSignal.removeEventListener("abort", abortFromTurn);
          if (playbackAbortRef.current === playbackController) playbackAbortRef.current = null;
          resolve();
          if (stopPlaybackRef.current === ownedStop) stopPlaybackRef.current = () => {};
        };
        installStop(() => {
          cancelled = true;
          playbackController.abort();
          resolve();
          if (stopPlaybackRef.current === ownedStop) stopPlaybackRef.current = () => {};
        });
        (async () => {
          const ttsStartedAt = performance.now();
          let measuredFirstChunk = false;
          try {
            const token = await getApiToken();
            if (playbackController.signal.aborted) return;
            const res = await fetchWithDeadline("/api/tts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ text, language: speechLanguage }),
              signal: playbackController.signal
            }, TTS_DEADLINE_MS);
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              throw new Error(data?.error ?? "Speech failed");
            }
            if (!res.body) throw new Error("Speech stream is unavailable");
            const reader = res.body.getReader();
            const audioChunks: Uint8Array[] = [];
            let audioBytes = 0;
            try {
              while (!playbackController.signal.aborted) {
                const { value, done } = await readVoiceStreamWithDeadline(reader, 40_000);
                if (done) break;
                if (!value?.byteLength) continue;
                if (!measuredFirstChunk) {
                  measuredFirstChunk = true;
                  measureLatency("miithii.voice.tts.first-chunk", ttsStartedAt);
                }
                audioChunks.push(value);
                audioBytes += value.byteLength;
              }
            } finally {
              if (playbackController.signal.aborted) await reader.cancel().catch(() => {});
              reader.releaseLock();
            }
            if (playbackController.signal.aborted || cancelled) return;
            if (!audioBytes) throw new Error("Speech stream was empty");

            const bytes = new Uint8Array(audioBytes);
            let offset = 0;
            for (const chunk of audioChunks) {
              bytes.set(chunk, offset);
              offset += chunk.byteLength;
            }
            const context = audioContextRef.current && audioContextRef.current.state !== "closed"
              ? audioContextRef.current
              : new AudioContext();
            audioContextRef.current = context;
            if (context.state === "suspended") await context.resume();
            const buffer = await context.decodeAudioData(bytes.buffer);
            if (playbackController.signal.aborted || cancelled) return;

            await new Promise<void>(done => {
              const source = context.createBufferSource();
              const analyser = context.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.7;
              const samples = new Uint8Array(analyser.fftSize);
              let levelFrame = 0;
              let audibleTimer = 0;
              const stopLevelMeter = () => {
                if (levelFrame) cancelAnimationFrame(levelFrame);
                outputLevelRef.current = 0;
              };
              const updateLevel = () => {
                analyser.getByteTimeDomainData(samples);
                let energy = 0;
                for (const sample of samples) {
                  const centered = (sample - 128) / 128;
                  energy += centered * centered;
                }
                outputLevelRef.current = Math.min(1, Math.sqrt(energy / samples.length) * 5.5);
                levelFrame = requestAnimationFrame(updateLevel);
              };
              source.buffer = buffer;
              source.connect(analyser);
              analyser.connect(context.destination);
              source.onended = () => {
                if (audibleTimer) window.clearTimeout(audibleTimer);
                stopLevelMeter();
                done();
              };
              installStop(() => {
                cancelled = true;
                playbackController.abort();
                if (audibleTimer) window.clearTimeout(audibleTimer);
                stopLevelMeter();
                try {
                  source.stop();
                } catch {
                  /* already stopped */
                }
                resolve();
                if (stopPlaybackRef.current === ownedStop) stopPlaybackRef.current = () => {};
                done();
              });

              const sourceStartedAt = performance.now();
              source.start();
              updateLevel();
              const outputDelayMs = Math.max(0, Number(context.outputLatency ?? context.baseLatency ?? 0) * 1000);
              audibleTimer = window.setTimeout(() => {
                if (!ownsTurn() || playbackController.signal.aborted || cancelled) return;
                setAudioStarted(true);
                measureLatency("miithii.voice.first-audio", turnStartedAt);
              }, outputDelayMs);
            });
          } catch (err) {
            if (!cancelled && !playbackController.signal.aborted) setError(err instanceof Error ? err.message : "Speech failed");
          } finally {
            measureLatency("miithii.voice.tts.total", ttsStartedAt);
            finish();
          }
        })();
      }),
    [getApiToken]
  );

  const runTurn = useCallback(async (
    audio: Blob,
    expectedSessionGeneration: number,
    expectedTurnGeneration: number,
    turnStartedAt: number
  ) => {
    if (sessionGenerationRef.current !== expectedSessionGeneration || turnGenerationRef.current !== expectedTurnGeneration) return;
    turnAbortRef.current?.abort();
    const controller = new AbortController();
    turnAbortRef.current = controller;
    const speechLanguage = language;
    const ownsTurn = () => ownsVoiceTurn(controller.signal, expectedSessionGeneration,
      sessionGenerationRef.current, expectedTurnGeneration, turnGenerationRef.current);

    setError(null);
    setAudioStarted(false);
    setPhase("transcribing");
    try {
      const token = await getApiToken();
      if (!ownsTurn()) return;
      const sttForm = new FormData();
      sttForm.append("file", audio, "recording.wav");
      const sttStartedAt = performance.now();
      const sttRes = await fetchWithDeadline("/api/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: sttForm,
        signal: controller.signal
      }, STT_DEADLINE_MS);
      const sttData = await sttRes.json();
      measureLatency("miithii.voice.stt", sttStartedAt);
      if (!ownsTurn()) return;
      if (!sttRes.ok) throw new Error(sttData.error ?? "Transcription failed");
      const heard = String(sttData.text ?? "");
      if (!heard) throw new Error("Didn't catch that. Try speaking a little closer");

      const history = commitTurns([...historyRef.current, { role: "user" as const, text: heard }]);
      setPhase("thinking");
      const modelHistory = selectVoiceHistory(history, speechLanguage);

      const chatStartedAt = performance.now();
      const chatRes = await fetchWithDeadline("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          language: speechLanguage,
          threadId: `voice-${speechLanguage}`,
          turnId: crypto.randomUUID(),
          messages: modelHistory.map(({ role, text }) => ({ role, content: text }))
        }),
        signal: controller.signal
      }, CHAT_DEADLINE_MS);
      const chatData = await chatRes.json();
      measureLatency("miithii.voice.chat", chatStartedAt);
      if (!ownsTurn()) return;
      if (!chatRes.ok) throw new Error(chatData.error ?? "The assistant is unavailable right now");
      const reply = String(chatData.reply);

      commitTurns([...history, { role: "assistant" as const, text: reply, language: speechLanguage }]);

      if (VOICE_LANGUAGES[speechLanguage].displayScript !== VOICE_LANGUAGES[speechLanguage].speechScript) {
        void fetchWithDeadline("/api/display", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ language: speechLanguage, text: reply }),
          signal: controller.signal
        }, DISPLAY_DEADLINE_MS).then(async response => {
          const data = await response.json().catch(() => null);
          const displayText = response.ok && typeof data?.text === "string" ? data.text.trim() : "";
          if (!displayText || !ownsTurn()) return;
          const updateDisplayText = (current: Turn[]) => {
            const updated = [...current];
            for (let index = updated.length - 1; index >= 0; index -= 1) {
              const turn = updated[index];
              if (turn.role === "assistant" && turn.text === reply) {
                updated[index] = { ...turn, displayText };
                break;
              }
            }
            return updated;
          };
          commitTurns(updateDisplayText(historyRef.current));
        }).catch(() => {});
      }

      if (!mutedRef.current) {
        setPhase("speaking");
        await speak(reply, speechLanguage, controller.signal, turnStartedAt, ownsTurn);
      }
      if (ownsTurn()) {
        measureLatency("miithii.voice.turn.total", turnStartedAt);
        setPhase("idle");
      }
    } catch (err) {
      if (ownsTurn()) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setPhase("idle");
      }
    } finally {
      if (turnAbortRef.current === controller) turnAbortRef.current = null;
    }
  }, [commitTurns, getApiToken, speak, language]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    inputLevelRef.current = 0;
    recordingGenerationRef.current += 1;
    keyboardHoldRef.current = false;
    recorderRef.current = null;
    vadRef.current = null;
    const sessionGeneration = sessionGenerationRef.current;
    if (recordingStartRef.current === recorder) {
      recordingStartRef.current = null;
      void recorder.abort().catch(() => {});
      setPhase("idle");
      return;
    }
    if (recorder.durationSeconds < MIN_RECORD_SECONDS) {
      recorder.abort().catch(() => {});
      setPhase("idle");
      setError("That was too short. Try again");
      return;
    }
    // Start the user-facing turn clock at the stop/VAD decision, before WAV
    // finalization, so "First audio" includes local encoding work too.
    const turnStartedAt = performance.now();
    const turnGeneration = turnGenerationRef.current + 1;
    turnGenerationRef.current = turnGeneration;
    recorder
      .stop()
      .then(audio => {
        if (sessionGenerationRef.current === sessionGeneration && turnGenerationRef.current === turnGeneration) {
          return runTurn(audio, sessionGeneration, turnGeneration, turnStartedAt);
        }
      })
      .catch(() => {
        if (sessionGenerationRef.current === sessionGeneration && turnGenerationRef.current === turnGeneration) {
          setPhase("idle");
          setError("Could not read the microphone recording");
        }
      });
  }, [runTurn]);

  const startRecording = useCallback(async (autoStop = true) => {
    const recordingGeneration = recordingGenerationRef.current + 1;
    recordingGenerationRef.current = recordingGeneration;
    // Cancel stale work and unlock output audio synchronously inside the user
    // gesture. Browsers may otherwise suspend an AudioContext created only
    // after STT/chat have finished, making a successful TTS reply inaudible.
    cancelActiveTurn();
    primePlayback();
    const previousStart = recordingStartRef.current;
    recordingStartRef.current = null;
    if (previousStart) await previousStart.abort().catch(() => {});
    if (recordingGenerationRef.current !== recordingGeneration) return;
    setError(null);
    inputLevelRef.current = 0;
    const recorder = new MicRecorder();
    recordingStartRef.current = recorder;
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
      inputLevelRef.current = Math.min(1, nextLevel * 14);
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

      // A continuous pause after confirmed speech is treated as the end of the
      // utterance. 1.5s keeps casual pauses intact while trimming dead air.
      if (vad.lastVoiceAt && now - vad.lastVoiceAt >= VAD_SILENCE_MS) {
        stopRecording();
      }
    };

    try {
      recorderRef.current = recorder;
      await recorder.start(onLevel);
      if (recordingGenerationRef.current !== recordingGeneration || recordingStartRef.current !== recorder || recorderRef.current !== recorder) {
        await recorder.abort().catch(() => {});
        return;
      }
      recordingStartRef.current = null;
    } catch {
      if (recordingGenerationRef.current !== recordingGeneration) {
        await recorder.abort().catch(() => {});
        return;
      }
      inputLevelRef.current = 0;
      if (recordingStartRef.current === recorder) recordingStartRef.current = null;
      if (recorderRef.current === recorder) recorderRef.current = null;
      vadRef.current = null;
      setPhase("idle");
      setError("Microphone access is required to talk");
      return;
    }
    setPhase("listening");
  }, [cancelActiveTurn, primePlayback, stopRecording]);

  useEffect(() => () => {
    sessionGenerationRef.current += 1;
    recordingGenerationRef.current += 1;
    turnAbortRef.current?.abort();
    playbackAbortRef.current?.abort();
    const recorder = recorderRef.current;
    const startingRecorder = recordingStartRef.current;
    recordingStartRef.current = null;
    recorderRef.current = null;
    if (recorder) void recorder.abort().catch(() => {});
    if (startingRecorder && startingRecorder !== recorder) void startingRecorder.abort().catch(() => {});
    stopPlaybackRef.current();
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

  // Auto-stop before the 30s API cap.
  useEffect(() => {
    if (phase !== "listening") return;
    const tick = setInterval(() => {
      const recorder = recorderRef.current;
      if (!recorder) return;
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
      if (!acceptsPushToTalkTarget(target.tagName)) return;
      if (target.isContentEditable || target.closest?.('[contenteditable="true"], [role="textbox"]')) return;
      if (recorderRef.current) return;
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
      else {
        const startingRecorder = recordingStartRef.current;
        recordingStartRef.current = null;
        if (startingRecorder) void startingRecorder.abort().catch(() => {});
      }
    };
    const onBlur = () => {
      if (!keyboardHoldRef.current) return;
      keyboardHoldRef.current = false;
      if (recorderRef.current) stopRecording();
      else {
        const startingRecorder = recordingStartRef.current;
        recordingStartRef.current = null;
        if (startingRecorder) void startingRecorder.abort().catch(() => {});
      }
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
          <span className="voice-auth-state__eyebrow">Miithii Voice</span>
          <h1>Talk in your language.</h1>
          <p>Miithii listens naturally, then answers out loud in Assamese or Bodo.</p>
          <div className="voice-auth-state__languages" aria-label="Available reply languages">
            <span>{VOICE_LANGUAGES.as.label}</span>
            <i aria-hidden="true">↔</i>
            <span>{VOICE_LANGUAGES.brx.label}</span>
          </div>
          <ClerkSignIn />
          <small className="voice-auth-state__helper">Sign in once · 50 messages/day shared with Chat</small>
        </main>
      </div>
    );
  }

  const toggleMic = () => {
    if (phase === "listening") stopRecording();
    else void startRecording();
  };

  const clearConversation = () => {
    invalidateSession();
    commitTurns([]);
    setError(null);
    setAudioStarted(false);
    setPhase("idle");
    setSheetOpen(false);
  };

  const changeLanguage = (nextLanguage: VoiceLanguageCode) => {
    if (nextLanguage === language) return;
    invalidateSession();
    setPhase("idle");
    setLanguage(nextLanguage);
    setError(null);
    setLanguageSwitchCue(value => value + 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(18);
  };

  const lastUser = [...turns].reverse().find(turn => turn.role === "user");
  let lastReplyIndex = -1;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (turn.role === "assistant" && turn.language === language) {
      lastReplyIndex = index;
      break;
    }
  }
  const lastReply = lastReplyIndex >= 0 ? turns[lastReplyIndex] : undefined;
  let exchangeUser: Turn | undefined;
  for (let index = lastReplyIndex - 1; index >= 0; index -= 1) {
    if (turns[index].role === "user") {
      exchangeUser = turns[index];
      break;
    }
  }
  const replyDisplayText = lastReply?.displayText ?? lastReply?.text;
  const currentUserText = phase === "thinking" || phase === "speaking" ? lastUser?.text : exchangeUser?.text;
  const visibleReply = phase === "thinking" ? null : replyDisplayText;
  const phaseLabel = phase === "idle"
    ? (turns.length ? "Your turn" : "Ready")
    : phase === "listening"
      ? "Listening"
      : phase === "transcribing"
        ? "Transcribing"
        : phase === "thinking"
          ? `Thinking in ${VOICE_LANGUAGES[language].english}`
          : audioStarted
            ? `Speaking ${VOICE_LANGUAGES[language].english}`
            : `Preparing ${VOICE_LANGUAGES[language].english} voice`;
  const signalState = phase === "listening"
    ? "listening"
    : phase === "speaking" && audioStarted
      ? "talking"
      : null;
  const signalColors: [string, string] = signalState === "listening"
    ? ["#7a8580", "#a3aaa7"]
    : language === "as"
      ? ["#2f8a74", "#83a98d"]
      : ["#6374bf", "#9a84ba"];
  const assistantTurnCount = turns.reduce((count, turn) => count + (turn.role === "assistant" ? 1 : 0), 0);
  const showInterruptHint = phase === "speaking" && audioStarted && assistantTurnCount === 1;
  const micLabel = phase === "listening" ? "Send" : phase === "idle" ? "Talk" : "Interrupt";

  return (
    <div className="voice-app" data-phase={phase} data-language={language}>
      <ProductDock active="voice" account={<VoiceAccountMenu />} />
      <VoiceSignal
        colors={signalColors}
        state={signalState}
        inputLevelRef={inputLevelRef}
        outputLevelRef={outputLevelRef}
        className="voice-edge-meter"
      />

      <main className="voice-stage">
        <section className="voice-console" aria-label="Miithii voice conversation">
          <header className="voice-console__top">
            <div className="voice-language" aria-label="Choose Miithii's reply language">
              <div className="voice-language__options" role="group" aria-label="Reply language">
                {Object.entries(VOICE_LANGUAGES).map(([code, value]) => (
                  <button
                    type="button"
                    key={code}
                    className="voice-language__option"
                    data-active={language === code ? "true" : "false"}
                    data-language={code}
                    aria-pressed={language === code}
                    aria-label={`Reply in ${value.english}`}
                    title={`Reply in ${value.english}`}
                    onClick={() => changeLanguage(code as VoiceLanguageCode)}
                  >
                    <span className="voice-language__native" lang={code}>{value.label}</span>
                  </button>
                ))}
              </div>
              {languageSwitchCue > 0 ? (
                <span className="sr-only" role="status" aria-live="polite">
                  Miithii will reply in {VOICE_LANGUAGES[language].english}.
                </span>
              ) : null}
            </div>
          </header>

          <div className="voice-presence" data-phase={phase} data-language={language}>
            <div className="voice-status" role="status" aria-live="polite">
              <span>{phaseLabel}</span>
            </div>
            <div className="voice-conversation" aria-live="polite">
              {currentUserText || visibleReply ? (
                <>
                  {currentUserText ? (
                    <div className="voice-conversation__user">
                      <span>You</span>
                      <p>{currentUserText}</p>
                    </div>
                  ) : null}
                  {visibleReply ? (
                    <div className="voice-conversation__reply">
                      <span>Miithii · {VOICE_LANGUAGES[language].english}</span>
                      <p lang={lastReply?.language ?? language}>{visibleReply}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="voice-first-use">
                  <strong>Speak any language.</strong>
                  <span>Replies in {VOICE_LANGUAGES[language].english}.</span>
                </p>
              )}
              {showInterruptHint ? <span className="sr-only">You can interrupt Miithii at any time.</span> : null}
            </div>
          </div>

          <div className="voice-dock">
            {error && <p className="voice-error" role="alert">{error}</p>}
            <div className="voice-dock__row">
              {turns.length ? (
                <button
                  type="button"
                  className={`voice-side${muted ? " voice-side--on" : ""}`}
                  onClick={() => setMuted(value => !value)}
                  aria-pressed={muted}
                  aria-label={muted ? "Unmute replies" : "Mute replies"}
                  title={muted ? "Unmute replies" : "Mute replies"}
                >
                  {muted ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M3 10v4h4l5 5V5L7 10H3z" />
                      <path d="m15 9 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                      <path d="M3 10v4h4l5 5V5L7 10H3z" />
                      <path d="M16 8c1.3 1 2 2.4 2 4s-.7 3-2 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              ) : <span className="voice-side-slot" aria-hidden="true" />}

              <button
                type="button"
                className="voice-mic"
                data-phase={phase}
                onClick={toggleMic}
                aria-label={phase === "listening" ? "Stop and send" : phase === "idle" ? "Start talking" : "Interrupt and talk"}
                title={phase === "listening" ? "Stop and send" : phase === "idle" ? "Tap to talk · hold Space" : "Interrupt and talk"}
              >
                <span className="voice-mic__icon" aria-hidden="true">
                  {phase === "listening" ? (
                    <span className="voice-mic__square" />
                  ) : (
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
                      <path d="M18 11a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93V21h2v-2.07A8 8 0 0 0 20 11h-2z" />
                    </svg>
                  )}
                </span>
                <span className="voice-mic__label">{micLabel}</span>
                <kbd className="voice-mic__key" data-hidden={phase === "idle" ? "false" : "true"} aria-hidden={phase === "idle" ? undefined : true}>
                  Space
                </kbd>
              </button>

              {turns.length ? (
                <button
                  type="button"
                  className="voice-side"
                  ref={transcriptTriggerRef}
                  onClick={() => setSheetOpen(true)}
                  aria-label="View transcript"
                  title="Transcript"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 6h16M4 12h10M4 18h7" />
                  </svg>
                </button>
              ) : <span className="voice-side-slot" aria-hidden="true" />}
            </div>
          </div>
        </section>
      </main>

      {sheetOpen && (
        <div
          className="voice-sheet-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setSheetOpen(false);
          }}
        >
          <div className="voice-sheet" role="dialog" aria-modal="true" aria-labelledby="voice-transcript-title">
            <div className="voice-sheet__head">
              <h2 id="voice-transcript-title">Transcript</h2>
              <div className="voice-sheet__actions">
                <button type="button" onClick={clearConversation}>
                  Clear
                </button>
                <button ref={transcriptCloseRef} type="button" onClick={() => setSheetOpen(false)} aria-label="Close transcript">
                  ✕
                </button>
              </div>
            </div>
            <ol className="voice-sheet__list">
              {turns.map((turn, index) => (
                <li key={index} className={`voice-turn voice-turn--${turn.role}`}>
                  <span className="voice-turn__who">{turn.role === "user" ? "You" : "Miithii"}</span>
                  <p lang={turn.role === "assistant" ? turn.language : undefined}>{turn.displayText ?? turn.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
