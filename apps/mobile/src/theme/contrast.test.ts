import test from 'node:test';
import assert from 'node:assert/strict';

import { palettes } from './tokens.ts';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('the language label accent meets normal-text contrast in both themes', () => {
  for (const palette of Object.values(palettes)) {
    for (const language of ['asm', 'brx'] as const) {
      assert.ok(
        contrast(palette.accent[language].tint, palette.surface.ink) >= 4.5,
        `${language} accent does not meet 4.5:1 against the ${palette === palettes.light ? 'light' : 'dark'} surface`,
      );
    }
  }
});
