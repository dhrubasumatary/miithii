import assert from 'node:assert/strict';
import {
  bindVoiceSessionRequest,
  isVoiceSessionToken,
  mintVoiceSessionToken,
  parseIceServers,
  verifyVoiceSessionToken
} from './src/voice-session.js';

const secret = 'voice-session-test-secret-0123456789abcdef';
const nowMs = Date.UTC(2026, 8, 18, 7, 0, 0);

const minted = await mintVoiceSessionToken({
  secret,
  principal: 'clerk:user_test',
  language: 'brx',
  threadId: 'voice-session-1',
  nowMs,
  ttlSeconds: 90
});

assert.equal(isVoiceSessionToken(minted.token), true);
const claims = await verifyVoiceSessionToken(minted.token, secret, nowMs + 30_000);
assert.equal(claims.sub, 'clerk:user_test');
assert.equal(claims.language, 'brx');
assert.equal(claims.threadId, 'voice-session-1');
assert.equal(claims.exp - claims.iat, 90);

const installMinted = await mintVoiceSessionToken({
  secret,
  principal: 'install:android_alpha_1234567890',
  language: 'as',
  threadId: 'voice-install-1',
  nowMs,
  ttlSeconds: 90
});
const installClaims = await verifyVoiceSessionToken(installMinted.token, secret, nowMs + 30_000);
assert.equal(installClaims.sub, 'install:android_alpha_1234567890');
assert.equal(installClaims.language, 'as');

await assert.rejects(
  () => verifyVoiceSessionToken(minted.token, `${secret}x`, nowMs + 30_000),
  /signature/
);
await assert.rejects(
  () => verifyVoiceSessionToken(minted.token, secret, nowMs + 91_000),
  /expired/
);

const bound = bindVoiceSessionRequest({
  turnId: 'turn-1',
  messages: [{ role: 'user', content: 'hello' }]
}, claims);
assert.equal(bound.responseMode, 'voice');
assert.equal(bound.language, 'brx');
assert.equal(bound.threadId, 'voice-session-1');
assert.equal(bound.stream, false);
assert.equal(bound.model, 'miithii');

assert.throws(
  () => bindVoiceSessionRequest({ messages: [], language: 'as' }, claims),
  /server-owned/
);
assert.deepEqual(parseIceServers('[{"urls":"stun:stun.example.com:3478"}]'), [
  { urls: 'stun:stun.example.com:3478' }
]);
assert.throws(() => parseIceServers('{bad json'), /ICE configuration/);

console.log('VOICE SESSION CONTRACT CHECKS PASSED!');
