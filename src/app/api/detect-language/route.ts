import { NextResponse } from "next/server";
import { getLanguageProfile, makeDetectionFromProfile } from "@/lib/tts/language-profiles";

function detectNortheastLanguageHints(text: string, sarvam: { language_code?: string; script_code?: string; confidence?: number } | null) {
  const t = text.toLowerCase();
  if (/[\uABC0-\uABFF]/.test(text) || /(eigi|aduga|nupa|nupi|houjik)/i.test(t)) return makeDetectionFromProfile("mni-IN", 0.8, "Meitei Mayek");
  if (/(\bboro\b|\bbodo\b|\bjarim\b|\bbwkha\b)/i.test(t)) return makeDetectionFromProfile("brx-IN", 0.75, sarvam?.script_code || "Devanagari");
  if (/(\baxomiya\b|\bmur\b|\bmoi\b|\bkiman\b|\bki\b)/i.test(t)) return makeDetectionFromProfile("as-IN", 0.82, "Bengali-Assamese");
  if (sarvam?.language_code) {
    const codeMap: Record<string, string> = { as: "as-IN", brx: "brx-IN", mni: "mni-IN", bn: "bn-IN", hi: "hi-IN", en: "en-IN" };
    const mapped = codeMap[sarvam.language_code.toLowerCase()] || "unknown";
    return makeDetectionFromProfile(mapped, Number(sarvam.confidence || 0.65), sarvam.script_code || getLanguageProfile(mapped).scripts[0]);
  }
  return makeDetectionFromProfile("unknown", 0.4, "Unknown");
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") return NextResponse.json({ error: "Text is required" }, { status: 400 });
    const trimmed = text.trim();
    if (!trimmed) return NextResponse.json({ error: "Text is required" }, { status: 400 });
    const sample = trimmed.slice(0, 1000);

    const key = process.env.SARVAM_API_KEY;
    if (!key) {
      const mock = detectNortheastLanguageHints(sample, null);
      return NextResponse.json({ ...mock, detectionSource: "mock-rules" });
    }

    const r = await fetch("https://api.sarvam.ai/v1/text/identify-language", { method: "POST", headers: { "Content-Type": "application/json", "api-subscription-key": key }, body: JSON.stringify({ input: sample }) });
    const data = await r.json().catch(() => ({}));
    const detected = detectNortheastLanguageHints(sample, data);
    return NextResponse.json(detected);
  } catch (e) {
    console.error("detect-language error", e);
    return NextResponse.json({ error: "Language detection is unavailable right now." }, { status: 500 });
  }
}
