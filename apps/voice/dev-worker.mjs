import http from "node:http";
import { fileURLToPath } from "node:url";
import worker from "./worker.js";

const envFile = fileURLToPath(new URL("./.env.local", import.meta.url));
try {
  process.loadEnvFile(envFile);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const port = Number(process.env.MIITHII_VOICE_API_PORT ?? 8788);
const apiOrigin = process.env.MIITHII_API_ORIGIN ?? "https://api.miithii.in";

const env = {
  BODHAN_API_KEY: process.env.BODHAN_API_KEY,
  BODHAN_TTS_API_KEY: process.env.BODHAN_TTS_API_KEY,
  MIITHII_API: {
    async fetch(request) {
      const source = new URL(request.url);
      const target = new URL(`${source.pathname}${source.search}`, apiOrigin);
      return fetch(new Request(target, request));
    }
  },
  ASSETS: {
    fetch() {
      return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
  }
};

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://127.0.0.1:${port}${incoming.url ?? "/"}`, {
      method: incoming.method,
      headers: incoming.headers,
      body
    });
    const response = await worker.fetch(request, env);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("[voice-dev-worker]", error instanceof Error ? error.message : error);
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "application/json");
    outgoing.end(JSON.stringify({ error: "Voice development proxy failed", code: "DEV_PROXY_ERROR" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Miithii voice API proxy listening on http://127.0.0.1:${port}`);
  console.log(`Forwarding account/chat requests to ${apiOrigin}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
