import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, test } from "node:test";
import { createVoiceDevServer } from "../dev-worker.mjs";
import { prepareSpeechInput } from "../worker.js";

const originalFetch = globalThis.fetch;
const servers = new Set();

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all([...servers].map(server => new Promise(resolve => server.close(resolve))));
  servers.clear();
});

function testEnv() {
  return {
    BODHAN_API_KEY: "test-key",
    BODHAN_TTS_API_KEY: "test-key",
    MIITHII_API: {
      fetch: async () => Response.json({ remaining: 50 })
    },
    ASSETS: { fetch: async () => new Response("not found", { status: 404 }) }
  };
}

function postJson(port, path, body) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json"
      }
    }, async response => {
      let text = "";
      response.setEncoding("utf8");
      for await (const chunk of response) text += chunk;
      resolve({ status: response.statusCode, body: JSON.parse(text) });
    });
    request.once("error", reject);
    request.end(JSON.stringify(body));
  });
}

async function listen(server) {
  servers.add(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

function postTts(port, text) {
  return http.request({
    host: "127.0.0.1",
    port,
    path: "/api/tts",
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json"
    }
  });
}

test("speech delivery is one provider-safe request and rejects oversized turns", () => {
  const prose = "এইটো এটা সম্পূৰ্ণ কণ্ঠ উত্তৰ। " + "স্বাভাৱিক কথোপকথন। ".repeat(8);
  const normalized = prose.replace(/\s+/gu, " ").trim();
  assert.equal(prepareSpeechInput(prose, 360), normalized);

  const exactLimit = "अ".repeat(360);
  assert.equal(prepareSpeechInput(exactLimit, 360), exactLimit);
  assert.throws(
    () => prepareSpeechInput("অ".repeat(361), 360),
    /delivery contract/
  );
});

test("Bodo display rendering asks Bodhan for same-language Roman script", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://api.bodhan.ai/v1/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "indic-translate");
    assert.equal(body.source_language_code, "brx");
    assert.equal(body.target_language_code, "brx");
    assert.equal(body.target_script, "roman");
    assert.equal(body.messages[0].content, "आं मोजां दं");
    return Response.json({
      choices: [{ message: { role: "assistant", content: "ang mwjang dong" }, finish_reason: "stop" }]
    });
  };

  const port = await listen(createVoiceDevServer(testEnv()));
  const result = await postJson(port, "/api/display", { language: "brx", text: "आं मोजां दं" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { text: "ang mwjang dong", transformed: true });
});

test("voice chat forwards the selected Assamese or Bodo language unchanged", async () => {
  const seen = [];
  const env = testEnv();
  env.MIITHII_API.fetch = async request => {
    const body = await request.json();
    seen.push({ pathname: new URL(request.url).pathname, body });
    const reply = body.language === "brx" ? "आं मोजां दं।" : "মই ভাল আছোঁ।";
    return Response.json({ choices: [{ message: { role: "assistant", content: reply } }] });
  };
  const port = await listen(createVoiceDevServer(env));

  for (const language of ["as", "brx"]) {
    const result = await postJson(port, "/api/chat", {
      language,
      turnId: `turn-${language}`,
      messages: [{ role: "user", content: "hello" }]
    });
    assert.equal(result.status, 200);
  }

  assert.deepEqual(seen.map(item => item.pathname), ["/v1/chat/completions", "/v1/chat/completions"]);
  assert.deepEqual(seen.map(item => item.body.language), ["as", "brx"]);
  assert.deepEqual(seen.map(item => item.body.max_tokens), [512, 4096]);
  assert.ok(seen.every(item => item.body.responseMode === "voice"));
});

test("voice session creation is a thin same-origin proxy to the shared API", async () => {
  const env = testEnv();
  let seen;
  env.MIITHII_API.fetch = async request => {
    seen = {
      pathname: new URL(request.url).pathname,
      authorization: request.headers.get("authorization"),
      body: await request.json()
    };
    return Response.json({ token: "session-token", language: "brx" });
  };
  const port = await listen(createVoiceDevServer(env));
  const result = await postJson(port, "/api/voice/session", { language: "brx" });

  assert.equal(result.status, 200);
  assert.equal(result.body.token, "session-token");
  assert.deepEqual(seen, {
    pathname: "/api/voice/session",
    authorization: "Bearer test-token",
    body: { language: "brx" }
  });
});

test("Bodo speech limit is shorter than Assamese and enforced before synthesis", async () => {
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    return new Response(new Uint8Array([1, 2, 3]));
  };
  const port = await listen(createVoiceDevServer(testEnv()));

  const allowed = "अ".repeat(180);
  const allowedRequest = postTts(port, allowed);
  allowedRequest.end(JSON.stringify({ language: "brx", text: allowed }));
  const allowedResponse = await new Promise((resolve, reject) => allowedRequest.once("response", resolve).once("error", reject));
  for await (const _chunk of allowedResponse) { /* drain */ }
  assert.equal(allowedResponse.statusCode, 200);
  assert.equal(providerCalls, 1);

  const oversized = "अ".repeat(181);
  const oversizedRequest = postTts(port, oversized);
  oversizedRequest.end(JSON.stringify({ language: "brx", text: oversized }));
  const oversizedResponse = await new Promise((resolve, reject) => oversizedRequest.once("response", resolve).once("error", reject));
  let oversizedBody = "";
  oversizedResponse.setEncoding("utf8");
  for await (const chunk of oversizedResponse) oversizedBody += chunk;
  assert.equal(oversizedResponse.statusCode, 413);
  assert.equal(JSON.parse(oversizedBody).code, "VOICE_DELIVERY");
  assert.equal(providerCalls, 1, "oversized Bodo must not call the TTS provider");

  const assamese = "অ".repeat(360);
  const assameseRequest = postTts(port, assamese);
  assameseRequest.end(JSON.stringify({ language: "as", text: assamese }));
  const assameseResponse = await new Promise((resolve, reject) => assameseRequest.once("response", resolve).once("error", reject));
  for await (const _chunk of assameseResponse) { /* drain */ }
  assert.equal(assameseResponse.statusCode, 200);
  assert.equal(providerCalls, 2);
});

test("TTS keeps Assamese and Bodo provider voice contracts separate", async () => {
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(new Uint8Array([1, 2, 3]));
  };
  const port = await listen(createVoiceDevServer(testEnv()));
  const cases = [
    { language: "as", text: "মই ভাল আছোঁ।", voice: "Prastuti" },
    { language: "brx", text: "आं मोजां दं।", voice: "Gwrbw" }
  ];

  for (const item of cases) {
    const request = postTts(port, item.text);
    request.end(JSON.stringify({ language: item.language, text: item.text }));
    const response = await new Promise((resolve, reject) => request.once("response", resolve).once("error", reject));
    for await (const _chunk of response) { /* drain */ }
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "audio/wav");
  }

  assert.equal(requests.length, 2);
  assert.equal(requests[0].voice, "Prastuti");
  assert.deepEqual(JSON.parse(requests[0].instructions), { lang: "as" });
  assert.equal(requests[1].voice, "Gwrbw");
  assert.deepEqual(JSON.parse(requests[1].instructions), { lang: "brx" });
});

test("first provider timeout returns a structured 504 before response streaming starts", async () => {
  globalThis.fetch = async () => {
    throw new DOMException("provider timeout", "TimeoutError");
  };
  const port = await listen(createVoiceDevServer(testEnv()));
  const request = postTts(port, "এটা উত্তৰ।");
  request.end(JSON.stringify({ language: "as", text: "এটা উত্তৰ।" }));
  const response = await new Promise((resolve, reject) => request.once("response", resolve).once("error", reject));
  let body = "";
  response.setEncoding("utf8");
  for await (const chunk of response) body += chunk;
  assert.equal(response.statusCode, 504);
  assert.deepEqual(JSON.parse(body), {
    error: "Speech playback took too long. You can still read the reply.",
    code: "TTS_UNAVAILABLE"
  });
});

test("a complete spoken turn consumes exactly one TTS provider request", async () => {
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    assert.equal(options.signal.aborted, false);
    return new Response(new Uint8Array([1, 2, 3]));
  };

  const text = "মই গোটেই উত্তৰটো একেবাৰে সম্পূৰ্ণকৈ ক'ম। এইটো মাজতে বন্ধ নহ'ব।";
  const port = await listen(createVoiceDevServer(testEnv()));
  const request = postTts(port, text);
  request.end(JSON.stringify({ language: "as", text }));
  const response = await new Promise((resolve, reject) => request.once("response", resolve).once("error", reject));
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  assert.equal(response.statusCode, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers["content-type"], "audio/wav");
  assert.deepEqual([...body], [1, 2, 3]);
});

test("disconnect before response headers aborts first provider synthesis", async () => {
  let providerAborted;
  const aborted = new Promise(resolve => { providerAborted = resolve; });
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      providerAborted();
      reject(options.signal.reason);
    }, { once: true });
  });
  const port = await listen(createVoiceDevServer(testEnv()));
  const request = postTts(port, "এটা উত্তৰ।");
  request.on("error", () => {});
  request.end(JSON.stringify({ language: "as", text: "এটা উত্তৰ।" }));
  setTimeout(() => request.destroy(), 20);
  await Promise.race([
    aborted,
    new Promise((_, reject) => setTimeout(() => reject(new Error("first provider request was not aborted")), 1_000))
  ]);
});
