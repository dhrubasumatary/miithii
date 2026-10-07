import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(await readFile(join(ROOT, 'schema/language-pack.schema.json'), 'utf8'));
const pack = JSON.parse(await readFile(join(ROOT, 'packs/asm/pack.json'), 'utf8'));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

test('the current Assamese source pack satisfies the runtime-facing schema', () => {
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
});

test('provider codes must be strings before a pack can compile', () => {
  const malformed = structuredClone(pack);
  malformed.codes.sarvam['realtime-stt'] = 123;
  assert.equal(validate(malformed), false);
});

test('Unicode range endpoints must be integers, not booleans', () => {
  const malformed = structuredClone(pack);
  malformed.scripts.native.unicodeRanges[0][0] = true;
  assert.equal(validate(malformed), false);
});

test('Latin script allowance must stay within a ratio', () => {
  const malformed = structuredClone(pack);
  malformed.gate.maxLatinRatio = 1.01;
  assert.equal(validate(malformed), false);
});
