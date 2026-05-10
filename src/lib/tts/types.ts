export type LanguageQualityStatus = "stable" | "beta" | "experimental";
export type PromptStrategy = "strict" | "light" | "experimental" | "default";
export type VoiceGender = "male" | "female";

export type LanguageProfile = {
  code: string;
  displayName: string;
  nativeName: string;
  scripts: string[];
  qualityStatus: LanguageQualityStatus;
  estimatedWpm: number;
  maxChunkChars: number;
  promptStrategy: PromptStrategy;
  accentMode: string;
  systemInstruction: string;
  styleInstruction: string;
  forbiddenBehaviors: string[];
};

export type DetectionResult = {
  languageCode: string;
  languageName: string;
  nativeName: string;
  script: string;
  confidence: number;
  detectionSource: string;
  accentMode: string;
  qualityStatus: LanguageQualityStatus;
};
