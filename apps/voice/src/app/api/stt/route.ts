import { transcribeAudio, UpstreamError } from "@/lib/bodhan";
import { DEFAULT_LANGUAGE, isVoiceLanguage } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 60;

// indic-transcribe caps audio at 30s; 16 kHz 16-bit mono ≈ 32 KB/s, so 2 MB
// covers the limit with headroom for compressed uploads.
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return Response.json({ error: "Audio file is required" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Recording is too long (30 seconds max)" }, { status: 413 });
    }

    const requested = String(form.get("language") ?? DEFAULT_LANGUAGE);
    const language = isVoiceLanguage(requested) ? requested : DEFAULT_LANGUAGE;

    const text = await transcribeAudio(file, language);
    return Response.json({ text, language });
  } catch (error) {
    if (error instanceof UpstreamError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[stt]", error);
    return Response.json({ error: "Could not transcribe the recording" }, { status: 500 });
  }
}
