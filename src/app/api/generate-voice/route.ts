import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLanguageProfile } from "@/lib/tts/language-profiles";
import { chunkTextForTts } from "@/lib/tts/chunker";
import { buildGeminiTtsPrompt, promptVersion } from "@/lib/tts/prompt-builder";
import { resolveVoiceName } from "@/lib/tts/voice-map";
import { estimateDurationSeconds } from "@/lib/tts/duration";
import { VoiceGender } from "@/lib/tts/types";
import { estimateGenerationBilling, TRIAL_MAX_GENERATION_MINUTES } from "@/lib/billing/pricing";
import { getUserCreditSummary, grantFreeTrialIfNeeded, recordGenerationSuccess } from "@/lib/billing/ledger";
import { createSignedAudioUrl, isSupabaseConfigured } from "@/lib/supabase/server";

function pcmToWav(pcmData: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4); // file size
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcmData.copy(buffer, 44);
  return buffer;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const requireAuth =
      process.env.NODE_ENV === "production" || process.env.MIITHII_REQUIRE_AUTH_FOR_GENERATION === "true";

    if (requireAuth && !userId) {
      return NextResponse.json(
        { error: "Sign in to generate voice files.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const { text, languageCode, voiceGender } = await req.json();
    if (!text || typeof text !== "string") return NextResponse.json({ error: "Text is required" }, { status: 400 });
    if (!["male", "female"].includes(voiceGender)) return NextResponse.json({ error: "voiceGender must be male or female" }, { status: 400 });
    const trimmed = text.trim();
    if (trimmed.length > 8000) return NextResponse.json({ error: "Text too long" }, { status: 400 });

    const profile = getLanguageProfile(languageCode);
    const chunks = chunkTextForTts(trimmed, profile.maxChunkChars);
    const voiceName = resolveVoiceName(profile.code, voiceGender as VoiceGender);
    const estimatedDuration = estimateDurationSeconds(trimmed, profile);
    const billing = estimateGenerationBilling(estimatedDuration);
    const model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
    const key = process.env.GEMINI_API_KEY;
    const creditGateEnabled =
      process.env.NODE_ENV === "production" || process.env.MIITHII_ENABLE_CREDIT_GATE === "true";

    if (creditGateEnabled) {
      if (!userId) {
        return NextResponse.json({ error: "Sign in to generate voice files.", code: "AUTH_REQUIRED" }, { status: 401 });
      }

      if (!isSupabaseConfigured()) {
        return NextResponse.json({ error: "Credit ledger is not configured.", code: "CREDIT_LEDGER_NOT_CONFIGURED" }, { status: 503 });
      }

      await grantFreeTrialIfNeeded(userId);

      const creditSummary = await getUserCreditSummary(userId);
      if (Number(creditSummary.balanceMinutes || 0) < billing.roundedCredits) {
        return NextResponse.json(
          {
            error: "Not enough voice credits.",
            code: "INSUFFICIENT_CREDITS",
            balanceMinutes: Number(creditSummary.balanceMinutes || 0),
            requiredMinutes: billing.roundedCredits,
          },
          { status: 402 }
        );
      }

      if (creditSummary.purchasedMinutes <= 0 && billing.roundedCredits > TRIAL_MAX_GENERATION_MINUTES) {
        return NextResponse.json(
          {
            error: `Free trial exports are capped at ${TRIAL_MAX_GENERATION_MINUTES} minute.`,
            code: "TRIAL_EXPORT_TOO_LONG",
            requiredMinutes: billing.roundedCredits,
            trialMaxMinutes: TRIAL_MAX_GENERATION_MINUTES,
          },
          { status: 402 }
        );
      }
    }

    if (!key && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Gemini TTS is not configured.", code: "TTS_NOT_CONFIGURED" }, { status: 503 });
    }

    if (!key) {
      return NextResponse.json({ languageCode: profile.code, voiceGender, voiceName, promptVersion: promptVersion(profile), estimatedDurationSeconds: estimatedDuration, billing, chunks: chunks.map((c, i) => ({ index: i, audioBase64: "UklGRigAAABXQVZFZm10IBAAAAABAAEA", mimeType: "audio/wav", textLength: c.length })) });
    }

    const out = [] as Array<{ index: number; audioBase64: string; mimeType: string; textLength: number }>;
    const audioFiles = [] as Array<{ audio: Buffer; chunkIndex: number; mimeType: string; textLength: number }>;
    for (let i = 0; i < chunks.length; i++) {
      const prompt = buildGeminiTtsPrompt({ text: chunks[i], profile, voiceGender });
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } } }) });
      const data = await r.json();
      const part = data?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data);
      if (!part?.inlineData?.data) throw new Error("No audio returned by Gemini");

      // Convert PCM to WAV format for browser compatibility
      const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
      const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
      const wavBase64 = wavBuffer.toString('base64');

      audioFiles.push({ audio: wavBuffer, chunkIndex: i, mimeType: "audio/wav", textLength: chunks[i].length });
      out.push({ index: i, audioBase64: wavBase64, mimeType: "audio/wav", textLength: chunks[i].length });
    }

    const stored = userId
      ? await recordGenerationSuccess({
          generation: {
            userId,
            provider: "gemini",
            model,
            languageCode: profile.code,
            voiceName,
            voiceGender,
            promptVersion: promptVersion(profile),
            inputChars: trimmed.length,
            estimatedDurationSeconds: estimatedDuration,
            billableMinutes: billing.estimatedMinutes,
            creditsDebited: billing.roundedCredits,
            apiCostInrEstimate: billing.internalCostInr,
            chunkCount: out.length,
            status: "success",
          },
          audioFiles,
        })
      : null;

    const storedChunks = stored?.uploadedFiles?.length
      ? await Promise.all(
          out.map(async (chunk) => {
            const file = stored.uploadedFiles.find(
              (uploaded) => Number(uploaded?.chunk_index) === chunk.index
            );
            if (!file?.storage_path) return chunk;

            const audioUrl = await createSignedAudioUrl(String(file.storage_path));
            if (!audioUrl) return chunk;

            return {
              index: chunk.index,
              audioUrl,
              fileId: file.id,
              mimeType: chunk.mimeType,
              textLength: chunk.textLength,
            };
          })
        )
      : out;

    return NextResponse.json({ languageCode: profile.code, voiceGender, voiceName, promptVersion: promptVersion(profile), estimatedDurationSeconds: estimatedDuration, billing, generationId: stored?.generationId || null, balanceAfter: stored?.balanceAfter ?? null, chunks: storedChunks });
  } catch (e) {
    console.error("generate-voice error", e);
    return NextResponse.json({ error: "Voice generation is unavailable right now." }, { status: 500 });
  }
}
