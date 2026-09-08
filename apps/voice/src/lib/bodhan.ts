// Server-side Bodhan.AI helpers. Keys never reach the browser — all calls go
// through the /api/stt and /api/tts routes.
// Docs: https://console.bodhan.ai/api-docs/
const BASE_URL = "https://api.bodhan.ai/v1";

export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function sttKey() {
  const key = process.env.BODHAN_API_KEY;
  if (!key) throw new UpstreamError(500, "BODHAN_API_KEY is not configured");
  return key;
}

function ttsKey() {
  const key = process.env.BODHAN_TTS_API_KEY;
  if (!key) throw new UpstreamError(500, "BODHAN_TTS_API_KEY is not configured");
  return key;
}

/** Speech → text via `indic-transcribe`. Audio must be WAV/FLAC/OGG/MP3, ≤30s. */
export async function transcribeAudio(file: Blob, language: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, "audio.wav");
  form.append("model", "indic-transcribe");
  form.append("language", language);

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sttKey()}` },
    body: form,
    signal: AbortSignal.timeout(30_000)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError(res.status === 401 ? 502 : res.status, `Transcription failed (${res.status}) ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Split reply into indic-speak-friendly chunks (it recommends 1–2 sentences). */
export function splitForSpeech(text: string, maxChars = 220): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[।?!.,])\s*/)
    .map(s => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) chunks.push(current);
      current = "";
      chunks.push(sentence.slice(0, maxChars));
      continue;
    }
    if (current && `${current} ${sentence}`.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 8);
}

/** Text → speech via `indic-speak`. Returns one base64 WAV per chunk. */
export async function synthesizeSpeech(text: string, language: string, voice: string): Promise<string[]> {
  const chunks = splitForSpeech(text);
  if (!chunks.length) return [];
  const wavBuffers = await Promise.all(
    chunks.map(async chunk => {
      const res = await fetch(`${BASE_URL}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ttsKey()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "indic-speak",
          input: chunk,
          voice,
          instructions: JSON.stringify({ lang: language })
        }),
        signal: AbortSignal.timeout(60_000)
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new UpstreamError(res.status === 401 ? 502 : res.status, `Speech synthesis failed (${res.status}) ${detail.slice(0, 200)}`);
      }
      return Buffer.from(await res.arrayBuffer()).toString("base64");
    })
  );
  return wavBuffers;
}
