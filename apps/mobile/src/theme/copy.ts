import { type LanguageId, languageOption } from '@miithii/language-core-ts';

/**
 * Every word the app speaks, in the app's own languages.
 *
 * The surface is small on purpose: a state, an action, a short recovery line, and the names of
 * the two languages. English is kept only where it is genuinely structural - the wordmark and
 * the "YOU" eyebrow, which is a speaker label rather than language content.
 *
 * **All chrome is English in this build, and that is a gate, not a decision.** Native-language
 * production copy needs reviewer metadata like any other native-language content, and the
 * repository rule is that LLM-written native copy never ships. So the Assamese and Bodo tables
 * below are complete and identical, and translating them is a separate, reviewed piece of work.
 * What is *not* allowed is a key missing from one table and falling back to the other: a
 * Bodo speaker seeing a line of Assamese is worse than seeing English, which at least reads as
 * "this is the app's own language and it is not mine yet".
 *
 * The exception is anything drawn from the language pack itself - a language's own name, its
 * accent colour, its font. Those are not copy. They are the pack's data, and they are correct
 * by construction because the pack is the authority.
 */
export type ReplyLanguage = LanguageId;

const ASSAMESE = {
  // Product states only. No transport, model, synthesis, room, or repair terminology belongs
  // here: a person should understand the screen without knowing how voice is implemented.
  statusOff: 'UNAVAILABLE',
  statusIdle: 'READY',
  statusConnecting: 'STARTING',
  statusEnding: 'ENDING',
  statusListening: 'LISTENING',
  statusThinking: 'RESPONDING',
  statusSynthesizing: 'PREPARING VOICE',
  statusSpeaking: 'SPEAKING',
  statusFailed: 'NOT CONNECTED',

  // Start and End are taps; Clear asks for confirmation.
  consoleStart: 'START CONVERSATION',
  consoleStop: 'END CONVERSATION',
  consoleRetry: 'TRY AGAIN',
  consoleReset: 'CLEAR CONVERSATION',

  // Header and sheets.
  eyebrowYou: 'YOU',
  eyebrowMiithii: 'MIITHII',
  generated: 'NOT YET SPOKEN',
  interrupted: 'REPLY INTERRUPTED · QUIET TEXT WAS NOT SPOKEN',
  shortened: 'Reply shortened. You can ask Miithii to continue.',
  languageTitle: 'REPLY LANGUAGE',
  languageNote: 'Changing language starts a new conversation.',
  languageCancel: 'CANCEL',

  // Empty states say the next useful action and stop there.
  inviteUnavailable: "Voice isn't available right now.",
  inviteStart: 'Tap Start, then talk.',
  inviteSpeak: 'Go ahead.',
  // Shown only while a connection is being established, so the face is not telling the user to
  // tap a control that already reads CANCEL.
  inviteStarting: 'One moment.',
  inviteFailed: 'Could not connect.',
  helpStart: 'Start, then speak naturally. Pause for a reply.',
  helpLive: 'Talk naturally. You can interrupt a reply by speaking.',
  helpStarting: 'Connecting your conversation. You can cancel below.',
  helpFailed: 'Check your connection, then tap Try again.',
  helpEnding: 'Turning off your microphone.',
  helpMuted: 'Your microphone is muted. Tap the mic to speak again.',
  micMuted: 'MIC MUTED',

  // A rejected generated reply is an internal quality failure, not something the user needs an
  // explanation of. The only useful UI is the recovery action.
  withheld: 'Try that again.',
} as const;

const BODO = { ...ASSAMESE };

export type Copy = typeof ASSAMESE;

export function stringsFor(language: ReplyLanguage): Copy {
  return language === 'brx' ? BODO : ASSAMESE;
}

/**
 * A language's name, in that language, and in Latin beside it.
 *
 * Both come from the language pack rather than from here, because the pack is the authority on
 * what a language is called. Duplicating the name in a design file would create a second
 * source of truth that could disagree with the pack - and a language name printed in the wrong
 * script is a mistake no test in this file would catch.
 */
export function nativeLanguageName(language: ReplyLanguage): string {
  return languageOption(language).nativeLabel;
}

export function latinLanguageName(language: ReplyLanguage): string {
  return languageOption(language).label;
}

/** Zero-padded, so a turn counter does not change width as it counts. */
export function count(value: number): string {
  return String(Math.max(0, value)).padStart(2, '0');
}

/**
 * Elapsed time, as a fixed-width readout.
 *
 * A wait is the one place a voice app feels broken, and this is the reason it should not: a
 * number that is visibly counting is progress, where a spinner is a request for patience. The
 * width is fixed at `SS.T` so the readout does not jitter sideways once a second, which is
 * exactly the kind of small wrongness that makes an interface feel cheap.
 */
export function elapsed(ms: number): string {
  const tenths = Math.max(0, ms) / 100;
  const whole = Math.floor(tenths / 10);
  const fraction = Math.floor(tenths % 10);
  return `${String(whole).padStart(2, '0')}.${fraction}`;
}
