import { NextResponse } from "next/server";
import { getLanguageProfile, makeDetectionFromProfile } from "@/lib/tts/language-profiles";

function detectNortheastLanguageHints(text: string, sarvam: { language_code?: string; script_code?: string; confidence?: number } | null) {
  const t = text.toLowerCase();
  // Detect Manipuri (Meitei Mayek script or specific words)
  if (/[\uABC0-\uABFF]/.test(text) || /(eigi|aduga|nupa|nupi|houjik)/i.test(t)) return makeDetectionFromProfile("mni-IN", 0.8, "Meitei Mayek");
  // Detect Bodo (specific words in Devanagari or Latin)
  if (
    /(\bboro\b|\bbodo\b|\bang\b|\bangni\b|\bnwng\b|\bnwngni\b|\bnwngkhou\b|\bnngkhou\b|\bjwng\b|\bjarim\b|\bbwkha\b|\bbaow\b|mwjang|gwdanai|gajwnnai|khabwnai|baowhor|baowhorbai|horbai|बड़ो|बोडो|बोरो|आं|आङ|नों|नंग|नङ|जों|जोङ|गोजोन|बावहर|बावहरबाय|हरबाय)/i.test(t)
  )
    return makeDetectionFromProfile("brx-IN", 0.82, sarvam?.script_code || (/[\u0900-\u097F]/.test(text) ? "Devanagari" : "Latin"));
  if (/\b(axomiya|assamese|moi|mur|tumi|kenekoi|khobor|kene|ase|koriba|goru|guwahati)\b/i.test(t)) return makeDetectionFromProfile("as-IN", 0.7, "Latin");
  // Bengali-Assamese script needs lexical disambiguation; the script block alone is not enough.
  if (/(মই|গৈছোঁ|তুমি|কেনে|আছা|কৰা|অসমীয়া|ভাষাত|স্বাভাৱিক|স্পষ্ট|মৰমলগা|সৃষ্টি|ৱ|ৰ)/i.test(text)) return makeDetectionFromProfile("as-IN", 0.88, "Bengali-Assamese");
  if (/(আমি|আজ|একটি|পরিষ্কার|স্বাভাবিক|কণ্ঠ|তৈরি|করতে|চাই|বাংলা|আপনি|কেমন)/i.test(text)) return makeDetectionFromProfile("bn-IN", 0.78, "Bengali");
  if (/(आज|मैं|एक|साफ|प्राकृतिक|आवाज़|बनाना|चाहता|चाहती|हूँ|है|हिंदी)/i.test(text)) return makeDetectionFromProfile("hi-IN", 0.78, "Devanagari");
  if (/[a-z]/i.test(text) && /\b(the|and|for|voice|create|clear|natural|product|demo|script|audio)\b/i.test(text)) return makeDetectionFromProfile("en-IN", 0.72, "Latin");
  if (/[\u0980-\u09FF]/.test(text)) return makeDetectionFromProfile("as-IN", 0.62, "Bengali-Assamese");
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

    const r = await fetch("https://api.sarvam.ai/text-lid", { method: "POST", headers: { "Content-Type": "application/json", "api-subscription-key": key }, body: JSON.stringify({ input: sample }) });
    const data = await r.json().catch(() => ({}));
    const detected = detectNortheastLanguageHints(sample, data);
    return NextResponse.json(detected);
  } catch (e) {
    console.error("detect-language error", e);
    return NextResponse.json({ error: "Language detection is unavailable right now." }, { status: 500 });
  }
}
