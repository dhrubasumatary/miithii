import assert from 'node:assert/strict';
import test from 'node:test';
import { CoverReadiness } from './coverReadiness.ts';

test('a late cover load cannot release a newer transition', async () => {
  const covers = new CoverReadiness();
  const first = covers.begin(1000);
  covers.complete(first.id);
  assert.equal(await first.ready, first.id);

  const second = covers.begin(1000);
  covers.complete(first.id);
  const result = await Promise.race([
    second.ready.then(() => 'resolved'),
    Promise.resolve('pending'),
  ]);
  assert.equal(result, 'pending');

  covers.complete(second.id);
  assert.equal(await second.ready, second.id);
});

test('a missed image load still releases its own cover on timeout', async () => {
  const covers = new CoverReadiness();
  const cover = covers.begin(1);
  assert.equal(await cover.ready, cover.id);

  const later = covers.begin(1000);
  covers.complete(cover.id);
  const result = await Promise.race([
    later.ready.then(() => 'resolved'),
    Promise.resolve('pending'),
  ]);
  assert.equal(result, 'pending');
  covers.complete(later.id);
});
