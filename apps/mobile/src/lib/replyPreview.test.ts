import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPreview,
  compareTurns,
  createGuard,
  EMPTY_PREVIEW,
  parsePreview,
  type PreviewMessage,
  type ReplyPreview,
} from './replyPreview.ts';

// A small driver so each test reads as "these messages arrive, this is what the screen shows",
// which is the only way a staleness bug is visible.
class Screen {
  state: ReplyPreview = EMPTY_PREVIEW;
  private guard = createGuard();

  /**
   * Begin a new session, as a reconnect does.
   *
   * The caller resets the guard when the room changes, which is the only reliable signal that
   * the previous session is over. Without that reset a new session can never be adopted.
   */
  reconnect(): void {
    this.guard = createGuard();
    this.state = EMPTY_PREVIEW;
  }

  send(overrides: Partial<PreviewMessage> & { kind: PreviewMessage['kind'] }): ReplyPreview {
    const message: PreviewMessage = {
      language: 'asm',
      roomName: 'room-a',
      sessionId: 'session-a',
      epoch: 0,
      turnId: 1,
      revision: 0,
      sequence: this.next++,
      text: '',
      ...overrides,
    };
    this.state = applyPreview(this.state, this.guard, message);
    return this.state;
  }

  private next = 1;
}

test('shortened outcome belongs to the end event and never carries into a newer reply', () => {
  const screen = new Screen();
  screen.send({ kind: 'end', text: 'accepted prefix', shortened: true });
  assert.equal(screen.state.shortened, true);
  assert.equal(screen.state.text, 'accepted prefix');
  // A new turn's delta may finish reading before its start event.
  screen.send({ kind: 'delta', turnId: 2, text: 'new reply' });
  assert.equal(screen.state.text, 'new reply');
  assert.equal(screen.state.shortened, false);
  screen.send({ kind: 'end', turnId: 2, text: 'new reply' });
  assert.equal(screen.state.shortened, false);
});

test('a turn streams in and then completes', () => {
  const screen = new Screen();
  screen.send({ kind: 'start' });
  assert.equal(screen.send({ kind: 'delta', text: 'এটা ' }).text, 'এটা ');
  assert.equal(screen.send({ kind: 'delta', text: 'বাক্য।' }).text, 'এটা বাক্য।');
  const done = screen.send({ kind: 'end', text: 'এটা বাক্য।' });
  assert.equal(done.text, 'এটা বাক্য।');
  assert.equal(done.complete, true);
});

test('a refused answer keeps its reason instead of looking like silence', () => {
  // The agent publishes the rejection so the screen can explain itself. A gate that refuses is
  // a real outcome; rendering it as nothing is what made a rejected turn look like a hang.
  // The reason is machine-readable and the refused words are never sent, because they were
  // never spoken and must not be presented as though they were.
  const screen = new Screen();
  screen.send({ kind: 'start' });
  screen.send({ kind: 'delta', text: 'ভুল লিপি' });
  screen.send({ kind: 'repair' });
  assert.equal(screen.state.repairing, true);

  const refused = screen.send({ kind: 'verdict', text: 'wrong_script,truncated' });
  assert.equal(refused.refusal, 'wrong_script,truncated');
  assert.equal(refused.repairing, false);
});

test('a speakable verdict is not treated as a refusal', () => {
  // The canonical words were already published as deltas. A speakable verdict carries no text,
  // so there is nothing to add and nothing to report as a refusal.
  const screen = new Screen();
  screen.send({ kind: 'start' });
  screen.send({ kind: 'delta', text: 'এটা বাক্য।' });
  const ok = screen.send({ kind: 'verdict', text: '' });
  assert.equal(ok.refusal, null);
  assert.equal(ok.text, 'এটা বাক্য।');
});

test('a canonical revision replaces the text rather than appending to it', () => {
  // The gate trims an over-long answer to the language's budget. The raw generation is already
  // on screen, so appending the trimmed answer would show the sentence twice while the audio
  // speaks only the trimmed version.
  const screen = new Screen();
  screen.send({ kind: 'start' });
  screen.send({ kind: 'delta', text: 'এটা বাক্য। আৰু বেছি বাক্য।' });
  const canonical = screen.send({ kind: 'delta', text: 'এটা বাক্য।', revision: 1 });
  assert.equal(canonical.text, 'এটা বাক্য।');
});

test('a chunk from a retired epoch cannot rewind the reply', () => {
  // This is the case a reset or a language switch produces. The old turn arrives late; treating
  // it as "a new turn" would clear the guard and render stale text under the live turn.
  const screen = new Screen();
  screen.send({ kind: 'start', epoch: 1, turnId: 1 });
  screen.send({ kind: 'delta', epoch: 1, turnId: 1, text: 'নতুন বাক্য।' });

  const after = screen.send({ kind: 'delta', epoch: 0, turnId: 9, text: 'পুরনো বাক্য।' });
  assert.equal(after.text, 'নতুন বাক্য।');
  assert.equal(after.epoch, 1);
});

test('a chunk from an earlier turn in the same epoch cannot rewind the reply', () => {
  const screen = new Screen();
  screen.send({ kind: 'start', turnId: 2 });
  screen.send({ kind: 'delta', turnId: 2, text: 'দ্বিতীয় বাক্য।' });
  const after = screen.send({ kind: 'delta', turnId: 1, text: 'প্ৰথম বাক্য।' });
  assert.equal(after.text, 'দ্বিতীয় বাক্য।');
  assert.equal(after.turnId, 2);
});

test('text from a previous session is never adopted', () => {
  const screen = new Screen();
  screen.send({ sessionId: 'session-a', kind: 'start' });
  screen.send({ sessionId: 'session-a', kind: 'delta', text: 'পুরনো সেশনৰ বাক্য।' });

  const leaked = screen.send({ sessionId: 'session-b', kind: 'delta', text: 'চুক্তিভুক্ত নহয়।' });
  assert.equal(leaked.text, 'পুরনো সেশনৰ বাক্য।');
});

test('the first message of a new session is adopted whole', () => {
  // A reconnect starts a new session, so the screen must be able to move to it. The caller
  // resets the guard when the room changes; that reset is the signal the previous session is
  // over, and the first message is then adopted outright rather than merged.
  const screen = new Screen();
  screen.send({ sessionId: 'session-a', kind: 'start' });
  screen.send({ sessionId: 'session-a', kind: 'delta', text: 'পুরনো।' });

  screen.reconnect();
  const adopted = screen.send({ sessionId: 'session-b', kind: 'start', turnId: 1 });
  assert.equal(adopted.text, '');
  assert.equal(adopted.complete, false);
  assert.equal(screen.send({ sessionId: 'session-b', kind: 'delta', text: 'নতুন।' }).text, 'নতুন।');
});

test('an out-of-order delta does not rewind the text', () => {
  const screen = new Screen();
  screen.send({ kind: 'start' });
  screen.send({ kind: 'delta', sequence: 5, text: 'এটা বাক্য। ' });
  const late = screen.send({ kind: 'delta', sequence: 2, text: 'ভুল। ' });
  assert.equal(late.text, 'এটা বাক্য। ');
});

test('an end message is authoritative even when its sequence is behind', () => {
  // The end carries the whole turn. Trusting it means a dropped delta in transit cannot leave
  // the screen showing a partial sentence.
  const screen = new Screen();
  screen.send({ kind: 'start' });
  screen.send({ kind: 'delta', sequence: 9, text: 'আংশিক' });
  const done = screen.send({ kind: 'end', sequence: 3, text: 'সম্পূৰ্ণ বাক্য।' });
  assert.equal(done.text, 'সম্পূৰ্ণ বাক্য।');
  assert.equal(done.complete, true);
});

test('each turn is tracked separately from the previous one', () => {
  // The publisher's sequence counter is monotonic for the whole session, so a new turn's
  // messages always follow the previous turn's. What matters is that the guard tracks the
  // current turn rather than accumulating across turns: an interrupted turn's late delta must
  // not be able to raise the bar for the turn that replaced it.
  const screen = new Screen();
  screen.send({ kind: 'start', turnId: 1, sequence: 1 });
  screen.send({ kind: 'delta', turnId: 1, sequence: 50, text: 'পুৰনা।' });

  screen.send({ kind: 'start', turnId: 2, sequence: 51 });
  // A low sequence on the new turn is accepted, because the guard was reset with the turn.
  const next = screen.send({ kind: 'delta', turnId: 2, sequence: 52, text: 'নতুন।' });
  assert.equal(next.text, 'নতুন।');
  assert.equal(next.turnId, 2);
});

test('a stale delta on the current turn is refused without disturbing a newer one', () => {
  const screen = new Screen();
  screen.send({ kind: 'start', turnId: 1, sequence: 1 });
  screen.send({ kind: 'delta', turnId: 1, sequence: 10, text: 'এটা বাক্য। ' });
  const late = screen.send({ kind: 'delta', turnId: 1, sequence: 4, text: 'ভুল। ' });
  assert.equal(late.text, 'এটা বাক্য। ');
});

test('malformed payloads are ignored rather than applied', () => {
  assert.equal(parsePreview('not json'), null);
  assert.equal(parsePreview('{}'), null);
  assert.equal(parsePreview(JSON.stringify({ kind: 'delta' })), null);
  // An unknown kind is refused rather than silently treated as a delta.
  assert.equal(
    parsePreview(JSON.stringify({ session_id: 'a', epoch: 0, turn_id: 1, kind: 'shout', text: '' })),
    null,
  );
});

test('camelCase payloads are accepted for schema tolerance', () => {
  const parsed = parsePreview(
    JSON.stringify({ language: 'asm', roomName: 'room-a', sessionId: 'a', epoch: 2, turnId: 3, revision: 1, sequence: 4, kind: 'delta', text: 'বাক্য' }),
  );
  assert.deepEqual(parsed, {
    language: 'asm',
    roomName: 'room-a',
    sessionId: 'a',
    epoch: 2,
    turnId: 3,
    revision: 1,
    sequence: 4,
    kind: 'delta',
    text: 'বাক্য',
  });
});

test('turn ordering puts a later epoch ahead of any turn in an earlier one', () => {
  assert.ok(compareTurns({ epoch: 1, turnId: 1 }, { epoch: 0, turnId: 99 }) > 0);
  assert.ok(compareTurns({ epoch: 0, turnId: 2 }, { epoch: 0, turnId: 1 }) > 0);
  assert.equal(compareTurns({ epoch: 3, turnId: 4 }, { epoch: 3, turnId: 4 }), 0);
});


test('a foreign-language first preview is refused before adopting its session', () => {
  const guard = createGuard('brx', 'room-b');
  const foreign: PreviewMessage = { language: 'asm', roomName: 'room-b', sessionId: 'foreign', epoch: 0, turnId: 1, revision: 0, sequence: 1, kind: 'delta', text: 'fixture' };
  assert.equal(applyPreview(EMPTY_PREVIEW, guard, foreign), EMPTY_PREVIEW);
  assert.equal(guard.lastRefusal, 'language_mismatch');
  assert.equal(guard.sessionId, null);
  assert.equal(applyPreview(EMPTY_PREVIEW, guard, { ...foreign, language: 'brx', sessionId: 'current' }).text, 'fixture');
});

test('a foreign room cannot establish the first preview session', () => {
  const guard = createGuard('brx', 'room-b');
  const foreign: PreviewMessage = { language: 'brx', roomName: 'room-a', sessionId: 'foreign', epoch: 0, turnId: 1, revision: 0, sequence: 1, kind: 'start', text: '' };
  assert.equal(applyPreview(EMPTY_PREVIEW, guard, foreign), EMPTY_PREVIEW);
  assert.equal(guard.lastRefusal, 'room_mismatch');
  assert.equal(guard.sessionId, null);
});

test('a retired turn is refused while the current preview is still empty', () => {
  const screen = new Screen();
  screen.send({ kind: 'start', epoch: 1, turnId: 2 });
  const after = screen.send({ kind: 'delta', epoch: 0, turnId: 9, text: 'stale' });
  assert.equal(after.text, '');
  assert.equal(after.epoch, 1);
});
