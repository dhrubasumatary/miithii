/**
 * Reply-preview correlation, as a pure reducer.
 *
 * The agent publishes generated text on an application-owned topic as the model produces it.
 * Every message carries the identity of the turn that produced it, so a chunk arriving after a
 * reset, a language switch, or a reconnect can be dropped instead of being rendered under
 * whichever turn happens to be current on arrival.
 *
 * This topic means *generated*, never *spoken*. What is actually being spoken comes from
 * LiveKit's TTS-aligned transcript and is rendered separately.
 *
 * The reducer is separated from the React hook so its rules can be tested directly. Those
 * rules are the whole point: a reply that reappears after a reset, or a sentence shown twice
 * because a revision was appended instead of replacing, is a correctness bug the user sees.
 */

export const REPLY_TOPIC = 'miithii.reply';

/**
 * Every message kind the agent publishes.
 *
 * `verdict` and `repair` exist so the screen can say why a turn produced no audio. Dropping
 * them makes a refused answer look exactly like a slow one, which is indistinguishable from a
 * broken app.
 */
export const PREVIEW_KINDS = ['start', 'delta', 'end', 'verdict', 'repair'] as const;

export type PreviewKind = (typeof PREVIEW_KINDS)[number];

export type PreviewMessage = {
  language: string;
  roomName: string;
  sessionId: string;
  epoch: number;
  turnId: number;
  revision: number;
  sequence: number;
  kind: PreviewKind;
  text: string;
  shortened?: boolean;
  /**
   * LiveKit text-stream timestamp for this preview event.
   *
   * This is transport metadata rather than part of Miithii's JSON payload. The hook stamps it
   * from `reader.info.timestamp`, which is generated on the same agent process as the
   * `lk.transcription` stream timestamps. It lets the UI define a real turn boundary without
   * guessing from text content.
   */
  streamTimestamp?: number;
};

export type ReplyPreview = {
  text: string;
  shortened?: boolean;
  epoch: number;
  turnId: number;
  /** Sender-side timestamp of the event that opened this preview turn. */
  startedAt: number;
  complete: boolean;
  /**
   * Why the gate declined to speak this answer, if it did.
   *
   * Null when the answer is speakable. A refused answer is a real outcome with a real reason,
   * not silence: the screen should say so rather than appear to hang.
   */
  refusal: string | null;
  /** True while the agent is regenerating a rejected answer. */
  repairing: boolean;
};

export const EMPTY_PREVIEW: ReplyPreview = {
  text: '',
  epoch: 0,
  turnId: 0,
  startedAt: 0,
  complete: false,
  refusal: null,
  repairing: false,
};

/** The agent serialises snake_case; accepting both keeps this tolerant of a schema change. */
export function parsePreview(raw: string): PreviewMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const sessionId = record.session_id ?? record.sessionId;
  const turnId = record.turn_id ?? record.turnId;
  const kind = record.kind;
  const roomName = record.room_name ?? record.roomName;

  if (
    typeof sessionId !== 'string' ||
    (record.language !== 'asm' && record.language !== 'brx') ||
    typeof roomName !== 'string' ||
    typeof record.epoch !== 'number' ||
    typeof turnId !== 'number' ||
    typeof record.text !== 'string' ||
    !PREVIEW_KINDS.includes(kind as PreviewKind)
  ) {
    return null;
  }

  return {
    language: record.language,
    roomName,
    sessionId,
    epoch: record.epoch,
    turnId,
    revision: typeof record.revision === 'number' ? record.revision : 0,
    sequence: typeof record.sequence === 'number' ? record.sequence : 0,
    kind: kind as PreviewKind,
    text: record.text,
    ...(record.shortened === true ? { shortened: true } : {}),
  };
}

/**
 * Order two turns from the same session.
 *
 * `begin_turn` increments the turn within an epoch, and `advance_epoch` retires the epoch, so
 * this is a total order: a later epoch always wins, and within one epoch a later turn always
 * wins. Anything else is either the same turn or from the past.
 */
export function compareTurns(
  a: { epoch: number; turnId: number },
  b: { epoch: number; turnId: number },
): number {
  if (a.epoch !== b.epoch) return a.epoch - b.epoch;
  return a.turnId - b.turnId;
}

/** Mutable correlation state that has to outlive a single render. */
export type PreviewGuard = {
  language: string | null;
  roomName: string | null;
  lastRefusal: 'language_mismatch' | 'room_mismatch' | 'session_mismatch' | null;
  /**
   * The session that owns the current preview.
   *
   * Set on the first message and cleared when the room changes, which is what makes a
   * reconnect able to adopt a new session while still refusing text from the old one.
   */
  sessionId: string | null;
  /** Highest sequence applied for the current turn, so a late delta cannot rewind the text. */
  highestSequence: number;
};

export function createGuard(language: string | null = null, roomName: string | null = null): PreviewGuard {
  return { sessionId: null, highestSequence: 0, language, roomName, lastRefusal: null };
}

export function applyPreview(
  current: ReplyPreview,
  guard: PreviewGuard,
  message: PreviewMessage,
): ReplyPreview {
  if (guard.language !== null && message.language !== guard.language) {
    guard.lastRefusal = 'language_mismatch';
    return current;
  }
  if (guard.roomName !== null && message.roomName !== guard.roomName) {
    guard.lastRefusal = 'room_mismatch';
    return current;
  }
  const firstMessage = guard.sessionId === null;
  if (firstMessage) {
    guard.sessionId = message.sessionId;
  } else if (message.sessionId !== guard.sessionId) {
    guard.lastRefusal = 'session_mismatch';
    // A different session owns the reply. A fresh session is adopted whole by its own first
    // message - that is what a reconnect looks like, and the caller resets the guard when the
    // room changes - so anything arriving here belongs to a session that is over.
    return current;
  }

  const incoming = { epoch: message.epoch, turnId: message.turnId };
  const isNewTurn = compareTurns(incoming, current) > 0;

  // Strictly older than what is on screen. Treating this as a new turn is how a chunk from a
  // retired epoch rewinds the reply under a live turn's label.
  if (!firstMessage && compareTurns(incoming, current) < 0) {
    return current;
  }

  if (isNewTurn) {
    guard.highestSequence = 0;
  } else if (message.kind !== 'end' && message.sequence <= guard.highestSequence) {
    // Out-of-order or replayed. The end message is exempt because it carries the whole turn and
    // is authoritative over deltas that may have been dropped in transit.
    return current;
  }
  guard.highestSequence = Math.max(guard.highestSequence, message.sequence);

  switch (message.kind) {
    case 'start':
      return {
        text: '',
        epoch: message.epoch,
        turnId: message.turnId,
        startedAt: message.streamTimestamp ?? current.startedAt,
        complete: false,
        refusal: null,
        repairing: false,
      };

    case 'repair':
      return { ...current, repairing: true, refusal: null, complete: false };

    case 'verdict':
      // A speakable verdict carries the judged text, so there is nothing to add. A refused one
      // carries the rejection reason, which is what the screen needs in order to stop looking
      // broken.
      return {
        ...current,
        repairing: false,
        refusal: message.text.trim() === '' ? null : message.text,
        complete: false,
      };

    case 'end':
      return {
        text: message.text,
        shortened: message.shortened === true,
        epoch: message.epoch,
        turnId: message.turnId,
        startedAt:
          isNewTurn && message.streamTimestamp !== undefined
            ? message.streamTimestamp
            : current.startedAt,
        complete: true,
        refusal: null,
        repairing: false,
      };

    default: {
      // A revision above zero replaces the text rather than adding to it. The gate republishes
      // the validated answer when it had to trim it, and appending that to the raw generated
      // text would show the user a sentence twice: once trimmed on screen, once whole in their
      // head, while the audio says only the trimmed part.
      const replaces = message.revision > 0;
      return {
        ...current,
        text: replaces || isNewTurn ? message.text : current.text + message.text,
        shortened: isNewTurn ? false : current.shortened,
        epoch: message.epoch,
        turnId: message.turnId,
        startedAt:
          isNewTurn && message.streamTimestamp !== undefined
            ? message.streamTimestamp
            : current.startedAt,
        complete: false,
        repairing: false,
      };
    }
  }
}
