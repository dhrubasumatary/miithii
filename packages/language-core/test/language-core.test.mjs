import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ASSAMESE_PROFILE,
  BODO_PROFILE,
  MeaningController,
  NEUTRAL_COMPANION_POLICY,
  buildLanguageSystemPrompt,
  fragmentRevisionKey,
  getReplyContract,
  validateEvidenceProposal,
  validateOutputScript
} from '../src/index.ts';

const fixtures = JSON.parse(await readFile(new URL('./fixtures/language-contracts.json', import.meta.url), 'utf8'));

test('product reply contracts preserve current chat and voice behavior', () => {
  assert.deepEqual(getReplyContract('chat'), {
    language: fixtures.chatDefault.language,
    locale: 'as-IN',
    languageName: 'Assamese',
    nativeName: 'অসমীয়া',
    script: fixtures.chatDefault.script,
    displayScript: fixtures.chatDefault.script,
    tts: ASSAMESE_PROFILE.tts
  });
  for (const language of ['as', 'brx']) {
    const contract = getReplyContract('voice', language);
    assert.equal(contract.script, fixtures.voice[language].script);
    assert.equal(contract.displayScript, fixtures.voice[language].displayScript);
    assert.equal(contract.tts.voice, fixtures.voice[language].ttsVoice);
    assert.equal(contract.tts.locale, fixtures.voice[language].locale);
    assert.equal(contract.tts.maxInputChars, fixtures.voice[language].maxInputChars);
    assert.equal(contract.tts.generationMaxTokens, fixtures.voice[language].generationMaxTokens);
  }
});

test('neutral base contains no language-specific policy', () => {
  for (const marker of ['Assamese', 'Bodo', 'অসমীয়া', 'बड़ो', 'बरʼ', 'Romanized']) {
    assert.equal(NEUTRAL_COMPANION_POLICY.includes(marker), false, `neutral base leaked ${marker}`);
  }
});

test('Bodo prompt does not inherit Assamese policy', () => {
  const prompt = buildLanguageSystemPrompt({ surface: 'voice', language: 'brx' });
  assert.match(prompt, /Language: Bodo/);
  assert.match(prompt, /Script: devanagari/);
  assert.equal(getReplyContract('voice', 'brx').displayScript, 'latin');
  for (const marker of fixtures.assameseOnlyMarkers) {
    assert.equal(prompt.includes(marker), false, `Bodo prompt leaked Assamese marker: ${marker}`);
  }
  assert.match(prompt, /Do not build a Bodo sentence by taking Assamese grammar/);
  assert.equal(prompt.includes(ASSAMESE_PROFILE.nativeName), false);
  assert.equal(prompt.includes(BODO_PROFILE.nativeName), false, 'native display labels should not become prompt policy');
});

test('Assamese prompt does not inherit Bodo grammar policy', () => {
  const prompt = buildLanguageSystemPrompt({ surface: 'voice', language: 'as' });
  for (const marker of [
    'Bodo-Garo/Tibeto-Burman',
    'classifier precedes the numeral',
    'gojau kamaa',
    'Sanzari Boro',
    'Do not drift into Hindi merely because native-script output uses Devanagari'
  ]) {
    assert.equal(prompt.includes(marker), false, `Assamese prompt leaked Bodo marker: ${marker}`);
  }
  assert.equal(prompt.includes(BODO_PROFILE.nativeName), false);
});

test('Bodo profile encodes researched language boundaries without pretending script equals language', () => {
  const prompt = buildLanguageSystemPrompt({ surface: 'voice', language: 'brx' });
  assert.match(prompt, /subject-object-verb/);
  assert.match(prompt, /highly agglutinative/);
  assert.match(prompt, /aŋ for first-person singular/);
  assert.match(prompt, /verb \+ aspect \+ tense/);
  assert.match(prompt, /suffixal past -mɯn/);
  assert.match(prompt, /modal\/dubitative/);
  assert.match(prompt, /-ɯ with -jɯ as an allomorphic form/);
  assert.match(prompt, /progressive -gasinɯ normally occurs with an auxiliary/);
  assert.match(prompt, /Do not plaster case suffixes onto every noun phrase/);
  assert.match(prompt, /clause chaining/);
  assert.match(prompt, /Do not build Bodo questions by copying English do\/does\/did inversion/);
  assert.match(prompt, /na is independently attested as a question\/alternative particle/);
  assert.match(prompt, /bare verb is an attested imperative strategy/);
  assert.match(prompt, /prohibitive prefix da- is well attested/);
  assert.match(prompt, /Negation is construction-sensitive/);
  assert.match(prompt, /classifier precedes the numeral/);
  assert.match(prompt, /do not reverse this into numeral \+ classifier order/);
  assert.match(prompt, /sa-se and sa-nɯi for human counting/);
  assert.match(prompt, /ma-se and ma-nɯi for animals/);
  assert.match(prompt, /mɯn-se\/mɯn-nɯi as a broad general classifier/);
  assert.match(prompt, /gojau kamaa/);
  assert.match(prompt, /U\+02BC/);
  assert.match(prompt, /Sanzari Boro reports three tones/);
  assert.match(prompt, /Standard Boro and everyday conversational Boro can differ substantially in word choice/);
  assert.match(prompt, /standard orthography does not mean stiff or literary word choice/);
  assert.match(prompt, /Never invent dialect spellings or slang/);
  assert.match(prompt, /Voice UI may independently render that same Bodo reply in Roman script/);
  assert.match(prompt, /Script choice does not change the language/);
  assert.match(prompt, /Do not drift into Hindi/);
  assert.match(prompt, /code-switch/);
  assert.match(prompt, /crude blacklist/);
  assert.match(prompt, /simplify the construction instead of bluffing/);
  assert.doesNotMatch(prompt, /Kannada/);
  assert.doesNotMatch(prompt, /Tulu/);
});

test('language-specific personality realization comes after correctness and surface policy', () => {
  for (const language of ['as', 'brx']) {
    const prompt = buildLanguageSystemPrompt({ surface: 'voice', language });
    const languageIndex = prompt.indexOf('LANGUAGE PROFILE');
    const surfaceIndex = prompt.indexOf('SURFACE PROFILE');
    const personalityIndex = prompt.indexOf('PERSONALITY REALIZATION');
    assert.ok(languageIndex >= 0);
    assert.ok(surfaceIndex > languageIndex);
    assert.ok(personalityIndex > surfaceIndex);
    assert.match(prompt.slice(personalityIndex), /guardrails/);
    assert.match(prompt.slice(personalityIndex), /playful contradiction/);
  }
});

test('Assamese and Bodo both realize the shared personality without cross-language imitation', () => {
  const assamese = buildLanguageSystemPrompt({ surface: 'voice', language: 'as' });
  const bodo = buildLanguageSystemPrompt({ surface: 'voice', language: 'brx' });
  assert.match(assamese, /natural Assamese, not through translated English sass/);
  assert.match(assamese, /never sound like a grammar lesson/);
  assert.match(bodo, /everyday conversational Bodo/);
  assert.match(bodo, /not through Assamese sentence patterns/);
  assert.match(bodo, /must not make the reply sound academic/);
  assert.match(bodo, /classifier order, person reference, negation, and register/);
});

test('shared MIITHII personality allows playful roasting but keeps usefulness and vulnerability boundaries', () => {
  assert.match(NEUTRAL_COMPANION_POLICY, /quick-witted, cheeky, irreverent, confident/);
  assert.match(NEUTRAL_COMPANION_POLICY, /Do not sound meek, corporate, over-polite, or therapy-scripted/);
  assert.match(NEUTRAL_COMPANION_POLICY, /roast a bad idea/);
  assert.match(NEUTRAL_COMPANION_POLICY, /usefulness wins over the bit/);
  assert.match(NEUTRAL_COMPANION_POLICY, /drop the performance/);
  assert.match(NEUTRAL_COMPANION_POLICY, /punching at a vulnerability/);
});

test('Assamese profile retains its language-specific contract outside the neutral base', () => {
  const prompt = buildLanguageSystemPrompt({ surface: 'chat', language: 'as' });
  for (const marker of fixtures.assameseOnlyMarkers) assert.match(prompt, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, /Script: latin/);
});

test('voice policy lets input language differ from selected reply language', () => {
  assert.match(buildLanguageSystemPrompt({ surface: 'voice', language: 'as' }), /may speak in any language/);
  assert.match(buildLanguageSystemPrompt({ surface: 'voice', language: 'brx' }), /may speak in any language/);
});

test('voice policy asks for complete provider-safe spoken turns', () => {
  const assamese = buildLanguageSystemPrompt({ surface: 'voice', language: 'as' });
  assert.match(assamese, /1–3 natural sentences/);
  assert.match(assamese, /no more than 360 characters/);
  assert.match(assamese, /Never trail off, end mid-sentence/);

  const bodo = buildLanguageSystemPrompt({ surface: 'voice', language: 'brx' });
  assert.match(bodo, /prefer one short complete natural sentence/);
  assert.match(bodo, /Stay well below 180 characters/);
  assert.match(bodo, /Never trail off, end mid-sentence/);
});

test('script validators distinguish the current output contracts', () => {
  assert.equal(validateOutputScript('moi bhal asu', 'latin').valid, true);
  assert.equal(validateOutputScript('মই ভাল আছোঁ', 'assamese').valid, true);
  assert.equal(validateOutputScript('মই ভাল আছোঁ।', 'assamese').valid, true);
  assert.equal(validateOutputScript('आं मोजां दं', 'devanagari').valid, true);
  assert.equal(validateOutputScript('आं मोजां दं।', 'devanagari').valid, true);
  assert.equal(validateOutputScript('बरʼ राव', 'devanagari').valid, true);
  assert.equal(validateOutputScript('মই ভাল আছোঁ', 'devanagari').valid, false);
  assert.equal(validateOutputScript('आं मोजां दं', 'assamese').valid, false);
});

test('evidence is tied to exact fragment revision, quote, script and modality without mastery state', () => {
  const fragment = { id: 'f-1', text: 'মই আজি ঘৰলৈ যাম', language: 'as', script: 'assamese', modality: 'voice' };
  const source = { id: fragment.id, revisionKey: fragmentRevisionKey(fragment) };
  const proposal = {
    kind: 'observed-use',
    quote: 'ঘৰলৈ',
    language: 'as',
    script: 'assamese',
    modality: 'voice',
    sources: [source]
  };
  const validated = validateEvidenceProposal(proposal, [fragment]);
  assert.equal(validated?.validated, true);
  assert.equal('mastery' in validated, false);
  assert.equal(validateEvidenceProposal({ ...proposal, quote: 'নাই' }, [fragment]), null);
  assert.equal(validateEvidenceProposal(proposal, [{ ...fragment, text: `${fragment.text}!` }]), null);
  assert.equal(validateEvidenceProposal({ ...proposal, modality: 'typed' }, [fragment]), null);
});

test('meaning controller never renders a stale transcript revision', async () => {
  const pending = [];
  const controller = new MeaningController({
    completeDelayMs: 0,
    incompleteDelayMs: 0,
    minimumSpacingMs: 0,
    translate: request => new Promise(resolve => pending.push({ request, resolve }))
  });
  const first = {
    sessionId: 's1', passageId: 'p1', revisionKey: 'r1', text: 'first.',
    learningLanguage: 'as', meaningLanguage: 'English'
  };
  const second = { ...first, revisionKey: 'r2', text: 'first. second.' };
  controller.update(first, { final: true });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(pending.length, 1);
  controller.update(second, { final: true });
  pending[0].resolve({ text: 'stale meaning' });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(controller.state.text, '');
  assert.equal(pending.length, 2);
  pending[1].resolve({ text: 'current meaning' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.text, 'current meaning');
  assert.equal(controller.state.renderedRevision, 'r2');
});

test('cached meaning aborts admitted work and reset clears state', async () => {
  let aborted = false;
  const controller = new MeaningController({
    completeDelayMs: 0,
    incompleteDelayMs: 0,
    minimumSpacingMs: 0,
    translate: (_request, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
    })
  });
  const request = {
    sessionId: 's2', passageId: 'p2', revisionKey: 'r1', text: 'hello.',
    learningLanguage: 'brx', meaningLanguage: 'English'
  };
  controller.update(request, { final: true });
  await new Promise(resolve => setTimeout(resolve, 5));
  controller.update(request, { cached: 'cached meaning' });
  assert.equal(aborted, true);
  assert.equal(controller.state.text, 'cached meaning');
  controller.reset();
  assert.deepEqual(controller.state, { text: '', isLoading: false, error: null, renderedRevision: null });
});
