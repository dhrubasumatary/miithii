import { VoiceGender } from "./types";

const defaultVoiceMap = { male: "Puck", female: "Kore" };
const voiceMapByLanguage: Record<string, { male: string; female: string }> = {
  "as-IN": { male: "Puck", female: "Kore" },
  "brx-IN": { male: "Puck", female: "Kore" },
  "mni-IN": { male: "Puck", female: "Kore" },
};

export function resolveVoiceName(languageCode: string, gender: VoiceGender) {
  return (voiceMapByLanguage[languageCode] || defaultVoiceMap)[gender];
}
