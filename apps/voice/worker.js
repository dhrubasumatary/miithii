const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 1500;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CHAT_BYTES = 96 * 1024;
const LANGUAGES = { as: "Prastuti", brx: "Gwrbw" };
const BODHAN_BASE_URL = "https://api.bodhan.ai/v1";

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  return /^Bearer\s+\S+$/i.test(value) ? value : null;
}

function serviceHeaders(request, authorization, contentType) {
  const headers = new Headers({ authorization });
  if (contentType) headers.set("content-type", contentType);
  const connectingIp = request.headers.get("cf-connecting-ip");
  if (connectingIp) headers.set("cf-connecting-ip", connectingIp);
  return headers;
}

async function accountCheckError(response) {
  const payload = await response.clone().json().catch(() => null);
  const nested = payload?.error && typeof payload.error === "object" ? payload.error : null;
  const code = typeof nested?.code === "string"
    ? nested.code
    : typeof payload?.code === "string"
      ? payload.code
      : "SERVICE_UNAVAILABLE";
  const requestId = typeof nested?.request_id === "string" ? nested.request_id : undefined;

  if (response.status === 401) return json({ error: "Sign in required", code: "AUTH_REQUIRED" }, 401);
  if (response.status === 429) {
    return json({ error: "Too many requests. Please try again shortly.", code }, 429, {
      ...(response.headers.get("retry-after") ? { "retry-after": response.headers.get("retry-after") } : {})
    });
  }

  const upstreamMessage = typeof nested?.message === "string"
    ? nested.message
    : typeof payload?.error === "string"
      ? payload.error
      : null;
  const status = response.status >= 400 && response.status < 500 ? response.status : 503;
  console.error(JSON.stringify({
    event: "voice_account_check_error",
    status: response.status,
    code,
    ...(requestId ? { request_id: requestId } : {})
  }));
  return json({
    error: status === 503 ? "Account service is unavailable" : (upstreamMessage || "Account access could not be verified"),
    code,
    ...(requestId ? { request_id: requestId } : {})
  }, status);
}

async function verifyAccount(request, env, requireRemaining = false) {
  const authorization = bearer(request);
  if (!authorization) return json({ error: "Sign in required", code: "AUTH_REQUIRED" }, 401);

  const response = await env.MIITHII_API.fetch(
    new Request("https://miithii-api.internal/api/usage", {
      method: "GET",
      headers: serviceHeaders(request, authorization),
      signal: request.signal
    })
  );
  if (response.ok) {
    if (!requireRemaining) return null;
    const usage = await response.json().catch(() => null);
    if (!usage || !Number.isFinite(Number(usage.remaining))) {
      return json({ error: "Account service is unavailable", code: "SERVICE_UNAVAILABLE" }, 503);
    }
    if (Number(usage.remaining) <= 0) {
      return json({ error: "You've reached your 50-message daily limit. Please try again after midnight India time.", code: "DAILY_LIMIT" }, 429);
    }
    return null;
  }

  return accountCheckError(response);
}

function normalizeSpeechText(text) {
  return text
    .normalize("NFKC")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/[*_~#>|]/g, " ")
    .replace(/^\s*[-+•]\s+/gm, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+([।?!,.])/g, "$1")
    .replace(/([।?!,.]){2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitForSpeech(text, maxChars = 560) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[।?!.,])\s*/)
    .map(value => value.trim())
    .filter(Boolean);
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) chunks.push(current);
      current = "";
      for (let offset = 0; offset < sentence.length; offset += maxChars) {
        chunks.push(sentence.slice(offset, offset + maxChars));
      }
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

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function handleUsage(request, env) {
  const authorization = bearer(request);
  if (!authorization) return json({ error: "Sign in required", code: "AUTH_REQUIRED" }, 401);
  return env.MIITHII_API.fetch(
    new Request("https://miithii-api.internal/api/usage", {
      method: "GET",
      headers: serviceHeaders(request, authorization),
      signal: request.signal
    })
  );
}

async function handleChat(request, env) {
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

  // Voice is intentionally a fast demo surface for now: preserve enough
  // recent context for continuity without shipping a long transcript on every
  // turn. The shared API still owns Miithii's identity and voice-mode policy.
  const language = body.language ?? "as";
  if (!Object.hasOwn(LANGUAGES, language)) return json({ error: "Unsupported language" }, 400);
  const recentMessages = messages.slice(-8);
  const threadId = typeof body.threadId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(body.threadId) ? body.threadId : "voice";
  const upstream = await env.MIITHII_API.fetch(
    new Request("https://miithii-api.internal/v1/chat/completions", {
      method: "POST",
      headers: serviceHeaders(request, authorization, "application/json"),
      body: JSON.stringify({
        model: "miithii",
        stream: false,
        responseMode: "voice",
        language,
        turnId: body.turnId,
        max_tokens: 144,
        temperature: 0.62,
        threadId,
        messages: recentMessages
      }),
      signal: request.signal
    })
  );

  let data;
  try {
    data = await upstream.json();
  } catch {
    data = null;
  }
  if (!upstream.ok) {
    const error = data?.error;
    return json(
      {
        error: typeof error?.message === "string" ? error.message : "Miithii is unavailable right now",
        code: typeof error?.code === "string" ? error.code : "UPSTREAM_ERROR"
      },
      upstream.status,
      upstream.headers.get("retry-after") ? { "retry-after": upstream.headers.get("retry-after") } : {}
    );
  }

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) return json({ error: "Miithii returned an empty reply", code: "UPSTREAM_ERROR" }, 502);
  const remaining = upstream.headers.get("x-ratelimit-remaining");
  return json({ reply }, 200, remaining ? { "x-ratelimit-remaining": remaining } : {});
}

async function handleStt(request, env) {
  const authError = await verifyAccount(request, env, true);
  if (authError) return authError;
  if (!env.BODHAN_API_KEY) return json({ error: "Voice transcription is not configured", code: "SERVICE_UNAVAILABLE" }, 503);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Recording could not be read", code: "INVALID_AUDIO" }, 400);
  }
  const language = form.get("language") ?? "as";
  if (!Object.hasOwn(LANGUAGES, language)) return json({ error: "Unsupported language" }, 400);
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return json({ error: "Recording is empty", code: "INVALID_AUDIO" }, 400);
  if (file.size > MAX_AUDIO_BYTES) return json({ error: "Recording is too long", code: "INVALID_AUDIO" }, 413);

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, "recording.wav");
  upstreamForm.append("model", "indic-transcribe");
  upstreamForm.append("language", language);

  try {
    const response = await fetch(`${BODHAN_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.BODHAN_API_KEY}` },
      body: upstreamForm,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(35_000)])
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: "voice_stt_error", status: response.status }));
      return json({ error: "Could not transcribe that recording", code: "STT_UNAVAILABLE" }, 502);
    }
    const data = await response.json();
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) return json({ error: "I couldn't hear any words. Try again a little closer to the microphone.", code: "NO_SPEECH" }, 422);
    return json({ text, language });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error(JSON.stringify({ event: "voice_stt_error", type: error?.name || "Error" }));
    return json({ error: "Transcription took too long. Please try again.", code: "STT_UNAVAILABLE" }, 504);
  }
}

async function handleTts(request, env) {
  const authError = await verifyAccount(request, env);
  if (authError) return authError;
  if (!env.BODHAN_TTS_API_KEY) return json({ error: "Spoken replies are not configured", code: "SERVICE_UNAVAILABLE" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid speech request", code: "INVALID_MESSAGE" }, 400);
  }
  const text = typeof body?.text === "string" ? normalizeSpeechText(body.text) : "";
  if (!text) return json({ error: "Reply text is empty", code: "INVALID_MESSAGE" }, 400);
  if (text.length > MAX_TEXT_CHARS) return json({ error: "Reply is too long to speak", code: "INVALID_MESSAGE" }, 413);

  const language = body.language ?? "as";
  if (!Object.hasOwn(LANGUAGES, language)) return json({ error: "Unsupported language" }, 400);
  const chunks = splitForSpeech(text);
  try {
    const audio = [];
    for (const chunk of chunks) {
      const response = await fetch(`${BODHAN_BASE_URL}/audio/speech`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.BODHAN_TTS_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "indic-speak",
          input: chunk,
          voice: LANGUAGES[language],
          instructions: JSON.stringify({ lang: language })
        }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)])
      });
      if (!response.ok) {
        console.error(JSON.stringify({ event: "voice_tts_error", status: response.status }));
        if (response.status === 429) {
          return json(
            { error: "Voice playback is busy for a moment. You can still read the reply.", code: "TTS_RATE_LIMIT" },
            429,
            response.headers.get("retry-after") ? { "retry-after": response.headers.get("retry-after") } : {}
          );
        }
        return json({ error: "Could not prepare the spoken reply", code: "TTS_UNAVAILABLE" }, 502);
      }
      audio.push(bytesToBase64(await response.arrayBuffer()));
    }
    return json({ audio, language });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    console.error(JSON.stringify({ event: "voice_tts_error", type: error?.name || "Error" }));
    return json({ error: "Speech playback took too long. You can still read the reply.", code: "TTS_UNAVAILABLE" }, 504);
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/usage" && request.method === "GET") return handleUsage(request, env);
    if (pathname === "/api/chat" && request.method === "POST") return handleChat(request, env);
    if (pathname === "/api/stt" && request.method === "POST") return handleStt(request, env);
    if (pathname === "/api/tts" && request.method === "POST") return handleTts(request, env);
    if (pathname.startsWith("/api/")) return json({ error: "Not found", code: "NOT_FOUND" }, 404);
    return env.ASSETS.fetch(request);
  }
};
