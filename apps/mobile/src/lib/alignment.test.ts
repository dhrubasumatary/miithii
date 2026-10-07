import { test } from 'node:test';
import assert from 'node:assert/strict';

import { alignReply, replyText } from './alignment.ts';

// Segmentation is pinned by `segment.test.ts` against the canonical corpus, which covers every
// hazard these cases used to assert individually. What is left here is only the alignment
// contract: which sentence may be marked spoken, and when it must not be.

test('empty preview yields no segments', () => {
  assert.deepEqual(alignReply({ preview: '', spoken: '', interrupted: false }), []);
  assert.deepEqual(alignReply({ preview: '   ', spoken: '', interrupted: false }), []);
});

test('generated text alone is never marked spoken', () => {
  // This is the core rule: Bodhan has not synthesised anything yet.
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: '',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['pending', 'pending']);
});

test('a partially advanced transcript marks only the speaking sentence', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য। দ্বিত',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'speaking']);
});

test('a complete transcript marks everything spoken', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'spoken']);
});

test('interruption never marks unspoken text as spoken', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য।',
    interrupted: true,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'unspoken']);
});

test('a sentence cut off by an interruption is not marked spoken', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য। দ্বিত',
    interrupted: true,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'unspoken']);
});

test('interrupted text stays readable', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য।',
    interrupted: true,
  });
  assert.equal(replyText(segments), 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।');
});

test('an overlong transcript cannot mark unspoken text as spoken', () => {
  // A replayed or racing stream must not be able to relabel a whole reply as spoken.
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য।',
    spoken: 'প্ৰথম বাক্য। প্ৰথম বাক্য। প্ৰথম বাক্য। প্ৰথম বাক্য।',
    interrupted: false,
  });
  assert.equal(segments.length, 1);
});

test('alignment is stable as the transcript advances one sentence at a time', () => {
  const preview = 'এটা। দুটা। তিনিটা। চাৰিটা।';
  const seen: string[][] = [];
  for (const spoken of ['', 'এটা।', 'এটা। দুটা।', 'এটা। দুটা। তিনিটা।', preview]) {
    seen.push(alignReply({ preview, spoken, interrupted: false }).map((s) => s.state));
  }
  assert.deepEqual(seen, [
    ['pending', 'pending', 'pending', 'pending'],
    ['spoken', 'pending', 'pending', 'pending'],
    ['spoken', 'spoken', 'pending', 'pending'],
    ['spoken', 'spoken', 'spoken', 'pending'],
    ['spoken', 'spoken', 'spoken', 'spoken'],
  ]);
});

test('whitespace differences between the two streams do not shift alignment', () => {
  const segments = alignReply({
    preview: 'এটা বাক্য।\nদুটা বাক্য।',
    spoken: 'এটা বাক্য। দুটা',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'speaking']);
});

test('missing whitespace at a sentence boundary does not stop spoken alignment', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য।দ্বিতীয় বাক্য।',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'spoken']);
});

test('ignoring whitespace still cannot advance through changed words', () => {
  const segments = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য।বেলেগ বাক্য।',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'pending']);
});

test('a single unterminated reply is one segment', () => {
  const segments = alignReply({ preview: 'শুধু কিছু কথা', spoken: '', interrupted: false });
  assert.deepEqual(segments, [{ text: 'শুধু কিছু কথা', state: 'pending' }]);
});

test('a respelled word stops the highlight instead of letting it run ahead', () => {
  // The provider's word aligner rebuilds the transcript from per-word timing and sometimes
  // respells. Past the divergence the two streams are different sentences, so nothing beyond
  // it may be marked spoken. Comparing the transcript's own length would mark all of it.
  const segments = alignReply({
    preview: 'এটা বাক্য। দুটা বাক্য। তিনিটা বাক্য।',
    spoken: 'এটা বাক্য। দুইটা বাক্য।',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'speaking', 'pending']);
});

test('divergence before the first sentence marks nothing as spoken', () => {
  const segments = alignReply({
    preview: 'এটা বাক্য। দুটা বাক্য।',
    spoken: 'একটা বাক্য।',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['speaking', 'pending']);
});

test('a respelled transcript cannot mark a complete reply as spoken', () => {
  // The regression this replaces: taking the transcript length as the reply length claimed the
  // whole reply had been spoken because the transcript was long enough, even though it had
  // only agreed with the first few words.
  const segments = alignReply({
    preview: 'এটা বাক্য। দুটা বাক্য।',
    spoken: 'এটা বাক্য। যি বাক্য ই ই মাপ চতৰ পিপাসালয় বাগৰ উপৰ',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'pending']);
});

test('agreement is measured in characters, so a partial word is not counted', () => {
  // A half-spoken word must not advance the highlight past its own sentence boundary.
  const segments = alignReply({
    preview: 'এটা বাক্য। দুটা বাক্য।',
    spoken: 'এটা বাক্য। দু',
    interrupted: false,
  });
  assert.deepEqual(segments.map((s) => s.state), ['spoken', 'speaking']);
});

test('a transcript covering a whole prefix has not started the next sentence', () => {
  // The one-character rule, stated as the rule rather than implied by a sequence.
  //
  // The separator between two sentences belongs to neither, so every span advances one
  // character past the sentence before it. Drop that and the offsets fall one character short
  // per sentence, which the first boundary hides - `start` lands exactly on the transcript's
  // length and the comparison is strict - and the second boundary does not. From three
  // sentences on, a transcript that has finished a whole prefix looks like it has reached into
  // the sentence after it, and that sentence is shown at full ink as being said.
  //
  // Three sentences is the smallest shape that shows it, and the extra assertion is what stops
  // the first one passing for the wrong reason.
  const covered = alignReply({
    preview: 'এটা। দুটা। তিনিটা।',
    spoken: 'এটা। দুটা।',
    interrupted: false,
  });
  assert.deepEqual(covered.map((s) => s.state), ['spoken', 'spoken', 'pending']);

  const oneIn = alignReply({
    preview: 'এটা। দুটা। তিনিটা।',
    spoken: 'এটা। দুটা। ত',
    interrupted: false,
  });
  assert.deepEqual(oneIn.map((s) => s.state), ['spoken', 'spoken', 'speaking']);
});

test('a transcript that diverges at a boundary has not started the next sentence', () => {
  // The same off-by-one seen from the failure it would cause.
  //
  // Here the transcript agrees through the first sentence and then diverges: no separator was
  // matched and not one character of the second sentence was either. The second sentence is
  // therefore not being said. Credit the separator to the first sentence instead and the
  // miscounted offset reports `speaking` - which is the divergence being laundered into
  // evidence of speech.
  const diverged = alignReply({
    preview: 'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
    spoken: 'প্ৰথম বাক্য।বেলেগ বাক্য।',
    interrupted: false,
  });
  assert.deepEqual(diverged.map((s) => s.state), ['spoken', 'pending']);
});
