import { VOICE_DEFAULT_LANGUAGE, getReplyContract, isLanguageId } from "@miithii/language-core";
import { elapsedMs, json, logLatency, timingHeader, verifyAccount } from "./http.js";

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_DISPLAY_TEXT_CHARS = 1500;
const BODHAN_BASE_URL = "https://api.bodhan.ai/v1";

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

function prepareSpeechText(text, language) {
  const spokenName = getReplyContract("voice", language).tts.companionName.spoken;
  return normalizeSpeechText(text).replace(/Miithii/gi, spokenName);
}

export function prepareSpeechInput(text, maxInputChars = 360) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  if (!normalized) return "";
  if (normalized.length > maxInputChars) throw new Error("Speech text exceeds the selected language delivery contract");
  return normalized;
}

function ttsError(response) {
  if (response.status === 429) {
    return {
      status: 429,
      body: { error: "Voice playback is busy for a moment. You can still read the reply.", code: "TTS_RATE_LIMIT" },
      headers: response.headers.get("retry-after") ? { "retry-after": response.headers.get("retry-after") } : {}
    };
  }
  return {
    status: 502,
    body: { error: "Could not prepare the spoken reply", code: "TTS_UNAVAILABLE" },
    headers: {}
  };
}

async function synthesizeSpeech(text, language, env, signal, timeoutMs = 35_000) {
  const voice = getReplyContract("voice", language).tts.voice;
  const response = await fetch(`${BODHAN_BASE_URL}/audio/speech`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.BODHAN_TTS_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "indic-speak",
      input: text,
      voice,
      instructions: JSON.stringify({ lang: language })
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: "voice_tts_error", status: response.status }));
    return { error: ttsError(response) };
  }
  return { response };
}

export async function handleDisplayText(request, env) {
  const authError = await verifyAccount(request, env);
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid display request", code: "INVALID_MESSAGE" }, 400);
  }

  const language = body.language ?? VOICE_DEFAULT_LANGUAGE;
  if (!isLanguageId(language)) return json({ error: "Unsupported language" }, 400);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_DISPLAY_TEXT_CHARS) return json({ error: "Reply text is invalid", code: "INVALID_MESSAGE" }, 400);

  const contract = getReplyContract("voice", language);
  if (contract.displayScript === contract.script) return json({ text, transformed: false });

  if (language !== "brx" || contract.displayScript !== "latin" || !env.BODHAN_API_KEY) {
    return json({ text, transformed: false });
  }

  const startedAt = performance.now();
  try {
    const response = await fetch(`${BODHAN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.BODHAN_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "indic-translate",
        messages: [{ role: "user", content: text }],
        source_language_code: "brx",
        target_language_code: "brx",
        target_script: "roman"
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)])
    });
    const elapsed = elapsedMs(startedAt);
    if (!response.ok) {
      console.warn(JSON.stringify({ event: "voice_display_transform_skipped", status: response.status, elapsed_ms: elapsed }));
      return json({ text, transformed: false }, 200, { "server-timing": timingHeader("display", elapsed) });
    }
    const data = await response.json().catch(() => null);
    const rendered = data?.choices?.[0]?.message?.content?.trim();
    logLatency("voice_display_transform_latency", elapsed, { language });
    return json(
      { text: rendered || text, transformed: Boolean(rendered) },
      200,
      { "server-timing": timingHeader("display", elapsed) }
    );
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    const elapsed = elapsedMs(startedAt);
    console.warn(JSON.stringify({ event: "voice_display_transform_skipped", type: error?.name || "Error", elapsed_ms: elapsed }));
    return json({ text, transformed: false }, 200, { "server-timing": timingHeader("display", elapsed) });
  }
}

export async function handleStt(request, env) {
  const authError = await verifyAccount(request, env, true);
  if (authError) return authError;
  if (!env.BODHAN_API_KEY) return json({ error: "Voice transcription is not configured", code: "SERVICE_UNAVAILABLE" }, 503);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Recording could not be read", code: "INVALID_AUDIO" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return json({ error: "Recording is empty", code: "INVALID_AUDIO" }, 400);
  if (file.size > MAX_AUDIO_BYTES) return json({ error: "Recording is too long", code: "INVALID_AUDIO" }, 413);

  const upstreamForm = new FormData();
  upstreamForm.append("file", file, "recording.wav");
  upstreamForm.append("model", "indic-transcribe");

  const sttStartedAt = performance.now();
  try {
    const response = await fetch(`${BODHAN_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.BODHAN_API_KEY}` },
      body: upstreamForm,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(35_000)])
    });
    const sttElapsed = elapsedMs(sttStartedAt);
    if (!response.ok) {
      console.error(JSON.stringify({ event: "voice_stt_error", status: response.status, elapsed_ms: sttElapsed }));
      return json(
        { error: "Could not transcribe that recording", code: "STT_UNAVAILABLE" },
        502,
        { "server-timing": timingHeader("stt", sttElapsed) }
      );
    }
    const data = await response.json();
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    logLatency("voice_stt_latency", sttElapsed, { status: response.status });
    if (!text) {
      return json(
        { error: "I couldn't hear any words. Try again a little closer to the microphone.", code: "NO_SPEECH" },
        422,
        { "server-timing": timingHeader("stt", sttElapsed) }
      );
    }
    return json({ text }, 200, { "server-timing": timingHeader("stt", sttElapsed) });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    const sttElapsed = elapsedMs(sttStartedAt);
    console.error(JSON.stringify({ event: "voice_stt_error", type: error?.name || "Error", elapsed_ms: sttElapsed }));
    return json(
      { error: "Transcription took too long. Please try again.", code: "STT_UNAVAILABLE" },
      504,
      { "server-timing": timingHeader("stt", sttElapsed) }
    );
  }
}

export async function handleTts(request, env) {
  const authError = await verifyAccount(request, env);
  if (authError) return authError;
  if (!env.BODHAN_TTS_API_KEY) return json({ error: "Spoken replies are not configured", code: "SERVICE_UNAVAILABLE" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid speech request", code: "INVALID_MESSAGE" }, 400);
  }
  const language = body.language ?? VOICE_DEFAULT_LANGUAGE;
  if (!isLanguageId(language)) return json({ error: "Unsupported language" }, 400);
  const contract = getReplyContract("voice", language);
  const text = typeof body?.text === "string" ? prepareSpeechText(body.text, language) : "";
  if (!text) return json({ error: "Reply text is empty", code: "INVALID_MESSAGE" }, 400);
  if (text.length > contract.tts.maxInputChars) {
    return json({ error: "Reply exceeded the spoken-turn limit", code: "VOICE_DELIVERY" }, 413);
  }
  const speechText = prepareSpeechInput(text, contract.tts.maxInputChars);
  const ttsStartedAt = performance.now();
  try {
    const result = await synthesizeSpeech(speechText, language, env, request.signal, 35_000);
    const readyElapsed = elapsedMs(ttsStartedAt);
    if (result.error) {
      console.error(JSON.stringify({ event: "voice_tts_error", elapsed_ms: readyElapsed, status: result.error.status }));
      return json(result.error.body, result.error.status, {
        ...result.error.headers,
        "server-timing": timingHeader("tts_ready", readyElapsed)
      });
    }
    if (!result.response.body) {
      return json(
        { error: "Could not prepare the spoken reply", code: "TTS_UNAVAILABLE" },
        502,
        { "server-timing": timingHeader("tts_ready", readyElapsed) }
      );
    }
    logLatency("voice_tts_ready_latency", readyElapsed, { language });
    const contentLength = result.response.headers.get("content-length");
    return new Response(result.response.body, {
      status: 200,
      headers: {
        "content-type": result.response.headers.get("content-type") || "audio/wav",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "server-timing": timingHeader("tts_ready", readyElapsed),
        ...(contentLength ? { "content-length": contentLength } : {})
      }
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    const totalElapsed = elapsedMs(ttsStartedAt);
    console.error(JSON.stringify({ event: "voice_tts_error", type: error?.name || "Error", elapsed_ms: totalElapsed }));
    return json(
      { error: "Speech playback took too long. You can still read the reply.", code: "TTS_UNAVAILABLE" },
      504,
      { "server-timing": timingHeader("tts_ready", totalElapsed) }
    );
  }
}
