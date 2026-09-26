import { VOICE_DEFAULT_LANGUAGE, getReplyContract, isLanguageId } from "@miithii/language-core";
import { bearer, elapsedMs, json, logLatency, serviceHeaders, timingHeader } from "./http.js";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CHAT_BYTES = 96 * 1024;

export async function handleChat(request, env) {
  const authorization = bearer(request);
  if (!authorization) return json({ error: "Sign in required", code: "AUTH_REQUIRED" }, 401);
  if (Number(request.headers.get("content-length")) > MAX_CHAT_BYTES) {
    return json({ error: "Conversation is too large", code: "REQUEST_TOO_LARGE" }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request", code: "INVALID_MESSAGE" }, 400);
  }

  if (!Array.isArray(body?.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    return json({ error: "Conversation is invalid", code: "INVALID_MESSAGE" }, 400);
  }
  const messages = [];
  for (const message of body.messages) {
    if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") {
      return json({ error: "Conversation is invalid", code: "INVALID_MESSAGE" }, 400);
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_CHARS) {
      return json({ error: "A message is too long", code: "INVALID_MESSAGE" }, 400);
    }
    messages.push({ role: message.role, content });
  }
  if (messages.at(-1)?.role !== "user") {
    return json({ error: "The latest message must be from you", code: "INVALID_MESSAGE" }, 400);
  }

  const language = body.language ?? VOICE_DEFAULT_LANGUAGE;
  if (!isLanguageId(language)) return json({ error: "Unsupported language" }, 400);
  const contract = getReplyContract("voice", language);
  const recentMessages = messages.slice(-8);
  const threadId = typeof body.threadId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(body.threadId) ? body.threadId : "voice";
  const chatStartedAt = performance.now();
  let upstream;
  try {
    upstream = await env.MIITHII_API.fetch(
      new Request("https://miithii-api.internal/v1/chat/completions", {
        method: "POST",
        headers: serviceHeaders(request, authorization, "application/json"),
        body: JSON.stringify({
          model: "miithii",
          stream: false,
          responseMode: "voice",
          language,
          turnId: body.turnId,
          max_tokens: contract.tts.generationMaxTokens,
          temperature: 0.62,
          threadId,
          messages: recentMessages
        }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(50_000)])
      })
    );
  } catch (error) {
    if (request.signal.aborted) throw error;
    const chatElapsed = elapsedMs(chatStartedAt);
    console.error(JSON.stringify({ event: "voice_chat_timeout", type: error?.name || "Error", elapsed_ms: chatElapsed }));
    return json(
      { error: "Miithii took too long to answer. Try that again.", code: "UPSTREAM_TIMEOUT" },
      504,
      { "server-timing": timingHeader("chat", chatElapsed) }
    );
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    data = null;
  }
  const chatElapsed = elapsedMs(chatStartedAt);
  logLatency("voice_chat_latency", chatElapsed, { status: upstream.status });
  if (!upstream.ok) {
    const error = data?.error;
    return json(
      {
        error: typeof error?.message === "string" ? error.message : "Miithii is unavailable right now",
        code: typeof error?.code === "string" ? error.code : "UPSTREAM_ERROR"
      },
      upstream.status,
      {
        "server-timing": timingHeader("chat", chatElapsed),
        ...(upstream.headers.get("retry-after") ? { "retry-after": upstream.headers.get("retry-after") } : {})
      }
    );
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return json(
      { error: "Miithii returned an empty reply", code: "UPSTREAM_ERROR" },
      502,
      { "server-timing": timingHeader("chat", chatElapsed) }
    );
  }
  const remaining = upstream.headers.get("x-ratelimit-remaining");
  return json(
    { reply },
    200,
    {
      "server-timing": timingHeader("chat", chatElapsed),
      ...(remaining ? { "x-ratelimit-remaining": remaining } : {})
    }
  );
}
