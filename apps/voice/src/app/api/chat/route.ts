import { VOICE_SYSTEM_PROMPT } from "@/lib/persona";

export const runtime = "nodejs";
export const maxDuration = 60;

// Voice turns are short by design (the persona prompt caps them), so a plain
// non-streaming completion is simpler and just as fast end-to-end: the reply
// can't be spoken until it is fully generated anyway.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!process.env.AIMLAPI_API_KEY) {
    return Response.json({ error: "AIMLAPI_API_KEY is not configured" }, { status: 500 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (!messages.length || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "At least one user message is required" }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);

  try {
    const res = await fetch(`${process.env.AIMLAPI_BASE_URL ?? "https://api.aimlapi.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIMLAPI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AIMLAPI_MODEL ?? "google/gemini-2.5-flash",
        messages: [{ role: "system", content: VOICE_SYSTEM_PROMPT }, ...messages],
        max_tokens: 1024,
        temperature: 0.8
      }),
      signal: AbortSignal.timeout(55_000)
    });

    if (!res.ok) {
      console.error("[chat] upstream", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return Response.json({ error: "The model is unavailable right now" }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return Response.json({ error: "The model returned an empty reply" }, { status: 502 });
    return Response.json({ reply });
  } catch (error) {
    console.error("[chat]", error);
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json({ error: timedOut ? "The model took too long to reply" : "Could not generate a reply" }, { status: timedOut ? 504 : 500 });
  }
}
