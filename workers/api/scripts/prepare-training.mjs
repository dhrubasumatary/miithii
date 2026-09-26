import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { containsCredentialLikeText, detectDominantScript } from '../src/training-data.js';

const [inputArg, outputArg = 'training-ready'] = process.argv.slice(2);
if (!inputArg) {
  throw new Error('Usage: node scripts/prepare-training.mjs <export.jsonl> [output-directory]');
}

const inputPath = resolve(inputArg);
const outputDirectory = resolve(outputArg);
const input = (await readFile(inputPath, 'utf8')).replace(/^\uFEFF/, '');
const lines = input.split(/\r?\n/).filter(Boolean);
const seen = new Set();
const accepted = [];
const rejected = [];

function splitForConversation(conversationId) {
  const digest = createHash('sha256').update(conversationId).digest();
  return digest.readUInt16BE(0) % 20 === 0 ? 'validation' : 'train';
}

for (let index = 0; index < lines.length; index += 1) {
  let record;
  try {
    record = JSON.parse(lines[index]);
  } catch {
    rejected.push({ line: index + 1, reason: 'invalid_json' });
    continue;
  }
  const messages = Array.isArray(record?.messages) ? record.messages : [];
  const user = messages.find(message => message?.role === 'user')?.content;
  const assistant = messages.find(message => message?.role === 'assistant')?.content;
  const metadata = record?.metadata;
  if (typeof user !== 'string' || typeof assistant !== 'string' || !metadata || typeof metadata !== 'object') {
    rejected.push({ line: index + 1, reason: 'invalid_record' });
    continue;
  }
  if (!['as', 'brx'].includes(metadata.target_language)) {
    rejected.push({ line: index + 1, reason: 'unsupported_language' });
    continue;
  }
  if (user.length < 1 || assistant.length < 1 || user.length > 16_000 || assistant.length > 16_000) {
    rejected.push({ line: index + 1, reason: 'invalid_length' });
    continue;
  }
  if (containsCredentialLikeText(user) || containsCredentialLikeText(assistant)) {
    rejected.push({ line: index + 1, reason: 'credential_like_text' });
    continue;
  }
  const assistantScript = detectDominantScript(assistant);
  if (metadata.assistant_script !== assistantScript) {
    rejected.push({ line: index + 1, reason: 'assistant_script_metadata_mismatch' });
    continue;
  }
  const conflictingScript = metadata.target_language === 'brx'
    ? !['devanagari', 'unknown'].includes(assistantScript)
    : metadata.surface === 'voice'
      ? !['assamese-bengali', 'unknown'].includes(assistantScript)
      : !['latin', 'unknown'].includes(assistantScript);
  if (conflictingScript) {
    rejected.push({ line: index + 1, reason: 'reply_contract_script_conflict' });
    continue;
  }
  const duplicateKey = createHash('sha256').update(`${metadata.target_language}\0${user}\0${assistant}`).digest('hex');
  if (seen.has(duplicateKey)) {
    rejected.push({ line: index + 1, reason: 'duplicate' });
    continue;
  }
  seen.add(duplicateKey);
  const conversationId = metadata.conversation_id;
  if (typeof conversationId !== 'string' || !conversationId) {
    rejected.push({ line: index + 1, reason: 'missing_conversation_id' });
    continue;
  }
  accepted.push({ record, split: splitForConversation(conversationId) });
}

await mkdir(outputDirectory, { recursive: true });
const render = split => accepted.filter(item => item.split === split).map(item => JSON.stringify(item.record)).join('\n');
const train = render('train');
const validation = render('validation');
await writeFile(join(outputDirectory, 'train.jsonl'), train ? `${train}\n` : '', 'utf8');
await writeFile(join(outputDirectory, 'validation.jsonl'), validation ? `${validation}\n` : '', 'utf8');
await writeFile(join(outputDirectory, 'manifest.json'), `${JSON.stringify({
  format: 'miithii-sft-v1',
  source: inputPath,
  totalInput: lines.length,
  accepted: accepted.length,
  train: accepted.filter(item => item.split === 'train').length,
  validation: accepted.filter(item => item.split === 'validation').length,
  rejected: rejected.length,
  rejectedByReason: Object.fromEntries([...new Set(rejected.map(item => item.reason))].sort().map(reason => [reason, rejected.filter(item => item.reason === reason).length])),
  splitRule: 'conversation-stable 95/5 sha256 split',
  qualityGate: 'credential rejection, exact duplicate removal, hard reply-script conflict rejection; native-speaker/model-quality review still required before training',
}, null, 2)}\n`, 'utf8');
await writeFile(join(outputDirectory, 'rejected.json'), `${JSON.stringify(rejected, null, 2)}\n`, 'utf8');

console.log(`Prepared ${accepted.length}/${lines.length} examples in ${outputDirectory}`);
