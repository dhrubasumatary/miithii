import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PipecatClient, TransportState } from "@pipecat-ai/client-js";

import {
  MIITHII_API_URL,
  PIPECAT_START_URL,
  PIPECAT_START_URL_OVERRIDE,
  USE_VOICE_SESSION,
  VOICE_TRANSPORT,
} from "./src/config";
import {
  MiithiiCloudflareSFUTransport,
  MiithiiSFUTransportError,
} from "./src/cloudflare-sfu-transport";
import { createVoiceSession } from "./src/session";
import { createVoiceClient, type ReplyLanguage } from "./src/voice-client";

type Phase = "offline" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";

function isRetryableStartupFailure(cause: unknown): cause is MiithiiSFUTransportError {
  if (!(cause instanceof MiithiiSFUTransportError)) return false;
  if (cause.code === "microphone_connect_timeout") return true;
  return cause.code === "sfu_http"
    && cause.path === "/pipecat-peer/start"
    && cause.status === 503;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const LANGUAGE_LABELS: Record<ReplyLanguage, { native: string; english: string }> = {
  as: { native: "অসমীয়া", english: "Assamese" },
  brx: { native: "बरʼ", english: "Bodo" },
};

function phaseCopy(phase: Phase, language: ReplyLanguage) {
  const languageName = LANGUAGE_LABELS[language].english;
  switch (phase) {
    case "connecting": return "Opening voice";
    case "ready": return "Talk naturally";
    case "listening": return "Listening";
    case "thinking": return `Thinking in ${languageName}`;
    case "speaking": return `Speaking ${languageName}`;
    case "error": return "Try again";
    default: return "Start a conversation";
  }
}

export default function App() {
  const clientRef = useRef<PipecatClient | null>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const activeLanguageRef = useRef<ReplyLanguage>("as");
  const turnStoppedAtRef = useRef<number | null>(null);
  const level = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const [language, setLanguage] = useState<ReplyLanguage>("as");
  const [phase, setPhase] = useState<Phase>("offline");
  const [transportState, setTransportState] = useState<TransportState>("disconnected");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [responseMs, setResponseMs] = useState<number | null>(null);

  const resetSignal = useCallback(() => {
    Animated.timing(level, {
      toValue: 0,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [level]);

  // A slow ambient pulse means "ready". Measured audio level takes over while
  // either side is actually speaking.
  useEffect(() => {
    if (phase !== "ready") {
      glow.stopAnimation();
      glow.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [glow, phase]);

  const connect = useCallback(async (targetLanguage: ReplyLanguage = language) => {
    if (clientRef.current) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const current = () => generationRef.current === generation;

    activeLanguageRef.current = targetLanguage;
    setError(null);
    setHeard("");
    setReply("");
    setResponseMs(null);
    setPhase("connecting");
    const connectAbort = new AbortController();
    connectAbortRef.current = connectAbort;

    try {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        if (!current() || connectAbort.signal.aborted) return;

        let botReady = false;
        let attemptActive = true;
        let client!: PipecatClient;
        const attemptCurrent = () => (
          attemptActive
          && current()
          && clientRef.current === client
        );

        client = createVoiceClient({
          onTransportState: state => {
            if (!attemptCurrent()) return;
            console.info("[miithii-voice-stage]", "transport_state", { state, attempt });
            setTransportState(state);
            if (["initializing", "authenticating", "authenticated", "connecting", "connected"].includes(state)) {
              setPhase("connecting");
            }
            if (state === "ready") setPhase("ready");
            if (state === "disconnected") setPhase("offline");
            if (state === "error" && botReady) setPhase("error");
          },
          onConnected: () => {
            console.info("[miithii-voice-stage]", "client_connected", { attempt });
            if (attemptCurrent()) setError(null);
          },
          onDisconnected: () => {
            console.info("[miithii-voice-stage]", "client_disconnected", { attempt });
            if (!attemptCurrent()) return;
            setPhase("offline");
            resetSignal();
          },
          onUserStartedSpeaking: () => {
            if (!attemptCurrent()) return;
            setPhase("listening");
            setError(null);
            setHeard("");
            setReply("");
            setResponseMs(null);
          },
          onUserStoppedSpeaking: () => {
            if (!attemptCurrent()) return;
            turnStoppedAtRef.current = performance.now();
            setPhase("thinking");
            resetSignal();
          },
          onBotStartedSpeaking: () => {
            if (!attemptCurrent()) return;
            const stoppedAt = turnStoppedAtRef.current;
            if (stoppedAt !== null) setResponseMs(Math.round(performance.now() - stoppedAt));
            setPhase("speaking");
          },
          onBotStoppedSpeaking: () => {
            if (!attemptCurrent()) return;
            setPhase("ready");
            resetSignal();
          },
          onUserTranscript: data => {
            if (attemptCurrent() && data.final && data.text.trim()) setHeard(data.text.trim());
          },
          onBotText: data => {
            if (attemptCurrent() && data.text.trim()) setReply(data.text.trim());
          },
          onLocalAudioLevel: next => {
            if (attemptCurrent()) level.setValue(Math.min(1, Math.max(0, next)));
          },
          onRemoteAudioLevel: next => {
            if (attemptCurrent()) level.setValue(Math.min(1, Math.max(0, next)));
          },
          onMetrics: () => {},
          onError: message => {
            console.info("[miithii-voice-stage]", "client_error", { message, attempt });
            if (!attemptCurrent() || !botReady) return;
            setError(message);
            setPhase("error");
            resetSignal();
          },
        });
        clientRef.current = client;

        try {
          console.info("[miithii-voice-stage]", "preflight_start", { attempt });
          const [, session] = await Promise.all([
            withTimeout(client.initDevices(), 15_000, "Microphone setup timed out"),
            USE_VOICE_SESSION
              ? withTimeout(
                createVoiceSession(MIITHII_API_URL, targetLanguage, connectAbort.signal),
                15_000,
                "Voice session timed out",
              )
              : Promise.resolve(null),
          ]);
          console.info("[miithii-voice-stage]", "preflight_ok", { attempt });
          if (!attemptCurrent() || connectAbort.signal.aborted) return;
          const endpoint = VOICE_TRANSPORT === "cloudflare-sfu"
            ? PIPECAT_START_URL_OVERRIDE
            : PIPECAT_START_URL_OVERRIDE || session?.startUrl || PIPECAT_START_URL;
          if (!endpoint) {
            throw new Error("Miithii SFU start endpoint is not configured");
          }
          const connectionParams = await client.startBot({
            endpoint,
            ...(session ? { headers: new Headers({ authorization: `Bearer ${session.token}` }) } : {}),
            timeout: 60_000,
            requestData: {
              transport: VOICE_TRANSPORT === "cloudflare-sfu" ? "cloudflare-sfu" : "webrtc",
              enableDefaultIceServers: true,
              body: { language: targetLanguage },
            },
          });
          if (!attemptCurrent() || connectAbort.signal.aborted) {
            console.info("[miithii-voice-stage]", "startup_cancelled_after_auth", { attempt });
            attemptActive = false;
            await client.disconnect().catch(() => {});
            return;
          }
          await withTimeout(
            client.connect(connectionParams),
            120_000,
            "Voice startup timed out",
          );
          botReady = true;
          console.info("[miithii-voice-stage]", "bot_ready", { attempt });
          if (attemptCurrent()) setPhase("ready");
          return;
        } catch (cause) {
          if (!current() || connectAbort.signal.aborted || clientRef.current !== client) return;

          const message = cause instanceof Error ? cause.message : "Could not open Miithii Voice";
          const retryable = attempt === 1 && !botReady && isRetryableStartupFailure(cause);
          console.info("[miithii-voice-stage]", "connect_failed", {
            message,
            attempt,
            retryable,
          });

          // Suppress callbacks from the retired attempt while keeping clientRef
          // occupied so a user tap cannot create a new media manager during
          // teardown. For a non-retryable failure, abort any parallel preflight
          // work; a retryable transport failure has already completed preflight
          // and keeps the user-intent abort signal alive for attempt two.
          attemptActive = false;
          if (!retryable) connectAbort.abort();
          setError(null);
          setPhase("connecting");
          let cleanupFailed = false;
          await client.disconnect().catch(error => {
            cleanupFailed = true;
            console.info("[miithii-voice-stage]", "disconnect_after_failure_failed", {
              message: error instanceof Error ? error.message : String(error),
              attempt,
            });
          });
          const retirementAcknowledged = VOICE_TRANSPORT === "cloudflare-sfu"
            && (client.transport as MiithiiCloudflareSFUTransport).retirementAcknowledged;

          // Cancellation, backgrounding or a language switch increments the
          // generation and/or clears the client while cleanup is in flight.
          // Those user lifecycle actions always win over automatic retry.
          if (generationRef.current !== generation || clientRef.current !== client) return;
          clientRef.current = null;

          if (
            retryable
            && !cleanupFailed
            && retirementAcknowledged
            && !connectAbort.signal.aborted
          ) {
            console.info("[miithii-voice-stage]", "startup_retry", {
              attempt: 2,
              code: cause.code,
              ...(cause.path ? { path: cause.path } : {}),
              ...(cause.status ? { status: cause.status } : {}),
            });
            setTransportState("disconnected");
            setPhase("connecting");
            continue;
          }

          if (retryable && !retirementAcknowledged) {
            console.info("[miithii-voice-stage]", "startup_retry_blocked", {
              reason: "sfu_retirement_unacknowledged",
              attempt,
            });
          }

          connectAbort.abort();
          generationRef.current += 1;
          setError(message);
          setPhase("error");
          return;
        }
      }
    } finally {
      if (connectAbortRef.current === connectAbort) connectAbortRef.current = null;
    }
  }, [language, level, resetSignal]);

  const disconnect = useCallback(async () => {
    console.info("[miithii-voice-stage]", "disconnect_requested");
    const client = clientRef.current;
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    generationRef.current += 1;
    clientRef.current = null;
    try {
      if (client) await client.disconnect();
    } finally {
      setTransportState("disconnected");
      setPhase("offline");
      resetSignal();
    }
  }, [resetSignal]);

  // Voice owns the microphone only while Miithii is visible. Backgrounding
  // invalidates the current generation before native/WebRTC cleanup runs, so
  // late events from the retired session cannot mutate a future conversation.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      console.info("[miithii-voice-stage]", "app_state_change", { state });
      if (state === "background" && clientRef.current) {
        console.info("[miithii-voice-stage]", "disconnect_background");
        void disconnect();
      }
    });
    return () => subscription.remove();
  }, [disconnect]);

  useEffect(() => () => {
    generationRef.current += 1;
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    const client = clientRef.current;
    clientRef.current = null;
    if (client) void client.disconnect().catch(() => {});
  }, []);

  const changeLanguage = useCallback(async (next: ReplyLanguage) => {
    if (next === language) return;
    // A language switch is a session reset even while startup is still in
    // progress. Checking only `client.connected` lets an old-language auth/ICE
    // attempt keep running behind the newly selected pill, which can leave the
    // UI showing one reply language while the live capability/bot uses another.
    const hadClient = Boolean(clientRef.current);
    if (hadClient) await disconnect();
    setLanguage(next);
    activeLanguageRef.current = next;
    if (hadClient) await connect(next);
  }, [connect, disconnect, language]);

  const active = phase !== "offline" && phase !== "error";
  const scale = Animated.multiply(
    Animated.add(1, Animated.multiply(level, 0.16)),
    Animated.add(1, Animated.multiply(glow, 0.025)),
  );
  const haloOpacity = Animated.add(0.08, Animated.multiply(level, 0.28));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Text style={styles.wordmark}>Miithii</Text>
          <View style={styles.languages} accessibilityRole="radiogroup">
            {(Object.keys(LANGUAGE_LABELS) as ReplyLanguage[]).map(code => {
              const selected = language === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => void changeLanguage(code)}
                  style={[styles.language, selected && styles.languageSelected]}
                >
                  <Text style={[styles.languageText, selected && styles.languageTextSelected]}>
                    {LANGUAGE_LABELS[code].native}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.stage}>
          <Text style={styles.phase}>{phaseCopy(phase, language)}</Text>

          <Pressable
            onPress={() => void (active ? disconnect() : connect())}
            accessibilityRole="button"
            accessibilityLabel={phase === "connecting" ? "Cancel voice startup" : active ? "End voice session" : "Start voice session"}
            style={styles.presenceHitArea}
          >
            <Animated.View style={[styles.halo, { opacity: haloOpacity, transform: [{ scale }] }]} />
            <Animated.View
              style={[
                styles.presence,
                phase === "listening" && styles.presenceListening,
                phase === "speaking" && (language === "as" ? styles.presenceAssamese : styles.presenceBodo),
                { transform: [{ scale }] },
              ]}
            >
              <View style={styles.presenceCore} />
            </Animated.View>
          </Pressable>

          <Text style={styles.action}>{phase === "connecting" ? "tap to cancel" : active ? "tap to end" : "tap to start"}</Text>
          {responseMs !== null ? <Text style={styles.latency}>{(responseMs / 1000).toFixed(2)}s response</Text> : null}
        </View>

        <View style={styles.transcript}>
          {heard ? (
            <View style={styles.turn}>
              <Text style={styles.turnLabel}>YOU</Text>
              <Text style={styles.userText} numberOfLines={3}>{heard}</Text>
            </View>
          ) : null}
          {reply ? (
            <View style={styles.turn}>
              <Text style={styles.turnLabel}>MIITHII · {LANGUAGE_LABELS[activeLanguageRef.current].english.toUpperCase()}</Text>
              <Text style={styles.replyText} numberOfLines={5}>{reply}</Text>
            </View>
          ) : null}
          {!heard && !reply && !error ? (
            <Text style={styles.firstUse}>Speak any language. Miithii answers in {LANGUAGE_LABELS[language].english}.</Text>
          ) : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {__DEV__ ? <Text style={styles.endpoint}>{PIPECAT_START_URL}</Text> : null}
            </View>
          ) : null}
        </View>

        {__DEV__ ? <Text style={styles.debugState}>{transportState}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#070908" },
  screen: { flex: 1, paddingHorizontal: 22, paddingTop: Platform.OS === "android" ? 22 : 10, paddingBottom: 18 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: "#f3f5f4", fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  languages: { flexDirection: "row", backgroundColor: "#111513", borderRadius: 999, padding: 3 },
  language: { minWidth: 68, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, alignItems: "center" },
  languageSelected: { backgroundColor: "#edf3ef" },
  languageText: { color: "#89928d", fontSize: 15, fontWeight: "600" },
  languageTextSelected: { color: "#111513" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 360 },
  phase: { color: "#a6afaa", fontSize: 14, fontWeight: "600", letterSpacing: 0.2, marginBottom: 34 },
  presenceHitArea: { width: 188, height: 188, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 176, height: 176, borderRadius: 88, backgroundColor: "#b8cfbf" },
  presence: { width: 132, height: 132, borderRadius: 66, backgroundColor: "#1b211e", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#303a35" },
  presenceListening: { backgroundColor: "#24302b", borderColor: "#607067" },
  presenceAssamese: { backgroundColor: "#12352d", borderColor: "#367a68" },
  presenceBodo: { backgroundColor: "#222942", borderColor: "#5d6da9" },
  presenceCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#edf3ef" },
  action: { marginTop: 26, color: "#65706a", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.2 },
  latency: { marginTop: 9, color: "#87918c", fontSize: 12, fontVariant: ["tabular-nums"] },
  transcript: { minHeight: 175, justifyContent: "flex-end", paddingBottom: 14, gap: 17 },
  turn: { gap: 5 },
  turnLabel: { color: "#65706a", fontSize: 10, fontWeight: "700", letterSpacing: 1.1 },
  userText: { color: "#a3aaa6", fontSize: 16, lineHeight: 22 },
  replyText: { color: "#eef2f0", fontSize: 22, lineHeight: 29, fontWeight: "500", letterSpacing: -0.3 },
  firstUse: { alignSelf: "center", maxWidth: 290, textAlign: "center", color: "#77817c", fontSize: 14, lineHeight: 20 },
  errorBox: { alignItems: "center", gap: 6 },
  errorText: { color: "#e6a39d", fontSize: 14, lineHeight: 20, textAlign: "center" },
  endpoint: { color: "#626c67", fontSize: 10 },
  debugState: { alignSelf: "center", color: "#444c48", fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase" },
});
