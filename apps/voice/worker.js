import { handleChat } from "./server/chat.js";
import { handleDisplayText, handleStt, handleTts, prepareSpeechInput } from "./server/bodhan.js";
import { handleUsage, handleVoiceSession, json } from "./server/http.js";

export { prepareSpeechInput };

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;

    if (pathname === "/api/usage" && request.method === "GET") return handleUsage(request, env);
    if (pathname === "/api/voice/session" && request.method === "POST") return handleVoiceSession(request, env);
    if (pathname === "/api/chat" && request.method === "POST") return handleChat(request, env);
    if (pathname === "/api/display" && request.method === "POST") return handleDisplayText(request, env);
    if (pathname === "/api/stt" && request.method === "POST") return handleStt(request, env);
    if (pathname === "/api/tts" && request.method === "POST") return handleTts(request, env);
    if (pathname.startsWith("/api/")) return json({ error: "Not found", code: "NOT_FOUND" }, 404);

    return env.ASSETS.fetch(request);
  }
};
