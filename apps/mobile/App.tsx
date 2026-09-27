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

import { MIITHII_API_URL, resolveVoicePcmStartUrl } from "./src/config";
import { createVoiceSession } from "./src/session";
import type {
  ReplyLanguage,
  VoiceDomErrorEvent,
  VoiceDomServerEvent,
  VoiceDomStateEvent,
  VoiceLatencyStage,
} from "./src/voice-contract";
import VoiceDOM, { type VoiceDOMRef } from "./src/voice-dom";

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
  const voiceDomRef = useRef<VoiceDOMRef>(null);
  const connectAbortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const activeRef = useRef(false);
  const activeLanguageRef = useRef<ReplyLanguage>("as");
  const turnStoppedAtRef = useRef<number | null>(null);
  const level = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const [language, setLanguage] = useState<ReplyLanguage>("as");
  const [phase, setPhase] = useState<Phase>("offline");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [responseMs, setResponseMs] = useState<number | null>(null);
  const [stageLatency, setStageLatency] = useState<Partial<Record<VoiceLatencyStage, number>>>({});
  const [error, setError] = useState<string | null>(null);

  const resetSignal = useCallback(() => {
    Animated.timing(level, {
      toValue: 0,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [level]);

  useEffect(() => {
    if (phase !== "ready") {
      glow.stopAnimation();
      glow.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [glow, phase]);

  const onDomState = useCallback(async (event: VoiceDomStateEvent) => {
    if (event.generation !== generationRef.current) return;
    console.info("[miithii-voice-stage]", "dom_state", event);
    if (event.state === "connecting") setPhase("connecting");
    if (event.state === "ready") {
      setError(null);
      setPhase("ready");
    }
    if (event.state === "error") setPhase("error");
    if (event.state === "stopped") {
      activeRef.current = false;
      setPhase("offline");
    }
  }, []);

  const onDomError = useCallback(async (event: VoiceDomErrorEvent) => {
    if (event.generation !== generationRef.current) return;
    console.info("[miithii-voice-stage]", "dom_error", event);
    activeRef.current = false;
    setError(event.message);
    setPhase("error");
  }, []);

  const onDomEvent = useCallback(async ({ generation, event }: VoiceDomServerEvent) => {
    if (generation !== generationRef.current) return;
    console.info("[miithii-voice-stage]", "server_event", { type: event.type });

    switch (event.type) {
      case "user-started":
        setError(null);
        setHeard("");
        setReply("");
        setResponseMs(null);
        setStageLatency({});
        setPhase("listening");
        break;
      case "user-stopped":
        turnStoppedAtRef.current = performance.now();
        setPhase("thinking");
        resetSignal();
        break;
      case "transcript":
        if (event.final && event.text.trim()) setHeard(event.text.trim());
        break;
      case "bot-text":
        if (event.text.trim()) setReply(event.text.trim());
        break;
      case "bot-started": {
        const stoppedAt = turnStoppedAtRef.current;
        if (stoppedAt !== null) setResponseMs(Math.round(performance.now() - stoppedAt));
        setPhase("speaking");
        break;
      }
      case "bot-stopped":
        setPhase("ready");
        resetSignal();
        break;
      case "audio-level":
        level.setValue(Math.min(1, Math.max(0, event.level)));
        break;
      case "latency":
        setStageLatency(current => ({ ...current, [event.stage]: event.ms }));
        break;
    }
  }, [level, resetSignal]);

  const connect = useCallback(async (targetLanguage: ReplyLanguage = language) => {
    if (activeRef.current) return;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    activeRef.current = true;
    activeLanguageRef.current = targetLanguage;
    setError(null);
    setHeard("");
    setReply("");
    setResponseMs(null);
    setStageLatency({});
    setPhase("connecting");

    const controller = new AbortController();
    connectAbortRef.current = controller;

    try {
      console.info("[miithii-voice-stage]", "session_start", { generation, language: targetLanguage });
      const session = await createVoiceSession(
        MIITHII_API_URL,
        targetLanguage,
        controller.signal,
      );
      if (generationRef.current !== generation || controller.signal.aborted) return;

      const startUrl = resolveVoicePcmStartUrl(session.startUrl);
      if (!startUrl) {
        throw new Error("Voice PCM endpoint is not configured");
      }
      const dom = voiceDomRef.current;
      if (!dom) throw new Error("Voice media component is unavailable");

      dom.start({
        generation,
        language: targetLanguage,
        startUrl,
        token: session.token,
      });
    } catch (cause) {
      if (generationRef.current !== generation || controller.signal.aborted) return;
      activeRef.current = false;
      const message = cause instanceof Error ? cause.message : "Could not open Miithii Voice";
      console.info("[miithii-voice-stage]", "session_failed", { generation, message });
      setError(message);
      setPhase("error");
    } finally {
      if (connectAbortRef.current === controller) connectAbortRef.current = null;
    }
  }, [language]);

  const disconnect = useCallback(async () => {
    const wasActive = activeRef.current;
    connectAbortRef.current?.abort();
    connectAbortRef.current = null;
    generationRef.current += 1;
    activeRef.current = false;
    if (wasActive) voiceDomRef.current?.stop();
    setPhase("offline");
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      console.info("[miithii-voice-stage]", "app_state_change", { state });
      if (state === "background" && activeRef.current) void disconnect();
    });
    return () => subscription.remove();
  }, [disconnect]);

  useEffect(() => () => {
    connectAbortRef.current?.abort();
    generationRef.current += 1;
    activeRef.current = false;
    voiceDomRef.current?.stop();
  }, []);

  const changeLanguage = useCallback(async (next: ReplyLanguage) => {
    if (next === language) return;
    const wasActive = activeRef.current;
    if (wasActive) await disconnect();
    setLanguage(next);
    activeLanguageRef.current = next;
    if (wasActive) await connect(next);
  }, [connect, disconnect, language]);

  const active = phase !== "offline" && phase !== "error";
  const scale = Animated.multiply(
    Animated.add(1, Animated.multiply(level, 0.16)),
    Animated.add(1, Animated.multiply(glow, 0.025)),
  );
  const haloOpacity = Animated.add(0.08, Animated.multiply(level, 0.28));
  const latencyParts = [
    stageLatency.stt === undefined ? null : `STT ${(stageLatency.stt / 1000).toFixed(2)}s`,
    stageLatency.brain === undefined ? null : `brain ${(stageLatency.brain / 1000).toFixed(2)}s`,
    stageLatency["tts-first-audio"] === undefined
      ? null
      : `TTS ${(stageLatency["tts-first-audio"]! / 1000).toFixed(2)}s`,
  ].filter((value): value is string => Boolean(value));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <VoiceDOM
        ref={voiceDomRef}
        onState={onDomState}
        onError={onDomError}
        onEvent={onDomEvent}
        dom={{
          style: styles.domHost,
          scrollEnabled: false,
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />

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
            accessibilityLabel={phase === "connecting"
              ? "Cancel voice startup"
              : active
                ? "End voice session"
                : "Start voice session"}
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
          {latencyParts.length > 0 ? (
            <Text style={styles.latency}>{latencyParts.join(" · ")}</Text>
          ) : responseMs !== null ? (
            <Text style={styles.latency}>{(responseMs / 1000).toFixed(2)}s response</Text>
          ) : null}
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
            <Text style={styles.firstUse}>
              Speak any language. Miithii answers in {LANGUAGE_LABELS[language].english}.
            </Text>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#070908" },
  domHost: { position: "absolute", width: 1, height: 1, opacity: 0 },
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
  errorText: { color: "#e6a39d", fontSize: 14, lineHeight: 20, textAlign: "center" },
});
