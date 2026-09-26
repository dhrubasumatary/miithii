import { LANGUAGE_PROFILES, VOICE_DEFAULT_LANGUAGE } from "@miithii/language-core";

// Voice interface labels are projections of the shared language contract.
// Provider voices and reply scripts live in @miithii/language-core so the UI,
// Voice Worker, and API cannot silently diverge.
export const DEFAULT_LANGUAGE = VOICE_DEFAULT_LANGUAGE;

// Codes follow the Bodhan.AI convention (ISO 639-3 for Indic languages).
// STT: https://console.bodhan.ai/api-docs/#speech-to-text-api
// TTS `instructions.lang`: https://console.bodhan.ai/api-docs/#text-to-speech-api
export const VOICE_LANGUAGES = {
  as: {
    label: LANGUAGE_PROFILES.as.nativeName,
    english: LANGUAGE_PROFILES.as.name,
    speechScript: LANGUAGE_PROFILES.as.replyScript.voice,
    displayScript: LANGUAGE_PROFILES.as.displayScript.voice,
  },
  brx: {
    label: LANGUAGE_PROFILES.brx.nativeName,
    english: LANGUAGE_PROFILES.brx.name,
    speechScript: LANGUAGE_PROFILES.brx.replyScript.voice,
    displayScript: LANGUAGE_PROFILES.brx.displayScript.voice,
  },
} as const;

export type VoiceLanguageCode = keyof typeof VOICE_LANGUAGES;
