import type { AgentState, TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { useTrackVolume } from '@livekit/react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ConversationModel } from '../lib/conversation.ts';
import { cue } from '../lib/haptics';
import { deriveVoiceUiState, type VoiceUiPresence } from '../lib/voiceUiState';
import { latinLanguageName, nativeLanguageName, stringsFor, type Copy, type ReplyLanguage } from '../theme/copy';
import { useTheme } from '../theme/ThemeProvider';
import { family, motion, space, type as typeScale, voiceLayout } from '../theme/tokens';
import { ControlBar, Header, MicIcon, ResetControl } from './Console';
import { LanguageSheet } from './LanguageSheet';
import { Wordmark } from './Logo';
import { Transcript } from './Transcript';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type { ReplyLanguage };
type VoiceShellProps = {
  configured: boolean; language: ReplyLanguage; connectionState: string; agentState: AgentState;
  audioTrack?: TrackReferenceOrPlaceholder;
  microphoneEnabled?: boolean; microphoneBusy?: boolean; onToggleMicrophone?: () => void;
  conversation: ConversationModel; operation: 'starting' | 'ending' | null;
  issue: 'start' | 'stop' | null; gateRefusal: string | null;
  replyShortened?: boolean;
  onLanguageChange: (language: ReplyLanguage) => void; onStartStop: () => void;
  onRetry: () => void; onReset: () => void;
};
const STATUS: Record<VoiceUiPresence, keyof Copy> = {
  off: 'statusOff', idle: 'statusIdle', connecting: 'statusConnecting', listening: 'statusListening',
  thinking: 'statusThinking', synthesizing: 'statusSynthesizing', speaking: 'statusSpeaking',
};

/** One voice state, readable conversation, and a permanent control dock. */
export function VoiceShell(props: VoiceShellProps) {
  const theme = useTheme();
  const { palette } = theme;
  const accent = theme.accent(props.language);
  const copy = stringsFor(props.language);
  const [sheetOpen, setSheetOpen] = useState(false);
  const turns = props.conversation.history.length + (props.conversation.live ? 1 : 0);
  const segments = props.conversation.live?.segments ?? [];
  const ui = deriveVoiceUiState({ ...props, hasGeneratedText: segments.length > 0,
    hasSpokenText: segments.some((segment) => segment.state === 'speaking' || segment.state === 'spoken'),
    hasConversation: turns > 0, microphoneAvailable: Boolean(props.onToggleMicrophone) });
  const waiting = ui.presence === 'thinking' || ui.presence === 'synthesizing';
  const preparing = waiting || ui.phase === 'connecting' || ui.phase === 'ending';
  const reduced = useReducedMotion();
  const [compact, setCompact] = useState(turns > 0);
  useLayoutEffect(() => {
    if (compact === (turns > 0)) return;
    if (!reduced) LayoutAnimation.configureNext({ duration: motion.state,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' }, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    setCompact(turns > 0);
  }, [turns, compact, reduced]);
  const breathing = useRef(new Animated.Value(0)).current;
  const voiceLevel = useTrackVolume(ui.presence === 'speaking' || ui.presence === 'listening' ? props.audioTrack : undefined);
  const voiceScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const reactive = !reduced && (ui.presence === 'speaking' || (ui.presence === 'listening' && !ui.muted));
    const animation = Animated.timing(voiceScale, { toValue: reactive ? 1 + Math.min(1, Math.sqrt(voiceLevel)) * 0.06 : 1,
      duration: 100, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [voiceLevel, reduced, voiceScale, ui.presence, ui.muted]);
  useEffect(() => {
    breathing.stopAnimation(); breathing.setValue(0);
    if (!preparing || reduced) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breathing, { toValue: 1, duration: 900, useNativeDriver: true, isInteraction: false }),
      Animated.timing(breathing, { toValue: 0, duration: 900, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [breathing, preparing, reduced]);
  const waitPhase = waiting ? 'reply' : ui.phase === 'connecting' ? 'connecting'
    : ui.phase === 'ending' ? 'ending' : null;
  const [waitClock, setWaitClock] = useState<{ phase: typeof waitPhase; elapsed: number }>({ phase: null, elapsed: 0 });
  const waitMs = waitClock.phase === waitPhase ? waitClock.elapsed : 0;
  const waitingCuePlayed = useRef(false);
  useEffect(() => {
    waitingCuePlayed.current = false;
    setWaitClock({ phase: waitPhase, elapsed: 0 });
    if (!waitPhase) return;
    // Thinking and synthesis are two phases of one reply wait. Keep one clock running across
    // that handoff so the elapsed cue reflects the user's whole wait, not only the last phase.
    const started = performance.now();
    const timer = setInterval(() => {
      setWaitClock({ phase: waitPhase, elapsed: performance.now() - started });
    }, 1000);
    return () => clearInterval(timer);
  }, [waitPhase]);
  // The elapsed readout also helps during connect/end, but the long-wait cue is only for a reply
  // the user is waiting to hear; teardown must not buzz as though synthesis were stalled.
  useEffect(() => {
    if (!waiting || props.operation === 'ending' || waitMs < voiceLayout.longWait || waitingCuePlayed.current) return;
    waitingCuePlayed.current = true;
    cue('waiting');
  }, [props.operation, waitMs, waiting]);
  const previousPresence = useRef<VoiceUiPresence>('off');
  useEffect(() => {
    if (ui.presence === 'synthesizing' && previousPresence.current !== 'synthesizing') cue('preparing');
    previousPresence.current = ui.presence;
  }, [ui.presence]);
  const events = useRef({ failed: false, interrupted: false });
  const interrupted = segments.some((segment) => segment.state === 'unspoken');
  useEffect(() => {
    if (ui.failed && !events.current.failed) cue('refused');
    else if (interrupted && !events.current.interrupted) cue('interrupted');
    events.current = { failed: ui.failed, interrupted };
  }, [ui.failed, interrupted]);
  const spoken = useRef({ turn: props.conversation.live?.key, index: -1 });
  const onSentenceSpoken = useCallback((index: number) => {
    const turn = props.conversation.live?.key;
    if (spoken.current.turn !== turn || spoken.current.index !== index) cue('sentence');
    spoken.current = { turn, index };
    return index;
  }, [props.conversation.live?.key]);
  const state = ui.failed ? copy.statusFailed : props.operation === 'ending' ? copy.statusEnding
    : ui.muted && ui.presence === 'idle' ? copy.micMuted : copy[STATUS[ui.presence]];
  const controlLabel = ui.controls.primary.action === 'retry' ? copy.consoleRetry
    : ui.phase === 'connecting' ? 'Cancel' : ui.phase === 'live' ? copy.consoleStop : copy.consoleStart;
  const explanation = ui.failed ? copy.helpFailed : props.operation === 'ending' ? null
    : waiting ? waitMs >= voiceLayout.longWait ? 'Taking longer than usual. You can read or end the conversation.'
      : ui.presence === 'synthesizing' ? 'Text is ready. Keep this screen open to hear the reply.' : null
      : props.replyShortened && ui.presence !== 'speaking' ? copy.shortened : null;

  return <View style={[styles.stage, { backgroundColor: palette.surface.ink }]}>
    <SafeAreaView style={styles.stage} edges={['top', 'bottom']}
      importantForAccessibility={sheetOpen ? 'no-hide-descendants' : 'auto'}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Header language={props.language} languageName={nativeLanguageName(props.language)}
        latinName={latinLanguageName(props.language)} accent={accent.tint}
        languageEnabled={ui.controls.language.enabled && !theme.transitioning} onPressLanguage={() => setSheetOpen(true)} />
      <View style={[styles.conversation, !compact && styles.emptyConversation]}>
        <View style={[styles.identity, compact && styles.identityCompact]}>
          <Animated.View style={{ opacity: breathing.interpolate({ inputRange: [0, 1], outputRange: [1, 0.62] }), transform: [{ scale: preparing ? breathing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) : voiceScale }] }}>
            <Wordmark size={compact ? voiceLayout.logoCompact : voiceLayout.logoWidth} />
          </Animated.View>
          <View style={styles.state}>
            {preparing ? <ActivityIndicator size="small" color={accent.tint} />
              : <View style={[styles.lamp, { backgroundColor: ui.failed ? palette.text.alarm : accent.tint }]} />}
            <Text accessibilityLiveRegion="polite" style={[typeScale.caption, { fontFamily: family.mono, color: ui.failed ? palette.text.alarm : preparing ? accent.tint : palette.text.muted }]}>{state}{preparing ? ' · ' + Math.floor(waitMs / 1000) + 's' : ''}</Text>
          </View>
          {explanation ? <Text accessibilityLiveRegion="polite" style={[styles.explanation, { color: palette.text.muted }]}>{explanation}</Text> : null}
        </View>
        {compact ? <Transcript conversation={props.conversation} language={props.language}
          refusal={ui.failed ? null : props.gateRefusal} copy={copy}
          onSentenceSpoken={onSentenceSpoken} /> : null}
      </View>
      <View style={styles.dock}>
        <View style={styles.sideControl}>
          {ui.controls.microphone.visible && props.onToggleMicrophone ? <Pressable
            accessibilityRole="button" accessibilityLabel={ui.muted ? 'Unmute microphone' : 'Mute microphone'}
            accessibilityState={{ disabled: !ui.controls.microphone.enabled, busy: props.microphoneBusy }}
            disabled={!ui.controls.microphone.enabled} onPress={props.onToggleMicrophone}
            style={({ pressed }) => [styles.secondary, { backgroundColor: pressed ? palette.surface.controlPressed : palette.surface.control }]}>
            {props.microphoneBusy ? <ActivityIndicator color={palette.text.muted} /> : <MicIcon color={ui.muted ? palette.text.muted : accent.tint} muted={ui.muted} />}
          </Pressable> : null}
        </View>
        <ControlBar accent={accent.tint} phase={ui.phase} label={controlLabel}
          disabled={!ui.controls.primary.enabled} onStart={ui.controls.primary.action === 'retry' ? props.onRetry : props.onStartStop}
          onEnd={props.onStartStop} />
        <View style={styles.sideControl}>
          {ui.controls.reset.visible ? <ResetControl label={copy.consoleReset} enabled={ui.controls.reset.enabled} onReset={props.onReset} /> : null}
        </View>
      </View>
    </SafeAreaView>
    <LanguageSheet visible={sheetOpen} current={props.language} copy={copy} onCancel={() => setSheetOpen(false)}
      onPick={(next) => { setSheetOpen(false); if (next !== props.language) theme.holdScreen(() => props.onLanguageChange(next)); }} />
  </View>;
}
const styles = StyleSheet.create({
  stage: { flex: 1 }, conversation: { flex: 1 }, emptyConversation: { justifyContent: 'center' },
  identity: { alignItems: 'center', paddingHorizontal: space.xxl, gap: space.lg, paddingVertical: space.xxl },
  identityCompact: { paddingVertical: space.lg }, state: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 24 },
  lamp: { width: 6, height: 6, borderRadius: 3 }, explanation: { ...typeScale.caption, fontFamily: family.mono, textAlign: 'center' },
  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl },
  sideControl: { width: 52, alignItems: 'center' }, secondary: { width: 52, height: 52, borderRadius: 26, marginBottom: 26, alignItems: 'center', justifyContent: 'center' },
});
