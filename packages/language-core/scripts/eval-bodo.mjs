import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { LANGUAGE_POLICY_VERSION, NEUTRAL_COMPANION_POLICY, buildLanguageSystemPrompt, getReplyContract, validateOutputScript } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const promptsPath = resolve(here, '../test/fixtures/bodo-eval-prompts.json');
const devVarsPath = resolve(repoRoot, 'workers/api/.dev.vars');

function parseVars(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

async function loadLocalVars() {
  try { return parseVars(await readFile(devVarsPath, 'utf8')); }
  catch { return {}; }
}

function argValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function scriptStats(text) {
  let devanagariLetters = 0;
  let assameseBengaliLetters = 0;
  let latinLetters = 0;
  let letters = 0;
  for (const char of text) {
    if (!/\p{L}/u.test(char)) continue;
    letters += 1;
    if (/\p{Script=Devanagari}/u.test(char)) devanagariLetters += 1;
    else if (/\p{Script=Bengali}/u.test(char)) assameseBengaliLetters += 1;
    else if (/\p{Script=Latin}/u.test(char)) latinLetters += 1;
  }
  return {
    letters,
    devanagariLetters,
    assameseBengaliLetters,
    latinLetters,
    devanagariLetterShare: letters ? Number((devanagariLetters / letters).toFixed(3)) : 0
  };
}

async function generate({ apiKey, baseURL, model, system, user, temperature, maxTokens, reasoningEffort }) {
  const started = performance.now();
  const response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false
    }),
    signal: AbortSignal.timeout(120000)
  });
  const elapsedMs = Math.round(performance.now() - started);
  if (!response.ok) {
    await response.arrayBuffer().catch(() => {});
    throw new Error(`upstream ${response.status}`);
  }
  const json = await response.json();
  const text = typeof json?.choices?.[0]?.message?.content === 'string' ? json.choices[0].message.content.trim() : '';
  return { text, elapsedMs, finishReason: json?.choices?.[0]?.finish_reason ?? null, usage: json?.usage ?? null, script: scriptStats(text) };
}

const local = await loadLocalVars();
const apiKey = process.env.UPSTREAM_API_KEY || local.UPSTREAM_API_KEY;
if (!apiKey) throw new Error('UPSTREAM_API_KEY is required (environment or workers/api/.dev.vars)');

const baseURL = process.env.UPSTREAM_BASE_URL || 'https://api.aimlapi.com/v1';
const model = process.env.UPSTREAM_MODEL || 'google/gemini-2.5-flash';
const temperature = Number(argValue('temperature') ?? '0.2');
const requestedLimit = Number(argValue('limit') ?? '0');
const requestedIds = (argValue('ids') ?? '').split(/[\s,]+/).map(value => value.trim()).filter(Boolean);
const requestedSuite = argValue('suite') ?? 'all';
const maxTokens = Number(argValue('max-tokens') ?? '1536');
const reasoningEffort = argValue('reasoning-effort') ?? null;
const promptsText = await readFile(promptsPath, 'utf8');
const prompts = JSON.parse(promptsText.charCodeAt(0) === 0xFEFF ? promptsText.slice(1) : promptsText);
const bySuite = requestedSuite === 'all' ? prompts : prompts.filter(prompt => prompt.suite === requestedSuite);
const filtered = requestedIds.length ? bySuite.filter(prompt => requestedIds.includes(prompt.id)) : bySuite;
const selected = Number.isInteger(requestedLimit) && requestedLimit > 0 ? filtered.slice(0, requestedLimit) : filtered;
if (!['all', 'everyday', 'diagnostic'].includes(requestedSuite)) throw new Error('suite must be all, everyday, or diagnostic');
if (requestedIds.length) {
  const found = new Set(selected.map(prompt => prompt.id));
  const missing = requestedIds.filter(id => !found.has(id));
  if (missing.length) throw new Error(`Unknown Bodo evaluation prompt id(s): ${missing.join(', ')}`);
}

const contract = getReplyContract('voice', 'brx');
const minimalBodoPrompt = `${NEUTRAL_COMPANION_POLICY}\n\nREPLY CONTRACT\nLanguage: Bodo (brx; brx-IN)\nScript: ${contract.script}\n\nMINIMAL BODO INSTRUCTION\nReply in natural conversational Bodo/Boro, not Hindi or Assamese grammar. Preserve the user's meaning and register. Use standard Bodo Devanagari for this Voice evaluation. Do not explain the language choice.`;
const conditions = {
  minimal: minimalBodoPrompt,
  structured: buildLanguageSystemPrompt({ surface: 'voice', language: 'brx' })
};

const outDir = resolve(repoRoot, 'tmp');
await mkdir(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = resolve(outDir, `bodo-eval-${stamp}.jsonl`);
const rows = [];

for (const prompt of selected) {
  for (const [condition, system] of Object.entries(conditions)) {
    process.stdout.write(`${prompt.id} ${condition} ... `);
    try {
      const result = await generate({ apiKey, baseURL, model, system, user: prompt.text, temperature, maxTokens, reasoningEffort });
      const scriptValidation = validateOutputScript(result.text, contract.script);
      const row = { prompt, condition, model, temperature, maxTokens, reasoningEffort, policyVersion: LANGUAGE_POLICY_VERSION, systemHash: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(system)).then(buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)), scriptValidation, ...result };
      rows.push(row);
      console.log(`${result.elapsedMs} ms, devanagari=${result.script.devanagariLetterShare}`);
    } catch (error) {
      rows.push({ prompt, condition, model, temperature, maxTokens, error: error instanceof Error ? error.message : String(error) });
      console.log(`ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await writeFile(outPath, rows.map(row => JSON.stringify(row)).join('\n') + '\n', 'utf8');
console.log(`\nSaved paired Bodo outputs to ${outPath}`);
console.log('Automatic checks are guardrails only. This evaluator intentionally does not assign a Bodo fluency score; use blinded fluent-speaker review for grammar, naturalness, register and contamination.');

