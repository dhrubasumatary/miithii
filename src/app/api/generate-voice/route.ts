import { NextResponse } from "next/server";
import { getLanguageProfile } from "@/lib/tts/language-profiles";
import { chunkTextForTts } from "@/lib/tts/chunker";
import { buildGeminiTtsPrompt, promptVersion } from "@/lib/tts/prompt-builder";
import { resolveVoiceName } from "@/lib/tts/voice-map";
import { estimateDurationSeconds } from "@/lib/tts/duration";
import { VoiceGender } from "@/lib/tts/types";

export async function POST(req: Request) {
  try {
    const { text, languageCode, voiceGender } = await req.json();
    if (!text || typeof text !== "string") return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (!["male", "female"].includes(voiceGender)) return NextResponse.json({ error: "voiceGender must be male or female" }, { status: 400 });
    const trimmed = text.trim();
    if (trimmed.length > 8000) return NextResponse.json({ error: "Text too long" }, { status: 400 });

    const profile = getLanguageProfile(languageCode);
    const chunks = chunkTextForTts(trimmed, profile.maxChunkChars);
    const voiceName = resolveVoiceName(profile.code, voiceGender as VoiceGender);
    const model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      return NextResponse.json({ languageCode: profile.code, voiceGender, voiceName, promptVersion: promptVersion(profile), estimatedDurationSeconds: estimateDurationSeconds(trimmed, profile), chunks: chunks.map((c, i) => ({ index: i, audioBase64: "UklGRigAAABXQVZFZm10IBAAAAABAAEA", mimeType: "audio/wav", textLength: c.length })) });
    }

    const out = [] as Array<{ index: number; audioBase64: string; mimeType: string; textLength: number }>;
    for (let i = 0; i < chunks.length; i++) {
      const prompt = buildGeminiTtsPrompt({ text: chunks[i], profile, voiceGender });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } } }) });
      const data = await r.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("No audio returned by Gemini");
      out.push({ index: i, audioBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || "audio/wav", textLength: chunks[i].length });
    }

    return NextResponse.json({ languageCode: profile.code, voiceGender, voiceName, promptVersion: promptVersion(profile), estimatedDurationSeconds: estimateDurationSeconds(trimmed, profile), chunks: out });
  } catch (e) {
    console.error("generate-voice error", e);
    return NextResponse.json({ error: "Voice generation is unavailable right now." }, { status: 500 });
  }
}
