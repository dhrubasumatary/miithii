import { DetectionResult, LanguageProfile } from "./types";

const profiles: Record<string, LanguageProfile> = {
  "as-IN": { code: "as-IN", displayName: "Assamese", nativeName: "অসমীয়া", scripts: ["Bengali-Assamese"], qualityStatus: "beta", estimatedWpm: 130, maxChunkChars: 1200, promptStrategy: "strict", accentMode: "Strict Assamese retention", systemInstruction: "Read aloud in Assamese only. Use natural Assamese accent from Northeast India. Do not pronounce it like Bengali. Do not pronounce it like Hindi. Do not translate, summarize, correct, or rewrite. Preserve every word exactly as written. Use clean professional narration.", styleInstruction: "Warm, natural narration with stable Assamese cadence.", forbiddenBehaviors: ["Do not translate the text", "Do not skip, add, or reorder words", "Do not switch accent to Bengali or Hindi"] },
  "brx-IN": { code: "brx-IN", displayName: "Bodo", nativeName: "बड़ो", scripts: ["Devanagari", "Latin"], qualityStatus: "beta", estimatedWpm: 125, maxChunkChars: 1200, promptStrategy: "light", accentMode: "Pure Bodo pronunciation", systemInstruction: "Read aloud in pure Bodo accent. Do not translate into Hindi, Assamese, Bengali, or English. Preserve text exactly. Use natural Bodo pronunciation and clear articulation.", styleInstruction: "Neutral premium narration with clear Bodo articulation.", forbiddenBehaviors: ["Do not translate the text", "Do not normalize words", "Do not drift into Hindi/Assamese/Bengali pronunciation"] },
  "mni-IN": { code: "mni-IN", displayName: "Manipuri", nativeName: "ꯃꯤꯇꯩꯂꯣꯟ", scripts: ["Meitei Mayek", "Bengali-Assamese", "Latin"], qualityStatus: "experimental", estimatedWpm: 125, maxChunkChars: 1000, promptStrategy: "strict", accentMode: "Experimental Meiteilon mode", systemInstruction: "Read aloud in Manipuri, also known as Meiteilon. Do not translate into Hindi, Bengali, Assamese, or English. Preserve original words exactly. Use natural Manipuri pronunciation and sentence rhythm.", styleInstruction: "Respect sentence rhythm and pause naturally.", forbiddenBehaviors: ["Do not translate the text", "Do not rewrite spelling", "Do not switch to Hindi/Bengali/Assamese"] },
  "hi-IN": { code: "hi-IN", displayName: "Hindi", nativeName: "हिन्दी", scripts: ["Devanagari"], qualityStatus: "stable", estimatedWpm: 135, maxChunkChars: 1200, promptStrategy: "default", accentMode: "Indian Hindi", systemInstruction: "Read aloud in Hindi and preserve wording exactly.", styleInstruction: "Professional and natural Indian narration.", forbiddenBehaviors: ["Do not translate the text"] },
  "bn-IN": { code: "bn-IN", displayName: "Bengali", nativeName: "বাংলা", scripts: ["Bengali"], qualityStatus: "stable", estimatedWpm: 135, maxChunkChars: 1200, promptStrategy: "default", accentMode: "Indian Bengali", systemInstruction: "Read aloud in Bengali and preserve wording exactly.", styleInstruction: "Professional and natural Indian narration.", forbiddenBehaviors: ["Do not translate the text"] },
  "en-IN": { code: "en-IN", displayName: "Indian English", nativeName: "Indian English", scripts: ["Latin"], qualityStatus: "stable", estimatedWpm: 145, maxChunkChars: 1500, promptStrategy: "default", accentMode: "Indian English", systemInstruction: "Read aloud in Indian English and preserve wording exactly.", styleInstruction: "Clear neutral Indian English narration.", forbiddenBehaviors: ["Do not paraphrase"] },
  unknown: { code: "unknown", displayName: "Detected language", nativeName: "Detected language", scripts: ["Unknown"], qualityStatus: "beta", estimatedWpm: 130, maxChunkChars: 1000, promptStrategy: "default", accentMode: "Indian multilingual professional", systemInstruction: "Read aloud naturally in the original language of the text. Do not translate and preserve words exactly.", styleInstruction: "Professional and neutral narration.", forbiddenBehaviors: ["Do not translate", "Do not summarize"] },
};

const profileAliases: Record<string, string> = {
  as: "as-IN",
  assamese: "as-IN",
  brx: "brx-IN",
  bodo: "brx-IN",
  mni: "mni-IN",
  manipuri: "mni-IN",
  meiteilon: "mni-IN",
  hi: "hi-IN",
  hindi: "hi-IN",
  bn: "bn-IN",
  bengali: "bn-IN",
  en: "en-IN",
  english: "en-IN",
};

export function resolveLanguageCode(code?: string): string {
  const key = (code || "").trim();
  if (!key) return "unknown";
  if (profiles[key]) return key;
  return profileAliases[key.toLowerCase()] || "unknown";
}

export function getLanguageProfile(code?: string): LanguageProfile { return profiles[resolveLanguageCode(code)] || profiles.unknown; }
export function getAllLanguageProfiles() { return profiles; }
export function makeDetectionFromProfile(code: string, confidence = 0.7, script?: string): DetectionResult { const p = getLanguageProfile(code); return { languageCode: p.code, languageName: p.displayName, nativeName: p.nativeName, script: script || p.scripts[0] || "Unknown", confidence, detectionSource: "sarvam+custom-rules", accentMode: p.accentMode, qualityStatus: p.qualityStatus }; }
