import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = join(ROOT, 'packs');
const OUTPUT = join(ROOT, 'compiled', 'language-packs.json');
const CHECK = process.argv.includes('--check');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function assertReviewedNativeEntries(entries, where) {
  requireValue(Array.isArray(entries), `${where} must be an array`);
  for (const [index, entry] of entries.entries()) {
    requireValue(entry && typeof entry === 'object', `${where}[${index}] must be an object`);
    requireValue(
      entry.reviewStatus === 'native-approved' && typeof entry.reviewer === 'string' && entry.reviewer,
      `${where}[${index}] contains native-language production content without native approval`,
    );
  }
}

function validatePack(pack, registryEntry, companions) {
  const where = `pack ${registryEntry.id}`;
  requireValue(pack.id === registryEntry.id, `${where} id does not match registry`);
  requireValue(/^[a-z]{3}$/.test(pack.id), `${where} id must be ISO 639-3 style`);
  requireValue(typeof pack.version === 'string' && pack.version, `${where} version is required`);
  requireValue(pack.names?.english && pack.names?.native, `${where} names are incomplete`);
  requireValue(pack.codes?.sarvam?.['realtime-stt'], `${where} is missing Sarvam realtime code`);
  requireValue(pack.codes?.bodhan?.speech, `${where} is missing Bodhan speech code`);
  requireValue(pack.scripts?.native?.unicodeRanges?.length, `${where} has no native script ranges`);
  requireValue(pack.scripts?.pipeline?.display, `${where} script pipeline is incomplete`);
  requireValue(pack.agentName?.display && pack.agentName?.tts, `${where} agentName is incomplete`);
  requireValue(pack.gate?.sentenceTerminators?.length, `${where} has no sentence terminators`);
  requireValue(Number.isInteger(pack.gate?.maxTurnChars) && pack.gate.maxTurnChars > 0, `${where} maxTurnChars must be positive`);
  requireValue(Number.isInteger(pack.gate?.generationMaxTokens) && pack.gate.generationMaxTokens > 0, `${where} generationMaxTokens must be positive`);
  requireValue(pack.tts?.recommendedVoice, `${where} needs a recommended TTS voice`);
  requireValue(pack.review && ['draft', 'reviewed', 'shipped'].includes(pack.review.status), `${where} review status is invalid`);
  requireValue(
    Array.isArray(pack.addressForm?.allowed) && pack.addressForm.allowed.includes(pack.addressForm?.default),
    `${where} default address form must be in addressForm.allowed`,
  );
  const provenance = pack.provenance?.languageInstructions;
  requireValue(provenance?.source === 'historical-language-core', `${where} language-instruction provenance source is invalid`);
  requireValue(/^[0-9a-f]{40}$/.test(provenance?.sourceCommit ?? ''), `${where} language-instruction source commit is invalid`);
  requireValue(typeof provenance?.sourcePath === 'string' && provenance.sourcePath, `${where} language-instruction source path is missing`);
  requireValue(provenance?.reviewStatus === 'native-approved', `${where} migrated language instructions lack native approval`);
  requireValue(typeof provenance?.reviewer === 'string' && provenance.reviewer, `${where} migrated language instructions need a reviewer`);

  assertReviewedNativeEntries(companions.exemplars.entries, `${where} exemplars`);
  assertReviewedNativeEntries(companions.fallback.lines, `${where} fallback lines`);
  assertReviewedNativeEntries(companions.crisis.triggers, `${where} crisis triggers`);
  assertReviewedNativeEntries(companions.crisis.spokenResources, `${where} spoken crisis resources`);

  if (pack.review.status === 'shipped') {
    requireValue(pack.review.reviewers?.length, `${where} cannot ship without reviewers`);
    requireValue(companions.fallback.lines.length, `${where} cannot ship without a native fallback`);
    requireValue(companions.crisis.triggers.length, `${where} cannot ship without crisis triggers`);
    requireValue(companions.crisis.spokenResources.length, `${where} cannot ship without spoken crisis resources`);
  }
}

async function compile() {
  const registry = await readJson(join(ROOT, 'registry.json'));
  const schema = await readJson(join(ROOT, 'schema', 'language-pack.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateSchema = ajv.compile(schema);
  const persona = await readFile(join(ROOT, 'persona', 'core.txt'), 'utf8');
  const segmentation = await readJson(join(ROOT, 'fixtures', 'segmentation.json'));
  requireValue(Array.isArray(registry.languages) && registry.languages.length > 0, 'registry has no languages');

  const onDisk = new Set((await readdir(PACKS, { withFileTypes: true })).filter((item) => item.isDirectory()).map((item) => item.name));
  const languages = {};
  const aliases = {};

  for (const entry of registry.languages) {
    requireValue(onDisk.has(entry.directory), `registry points at missing pack directory ${entry.directory}`);
    const dir = join(PACKS, entry.directory);
    const [pack, blocklist, lexicon, exemplars, crisis, fallback] = await Promise.all([
      readJson(join(dir, 'pack.json')),
      readJson(join(dir, 'blocklist.json')),
      readJson(join(dir, 'lexicon.json')),
      readJson(join(dir, 'exemplars.json')),
      readJson(join(dir, 'crisis.json')),
      readJson(join(dir, 'fallback.json')),
    ]);
    if (!validateSchema(pack)) {
      throw new Error(
        `${entry.id} does not satisfy language-pack.schema.json: ${ajv.errorsText(validateSchema.errors)}`,
      );
    }
    validatePack(pack, entry, { blocklist, lexicon, exemplars, crisis, fallback });
    const instructionsFile = pack.prompt?.languageInstructionsFile;
    requireValue(
      typeof instructionsFile === 'string' && instructionsFile && !instructionsFile.includes('/') && !instructionsFile.includes('\\') && !instructionsFile.includes('..'),
      `pack ${entry.id} languageInstructionsFile must be a file in its pack directory`,
    );
    const languageInstructions = await readFile(join(dir, instructionsFile), 'utf8');
    requireValue(languageInstructions.trim(), `pack ${entry.id} language instructions are empty`);
    languages[entry.id] = {
      ...pack,
      prompt: { ...pack.prompt, languageInstructions },
      blocklist,
      lexicon,
      exemplars,
      crisis,
      fallback,
      enabledForDevelopment: Boolean(entry.enabledForDevelopment),
    };
    aliases[entry.id] = entry.id;
    for (const alias of entry.aliases ?? []) {
      requireValue(!aliases[alias], `duplicate language alias ${alias}`);
      aliases[alias] = entry.id;
    }
  }

  requireValue(languages[registry.defaultLanguage], 'defaultLanguage is not registered');
  const base = {
    schemaVersion: registry.schemaVersion,
    defaultLanguage: registry.defaultLanguage,
    aliases,
    persona,
    segmentation,
    languages,
  };
  const contentHash = createHash('sha256').update(JSON.stringify(base)).digest('hex');
  return `${JSON.stringify({ ...base, contentHash }, null, 2)}\n`;
}

const rendered = await compile();
if (CHECK) {
  let current = '';
  try {
    current = await readFile(OUTPUT, 'utf8');
  } catch {}
  if (current !== rendered) {
    throw new Error('compiled language pack artifact is stale; run pnpm --filter @miithii/language-packs compile');
  }
} else {
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, rendered, 'utf8');
}
