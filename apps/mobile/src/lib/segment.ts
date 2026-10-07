/** Sentence segmentation for display, driven by the same data artifact as the Python agent. */
import { SEGMENTATION_RULES } from '@miithii/language-core-ts';

export const SENTENCE_TERMINATORS = SEGMENTATION_RULES.terminators;

/**
 * Words that end in a period without ending a sentence.
 *
 * Deliberately small. An over-broad list is how a real sentence end gets swallowed, which
 * costs more than a rare abbreviation splitting a sentence.
 */
export const SENTENCE_ABBREVIATIONS = SEGMENTATION_RULES.abbreviations;

/** Characters that stay attached to a sentence after its terminator, e.g. `end."` */
export const SENTENCE_CLOSERS = SEGMENTATION_RULES.closers.join('');

const TERMINATOR_SET = new Set<string>(SENTENCE_TERMINATORS);
const ABBREVIATION_SET = new Set<string>(SENTENCE_ABBREVIATIONS);
const CLOSER_SET = new Set<string>(SENTENCE_CLOSERS);

const DECIMAL = /\d+[.,]\d+/g;
const URL = /\bhttps?:\/\/\S+|\b[\w-]+(?:\.[\w-]+)+\/\S*/g;
const TRAILING_WORD = /([A-Za-z][A-Za-z.]*)$/;

/** Placeholder that cannot occur in reply text, used to hide decimals and URLs. */
const SENTINEL = '\u0000';

function endsWithAbbreviation(head: string): boolean {
  const match = TRAILING_WORD.exec(head.trimEnd());
  if (!match) return false;
  return ABBREVIATION_SET.has(match[1]!.toLowerCase().replace(/\.+$/, ''));
}

/**
 * Split complete text into sentence strings.
 *
 * A terminator only ends a sentence when whitespace or end-of-input follows it. That single
 * rule is what keeps `3.5` and `example.com` intact, so decimals and URLs are additionally
 * hidden behind a sentinel for the cases where a period is surrounded by letters.
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];

  const hidden: string[] = [];
  let protectedText = text;
  // `String.replace` passes the matched text itself, not a match array.
  const hide = (match: string): string => {
    hidden.push(match);
    return `${SENTINEL}${hidden.length - 1}${SENTINEL}`;
  };
  protectedText = protectedText.replace(DECIMAL, hide).replace(URL, hide);

  const sentences: string[] = [];
  let start = 0;

  for (let index = 0; index < protectedText.length; index += 1) {
    const char = protectedText[index]!;
    if (!TERMINATOR_SET.has(char)) continue;

    // Absorb trailing closers so `...end."` stays one sentence.
    let end = index + 1;
    while (end < protectedText.length && CLOSER_SET.has(protectedText[end]!)) end += 1;

    if ('.!?'.includes(char) && endsWithAbbreviation(protectedText.slice(0, index))) {
      continue;
    }

    const remainder = protectedText.slice(end);
    if (remainder && !/^\s/.test(remainder)) continue;

    const candidate = protectedText.slice(start, end).trim();
    if (candidate) sentences.push(candidate);
    start = end;
  }

  const tail = protectedText.slice(start).trim();
  if (tail) sentences.push(tail);

  const restore = (value: string): string =>
    value.replace(
      new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'),
      (_match, id) => hidden[Number(id)]!,
    );

  return sentences.map(restore);
}

/**
 * Cases the app must split the way the canonical reply does.
 *
 * Every entry is a real hazard this pipeline has to survive: Indic terminators, Latin
 * code-switching, decimals, abbreviations, URLs, closing quotes, and text with no terminator
 * at all. If the app and the agent ever disagree on any of these, a sentence would be
 * highlighted differently from how it is spoken.
 */
export const SEGMENTATION_CONFORMANCE: ReadonlyArray<{ text: string; sentences: string[] }> =
  SEGMENTATION_RULES.conformance.map((item) => ({ text: item.text, sentences: [...item.sentences] }));
