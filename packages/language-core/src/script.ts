import type { ReplyScript } from './types.ts';

const SCRIPT_PATTERNS: Record<ReplyScript, RegExp> = {
  latin: /\p{Script=Latin}/u,
  // Unicode names the shared Assamese/Bengali writing system "Bengali".
  assamese: /\p{Script=Bengali}/u,
  devanagari: /\p{Script=Devanagari}/u
};

const FOREIGN_SCRIPT_PATTERNS: Record<ReplyScript, RegExp[]> = {
  // Use Unicode Script rather than numeric blocks. Shared Indic punctuation
  // such as danda U+0964 is Script=Common and must not make a valid Assamese
  // sentence look like accidental Devanagari output.
  latin: [/\p{Script=Bengali}/u, /\p{Script=Devanagari}/u],
  assamese: [/\p{Script=Devanagari}/u],
  devanagari: [/\p{Script=Bengali}/u]
};

export interface ScriptValidation {
  valid: boolean;
  expected: ReplyScript;
  hasExpectedScript: boolean;
  hasUnexpectedIndicScript: boolean;
}

export function validateOutputScript(text: string, expected: ReplyScript): ScriptValidation {
  const content = text.trim();
  const hasExpectedScript = SCRIPT_PATTERNS[expected].test(content);
  const hasUnexpectedIndicScript = FOREIGN_SCRIPT_PATTERNS[expected].some(pattern => pattern.test(content));
  // A reply with letters is valid only when it contains the configured script;
  // callers handling exact names, URLs, code or quotations can use the detailed
  // flags to apply task-specific exemptions. A conflicting Indic script is a
  // hard contract violation for these product reply modes.
  return {
    valid: !hasUnexpectedIndicScript && (hasExpectedScript || !/\p{Letter}/u.test(content)),
    expected,
    hasExpectedScript,
    hasUnexpectedIndicScript
  };
}

export function containsScript(text: string, script: ReplyScript): boolean {
  return SCRIPT_PATTERNS[script].test(text);
}
