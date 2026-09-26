export function elapsedMs(startedAt) {
  return Math.max(0, Math.round((performance.now() - startedAt) * 10) / 10);
}

export function timingHeader(name, durationMs) {
  return `${name};dur=${durationMs.toFixed(1)}`;
}

export function logLatency(event, durationMs, extra = {}) {
  console.log(JSON.stringify({ event, elapsed_ms: durationMs, ...extra }));
}

export function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

export function bearer(request) {
  const value = request.headers.get("authorization") || "";
  return /^Bearer\s+\S+$/i.test(value) ? value : null;
}

export function serviceHeaders(request, authorization, contentType) {
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

export async function verifyAccount(request, env, requireRemaining = false) {
  const authorization = bearer(request);
  if (!authorization) return json({ error: "Sign in required", code: "AUTH_REQUIRED" }, 401);

  let response;
  try {
    response = await env.MIITHII_API.fetch(
      new Request("https://miithii-api.internal/api/usage", {
        method: "GET",
        headers: serviceHeaders(request, authorization),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)])
      })
    );
  } catch (error) {
    if (request.signal.aborted) throw error;
    console.error(JSON.stringify({ event: "voice_account_check_timeout", type: error?.name || "Error" }));
    return json({ error: "Account service is unavailable", code: "SERVICE_UNAVAILABLE" }, 503);
  }
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

export async function handleUsage(request, env) {
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

export async function handleVoiceSession(request, env) {
  const authorization = bearer(request);
  if (!authorization) return json({ error: "Sign in required", code: "AUTH_REQUIRED" }, 401);
  if (Number(request.headers.get("content-length")) > 4096) {
    return json({ error: "Voice session request is too large", code: "REQUEST_TOO_LARGE" }, 413);
  }
  const body = await request.arrayBuffer();
  return env.MIITHII_API.fetch(
    new Request("https://miithii-api.internal/api/voice/session", {
      method: "POST",
      headers: serviceHeaders(request, authorization, "application/json"),
      body,
      signal: request.signal
    })
  );
}
