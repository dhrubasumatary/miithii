import { createWriteStream } from 'node:fs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outputPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (outIndex >= 0 && !outputPath) throw new Error('--out requires a file path');

const baseUrl = process.env.MIITHII_API_ORIGIN || 'https://api.miithii.in';
const token = process.env.MIITHII_TRAINING_EXPORT_TOKEN;
if (!token) throw new Error('Set MIITHII_TRAINING_EXPORT_TOKEN before exporting training data.');

const output = outputPath ? createWriteStream(outputPath, { encoding: 'utf8' }) : process.stdout;
let after = 0;
let written = 0;

while (true) {
  const url = new URL('/api/training/export', baseUrl);
  url.searchParams.set('after', String(after));
  url.searchParams.set('limit', '200');
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Training export failed (${response.status}).`);
  const payload = await response.json();
  const records = Array.isArray(payload.records) ? payload.records : [];
  for (const record of records) {
    output.write(`${JSON.stringify(record)}\n`);
    written += 1;
  }
  if (!payload.hasMore || !records.length || payload.next === after) break;
  after = payload.next;
}

if (output !== process.stdout) {
  await new Promise((resolve, reject) => {
    output.on('error', reject);
    output.end(resolve);
  });
}
console.error(`Exported ${written} opt-in training examples${outputPath ? ` to ${outputPath}` : ''}.`);
