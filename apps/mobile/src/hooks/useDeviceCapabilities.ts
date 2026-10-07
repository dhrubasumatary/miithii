import { useCallback, useEffect, useRef } from 'react';
import type { Room } from 'livekit-client';

import {
  type DeviceCommand,
  type DeviceResult,
  capabilityReport,
  no,
  ok,
  registerDeviceBridge,
} from '../lib/deviceBridge';
import { cue } from '../lib/haptics';

/**
 * Owns everything the agent can ask the phone to do.
 *
 * All of it is on-demand, and all of it goes through one room RPC method, so the agent has a
 * single door to knock on rather than a menu it has to know. The commands are deliberately
 * few. Each one that exists is one the agent can be trusted to use without a follow-up
 * question, and "what can this phone do" is answered by `capabilities` rather than by
 * shipping a large surface of mostly-unreachable tools.
 *
 * **There is no camera.** It was removed rather than left unfinished, and the reason is
 * structural rather than a matter of time: LiveKit Agents 1.8.3 has no automatic path from a
 * camera track to an STT-LLM-TTS model, so a viewfinder in this app would have shown the user
 * a live image of themselves and a live indicator that something was being looked at, while the
 * agent received no frames at all. A control that appears to work and does nothing is worse
 * than no control, and this one was already the least-understood element on the screen.
 */
export function useDeviceCapabilities({
  room,
  replyLanguage,
  sessionState,
  onResetSession,
  onSwitchLanguage,
  onBridgeError,
}: {
  room: Room | undefined;
  replyLanguage: string;
  sessionState: string;
  onResetSession: () => void;
  onSwitchLanguage: (code: string) => void;
  onBridgeError: (error: Error) => void;
}) {
  // Session facts and UI callbacks change while streaming. A room's registration does not.
  const current = useRef({ replyLanguage, sessionState, onResetSession, onSwitchLanguage, onBridgeError });
  current.current = { replyLanguage, sessionState, onResetSession, onSwitchLanguage, onBridgeError };
  const report = useCallback((): DeviceResult => {
    return capabilityReport({ language: current.current.replyLanguage, sessionState: current.current.sessionState });
  }, []);

  const command = useCallback(
    async (input: DeviceCommand): Promise<DeviceResult> => {
      switch (input.kind) {
        case 'capabilities':
          return report();

        case 'haptic': {
          cue('listening');
          return ok({ delivered: true });
        }

        case 'session.reset': {
          current.current.onResetSession();
          return ok({ reset: true }, true);
        }

        case 'reply.language': {
          if (typeof input.target !== 'string' || input.target.length === 0) {
            return no('failed', 'language command needs a target');
          }
          if (input.target === current.current.replyLanguage) return ok({ language: input.target }, true);
          current.current.onSwitchLanguage(input.target);
          // The language is bound to the room, so it cannot change under a live session. The
          // honest result says so, and the app restarts the session itself.
          return ok({ language: input.target, applied: false, requires_new_session: true }, true);
        }

        default:
          return no('unsupported', 'unknown command');
      }
    },
    [report],
  );

  // One bridge per room. The disposer runs with the room, so a reconnect cannot leave the
  // previous room's handler answering on the new one.
  useEffect(() => {
    try {
      return registerDeviceBridge(room, { onCommand: command });
    } catch (cause) {
      current.current.onBridgeError(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }, [command, room]);
}
