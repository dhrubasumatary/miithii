import assert from 'node:assert/strict';
import test from 'node:test';
import { guardCancelledConnection } from './cancelledConnection.ts';

test('cancel during token fetch disconnects both now and a later SDK connection', async () => {
  const controller = new AbortController();
  let listener: ((state: string) => void) | undefined;
  let disconnects = 0;
  const cleanup = guardCancelledConnection(controller.signal, (callback) => {
    listener = callback;
    return () => { listener = undefined; };
  }, async () => { disconnects += 1; });
  listener?.('connecting');
  assert.equal(disconnects, 0);
  controller.abort();
  assert.equal(disconnects, 1);
  // The SDK receives its token after abort and attempts room.connect anyway.
  listener?.('connecting');
  listener?.('connected');
  assert.equal(disconnects, 3);
  listener?.('disconnected');
  assert.equal(disconnects, 3);
  cleanup();
  assert.equal(listener, undefined);
});

test('settled successful start releases the guard before later lifecycle actions', () => {
  const controller = new AbortController();
  let disconnects = 0;
  let unsubscribed = false;
  const cleanup = guardCancelledConnection(controller.signal, () => () => {
    unsubscribed = true;
  }, async () => { disconnects += 1; });
  cleanup();
  controller.abort();
  assert.equal(disconnects, 0);
  assert.equal(unsubscribed, true);
});
