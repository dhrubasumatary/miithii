import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveVoiceUiState } from './voiceUiState.ts';
import { createOperationBound, OPERATION_BOUND_MS } from './operationBound.ts';

const base = {
  configured: true,
  operation: null,
  issue: null,
  hasGeneratedText: false,
  hasSpokenText: false,
} as const;

test('teardown gates release on completion and on the operation bound', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let operation: 'ending' | null = 'ending';
  const bound = createOperationBound(() => { operation = null; });
  const finish = bound.hold();
  finish();
  assert.equal(operation, null);
  operation = 'ending';
  const oldFinish = bound.hold();
  bound.hold();
  oldFinish();
  assert.equal(operation, 'ending', 'stale completion must not unlock the new operation');
  context.mock.timers.tick(OPERATION_BOUND_MS);
  assert.equal(operation, null);
  bound.dispose();
});

test('a fresh disconnected screen is idle and can show READY', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'disconnected',
    agentState: 'disconnected',
  });
  assert.equal(state.failed, false);
  assert.equal(state.presence, 'idle');
  assert.equal(state.phase, 'off');
});

test('a failed voice process can never become READY', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'connected',
    agentState: 'failed',
  });
  assert.equal(state.failed, true);
  assert.equal(state.presence, 'off');
  assert.equal(state.phase, 'off');
});

test('a captured start failure stays failed even after disconnect', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'disconnected',
    agentState: 'disconnected',
    issue: 'start',
  });
  assert.equal(state.failed, true);
  assert.equal(state.presence, 'off');
});

test('pre-connect buffering is startup, not READY', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'connected',
    agentState: 'pre-connect-buffering',
  });
  assert.equal(state.presence, 'connecting');
  assert.equal(state.phase, 'connecting');
});

test('reconnecting is startup/recovery, not READY or live', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'reconnecting',
    agentState: 'listening',
  });
  assert.equal(state.connectionTransitioning, true);
  assert.equal(state.presence, 'connecting');
  assert.equal(state.phase, 'connecting');
  assert.equal(state.running, false);
});

test('a reconnect blip is cancellable, not a reason to end the session', () => {
  // This is the state that used to put CANCEL on a button wired to the transcript-clearing
  // action, so one tap on a bad network threw away the conversation. `phase` is what selects
  // the control's action, and it must not be able to route to a destructive one.
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'reconnecting',
    agentState: 'listening',
  });
  assert.equal(state.phase, 'connecting');
  // `VoiceShell` only routes CANCEL to `onStartStop` now, so what matters is that this phase
  // is not the destructive one.
  assert.notEqual(state.phase, 'ending');
  assert.equal(state.controls.primary.action, 'cancel');
});

test('unknown agent states are transitional with no live microphone control', () => {
  const state = deriveVoiceUiState({ ...base, connectionState: 'connected', agentState: 'future-state', microphoneAvailable: true });
  assert.equal(state.phase, 'connecting');
  assert.equal(state.running, false);
  assert.equal(state.controls.primary.action, 'cancel');
  assert.equal(state.controls.microphone.visible, false);
});

test('ending hides session controls and clear is shown only when actionable', () => {
  const ending = deriveVoiceUiState({ ...base, connectionState: 'connected', agentState: 'listening', operation: 'ending', hasConversation: true });
  for (const control of Object.values(ending.controls)) {
    assert.equal(control.visible, false);
    assert.equal(control.enabled, false);
    assert.equal(control.action, 'none');
  }
  const ready = deriveVoiceUiState({ ...base, connectionState: 'disconnected', agentState: 'disconnected', hasConversation: true });
  assert.equal(ready.controls.reset.visible, true);
  assert.equal(ready.controls.reset.enabled, true);
});

test('muting never claims that the app is listening', () => {
  const state = deriveVoiceUiState({ ...base, connectionState: 'connected', agentState: 'listening', microphoneAvailable: true, microphoneEnabled: false });
  assert.equal(state.muted, true);
  assert.equal(state.presence, 'idle');
  assert.equal(state.controls.microphone.action, 'toggle-microphone');
});

test('ending has its own phase instead of reusing STARTING', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'connected',
    agentState: 'listening',
    operation: 'ending',
  });
  assert.equal(state.phase, 'ending');
});

test('a known listening state on a connected session is live', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'connected',
    agentState: 'listening',
  });
  assert.equal(state.presence, 'listening');
  assert.equal(state.phase, 'live');
  assert.equal(state.running, true);
});

test('generated but unspoken text maps to the answering wait', () => {
  const state = deriveVoiceUiState({
    ...base,
    connectionState: 'connected',
    agentState: 'thinking',
    hasGeneratedText: true,
  });
  assert.equal(state.presence, 'synthesizing');
});
