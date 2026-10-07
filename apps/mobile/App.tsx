import {
  SessionProvider,
  useAgent,
  useLocalParticipant,
  useSession,
  useSessionContext,
  useSessionMessages,
} from '@livekit/components-react';
import { DEFAULT_LANGUAGE_ID, normalizeLanguageId } from '@miithii/language-core-ts';
import { AudioSession } from '@livekit/react-native';
import { createAudioSessionLeases } from './src/lib/audioSessionLease';
import { guardCancelledConnection } from './src/lib/cancelledConnection';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { RoomEvent, TokenSource, Track } from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VoiceShell } from './src/components/VoiceShell';
import { useDeviceCapabilities } from './src/hooks/useDeviceCapabilities';
import { useReplyPreview } from './src/hooks/useReplyPreview';
import { buildConversation } from './src/lib/conversation';
import { spokenTranscriptForTurn } from './src/lib/turnTranscript';
import { createOperationBound } from './src/lib/operationBound';
import {
  clearRetainedTurns,
  mergeConversation,
  retainTurns,
  type RetainedTurns,
  type Turn,
} from './src/lib/conversation';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import type { ReplyLanguage } from './src/theme/copy';

export type { ReplyLanguage };

type LiveKitExtra = {
  livekitDevelopmentTokenServerId?: string;
  livekitTokenEndpoint?: string;
  livekitAgentName?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as LiveKitExtra;
const developmentTokenServerId = extra.livekitDevelopmentTokenServerId?.trim() ?? '';
const tokenEndpoint = extra.livekitTokenEndpoint?.trim() ?? '';
const agentName = extra.livekitAgentName?.trim() || undefined;

/** Must match `miithii_agent.token.LANGUAGE_ATTRIBUTE`. */
const LANGUAGE_ATTRIBUTE = 'miithii.language';
const audioLeases = createAudioSessionLeases({ start: () => AudioSession.startAudioSession(), stop: () => AudioSession.stopAudioSession() });

const tokenSource = developmentTokenServerId
  ? TokenSource.developmentTokenServer(developmentTokenServerId)
  : tokenEndpoint
    ? TokenSource.endpoint(tokenEndpoint)
    : null;

/**
 * The mono face, loaded at runtime.
 *
 * Every label on the face is set in it, and the app must never draw a frame without it: a
 * first render in the platform sans is the one moment the design is not the design, and on a
 * dark screen the swap is a visible flash. So the app holds on the page colour until the face
 * is ready rather than rendering chrome in the wrong typeface and swapping it.
 *
 * The two Indic faces are *not* loaded this way. `useFonts` loads a single face per family, and
 * a family that resolved only its regular weight would synthetic-bold the semibold, which on a
 * conjunct like `ক্ষ` or `क्ष` fattens the strokes uniformly and dissolves the joins. Those come
 * from `app.json`'s `expo-font` plugin, which bakes the weights into the native build.
 */
function useMono(): { loaded: boolean; failed: boolean } {
  const [loaded, error] = useFonts({
    SpaceMono: require('./assets/fonts/SpaceMono-Regular.ttf'),
  });
  useEffect(() => {
    if (error) console.warn('miithii: mono face failed to load', error);
  }, [error]);
  return { loaded, failed: Boolean(error) };
}

type VoiceIssue = 'start' | 'stop' | null;
type VoiceOperation = 'starting' | 'ending' | null;

/**
 * The bound on any one session operation.
 *
 * This exists because the whole interface is gated on `operation`, and a gate on a flag that
 * cannot be proven to clear is a brick. `session.end()` and `session.start()` are awaited with
 * no timeout of their own, and a teardown can legitimately stay open for a long time - a
 * pending TTS turn keeps it open - so "long" is not the failure. Never settling is.
 *
 * So the flag is released whether or not the work underneath finished. The room may still be
 * closing in the background; that is the SDK's business and it has its own recovery. The user's
 * controls are not hostage to it.
 */

/**
 * Whether the app opens into a live microphone without being asked.
 *
 * It does not. A voice app that opens already listening has taken the microphone before the
 * user has decided anything, and the first thing on the face would be a live session rather
 * than an invitation. `App` mounts its runtime with `autoStart: false` so the opening state is
 * `READY` with an explicit START, and every later entry into the app follows the same rule.
 *
 * `runtime.autoStart` is still threaded through `resetRuntime` because retry genuinely does
 * want to reconnect on the user's behalf: they pressed TRY AGAIN, which is a request for a
 * session, not a request for a screen.
 */
const AUTO_START_ON_OPEN = false;

export default function App() {
  const mono = useMono();
  const [replyLanguage, setReplyLanguage] = useState<ReplyLanguage>(DEFAULT_LANGUAGE_ID);
  const [runtime, setRuntime] = useState({ epoch: 0, autoStart: AUTO_START_ON_OPEN });

  /**
   * Finished turns, held here rather than in the session subtree.
   *
   * `VoiceRuntime` is keyed on `runtime.epoch`, so everything inside it is destroyed on every
   * session boundary - which is exactly the event that used to erase the transcript. A record
   * kept in there would not survive the thing it exists to survive, so it lives one level up and
   * is folded into the view by `mergeConversation`.
   */
  const [retained, setRetained] = useState<RetainedTurns>(clearRetainedTurns);

  const resetRuntime = useCallback((autoStart = false) => {
    setRuntime((value) => ({ epoch: value.epoch + 1, autoStart }));
  }, []);

  /** File newly-finished turns. Idempotent, so it is safe to call on every render. */
  const archiveTurns = useCallback((finished: readonly Turn[]) => {
    setRetained((previous) => retainTurns(previous, finished));
  }, []);

  /** A clear means start over, so the record goes with it. */
  const clearTranscript = useCallback(() => {
    setRetained(clearRetainedTurns());
  }, []);

  if (!mono.loaded && !mono.failed) {
    // The page colour, not a splash screen and not a spinner. A voice app that cannot speak
    // should not pretend to be busy; it should simply not have drawn yet.
    return <View style={{ flex: 1, backgroundColor: '#08090A' }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {mono.failed ? (
          <Boot />
        ) : tokenSource ? (
          <VoiceRuntime
            key={runtime.epoch}
            replyLanguage={replyLanguage}
            autoStart={runtime.autoStart}
            retained={retained}
            onArchiveTurns={archiveTurns}
            onClearTranscript={clearTranscript}
            onReplyLanguageChange={setReplyLanguage}
            onResetRuntime={resetRuntime}
          />
        ) : (
          <VoiceShell
            configured={false}
            language={replyLanguage}
            connectionState="unconfigured"
            agentState="disconnected"
            conversation={{ history: retained.turns, live: null }}
            operation={null}
            issue={null}
            gateRefusal={null}
            onLanguageChange={setReplyLanguage}
            onStartStop={() => undefined}
            onRetry={() => undefined}
            onReset={() => {
              clearTranscript();
              resetRuntime(false);
            }}
          />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * The one screen drawn before the face exists.
 *
 * It exists for two moments: before the mono face has loaded, and after the face has failed to
 * load at all. Both show the same substrate and both are drawn inside the theme provider, so the
 * second one at least appears on the face the user chose rather than snapping to dark on the way
 * out. It never shows a spinner, because a voice app that cannot speak should not look busy.
 */
function Boot() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: theme.palette.surface.ink }}>
      <Text
        style={{
          color: theme.palette.text.body,
          fontSize: 17,
          lineHeight: 25,
          textAlign: 'center',
        }}
      >
        Miithii could not start. Reopen the app.
      </Text>
    </View>
  );
}

function VoiceRuntime({
  replyLanguage,
  autoStart,
  retained,
  onArchiveTurns,
  onClearTranscript,
  onReplyLanguageChange,
  onResetRuntime,
}: {
  replyLanguage: ReplyLanguage;
  autoStart: boolean;
  retained: RetainedTurns;
  onArchiveTurns: (turns: readonly Turn[]) => void;
  onClearTranscript: () => void;
  onReplyLanguageChange: (language: ReplyLanguage) => void;
  onResetRuntime: (autoStart?: boolean) => void;
}) {
  // The reply language leaves the phone here and nowhere else.
  //
  // It travels as a participant attribute on the token request, so the server can validate it
  // and put it in the room name the worker reads on arrival. That is the whole session-language
  // contract: the phone states the language, the server owns it, and the worker is dispatched
  // with the matching policy, LLM and TTS voice. `agentName` is packaged by the SDK into
  // `room_config`, which is what gets the named worker actually given this session.
  const participantAttributes = useMemo(
    () => ({ [LANGUAGE_ATTRIBUTE]: replyLanguage }),
    [replyLanguage],
  );
  const session = useSession(tokenSource!, {
    agentName,
    participantAttributes,
  });
  const [operation, setOperation] = useState<VoiceOperation>(null);
  const [issue, setIssue] = useState<VoiceIssue>(null);
  const startedRef = useRef(false);
  const audioOwner = useRef(Symbol('voice-room')).current;
  const hasStartedRef = useRef(false);
  const startAbortRef = useRef<AbortController | null>(null);
  const endRef = useRef(session.end);
  const autoStartedRef = useRef(false);
  const boundRef = useRef<ReturnType<typeof createOperationBound> | null>(null);
  if (!boundRef.current) boundRef.current = createOperationBound(() => setOperation(null));

  useEffect(() => {
    endRef.current = session.end;
  }, [session.end]);

  /**
   * Release `operation` after a bounded wait, whatever the awaited work is doing.
   *
   * Every control on the face is gated on this flag, so a flag with no upper bound is a single
   * unsettled promise away from an interface that cannot be operated. The room may still be
   * open when this fires; the SDK owns that and recovers on its own. What must not happen is a
   * control that has stopped answering because nothing ever awaited a reply.
   */
  const releaseOperation = useCallback(() => {
    boundRef.current?.release();
  }, []);

  const holdOperation = useCallback(() => {
    return boundRef.current!.hold();
  }, []);

  useEffect(() => () => boundRef.current?.dispose(), []);

  const start = useCallback(async () => {
    if (operation || startedRef.current || startAbortRef.current) return;
    setOperation('starting');
    setIssue(null);
    const finishOperation = holdOperation();
    const controller = new AbortController();
    startAbortRef.current = controller;
    const releaseConnectionGuard = guardCancelledConnection(controller.signal, (listener) => {
      session.room.on(RoomEvent.ConnectionStateChanged, listener);
      return () => { session.room.off(RoomEvent.ConnectionStateChanged, listener); };
    }, () => session.room.disconnect());
    try {
      await audioLeases.claim(audioOwner);
      // Cancellation/backgrounding can arrive while the native audio session is opening.
      // Never publish a microphone after that request was withdrawn.
      if (controller.signal.aborted) return;
      startedRef.current = true;
      hasStartedRef.current = true;
      await session.start({
        signal: controller.signal,
        tracks: {
          microphone: {
            enabled: true,
            publishOptions: { preConnectBuffer: true },
          },
          camera: { enabled: false },
          screenShare: { enabled: false },
        },
      });
    } catch (cause) {
      startedRef.current = false;
      await session.end().catch(() => undefined);
      await audioLeases.release(audioOwner);
      if (!controller.signal.aborted) {
        console.warn('miithii: voice start failed', cause);
        setIssue('start');
      }
    } finally {
      releaseConnectionGuard();
      if (startAbortRef.current === controller) {
        startAbortRef.current = null;
        finishOperation();
      }
    }
  }, [audioOwner, holdOperation, operation, releaseOperation, session]);

  const stop = useCallback(async () => {
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    const shouldEndRoom = startedRef.current || session.connectionState !== 'disconnected';
    startedRef.current = false;
    setOperation('ending');
    setIssue(null);
    const finishOperation = holdOperation();
    try {
      if (shouldEndRoom) await session.end();
    } catch (cause) {
      console.warn('miithii: voice stop failed', cause);
      setIssue('stop');
    } finally {
      // Two ways out of a teardown, because one is not enough.
      //
      // The rejection: `setOperation(null)` used to sit after an unguarded `await`, so a
      // rejected `stopAudioSession` skipped it, left `operation` at 'ending' for the life of the
      // process, and every gated control on the face - the control bar, the language chip, the
      // clear - stayed dead until the app was killed.
      //
      // The never-settles case: no `finally` can help, because it never runs. `holdOperation`'s
      // bound covers that one.
      try {
        await audioLeases.release(audioOwner);
      } catch (cause) {
        console.warn('miithii: audio session stop failed', cause);
      } finally {
        finishOperation();
      }
    }
  }, [audioOwner, holdOperation, releaseOperation, session]);

  const reset = useCallback(async () => {
    await stop();
    onResetRuntime(false);
  }, [onResetRuntime, stop]);

  const retry = useCallback(async () => {
    await stop();
    onResetRuntime(true);
  }, [onResetRuntime, stop]);

  const failSession = useCallback(
    async (reasons: readonly string[]) => {
      console.warn('miithii: voice failed after connecting', reasons);
      startAbortRef.current?.abort();
      startAbortRef.current = null;
      startedRef.current = false;
      releaseOperation();
      setIssue('start');
      await session.end().catch((cause) => console.warn('miithii: failed session cleanup', cause));
      await audioLeases.release(audioOwner).catch(() => undefined);
    },
    [audioOwner, releaseOperation, session],
  );

  const selectLanguage = useCallback(
    (language: ReplyLanguage) => {
      if (language === replyLanguage) return;
      if (startedRef.current || session.connectionState !== 'disconnected') {
        // Do not block the new language on an old Room's asynchronous shutdown. A pending
        // TTS/audio turn can keep `session.end()` open long after the user picked a language.
        // The old runtime owns the cleanup; the new runtime mounts disconnected with a new
        // Room and an empty transcript immediately.
        void stop();
      }
      onReplyLanguageChange(language);
      // A language switch changes the policy, the prompt and the voice, and the agent's chat
      // context starts empty. The old turns are therefore not a conversation the new session can
      // continue, and showing them under a different language's accent would misrepresent that -
      // so this is the one boundary that clears the record. Ending a session does not.
      onClearTranscript();
      // A language switch always gets a fresh Room/session boundary, even after Stop.
      onResetRuntime(false);
    },
    [
      onClearTranscript,
      onReplyLanguageChange,
      onResetRuntime,
      replyLanguage,
      session.connectionState,
      stop,
    ],
  );

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void start();
  }, [autoStart, start]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && (startedRef.current || startAbortRef.current)) void stop();
    });
    return () => subscription.remove();
  }, [stop]);

  useEffect(() => {
    return () => {
      startAbortRef.current?.abort();
      if (startedRef.current) void endRef.current();
      void audioLeases.release(audioOwner).catch(() => undefined);
    };
  }, []);

  const startStop = useCallback(() => {
    if (operation === 'ending') return;
    if (operation || session.connectionState !== 'disconnected') {
      void stop();
      return;
    }
    // Fresh room after a finished session prevents old reply IDs crossing the boundary.
    if (hasStartedRef.current) onResetRuntime(true);
    else void start();
  }, [onResetRuntime, operation, session.connectionState, start, stop]);

  return (
    <SessionProvider session={session}>
      <ConnectedVoiceScreen
        replyLanguage={replyLanguage}
        connectionState={session.connectionState}
        operation={operation}
        issue={issue}
        onAgentFailed={failSession}
        retained={retained}
        onArchiveTurns={onArchiveTurns}
        onClearTranscript={onClearTranscript}
        onLanguageChange={selectLanguage}
        onStartStop={startStop}
        onRetry={retry}
        onReset={reset}
      />
    </SessionProvider>
  );
}

function ConnectedVoiceScreen({
  replyLanguage,
  connectionState,
  operation,
  retained,
  onArchiveTurns,
  onClearTranscript,
  issue,
  onAgentFailed,
  onLanguageChange,
  onStartStop,
  onRetry,
  onReset,
}: {
  replyLanguage: ReplyLanguage;
  connectionState: string;
  operation: VoiceOperation;
  retained: RetainedTurns;
  onArchiveTurns: (turns: readonly Turn[]) => void;
  onClearTranscript: () => void;
  issue: VoiceIssue;
  onAgentFailed: (reasons: readonly string[]) => void;
  onLanguageChange: (language: ReplyLanguage) => void;
  onStartStop: () => void;
  onRetry: () => void;
  onReset: () => void;
}) {
  // Inside SessionProvider the session is already created, so read it from context rather than
  // asking useSession to build a second one.
  const session = useSessionContext();
  const agent = useAgent();
  const { messages } = useSessionMessages();
  const preview = useReplyPreview(session.room, replyLanguage);
  const local = useLocalParticipant();
  const [microphoneBusy, setMicrophoneBusy] = useState(false);
  const microphonePending = useRef(false);
  const toggleMicrophone = useCallback(async () => {
    if (microphonePending.current || connectionState !== 'connected' || operation) return;
    microphonePending.current = true;
    setMicrophoneBusy(true);
    try {
      await local.localParticipant.setMicrophoneEnabled(!local.isMicrophoneEnabled);
    } catch {
      Alert.alert('Microphone unavailable', 'Could not change your microphone. End the conversation and try again.');
    } finally {
      microphonePending.current = false;
      setMicrophoneBusy(false);
    }
  }, [connectionState, local.isMicrophoneEnabled, local.localParticipant, operation]);
  const agentFailureHandledRef = useRef(false);

  useEffect(() => {
    if (agent.state !== 'failed') {
      agentFailureHandledRef.current = false;
      return;
    }
    if (agentFailureHandledRef.current) return;
    agentFailureHandledRef.current = true;
    onAgentFailed(agent.failureReasons);
  }, [agent.failureReasons, agent.state, onAgentFailed]);

  const switchDeviceLanguage = useCallback((code: string) => {
    // Unsupported requests throw into the RPC result rather than falsely claiming success.
    onLanguageChange(normalizeLanguageId(code));
  }, [onLanguageChange]);
  const bridgeError = useCallback((error: Error) => {
    onAgentFailed([`Device controls unavailable: ${error.message}`]);
  }, [onAgentFailed]);
  const clearSession = useCallback(() => {
    onClearTranscript();
    onReset();
  }, [onClearTranscript, onReset]);
  useDeviceCapabilities({
    room: session.room,
    replyLanguage,
    sessionState: connectionState,
    onResetSession: clearSession,
    onSwitchLanguage: switchDeviceLanguage,
    onBridgeError: bridgeError,
  });


  // Everything the screen claims about a turn comes from two independent streams: the generated
  // preview, and LiveKit's TTS-aligned transcript of what was actually played. The transcript is
  // scoped to the current preview turn so a sentence from an earlier turn cannot advance this
  // one's spoken state.
  const spoken = useMemo(
    () => spokenTranscriptForTurn(messages, preview.startedAt),
    [messages, preview.startedAt],
  );

  // The whole conversation, not just the turn in flight. See `lib/conversation.ts` for why this
  // was missing and how turns are inferred from arrival order.
  const conversation = useMemo(
    () =>
      buildConversation({
        messages,
        previewStartedAt: preview.startedAt,
        previewText: preview.text || spoken,
        // Whether this turn was genuinely cut off, which is the only thing allowed to mark a
        // sentence as never-going-to-be-said.
        //
        // "The agent is not speaking" is NOT that signal. The agent passes through
        // `thinking` between sentences and while it is still streaming, and a non-streaming TTS
        // sits in `thinking` for most of a turn. Testing `!== 'speaking'` therefore struck
        // through sentences that were merely next in the queue, which is precisely the
        // "the text and the voice do not agree" report: text visibly thrown away while the audio
        // went on to say it.
        //
        // A real interruption has a shape: the agent was answering, it has stopped, the user has
        // taken the floor, and the model had already generated more than was spoken. `listening`
        // is the state that means the user is talking, as distinct from the model or the
        // synthesizer thinking. So the signal is "the user started speaking before the generated
        // reply was finished", and the preview being incomplete is what proves there was more to
        // throw away.
        interrupted: !preview.complete && agent.state === 'listening' && spoken.length > 0,
      }),
    [agent.state, messages, preview.complete, preview.startedAt, preview.text, spoken],
  );

  // File every finished turn as it completes, so the record exists before whatever ends the
  // session gets the chance to destroy it. `retainTurns` is idempotent, so this on every render
  // is safe.
  const finished = conversation.history;
  useEffect(() => {
    if (finished.length > 0) onArchiveTurns(finished);
  }, [finished, onArchiveTurns]);

  // What the screen shows: this session's turns, plus everything that came before and survived.
  const shown = useMemo(
    () => mergeConversation(retained.turns, conversation),
    [conversation, retained.turns],
  );

  return (
    <VoiceShell
      configured
      language={replyLanguage}
      audioTrack={agent.state === 'speaking' ? agent.microphoneTrack : local.isMicrophoneEnabled && local.microphoneTrack ? { participant: local.localParticipant, publication: local.microphoneTrack, source: Track.Source.Microphone } : undefined}
      connectionState={connectionState}
      agentState={agent.state}
      microphoneEnabled={local.isMicrophoneEnabled}
      microphoneBusy={microphoneBusy}
      onToggleMicrophone={() => void toggleMicrophone()}
      conversation={shown}
      operation={operation}
      issue={issue}
      gateRefusal={preview.refusal}
      replyShortened={preview.shortened}
      onLanguageChange={onLanguageChange}
      onStartStop={onStartStop}
      onRetry={onRetry}
      onReset={clearSession}
    />
  );
}
