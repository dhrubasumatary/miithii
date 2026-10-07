/**
 * The conversation, as a thing that accumulates.
 *
 * ## The problem this exists to solve
 *
 * The screen used to render exactly one turn. The user's words were found by scanning the
 * message list backwards for the most recent `userTranscript`, and the reply came from the
 * preview reducer, which also only ever holds the newest turn. So every time the user spoke,
 * the previous exchange was destroyed and replaced.
 *
 * That is not a rendering bug, it is a missing memory. A voice conversation is not a
 * teleprompter line. People refer back - "no, the other one" - and a screen with no
 * scrollback makes that impossible, which makes the whole thing feel like a slot machine
 * rather than a conversation. It is also why the screen felt dead: nothing ever accumulated,
 * so there was never any evidence that anything had happened.
 *
 * ## How turns are derived
 *
 * LiveKit's `ReceivedMessage` carries only `{id, timestamp, type, message}`. There is no
 * segment or turn identifier on a transcription, so a turn has to be inferred from arrival
 * order. It is inferred at one place only: **a `userTranscript` opens a turn.**
 *
 * That single rule handles the two cases that matter:
 *
 * - **Interim transcription.** STT emits a partial, revises it, then emits the final. Those
 *   are three `userTranscript` messages for one turn. They are told apart from a new turn by
 *   whether the agent has started answering: an interim revision always arrives before the
 *   agent's first word, so while a turn has collected no agent speech the latest partial
 *   simply replaces the last one.
 * - **Barge-in.** The user can cut in before the agent finishes, so a transcript chunk for the
 *   audio that *was* played can arrive after the user's next words. See the note on the live
 *   turn below: it cannot be attributed, and is kept from lying by the alignment rule rather
 *   than by a guess here.
 *
 * ## What a finished turn is allowed to contain
 *
 * Only `agentTranscript` text. Never preview text.
 *
 * A finished turn's record is a record of what was *said*, and the TTS-aligned transcript is
 * the only evidence of that. The preview is generated text and is discarded here - so a turn
 * the user interrupted simply records the part that was actually played, with no marker,
 * because there is nothing to mark: it was never going to be said. This is the same invariant
 * the live view obeys, applied to history, and it is why this module never has to guess.
 */

import type { ReplySegment } from './alignment.ts';
import { alignReply } from './alignment.ts';

export type TranscriptMessage = {
  type?: string;
  message?: string;
  id?: string;
  timestamp?: number;
};

export type Turn = {
  /**
   * Stable across re-renders and re-derivations.
   *
   * It is the id of the message that opened the turn, which is unique in the room's message
   * list. A turn therefore keeps its identity as its own text grows, so React is not asked to
   * reconcile a new subtree for every interim revision.
   */
  key: string;
  /** What the user said, as STT heard it. Never translated. */
  said: string;
  /** A completed turn: the sentences that were actually spoken, in order. */
  segments: ReplySegment[];
  /** A finished turn is not live, so nothing in it is pending or unspoken. */
  finished: true;
};

export type LiveTurn = {
  key: string;
  said: string;
  /** The in-flight turn. Its segments carry pending, speaking and unspoken states. */
  segments: ReplySegment[];
  finished: false;
};

export type ConversationModel = {
  /** Every completed turn, oldest first. */
  history: Turn[];
  /**
   * The turn in flight, or null before the user has said anything.
   *
   * Present-but-empty is a real state: the user has spoken, the agent has not answered yet,
   * and the screen has to show that gap rather than an empty screen.
   */
  live: LiveTurn | null;
};

export const EMPTY_CONVERSATION: ConversationModel = { history: [], live: null };

/** Every sentence of a completed turn is spoken, because only spoken text was kept. */
function finishedSegments(spoken: string): ReplySegment[] {
  const text = spoken.trim();
  if (text.length === 0) return [];
  // Aligned against itself: the whole record is, by construction, what was played. This keeps
  // a finished turn on the same sentence-per-line rhythm as the live one, so scrolling back
  // does not change how the text is broken.
  return alignReply({ preview: text, spoken: text, interrupted: false });
}

function finish(key: string, said: string, spoken: string[]): Turn {
  return { key, said, segments: finishedSegments(spoken.join(' ')), finished: true };
}

export type BuildInput = {
  messages: readonly TranscriptMessage[];
  /**
   * When the newest reply preview opened, as a LiveKit text-stream timestamp.
   *
   * Zero means there is no live preview, which is the state before the model has produced
   * anything. The live turn is then rendered from the transcript alone, which is the correct
   * degraded path: the user sees their own words and whatever has actually been said, and
   * never a fabricated sentence.
   */
  previewStartedAt: number;
  /** Generated text for the newest turn, or empty. */
  previewText: string;
  /**
   * True when the turn in flight will never finish: it was interrupted, or the session is
   * being retired.
   */
  interrupted: boolean;
};

/**
 * Derive the whole conversation from the room's message list and the live preview.
 *
 * Pure, and cheap enough to run on every message: the message list is append-only and the
 * result is memoised by the caller on the list identity.
 */
export function buildConversation({
  messages,
  previewStartedAt,
  previewText,
  interrupted,
}: BuildInput): ConversationModel {
  const history: Turn[] = [];
  let key = '';
  let said = '';
  let spoken: Array<{ text: string; timestamp: number }> = [];

  const flush = () => {
    if (said === '' && spoken.length === 0) return;
    history.push(finish(key, said, spoken.map((item) => item.text)));
  };

  for (const message of messages) {
    const text = typeof message.message === 'string' ? message.message : '';
    if (message.type === 'userTranscript') {
      if (text.length === 0) continue;
      if (spoken.length > 0) {
        // The agent has already answered this turn, so this is a new one. Everything the
        // agent said belongs to the turn that is being closed.
        flush();
        key = message.id ?? `${history.length}`;
        said = text;
        spoken = [];
      } else {
        // No agent speech yet, so this is an interim revision of the turn already open.
        key = message.id ?? key;
        said = text;
      }
      continue;
    }

    if (message.type === 'agentTranscript' && text.trim().length > 0) {
      spoken.push({ text: text.trim(), timestamp: message.timestamp ?? 0 });
    }
  }

  // The last group is the turn in flight. It is the only one that can be live, so it is held
  // back rather than closed.
  const lastKey = key;
  const lastSaid = said;

  // The preview belongs to this turn only if the user's last words came before the model
  // started answering. If the user has spoken again since, the preview is describing a turn
  // that has already been archived, and attaching its generated text here would show text
  // that belongs to the previous exchange as though it answered the newest question.
  const lastUserAt = lastUserTimestamp(messages);
  const previewIsLive = previewStartedAt > 0 && lastUserAt <= previewStartedAt;

  // A barge-in tail is a real case, and the honest answer is that it cannot be attributed.
  //
  // The user can cut in before the agent finishes, and LiveKit still delivers a transcript
  // chunk for audio that was played. That chunk arrives after the user's next words, so by
  // position alone it looks like part of the new turn. There is no timestamp that separates
  // them - the tail is genuinely *newer* than the new turn - and `ReceivedMessage` carries no
  // turn id.
  //
  // So the tail is filed with the later turn, and what keeps that safe is not a filter here but
  // the alignment rule downstream: `spokenPrefixLength` measures how far the transcript
  // *agrees* with the generated text, and a tail from a different answer agrees with none of
  // it. It therefore contributes zero and can never mark the new turn's sentences as spoken.
  // That is the difference between an imprecision that loses a few words and one that lies to
  // the user, and it is why no guess is attempted here.
  const spokenSoFar = spoken.map((item) => item.text).join(' ');

  const generated = previewIsLive ? previewText : '';

  if (lastSaid === '' && spokenSoFar === '') {
    // Nothing is in flight. A preview with no user turn behind it cannot happen, but if it
    // somehow does, the honest rendering is to show it as the live turn rather than to drop
    // generated text on the floor.
    if (generated.trim().length === 0) {
      return { history, live: null };
    }
    return {
      history,
      live: {
        key: 'live',
        said: '',
        segments: alignReply({
          preview: generated,
          spoken: spokenSoFar,
          interrupted,
        }),
        finished: false,
      },
    };
  }

  return {
    history,
    live: {
      key: lastKey || 'live',
      said: lastSaid,
      // The preview leads the audio, so the whole reply is visible before any of it is
      // spoken. Falling back to the transcript covers a turn whose preview was dropped.
      segments: alignReply({
        preview: generated || spokenSoFar,
        spoken: spokenSoFar,
        interrupted,
      }),
      finished: false,
    },
  };
}

/** When the user last spoke, so a preview can be matched to the turn it answers. */
function lastUserTimestamp(messages: readonly TranscriptMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type === 'userTranscript' && (message.message?.length ?? 0) > 0) {
      return message.timestamp ?? 0;
    }
  }
  return 0;
}

/** Plain text of a turn, for tests and for anything that needs to search the conversation. */
export function turnText(segments: readonly ReplySegment[]): string {
  return segments.map((segment) => segment.text).join(' ');
}

/**
 * Keep finished turns alive across a session boundary.
 *
 * ## The bug this exists for
 *
 * A conversation was derived entirely from the room's live message list, so the moment the room
 * went away the transcript went with it. The user said something, Miithii answered, the session
 * dropped - whether because the user ended it, because the agent process died, or because the
 * screen timed out and the app closed the session itself - and both turns were gone with no
 * trace and no explanation. Losing the thing you just had a conversation *about*, for a reason
 * that had nothing to do with the conversation, is the single most infuriating thing this app
 * could do.
 *
 * ## What is kept, and what is honestly implied
 *
 * Finished turns only. A turn in flight is dropped with its room, because a half-spoken reply
 * from a session that no longer exists is not a record of anything.
 *
 * Retained turns are shown as a record, not as context. The agent has no memory of them: a new
 * session is a new room with a new worker and an empty chat context, so Miithii genuinely cannot
 * see what came before. Presenting the history is not pretending otherwise - the turns are
 * visibly finished and older, and the language still changes the whole session.
 *
 * ## Why it is a pure function
 *
 * The runtime remounts on every session boundary, so this state cannot live in the component
 * tree below that boundary or it would be destroyed by the very event it exists to survive. It
 * is held above it and folded in here, where the dedupe can be tested.
 */
export type RetainedTurns = {
  turns: Turn[];
  /**
   * The conversation state these turns came from, so the same turn is never filed twice when a
   * component re-renders between an archive and a clear.
   */
  signature: string;
};

/** An identity for a set of finished turns, used to avoid filing the same turn twice. */
export function historySignature(turns: readonly Turn[]): string {
  return turns.map((turn) => `${turn.key}:${turnText(turn.segments).length}`).join('|');
}

/**
 * File any newly-finished turns into the retained record and return the updated record.
 *
 * Turns already filed are skipped by key, so calling this on every render is safe and does not
 * need to be memoised at the call site.
 */
export function retainTurns(
  previous: RetainedTurns,
  finished: readonly Turn[],
): RetainedTurns {
  const known = new Set(previous.turns.map((turn) => turn.key));
  const added = finished.filter((turn) => !known.has(turn.key));
  if (added.length === 0) return previous;
  // Newest last, and the cap is applied from the front so the most recent history survives a
  // long session. It is a cap rather than a clear because a conversation that outlives its own
  // memory limit is still better than one that empties itself.
  const turns = [...previous.turns, ...added].slice(-MAX_RETAINED_TURNS);
  return { turns, signature: historySignature(turns) };
}

/** How many finished turns survive a session boundary. */
export const MAX_RETAINED_TURNS = 40;

/** Drop the record. A language switch and an explicit clear both mean "start over". */
export function clearRetainedTurns(): RetainedTurns {
  return { turns: [], signature: '' };
}

/** The whole conversation: what was retained, what this session added, and what is in flight. */
export function mergeConversation(
  retained: readonly Turn[],
  model: ConversationModel,
): ConversationModel {
  if (retained.length === 0) return model;
  const inSession = new Set(model.history.map((turn) => turn.key));
  return {
    history: [...retained.filter((turn) => !inSession.has(turn.key)), ...model.history],
    live: model.live,
  };
}

/** Plain text of a whole conversation. */
export function conversationText(model: ConversationModel): string {
  const parts: string[] = [];
  for (const turn of model.history) {
    if (turn.said) parts.push(turn.said);
    parts.push(turnText(turn.segments));
  }
  if (model.live) {
    if (model.live.said) parts.push(model.live.said);
    parts.push(turnText(model.live.segments));
  }
  return parts.filter(Boolean).join(' | ');
}

