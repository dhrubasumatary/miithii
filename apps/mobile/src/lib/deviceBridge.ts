import type { RpcInvocationData, Room } from 'livekit-client';

/**
 * The device bridge.
 *
 * ## Why RPC and not a data stream
 *
 * The agent runs on a server and the only thing it can reach on this phone is the room. Three
 * channels exist: text streams, byte streams, and RPC. All three can carry a command.
 *
 * RPC is the only one that carries a reply, and that is the whole argument. A command the
 * agent cannot check the outcome of is a command it must report optimistically, and an agent
 * that says "I did it" when permission was refused is worse than an agent that says nothing.
 * With RPC the client's answer is the tool result, so the model learns the truth and the next
 * sentence it speaks is a true one.
 *
 * The payload limit is the constraint to design around: a string of at most 15 KiB, and a
 * timeout LiveKit clamps to a minimum of 8 seconds. Every command here is compact JSON, and
 * the largest thing the bridge carries is a capability report.
 *
 * ## The shape of a result
 *
 * Every handler returns the same envelope, and it is always honest:
 *
 * `{ ok: true, ... }` the action happened, and here is what it produced.
 * `{ ok: false, reason, ... }` it did not, and here is exactly why - a machine `reason` the
 * agent can map to a sentence, and a `speak` hint telling it whether the user already knows.
 *
 * There is no third case. A handler that throws becomes `{ ok: false, reason: 'unavailable' }`
 * rather than a rejected promise, because an unhandled RPC rejection surfaces on the phone as
 * a framework error the user sees, and the user has no way to act on it.
 */
export type DeviceResult = {
  ok: boolean;
  /** Machine-readable cause. Stable, so the agent can be taught to speak about it. */
  reason?: 'denied' | 'unavailable' | 'unsupported' | 'busy' | 'failed' | 'not_ready';
  /** Free detail for the agent. Never shown to the user directly. */
  detail?: string;
  /** Anything the action produced, for the agent to read back or use. */
  data?: Record<string, unknown>;
  /**
   * Whether the user was shown the outcome themselves.
   *
   * When true the agent should not also narrate it, because the screen is the confirmation.
   * Repeating a confirmation the user just watched is the single most talkative thing an
   * assistant can do.
   */
  spoke?: boolean;
};

export function ok(data?: Record<string, unknown>, spoke = false): DeviceResult {
  return { ok: true, data, spoke };
}

export function no(
  reason: NonNullable<DeviceResult['reason']>,
  detail?: string,
): DeviceResult {
  return { ok: false, reason, detail };
}

/** The commands the phone can carry out. The agent's tools map one-to-one onto these. */
export type DeviceCommand =
  | { kind: 'haptic'; intensity?: 'light' | 'medium' | 'heavy' }
  | { kind: 'reply.language'; target: string }
  | { kind: 'session.reset' }
  | { kind: 'capabilities' };

/**
 * The capability report.
 *
 * The agent asks for this before it promises anything. A phone that can be asked for a camera
 * and a phone that cannot have to produce different sentences, and the only way to know which
 * is which is to ask rather than to discover by failing a tool call the user is waiting on.
 *
 * **There is no camera in this build, and the report says so.**
 *
 * It is not a missing feature, it is a removal. LiveKit Agents 1.8.3 has no automatic path from
 * a camera track to a STT-LLM-TTS model: `AgentActivity.push_video` forwards frames only to a
 * realtime session, so on this pipeline every frame is received and silently discarded. Making
 * the agent see would mean hand-wiring `rtc.VideoStream` into `ImageContent` on the context, on
 * top of an OpenAI-compatible proxy whose image passthrough is unverified. So the camera was
 * taken off the face entirely, and this report is what stops the agent describing a viewfinder
 * the user can no longer open.
 */
export function capabilityReport(state: {
  language: string;
  sessionState: string;
}): DeviceResult {
  return ok({
    // Reported as present-but-unsupported rather than absent, so the agent can tell "this
    // build has no camera" from "this phone has no camera" and say something true about it.
    camera: { available: false, reason: 'not_supported' },
    haptics: true,
    // These two are the app's own control, always present, and cost nothing to expose.
    can_switch_language: true,
    can_reset_session: true,
    language: state.language,
    session: state.sessionState,
  });
}

type Handlers = {
  onCommand: (command: DeviceCommand) => Promise<DeviceResult>;
};

/**
 * Register the phone's command surface on a room.
 *
 * Returns a disposer. Registration is per-room, and a reconnect produces a new room, so this
 * has to be torn down with the room or the next session would answer commands meant for the
 * previous one - which is exactly the stale-event class the rest of the app is built to
 * prevent.
 *
 * `registerRpcMethod` hands the handler an `RpcInvocationData` object, whose `payload` is the
 * raw JSON string the agent sent. The handler must **return a string**; returning the object
 * is what the agent will read as a wall of JSON keys.
 */
export function registerDeviceBridge(room: Room | undefined, handlers: Handlers): () => void {
  if (!room) return () => undefined;
  let disposed = false;

  const method = async (data: RpcInvocationData): Promise<string> => {
    if (disposed) return JSON.stringify(no('not_ready', 'device bridge was disposed'));
    let command: DeviceCommand;
    try {
      const parsed: unknown = JSON.parse(data.payload);
      if (!parsed || typeof parsed !== 'object' || typeof (parsed as DeviceCommand).kind !== 'string') {
        throw new Error('command has no kind');
      }
      command = parsed as DeviceCommand;
    } catch (cause) {
      // A malformed command is the agent's bug, not the user's. It gets a clear result so the
      // model can correct itself instead of stalling.
      return JSON.stringify(no('failed', `unparseable command: ${String(cause)}`));
    }

    try {
      return JSON.stringify(await handlers.onCommand(command));
    } catch (cause) {
      return JSON.stringify(no('unavailable', cause instanceof Error ? cause.message : String(cause)));
    }
  };

  // Registration failure is a broken session, surfaced by the owning hook. Never advertise
  // capabilities through a bridge that silently failed to attach.
  room.registerRpcMethod('miithii.device', method);

  return () => {
    if (disposed) return;
    disposed = true;
    try {
      room.unregisterRpcMethod('miithii.device');
    } catch {
      // The room is already gone. Nothing to unregister from.
    }
  };
}

