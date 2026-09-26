import assert from 'node:assert/strict';
import {
  buildTrainingExample,
  containsCredentialLikeText,
  detectDominantScript,
  redactCommonIdentifiers,
  rowToTrainingRecord,
  stableHash,
} from './src/training-data.js';

console.log('Testing training-data contracts...');

assert.equal(detectDominantScript('মই ভাল আছোঁ'), 'assamese-bengali');
assert.equal(detectDominantScript('आं मोजां दं'), 'devanagari');
assert.equal(detectDominantScript('moi bhal asu'), 'latin');
assert.equal(detectDominantScript('hello অসমীয়া'), 'mixed');

assert.equal(containsCredentialLikeText('normal conversation'), false);
assert.equal(containsCredentialLikeText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz.1234567890'), true);
assert.equal(containsCredentialLikeText('my key is sk-syntheticcredentialvalue123456'), true);
assert.equal(
  redactCommonIdentifiers('mail me at hello@example.com or https://example.com and call +91 98765 43210'),
  'mail me at [email] or [url] and call [phone]'
);

const firstHash = await stableHash('clerk:user-1');
assert.equal(firstHash, await stableHash('clerk:user-1'));
assert.notEqual(firstHash, await stableHash('clerk:user-2'));
assert.equal(firstHash.length, 64);

const example = await buildTrainingExample({
  principal: 'clerk:user-1',
  threadId: 'thread-1',
  turnId: 'turn-1',
  surface: 'chat',
  targetLanguage: 'as',
  userText: 'ki kori asa?',
  assistantText: 'tumar logot kotha pati asu 😄',
  model: 'test-model',
  policyVersion: 'test-policy',
  createdAt: Date.UTC(2026, 8, 15, 9, 0, 0),
});
assert.ok(example);
assert.equal(example.userScript, 'latin');
assert.equal(example.targetLanguage, 'as');
assert.notEqual(example.contributorHash, 'clerk:user-1');
assert.equal(example.id, (await buildTrainingExample({
  principal: 'clerk:user-1',
  threadId: 'thread-1',
  turnId: 'turn-1',
  surface: 'chat',
  targetLanguage: 'as',
  userText: 'retry text may differ',
  assistantText: 'retry reply may differ',
  model: 'test-model',
  policyVersion: 'test-policy',
}))?.id, 'the same logical turn must keep a stable record identity');

assert.equal(await buildTrainingExample({
  principal: 'clerk:user-1',
  threadId: 'thread-1',
  turnId: 'turn-too-long',
  surface: 'chat',
  targetLanguage: 'as',
  userText: 'a'.repeat(16_001),
  assistantText: 'reply',
}), null, 'over-limit text must be rejected rather than silently truncated');

assert.equal(await buildTrainingExample({
  principal: 'clerk:user-1',
  threadId: 'thread-1',
  turnId: 'turn-2',
  surface: 'chat',
  targetLanguage: 'as',
  userText: 'my secret is sk-syntheticcredentialvalue123456',
  assistantText: 'do not share it',
}), null);

const record = rowToTrainingRecord({
  id: example.id,
  contributor_hash: example.contributorHash,
  thread_hash: example.threadHash,
  turn_id: example.turnId,
  surface: example.surface,
  target_language: example.targetLanguage,
  user_text: example.userText,
  assistant_text: example.assistantText,
  user_script: example.userScript,
  assistant_script: example.assistantScript,
  model: example.model,
  policy_version: example.policyVersion,
  created_at: example.createdAt,
});
assert.deepEqual(record.messages, [
  { role: 'user', content: 'ki kori asa?' },
  { role: 'assistant', content: 'tumar logot kotha pati asu 😄' },
]);
assert.equal(record.metadata.source, 'miithii_opt_in');
assert.equal(record.metadata.record_version, 1);

console.log('ALL TRAINING DATA CONTRACT CHECKS PASSED!');
