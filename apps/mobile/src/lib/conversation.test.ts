import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildConversation,
  clearRetainedTurns,
  conversationText,
  historySignature,
  MAX_RETAINED_TURNS,
  mergeConversation,
  retainTurns,
  turnText,
  type Turn,
} from './conversation.ts';
import type { TranscriptMessage } from './conversation.ts';

let clock = 1000;
let ids = 0;

function user(text: string): TranscriptMessage {
  clock += 10;
  ids += 1;
  return { type: 'userTranscript', message: text, id: `u${ids}`, timestamp: clock };
}

function agent(text: string): TranscriptMessage {
  clock += 10;
  ids += 1;
  return { type: 'agentTranscript', message: text, id: `a${ids}`, timestamp: clock };
}

/** Reset the shared clock so each test reads its timestamps in isolation. */
function fresh(): void {
  clock = 1000;
  ids = 0;
}

test('an empty room is an empty conversation, not a blank turn', () => {
  fresh();
  const model = buildConversation({
    messages: [],
    previewStartedAt: 0,
    previewText: '',
    interrupted: false,
  });
  assert.equal(model.history.length, 0);
  assert.equal(model.live, null);
});

test('one exchange becomes one live turn', () => {
  fresh();
  const messages = [user('what is this'), agent('a book')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'a book',
    interrupted: false,
  });
  assert.equal(model.history.length, 0);
  assert.equal(model.live?.said, 'what is this');
  assert.equal(conversationText(model), 'what is this | a book');
});

test('turns accumulate instead of replacing each other', () => {
  fresh();
  const first = [user('one'), agent('first answer')];
  const model = buildConversation({
    messages: first,
    previewStartedAt: 1010,
    previewText: 'first answer',
    interrupted: false,
  });
  assert.equal(model.history.length, 0);

  // The same room, later: the user asked again and got an answer.
  const second = [...first, user('two'), agent('second answer')];
  const later = buildConversation({
    messages: second,
    previewStartedAt: 1030,
    previewText: 'second answer',
    interrupted: false,
  });

  // The first exchange is now history and is still readable.
  assert.equal(later.history.length, 1);
  assert.equal(later.history[0]?.said, 'one');
  assert.equal(turnText(later.history[0]?.segments ?? []), 'first answer');
  assert.equal(later.live?.said, 'two');
  assert.equal(conversationText(later), 'one | first answer | two | second answer');
});

test('an interim STT revision is not a new turn', () => {
  fresh();
  // Partial, revised, final - three messages, one turn, and the agent has not answered yet.
  const messages = [user('what'), user('what is'), user('what is this')];
  const model = buildConversation({
    messages,
    previewStartedAt: 0,
    previewText: '',
    interrupted: false,
  });
  assert.equal(model.history.length, 0);
  assert.equal(model.live?.said, 'what is this');
});

test('several agent segments belong to the turn they answered', () => {
  fresh();
  const messages = [
    user('tell me'),
    agent('The first part. '),
    agent('And the second part. '),
    agent('And a third one.'),
  ];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'The first part. And the second part. And a third one.',
    interrupted: false,
  });
  assert.equal(model.live?.segments.length, 3);
  assert.ok(model.live?.segments.every((segment) => segment.state === 'spoken'));
});

test('a turn the user interrupted records only what was played', () => {
  fresh();
  const messages = [user('tell me'), agent('The first part.')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    // The model generated three sentences. Only the first was ever spoken.
    previewText: 'The first part. And the second part. And a third one.',
    interrupted: true,
  });
  // The discarded sentences are marked, not deleted: the user can see what was lost.
  const states = model.live?.segments.map((segment) => segment.state) ?? [];
  assert.equal(states[0], 'spoken');
  assert.ok(states.slice(1).every((state) => state === 'unspoken'));
});

test('an interrupted turn becomes history with only its spoken part', () => {
  fresh();
  const first = [user('tell me'), agent('Only this.')];
  const second = [...first, user('again'), agent('And this.')];
  const model = buildConversation({
    messages: second,
    previewStartedAt: 1030,
    previewText: 'And this.',
    interrupted: false,
  });
  // History holds what was actually played and never the generated tail, so there is nothing
  // in it that has to be struck through.
  assert.equal(model.history.length, 1);
  assert.ok(model.history[0]?.segments.every((segment) => segment.state === 'spoken'));
  assert.equal(turnText(model.history[0]?.segments ?? []), 'Only this.');
});

test('a turn mid-synthesis is not treated as an interruption', () => {
  fresh();
  // The model generated three sentences and the synthesizer has produced the first. The agent is
  // not `speaking` at this instant - it is waiting on the voice - and the reply is incomplete.
  //
  // This is the ordinary middle of a turn, not a cut-off. Treating "not speaking" as
  // "interrupted" is what made the screen strike through sentences the audio went on to say,
  // which is the "the text and the voice do not agree" report. Only the user actually taking
  // the floor may throw generated text away.
  const messages = [user('ask me something'), agent('The first sentence is ready.')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'The first sentence is ready. The second one follows. And a third.',
    // The caller derives this from the agent state. Waiting on the voice is not `listening`.
    interrupted: false,
  });
  const states = model.live?.segments.map((segment) => segment.state) ?? [];
  assert.equal(states[0], 'spoken');
  assert.deepEqual(states.slice(1), ['pending', 'pending']);
  assert.equal(turnText(model.live?.segments ?? []).includes('And a third'), true);
});

test('the user taking the floor does discard the rest of the reply', () => {
  fresh();
  const messages = [user('ask me something'), agent('The first sentence is ready.')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'The first sentence is ready. The second one follows. And a third.',
    interrupted: true,
  });
  const states = model.live?.segments.map((segment) => segment.state) ?? [];
  assert.equal(states[0], 'spoken');
  assert.deepEqual(states.slice(1), ['unspoken', 'unspoken']);
});

test('a barge-in tail cannot relabel the new reply as spoken', () => {
  fresh();
  // The user cuts in. If a transcript chunk for the audio that was played arrives after the
  // user's next words, position alone files it with the new turn - there is no turn id on a
  // transcription and no timestamp that separates them.
  const messages = [
    user('start'),
    agent('The beginning of a long answer.'),
    user('wait'),
    agent(' And the tail of the interrupted answer.'),
  ];
  const model = buildConversation({
    messages,
    // The new turn's preview, published after the user said "wait".
    previewStartedAt: 1030,
    previewText: 'A brand new answer.',
    interrupted: false,
  });

  // What must hold: the visible reply is the new turn's own text, and the tail does not
  // advance the highlight through it. The tail shares only a leading character or two with a
  // different sentence, so alignment measures almost no agreement and the sentence stays where
  // the alignment layer left it rather than being counted as spoken.
  assert.equal(model.live?.said, 'wait');
  assert.equal(turnText(model.live?.segments ?? []), 'A brand new answer.');
  assert.ok(
    !model.live?.segments.some((segment) => segment.state === 'spoken'),
    'a transcript from another answer must not mark this reply as spoken',
  );
});

test('a preview older than the newest user turn is not shown against it', () => {
  fresh();
  // The user interrupted and asked again. The preview still describes the old turn.
  const messages = [user('first question'), agent('first answer'), user('second question')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'first answer plus text that was never spoken',
    interrupted: false,
  });
  // The live turn is the new question, with no reply yet. Generated text from the previous
  // turn must not appear as though it answered the new one.
  assert.equal(model.live?.said, 'second question');
  assert.equal(model.live?.segments.length, 0);
});

test('generated text is shown as pending before any of it is spoken', () => {
  fresh();
  const messages = [user('describe it')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'one. two. three.',
    interrupted: false,
  });
  const states = model.live?.segments.map((segment) => segment.state) ?? [];
  assert.deepEqual(states, ['pending', 'pending', 'pending']);
});

test('a dropped preview degrades to the transcript rather than inventing text', () => {
  fresh();
  // No preview at all, but the agent has already said something.
  const messages = [user('hello'), agent('hi there')];
  const model = buildConversation({
    messages,
    previewStartedAt: 0,
    previewText: '',
    interrupted: false,
  });
  assert.equal(turnText(model.live?.segments ?? []), 'hi there');
  assert.ok(model.live?.segments.every((segment) => segment.state === 'spoken'));
});

test('a turn key is stable while its own text grows', () => {
  fresh();
  const partial = [user('hello')];
  const partialModel = buildConversation({
    messages: partial,
    previewStartedAt: 1010,
    previewText: 'h',
    interrupted: false,
  });
  const grown = buildConversation({
    messages: [...partial, agent('hi')],
    previewStartedAt: 1010,
    previewText: 'hi',
    interrupted: false,
  });
  assert.equal(partialModel.live?.key, grown.live?.key);
});

test('turn keys are distinct across turns', () => {
  fresh();
  const messages = [user('one'), agent('a'), user('two'), agent('b')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1030,
    previewText: 'b',
    interrupted: false,
  });
  assert.notEqual(model.history[0]?.key, model.live?.key);
});

/**
 * A finished turn, built by hand so the retention rules can be tested without a room.
 */
function turn(key: string, said: string, reply: string): Turn {
  return { key, said, segments: [{ text: reply, state: 'spoken' }], finished: true };
}

test('a finished turn survives the session it happened in', () => {
  // The exact failure: the room goes away and the message list empties, but the user still spoke
  // and still got an answer. Losing that is not an acceptable way for a session to end.
  fresh();
  const messages = [user('who are you'), agent('I am Miithii.')];
  const model = buildConversation({
    messages,
    previewStartedAt: 1010,
    previewText: 'I am Miithii.',
    interrupted: false,
  });

  const retained = retainTurns(clearRetainedTurns(), [
    { ...model.history[0]!, key: 't1', said: 'who are you', segments: [{ text: 'I am Miithii.', state: 'spoken' }], finished: true },
  ]);
  assert.equal(retained.turns.length, 1);

  // The next session is an empty room, and the record is still there underneath it.
  const nextSession = buildConversation({
    messages: [],
    previewStartedAt: 0,
    previewText: '',
    interrupted: false,
  });
  const merged = mergeConversation(retained.turns, nextSession);
  assert.equal(conversationText(merged), 'who are you | I am Miithii.');
});

test('the same turn is never filed twice', () => {
  // The archive is called from render, so it has to be idempotent without the caller having to
  // memoise anything.
  const once = retainTurns(clearRetainedTurns(), [turn('t1', 'a', 'b')]);
  const twice = retainTurns(once, [turn('t1', 'a', 'b')]);
  assert.equal(twice, once);
  assert.equal(twice.turns.length, 1);
});

test('a turn still in flight is not retained', () => {
  // A half-spoken reply from a session that no longer exists is not a record of anything.
  fresh();
  const model = buildConversation({
    messages: [user('tell me'), agent('first part')],
    previewStartedAt: 1010,
    previewText: 'first part. second part.',
    interrupted: true,
  });
  assert.ok(model.live, 'the turn is still in flight');
  assert.equal(model.history.length, 0);
});

test('the record is capped, keeping the most recent', () => {
  let record = clearRetainedTurns();
  for (let index = 0; index < MAX_RETAINED_TURNS + 10; index += 1) {
    record = retainTurns(record, [turn(`t${index}`, `said ${index}`, `reply ${index}`)]);
  }
  assert.equal(record.turns.length, MAX_RETAINED_TURNS);
  assert.equal(record.turns[record.turns.length - 1]?.key, `t${MAX_RETAINED_TURNS + 9}`);
});

test('a turn present in both the record and the live session is shown once', () => {
  // The archive is called before the session has ended, so a turn can be both retained and
  // still in the current room's history.
  const retained = retainTurns(clearRetainedTurns(), [turn('t1', 'a', 'b')]);
  const model = {
    history: [turn('t1', 'a', 'b'), turn('t2', 'c', 'd')],
    live: null,
  };
  const merged = mergeConversation(retained.turns, model);
  assert.deepEqual(merged.history.map((entry) => entry.key), ['t1', 't2']);
});

test('a signature distinguishes different sets of turns', () => {
  const a = historySignature([turn('t1', 'a', 'bb')]);
  const b = historySignature([turn('t1', 'a', 'bbb')]);
  const c = historySignature([turn('t1', 'a', 'bb')]);
  assert.notEqual(a, b);
  assert.equal(a, c);
});
