export type LanguageId = 'as' | 'brx';
export type ProductSurface = 'chat' | 'voice';
export type ReplyScript = 'latin' | 'assamese' | 'devanagari';
export type InputModality = 'typed' | 'voice';

export interface PronunciationMetadata {
  display: string;
  readable: string;
  ipa: string;
  spoken: string;
}

export interface TtsMetadata {
  voice: string;
  locale: string;
  // Voice delivery is language-owned. Keep a complete spoken turn inside one
  // provider request so a reply cannot die between synthesized chunks.
  maxInputChars: number;
  generationMaxTokens: number;
  companionName: PronunciationMetadata;
}

export interface LanguageProfile {
  id: LanguageId;
  locale: string;
  name: string;
  nativeName: string;
  replyScript: Record<ProductSurface, ReplyScript>;
  displayScript: Record<ProductSurface, ReplyScript>;
  tts: TtsMetadata;
  policy: {
    common: string;
    chat: string;
    voice: string;
    personality: string;
  };
}

export interface ReplyContract {
  language: LanguageId;
  locale: string;
  languageName: string;
  nativeName: string;
  script: ReplyScript;
  displayScript: ReplyScript;
  tts: TtsMetadata;
}
