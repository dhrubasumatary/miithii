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
  USE_VOICE_SESSION,
} from "./src/config";
import { createVoiceSession } from "./src/session";
import { createVoiceClient, type ReplyLanguage } from "./src/voice-client";

type Phase = "offline" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";

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

    const client = createVoiceClient({
      onTransportState: state => {
        if (!current()) return;
        setTransportState(state);
        if (["initializing", "authenticating", "authenticated", "connecting", "connected"].includes(state)) {
          setPhase("connecting");
        }
        if (state === "ready") setPhase("ready");
        if (state === "disconnected") setPhase("offline");
        if (state === "error") setPhase("error");
      },
      onConnected: () => {
        if (current()) setError(null);
      },
      onDisconnected: () => {
        if (!current()) return;
        setPhase("offline");
        resetSignal();
      },
      onUserStartedSpeaking: () => {
        if (!current()) return;
        setPhase("listening");
        setError(null);
        setHeard("");
        setReply("");
        setResponseMs(null);
      },
      onUserStoppedSpeaking: () => {
        if (!current()) return;
        turnStoppedAtRef.current = performance.now();
        setPhase("thinking");
        resetSignal();
      },
      onBotStartedSpeaking: () => {
        if (!current()) return;
        const stoppedAt = turnStoppedAtRef.current;
        if (stoppedAt !== null) setResponseMs(Math.round(performance.now() - stoppedAt));
        setPhase("speaking");
      },
      onBotStoppedSpeaking: () => {
        if (!current()) return;
        setPhase("ready");
        resetSignal();
      },
      onUserTranscript: data => {
        if (current() && data.final && data.text.trim()) setHeard(data.text.trim());
      },
      onBotText: data => {
        if (current() && data.text.trim()) setReply(data.text.trim());
      },
      onLocalAudioLevel: next => {
        if (current()) level.setValue(Math.min(1, Math.max(0, next)));
      },
      onRemoteAudioLevel: next => {
        if (current()) level.setValue(Math.min(1, Math.max(0, next)));
      },
      onMetrics: () => {},
      onError: message => {
        if (!current()) return;
        setError(message);
        setPhase("error");
        resetSignal();
      },
    });
    clientRef.current = client;

    try {
      const [, session] = await Promise.all([
        client.initDevices(),
        USE_VOICE_SESSION
          ? createVoiceSession(MIITHII_API_URL, targetLanguage)
          : Promise.resolve(null),
      ]);
      if (!current()) return;
      await client.startBotAndConnect({
        endpoint: session?.startUrl || PIPECAT_START_URL,
        ...(session ? { headers: new Headers({ authorization: `Bearer ${session.token}` }) } : {}),
        timeout: 15_000,
        requestData: {
          transport: "webrtc",
          enableDefaultIceServers: true,
          body: { language: targetLanguage },
        },
      });
      if (current()) setPhase("ready");
    } catch (cause) {
      if (!current()) return;
      clientRef.current = null;
      const message = cause instanceof Error ? cause.message : "Could not open Miithii Voice";
      setError(message);
      setPhase("error");
    }
  }, [language, level, resetSignal]);

  const disconnect = useCallback(async () => {
    const client = clientRef.current;
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
      if (state !== "active" && clientRef.current) void disconnect();
    });
    return () => subscription.remove();
  }, [disconnect]);

  useEffect(() => () => {
    generationRef.current += 1;
    const client = clientRef.current;
    clientRef.current = null;
    if (client) void client.disconnect().catch(() => {});
  }, []);

  const changeLanguage = useCallback(async (next: ReplyLanguage) => {
    if (next === language) return;
    const wasConnected = Boolean(clientRef.current?.connected);
    if (wasConnected) await disconnect();
    setLanguage(next);
    activeLanguageRef.current = next;
    if (wasConnected) await connect(next);
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
            disabled={phase === "connecting"}
            accessibilityRole="button"
            accessibilityLabel={active ? "End voice session" : "Start voice session"}
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

          <Text style={styles.action}>{phase === "connecting" ? "connecting" : active ? "tap to end" : "tap to start"}</Text>
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
