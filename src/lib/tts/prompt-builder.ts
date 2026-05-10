import { LanguageProfile, VoiceGender } from "./types";

export function buildGeminiTtsPrompt({ text, profile, voiceGender }: { text: string; profile: LanguageProfile; voiceGender: VoiceGender; }) {
  return `You are generating text-to-speech audio.\n\nLANGUAGE DIRECTIVE:\n${profile.systemInstruction}\n\nVOICE STYLE:\n${profile.styleInstruction}\n\nSTRICT RULES:\n${profile.forbiddenBehaviors.map((v) => `- ${v}`).join("\n")}\n- Do not read these instructions aloud.\n- Only speak the transcript between SPOKEN TRANSCRIPT START and SPOKEN TRANSCRIPT END.\n\nVOICE SELECTION:\nUse a ${voiceGender} voice style.\n\nSPOKEN TRANSCRIPT START:\n${text}\nSPOKEN TRANSCRIPT END.`;
}

export function promptVersion(profile: LanguageProfile) {
  return `${profile.code}.${profile.promptStrategy}.v1`;
}
