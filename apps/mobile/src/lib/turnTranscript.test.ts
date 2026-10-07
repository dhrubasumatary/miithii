import assert from 'node:assert/strict';
import { test } from 'node:test';

import { spokenTranscriptForTurn } from './turnTranscript.ts';

test('old turn transcript cannot mark a repeated prefix in the new turn as spoken', () => {
  const messages = [
    { type: 'agentTranscript', id: 'old', timestamp: 100, message: 'এটা বাক্য।' },
  ];

  assert.equal(spokenTranscriptForTurn(messages, 200), '');
});

test('all transcription segments opened in the current turn are concatenated', () => {
  const messages = [
    { type: 'agentTranscript', id: 'old', timestamp: 100, message: 'পুৰণা।' },
    { type: 'agentTranscript', id: 'one', timestamp: 210, message: 'প্ৰথম বাক্য।' },
    { type: 'agentTranscript', id: 'two', timestamp: 240, message: 'দ্বিতীয় বাক্য।' },
  ];

  assert.equal(
    spokenTranscriptForTurn(messages, 200),
    'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
  );
});

test('a growing LiveKit segment replaces itself rather than being counted twice', () => {
  const messages = [
    { type: 'agentTranscript', id: 'one', timestamp: 210, message: 'প্ৰথম বাক্য।' },
    { type: 'userTranscript', id: 'user', timestamp: 220, message: 'user text' },
    { type: 'agentTranscript', id: 'two', timestamp: 240, message: 'দ্বিতীয় বাক্য।' },
  ];

  assert.equal(
    spokenTranscriptForTurn(messages, 200),
    'প্ৰথম বাক্য। দ্বিতীয় বাক্য।',
  );
});

test('missing preview boundary degrades to the latest agent transcript only', () => {
  const messages = [
    { type: 'agentTranscript', id: 'old', timestamp: 100, message: 'পুৰণা।' },
    { type: 'agentTranscript', id: 'latest', timestamp: 200, message: 'শেহতীয়া।' },
  ];

  assert.equal(spokenTranscriptForTurn(messages, 0), 'শেহতীয়া।');
});
