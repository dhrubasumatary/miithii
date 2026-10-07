/**
 * Turning generated text and spoken text into what the screen is allowed to claim.
 *
 * The reply arrives on two independent streams. The preview is the text as the model
 * produces it, which is available long before any audio exists. The spoken text is the
 * TTS-aligned transcript, which only advances as sentences are actually played. The
 * synthesizer can take over a second to produce the first sentence, so the gap between the
 * two is large and visible.
 *
 * The rule this module exists to enforce: a sentence may be shown as *spoken* only if the
 * transcript says it was. Generation alone never implies speech, and text left behind by an
 * interruption stays readable but is never relabelled as spoken.
 */

import { splitSentences } from './segment.ts';

export type SentenceDisplayState =
  | 'pending'
  | 'speaking'
  | 'spoken'
  | 'unspoken';

export type ReplySegment = {
  text: string;
  state: SentenceDisplayState;
};

export type AlignmentInput = {
  /** Full generated reply, from the preview stream. */
  preview: string;
  /** Text actually spoken so far, from the TTS-aligned transcript. */
  spoken: string;
  /** True once the turn was interrupted or the session was retired. */
  interrupted: boolean;
};

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * How many characters of `preview` match the start of `spoken`.
 *
 * The two streams are drawn from the same generated answer, so the transcript should be a
 * prefix of the reply. On the current route it is exactly one: `StreamAdapter` publishes a
 * `TimedString` carrying each sentence's own text immediately before that sentence's audio, so
 * the transcript is the tokenizer's sentences rather than anything a provider rebuilt from word
 * timings. A word aligner *can* respell and split Indic conjuncts, which is why this measures
 * agreement instead of trusting the transcript's length - and that is the trap. Subtracting the
 * transcript's own length assumes the two never diverge; the moment they do it marks text as
 * spoken that was never spoken, which is the one thing this module must never do.
 *
 * So the measurement stays, and it is now the only thing standing between a regression and a
 * lie. A divergence here is no longer a provider quirk to absorb: it means the transcript and
 * the preview came from different text, and the highlight stops advancing so the screen
 * under-claims instead of over-claiming.
 */
function spokenPrefixLength(preview: string, spoken: string): number {
  let previewIndex = 0;
  let spokenIndex = 0;

  while (previewIndex < preview.length && spokenIndex < spoken.length) {
    const previewChar = preview.charAt(previewIndex);
    const spokenChar = spoken.charAt(spokenIndex);

    if (/\s/u.test(previewChar)) {
      previewIndex += 1;
      continue;
    }
    if (/\s/u.test(spokenChar)) {
      spokenIndex += 1;
      continue;
    }
    if (previewChar !== spokenChar) break;

    previewIndex += 1;
    spokenIndex += 1;
  }

  return previewIndex;
}

export function alignReply({
  preview,
  spoken,
  interrupted,
}: AlignmentInput): ReplySegment[] {
  const sentences = splitSentences(preview);
  if (sentences.length === 0) return [];

  const normalizedPreview = normalize(preview);
  const spokenLength = spokenPrefixLength(normalizedPreview, normalize(spoken));

  const segments: ReplySegment[] = [];
  let cursor = 0;

  for (const sentence of sentences) {
    const normalizedSentence = normalize(sentence);
    const start = cursor;
    const end = start + normalizedSentence.length;
    // The separator between two sentences belongs to neither of them, so every span advances one
    // character past the sentence before it. This is a rule, not an offset convenience, and the
    // direction it fails in is not the obvious one.
    //
    // `start` is what separates `speaking` from `pending`, and it is the one thing that can mark a
    // sentence as being said. Drop the `+1` and the offsets fall one character short per sentence.
    // The first boundary hides that: `start` lands exactly on the transcript's length and the
    // comparison below is strict, so two sentences still read correctly. The second boundary does
    // not, and from three sentences on a transcript that has finished a whole prefix is misread as
    // having reached into the sentence after it - which is then shown at full ink as being said, on
    // the strength of none of its characters. The same off-by-one launders a divergence at a
    // boundary into evidence of speech, because a transcript that agrees through one sentence and
    // then diverges has matched no character of the next one and still reports `speaking`.
    //
    // Five cases in `alignment.test.ts` fail if this is dropped, and two of them exist only to
    // name this rule: a whole covered prefix must leave the next sentence `pending`, and a
    // transcript that diverges at a boundary must too.
    cursor = end + 1;

    let state: SentenceDisplayState;
    if (end <= spokenLength) {
      state = 'spoken';
    } else if (start < spokenLength) {
      // The transcript reached into this sentence but not through it.
      state = interrupted ? 'unspoken' : 'speaking';
    } else {
      state = interrupted ? 'unspoken' : 'pending';
    }

    segments.push({ text: sentence, state });
  }

  return segments;
}

/** Concatenates the reply for a plain-text rendering, ignoring state. */
export function replyText(segments: ReplySegment[]): string {
  return segments.map((segment) => segment.text).join(' ');
}
