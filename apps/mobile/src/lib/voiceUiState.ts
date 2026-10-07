export type VoiceUiOperation = 'starting' | 'ending' | null;
export type VoiceUiIssue = 'start' | 'stop' | null;

export type VoiceUiPresence =
  | 'off'
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'synthesizing'
  | 'speaking';

export type VoiceUiPhase = 'off' | 'connecting' | 'live' | 'ending';
export type ControlInteraction<Action extends string> = {
  visible: boolean;
  enabled: boolean;
  action: Action | 'none';
};

export type VoiceUiState = {
  failed: boolean;
  connectionTransitioning: boolean;
  agentStarting: boolean;
  running: boolean;
  presence: VoiceUiPresence;
  phase: VoiceUiPhase;
  muted: boolean;
  controls: {
    primary: ControlInteraction<'start' | 'end' | 'retry' | 'cancel'>;
    language: ControlInteraction<'switch-language'>;
    reset: ControlInteraction<'reset'>;
    microphone: ControlInteraction<'toggle-microphone'>;
  };
};

/**
 * Converts SDK lifecycle facts into the small state vocabulary the product is allowed to show.
 * Raw connection/agent states never reach copy directly.
 */
export function deriveVoiceUiState(input: {
  configured: boolean;
  connectionState: string;
  agentState: string;
  operation: VoiceUiOperation;
  issue: VoiceUiIssue;
  hasGeneratedText: boolean;
  hasSpokenText: boolean;
  hasConversation?: boolean;
  microphoneAvailable?: boolean;
  microphoneBusy?: boolean;
  microphoneEnabled?: boolean;
}): VoiceUiState {
  const connected = input.connectionState !== 'disconnected';
  const connectionTransitioning =
    input.connectionState !== 'disconnected' && input.connectionState !== 'connected';
  const failed = input.issue !== null || input.agentState === 'failed';
  const agentStarting =
    input.agentState === 'disconnected' ||
    input.agentState === 'connecting' ||
    input.agentState === 'initializing' ||
    input.agentState === 'pre-connect-buffering';
  const agentReady = ['listening', 'idle', 'thinking', 'speaking'].includes(input.agentState);
  const running =
    input.configured && input.connectionState === 'connected' && agentReady && !failed;

  let presence: VoiceUiPresence;
  if (!input.configured || failed) presence = 'off';
  else if (input.operation === 'starting' || connectionTransitioning || (connected && agentStarting)) {
    presence = 'connecting';
  } else if (!connected) presence = 'idle';
  else {
    switch (input.agentState) {
      case 'thinking':
        presence = input.hasGeneratedText && !input.hasSpokenText ? 'synthesizing' : 'thinking';
        break;
      case 'speaking':
        presence = 'speaking';
        break;
      case 'listening':
      case 'idle':
        presence = 'listening';
        break;
      default:
        // Unknown future SDK states are transitional, never READY. That is the safe direction:
        // readiness must be proved by a known ready state rather than inferred from novelty.
        presence = 'connecting';
        break;
    }
  }

  let phase: VoiceUiPhase;
  if (!input.configured || failed) phase = 'off';
  else if (input.operation === 'ending') phase = 'ending';
  else if (
    input.operation === 'starting' ||
    connectionTransitioning ||
    (connected && !agentReady)
  ) {
    phase = 'connecting';
  } else if (running) phase = 'live';
  else phase = 'off';

  const muted = running && input.microphoneEnabled === false;
  if (muted && presence === 'listening') presence = 'idle';
  const available = input.configured && input.operation !== 'ending';
  const primaryAction = !available ? 'none' : failed ? 'retry' : phase === 'connecting'
    ? 'cancel' : phase === 'live' ? 'end' : 'start';
  const resetAvailable = available && input.operation === null && Boolean(input.hasConversation);
  const microphoneAvailable = available && running && Boolean(input.microphoneAvailable);
  return {
    failed, connectionTransitioning, agentStarting, running, presence, phase, muted,
    controls: {
      primary: { visible: available, enabled: available, action: primaryAction },
      language: { visible: available, enabled: available, action: available ? 'switch-language' : 'none' },
      reset: { visible: resetAvailable, enabled: resetAvailable, action: resetAvailable ? 'reset' : 'none' },
      microphone: { visible: microphoneAvailable, enabled: microphoneAvailable && !input.microphoneBusy,
        action: microphoneAvailable && !input.microphoneBusy ? 'toggle-microphone' : 'none' },
    },
  };
}
