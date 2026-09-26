import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import worker from "./worker.js";

const envFile = fileURLToPath(new URL("./.env.local", import.meta.url));
try {
  process.loadEnvFile(envFile);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const port = Number(process.env.MIITHII_VOICE_API_PORT ?? 8788);
const explicitApiOrigin = process.env.MIITHII_API_ORIGIN;
const localApiOrigin = "http://127.0.0.1:8787";

async function forwardToApi(request) {
  const source = new URL(request.url);
  const targetFor = origin => new URL(`${source.pathname}${source.search}`, origin);
  const origin = explicitApiOrigin ?? localApiOrigin;
  return fetch(new Request(targetFor(origin), request));
}

const env = {
  BODHAN_API_KEY: process.env.BODHAN_API_KEY,
  BODHAN_TTS_API_KEY: process.env.BODHAN_TTS_API_KEY,
  MIITHII_API: {
    fetch: forwardToApi
  },
  ASSETS: {
    fetch() {
      return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }
  }
};

export function createVoiceDevServer(workerEnv = env) {
  return http.createServer(async (incoming, outgoing) => {
    try {
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      incoming.once("aborted", abortRequest);
      outgoing.once("close", () => {
        if (!outgoing.writableFinished) abortRequest();
      });
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(`http://127.0.0.1:${port}${incoming.url ?? "/"}`, {
        method: incoming.method,
        headers: incoming.headers,
        body,
        signal: requestController.signal
      });
      const response = await worker.fetch(request, workerEnv);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      if (!response.body) {
        outgoing.end();
        return;
      }
      await pipeline(Readable.fromWeb(response.body), outgoing);
    } catch (error) {
      const disconnected = outgoing.destroyed || error?.code === "ERR_STREAM_PREMATURE_CLOSE";
      if (!disconnected) console.error("[voice-dev-worker]", error instanceof Error ? error.message : error);
      if (!outgoing.headersSent) {
        outgoing.statusCode = 500;
        outgoing.setHeader("content-type", "application/json");
        outgoing.end(JSON.stringify({ error: "Voice development proxy failed", code: "DEV_PROXY_ERROR" }));
      } else if (!outgoing.destroyed) {
        outgoing.end();
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createVoiceDevServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Miithii voice API proxy listening on http://127.0.0.1:${port}`);
    console.log(explicitApiOrigin
      ? `Forwarding account/chat requests to ${explicitApiOrigin}`
      : `Forwarding account/chat requests to local API ${localApiOrigin}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
