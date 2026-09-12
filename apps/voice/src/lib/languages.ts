// Voice interface languages. Assamese is the default; both paths are backed by
// the same Bodhan STT/TTS contract used by the production Voice Worker.
export const DEFAULT_LANGUAGE = "as";

// Codes follow the Bodhan.AI convention (ISO 639-3 for Indic languages).
// STT: https://console.bodhan.ai/api-docs/#speech-to-text-api
// TTS `instructions.lang`: https://console.bodhan.ai/api-docs/#text-to-speech-api
export const VOICE_LANGUAGES = {
  as: { label: "অসমীয়া", english: "Assamese", ttsVoice: "Prastuti" },
  brx: { label: "बड़ो", english: "Bodo", ttsVoice: "Gwrbw" },
} as const;

export type VoiceLanguageCode = keyof typeof VOICE_LANGUAGES;

export function isVoiceLanguage(code: string): code is VoiceLanguageCode {
  return code in VOICE_LANGUAGES;
}
