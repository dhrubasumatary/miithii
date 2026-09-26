import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  LANGUAGE_POLICY_VERSION,
  LANGUAGE_PROFILES,
  VOICE_DEFAULT_LANGUAGE,
  getReplyContract,
} from '../src/index.ts';

const outputUrl = new URL('../../../services/voice-rtc/contracts/voice-contracts.json', import.meta.url);

const contracts = Object.fromEntries(
  Object.keys(LANGUAGE_PROFILES).map((language) => {
    const contract = getReplyContract('voice', language);
    return [language, {
      language: contract.language,
      locale: contract.locale,
      languageName: contract.languageName,
      nativeName: contract.nativeName,
      script: contract.script,
      displayScript: contract.displayScript,
      tts: contract.tts,
    }];
  }),
);

const artifact = `${JSON.stringify({
  schemaVersion: 1,
  policyVersion: LANGUAGE_POLICY_VERSION,
  defaultLanguage: VOICE_DEFAULT_LANGUAGE,
  contracts,
}, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const existing = await readFile(outputUrl, 'utf8').catch(() => '');
  if (existing !== artifact) {
    console.error(`Voice contract artifact is stale: ${fileURLToPath(outputUrl)}`);
    console.error('Run: pnpm --filter @miithii/language-core export:voice-contracts');
    process.exitCode = 1;
  }
} else {
  await writeFile(outputUrl, artifact, 'utf8');
  console.log(`Wrote ${fileURLToPath(outputUrl)}`);
}
