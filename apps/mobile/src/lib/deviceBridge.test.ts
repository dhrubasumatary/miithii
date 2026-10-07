import assert from 'node:assert/strict';
import test from 'node:test';
import type { Room, RpcInvocationData } from 'livekit-client';
import { ok, registerDeviceBridge } from './deviceBridge.ts';

function fakeRoom() {
  let handler: ((data: RpcInvocationData) => Promise<string>) | undefined;
  const room = {
    registerRpcMethod(_name: string, method: typeof handler) {
      if (handler) throw new Error('duplicate registration');
      handler = method;
    },
    unregisterRpcMethod() { handler = undefined; },
  } as unknown as Room;
  return { room, handler: () => handler };
}

test('duplicate registration surfaces and preserves the live handler', async () => {
  const fake = fakeRoom();
  const dispose = registerDeviceBridge(fake.room, { onCommand: async () => ok({ live: true }) });
  assert.throws(() => registerDeviceBridge(fake.room, { onCommand: async () => ok({ stale: true }) }), /duplicate/);
  const live = fake.handler()!;
  const request = { payload: JSON.stringify({ kind: 'capabilities' }) } as RpcInvocationData;
  assert.deepEqual(JSON.parse(await live(request)).data, { live: true });
  dispose();
  assert.equal(JSON.parse(await live(request)).reason, 'not_ready');
  const disposeNext = registerDeviceBridge(fake.room, { onCommand: async () => ok({ next: true }) });
  dispose(); // An old disposer must never remove its successor.
  assert.deepEqual(JSON.parse(await fake.handler()!(request)).data, { next: true });
  disposeNext();
});

test('command failures return honest RPC results', async () => {
  const fake = fakeRoom();
  const dispose = registerDeviceBridge(fake.room, { onCommand: async () => { throw new Error('unsupported language'); } });
  const result = JSON.parse(await fake.handler()!({ payload: '{"kind":"reply.language","target":"invalid"}' } as RpcInvocationData));
  assert.equal(result.ok, false);
  assert.equal(result.detail, 'unsupported language');
  dispose();
});
