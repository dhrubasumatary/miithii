import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioSessionLeases } from './audioSessionLease.ts';

test('late cleanup from a retired room cannot shut down the next room audio', async () => {
  const calls: string[] = [];
  const leases = createAudioSessionLeases({ start: async () => { calls.push('start'); }, stop: async () => { calls.push('stop'); } });
  const oldRoom = Symbol('old'); const nextRoom = Symbol('next');
  await leases.claim(oldRoom);
  await leases.claim(nextRoom);
  await leases.release(oldRoom);
  assert.deepEqual(calls, ['start', 'stop', 'start']);
  await leases.release(nextRoom);
  assert.deepEqual(calls, ['start', 'stop', 'start', 'stop']);
});

test('cancellation during native startup finishes cleanup before the next claim', async () => {
  let ready!: () => void;
  let starting = true;
  const blocked = new Promise<void>((resolve) => { ready = resolve; });
  const calls: string[] = [];
  const leases = createAudioSessionLeases({ start: async () => { calls.push('start'); if (starting) { starting = false; await blocked; } }, stop: async () => { calls.push('stop'); } });
  const oldRoom = Symbol('old'); const nextRoom = Symbol('next');
  const first = leases.claim(oldRoom);
  const cancel = leases.release(oldRoom);
  const second = leases.claim(nextRoom);
  await Promise.resolve();
  assert.deepEqual(calls, ['start']);
  ready();
  await Promise.all([first, cancel, second]);
  assert.deepEqual(calls, ['start', 'stop', 'start']);
});

test('a failed native start does not poison the next operation', async () => {
  let failure = true;
  const leases = createAudioSessionLeases({ start: async () => { if (failure) { failure = false; throw new Error('device'); } }, stop: async () => undefined });
  await assert.rejects(leases.claim(Symbol('failed')));
  await leases.claim(Symbol('fresh'));
});
