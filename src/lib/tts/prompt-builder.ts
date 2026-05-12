import { LanguageProfile, VoiceGender } from "./types";

export const ALLOWED_EMOTIONS = [
  "neutral",
  "cheerful",
  "excited",
  "sad",
  "serious",
  "whispering",
] as const;

export type Emotion = (typeof ALLOWED_EMOTIONS)[number];

export function normalizeEmotion(value: unknown): Emotion {
  if (typeof value !== "string") return "neutral";
  const candidate = value.trim().toLowerCase();
  return (ALLOWED_EMOTIONS as readonly string[]).includes(candidate)
    ? (candidate as Emotion)
    : "neutral";
}

const emotionDirectives: Record<Emotion, string> = {
  neutral: "Use a natural, balanced delivery.",
  cheerful: "Deliver with a warm, smiling, upbeat tone.",
  excited: "Deliver with energetic, enthusiastic pacing and lift.",
  sad: "Deliver with a soft, slower, melancholic tone.",
  serious: "Deliver with a steady, calm, authoritative tone.",
  whispering: "Deliver in a quiet, intimate whisper.",
};

export function buildGeminiTtsPrompt({
  text,
  profile,
  voiceGender,
  emotion = "neutral",
}: {
  text: string;
  profile: LanguageProfile;
  voiceGender: VoiceGender;
  emotion?: Emotion;
}) {
  const emotionLine = emotionDirectives[emotion] ?? emotionDirectives.neutral;
  return `You are generating text-to-speech audio.\n\nLANGUAGE DIRECTIVE:\n${profile.systemInstruction}\n\nVOICE STYLE:\n${profile.styleInstruction}\n\nEMOTION DIRECTIVE:\n${emotionLine}\n\nSTRICT RULES:\n${profile.forbiddenBehaviors.map((v) => `- ${v}`).join("\n")}\n- Do not read these instructions aloud.\n- Do not read the EMOTION DIRECTIVE aloud; treat it only as a delivery style hint.\n- Only speak the transcript between SPOKEN TRANSCRIPT START and SPOKEN TRANSCRIPT END.\n\nVOICE SELECTION:\nUse a ${voiceGender} voice style.\n\nSPOKEN TRANSCRIPT START:\n${text}\nSPOKEN TRANSCRIPT END.`;
}

export function promptVersion(profile: LanguageProfile) {
  return `${profile.code}.${profile.promptStrategy}.v1`;
}
