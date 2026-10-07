import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEGMENTATION_CONFORMANCE, splitSentences } from './segment.ts';

/**
 * The app splits the reply to decide which sentence gets which highlight state, and the agent
 * splits the same reply to decide what is spoken. If the two disagree, the highlight lands on
 * the wrong words, so the corpus is the contract.
 */
describe('splitSentences', () => {
  it('agrees with the canonical corpus on every hazard', () => {
    for (const { text, sentences } of SEGMENTATION_CONFORMANCE) {
      assert.deepEqual(
        splitSentences(text),
        sentences,
        `split of ${JSON.stringify(text)} did not match the corpus`,
      );
    }
  });

  it('returns nothing for text with no sentences at all', () => {
    assert.deepEqual(splitSentences(''), []);
    assert.deepEqual(splitSentences('   \n\t '), []);
  });

  it('never returns a sentence that is only whitespace', () => {
    for (const { text } of SEGMENTATION_CONFORMANCE) {
      for (const sentence of splitSentences(text)) {
        assert.notEqual(sentence.trim(), '', `blank sentence from ${JSON.stringify(text)}`);
      }
    }
  });

  /**
   * `alignReply` measures how far the transcript has advanced by comparing character offsets
   * into the reply, and it derives each sentence's span from the sentence's own length. That is
   * only sound if joining the sentences with one space reproduces the reply with all runs of
   * whitespace collapsed - otherwise the spans drift and the highlight marks text that was
   * never spoken.
   */
  it('rejoins into the reply when whitespace is collapsed', () => {
    for (const { text } of SEGMENTATION_CONFORMANCE) {
      const collapsed = text.replace(/\s+/g, ' ').trim();
      const rejoined = splitSentences(text).join(' ');
      assert.equal(rejoined, collapsed, `rejoin of ${JSON.stringify(text)} drifted`);
    }
  });
});
