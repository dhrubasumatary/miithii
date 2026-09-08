import { synthesizeSpeech, UpstreamError } from "@/lib/bodhan";
import { DEFAULT_LANGUAGE, isVoiceLanguage, VOICE_LANGUAGES } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_CHARS = 1500;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string; language?: string };
    const text = (body.text ?? "").trim();
    if (!text) return Response.json({ error: "Text is required" }, { status: 400 });
    if (text.length > MAX_TEXT_CHARS) {
      return Response.json({ error: "Text is too long to speak" }, { status: 413 });
    }

    const requested = body.language ?? DEFAULT_LANGUAGE;
    const language = isVoiceLanguage(requested) ? requested : DEFAULT_LANGUAGE;
    const voice = VOICE_LANGUAGES[language].ttsVoice ?? "Prastuti";

    const audio = await synthesizeSpeech(text, language, voice);
    return Response.json({ audio, language });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[tts]", error);
    return Response.json({ error: "Could not synthesize speech" }, { status: 500 });
  }
}
